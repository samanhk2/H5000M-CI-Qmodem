#!/bin/sh
# Both native vendor pages use the same owner-serialized, verified operation.
[ "$1" = /dev/modem-at ] || exit 1
mode="$(printf '%s' "$2" | jq -er '
 def flag: if .==1 or .=="1" then true elif .==0 or .=="0" then false else error("invalid mode flag") end;
 if ((.["2G"].enable // 0)|flag) then error("unsupported GSM mode") else . end |
 . as $settings | ["3G","4G","5G"] | map(select((($settings[.].enable // 0)|flag))) | join(",") |
 {"3G":"3g-only","4G":"4g-only","5G":"5g-only","3G,4G":"4g-priority","3G,5G":"3g-5g","4G,5G":"4g-5g","3G,4G,5G":"auto"}[.] // error("empty mode selection")
')" || exit 1
encoded="$(printf '{"mode":"%s"}' "$mode" | base64 | tr -d '=\n' | tr '+/' '-_')" || exit 1
owner="$(/usr/libexec/modem/at --owner)" || exit 1
if [ -n "$MODEM_AT_EXPECTED_OWNER" ]; then
    printf '%s' "$owner" | jq -e --argjson expected "$MODEM_AT_EXPECTED_OWNER" '. == $expected' >/dev/null || exit 1
fi
MODEM_AT_EXPECTED_OWNER="$owner" /usr/libexec/modem/at /dev/modem-at "AT+MWUINETWORKMODESETTINGS=$encoded"
