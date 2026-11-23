#!/bin/sh
# Native LuCI and Higo share the current owner's verified band operations.
[ "$2" = /dev/modem-at ] || exit 1
owner="$(/usr/libexec/modem/at --owner)" || exit 1
if [ -n "$MODEM_AT_EXPECTED_OWNER" ]; then
    printf '%s' "$owner" | jq -e --argjson expected "$MODEM_AT_EXPECTED_OWNER" '. == $expected' >/dev/null || exit 1
fi
export MODEM_AT_EXPECTED_OWNER="$owner"
case "$1" in
get)
    modes="$(/usr/libexec/modem/at /dev/modem-at 'AT+MWUINETWORKMODESETTINGS?')" || exit 1
    bands="$(/usr/libexec/modem/at /dev/modem-at 'AT+MWUIBANDSETTINGS?')" || exit 1
    jq -en --argjson modes "$modes" --argjson bands "$bands" '
      def items($kind;$prefix):
        ($bands.lockband[$kind] // {available_band:[],lock_band:[]}) as $group |
        [$group.available_band[] | (.band_id|tostring) as $id |
          {($prefix+$id): (if ($group.lock_band|map(tostring)|index($id)) == null then 0 else 1 end)}];
      {network_prefer:[
        {"3G":{enable:(if ($modes.selectedNetworks|index("3G"))==null then 0 else 1 end),band:items("WCDMA";"WCDMA_B")}},
        {"4G":{enable:(if ($modes.selectedNetworks|index("4G"))==null then 0 else 1 end),band:items("LTE";"LTE_BC")}},
        {"5G":{enable:(if ($modes.selectedNetworks|index("5G"))==null then 0 else 1 end),band:(items("NR";"NR5G_N")+items("NR5G-SA";"NR5G_SA_N")+items("NR5G-NSA";"NR5G_NSA_N"))}}
      ] | map(select((keys[0]) as $rat | ($modes.supportedNetworks|index($rat)) != null))}'
    ;;
set)
    request="$(printf '%s' "$3" | jq -ec '
      def flag: if .==1 or .=="1" then true elif .==0 or .=="0" then false else error("invalid band flag") end;
      if type!="object" or any(keys[]; .!="3G" and .!="4G" and .!="5G") then error("invalid network family") else . end |
      [to_entries[] | select(.key=="3G" or .key=="4G" or .key=="5G") |
        select(.value.enable|flag) | .key as $rat | .value.band[] | to_entries[] |
        .key as $key | (.value|flag) as $selected |
        if ($key | test("^(WCDMA_B|LTE_BC|NR5G_N|NR5G_SA_N|NR5G_NSA_N)[0-9]+$")) then . else error("invalid band key") end |
        ($key | capture("^(?<prefix>WCDMA_B|LTE_BC|NR5G_N|NR5G_SA_N|NR5G_NSA_N)(?<id>[0-9]+)$")) as $parts |
        {class:({WCDMA_B:"WCDMA",LTE_BC:"LTE",NR5G_N:"NR",NR5G_SA_N:"NR5G-SA",NR5G_NSA_N:"NR5G-NSA"}[$parts.prefix]), id:$parts.id, selected:$selected, rat:$rat} |
        if (.class=="WCDMA" and .rat!="3G") or (.class=="LTE" and .rat!="4G") or ((.class|startswith("NR")) and .rat!="5G") then error("band family mismatch") else . end] |
      group_by(.class) | map({band_class:.[0].class,lock_band:([.[]|select(.selected)|.id]|join(","))}) |
      if length==0 or any(.lock_band=="") then error("empty band selection") else {changes:.} end
    ')" || exit 1
    encoded="$(printf '%s' "$request" | base64 | tr -d '=\n' | tr '+/' '-_')" || exit 1
    /usr/libexec/modem/at /dev/modem-at "AT+MWUIBANDSETTINGS=$encoded"
    ;;
*) exit 1 ;;
esac
