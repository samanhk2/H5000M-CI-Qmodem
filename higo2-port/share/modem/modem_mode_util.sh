#!/bin/sh
# Shared mode transport. Only the native modem owner chooses the serial device.
m_mode_owner()
{
 case "$2" in quectel|tdtech) ;; *) echo "仅支持移远和鼎桥模组" >&2;return 1 ;; esac
 [ "$1" = /dev/modem-at ] || { echo 'Mode operations require the logical AT endpoint' >&2;return 1; }
 local proof expected="$MODEM_AT_EXPECTED_OWNER"
 proof="$(/usr/libexec/modem/at --owner)" || return 1
 printf '%s' "$proof" | jq -e --arg manufacturer "$2" '.manufacturer==$manufacturer and (.section|type=="string") and (.platform|type=="string")' >/dev/null || return 1
 if [ -n "$expected" ];then jq -n -e --argjson actual "$proof" --argjson expected "$expected" '$actual==$expected' >/dev/null || return 1;fi
 [ -z "$3" ] || [ "$(printf '%s' "$proof" | jq -r .platform)" = "$3" ] || return 1
 printf '%s\n' "$proof"
}
m_mode_transaction()
{
 local proof="$1" command="$2" request response
 if [ -n "$MODEM_OVERVIEW_CAPTURE_DIR" ];then
  case "$command" in 'AT+QCFG="usbnet"'|'AT^SETMODE?') MODEM_AT_EXPECTED_OWNER="$proof" sh "${SCRIPT_DIR}/modem_at.sh" /dev/modem-at "$command";return $?;;esac
 fi
 request="$(jq -n --argjson owner "$proof" --arg command "$command" '{port:"/dev/modem-at",owner:$owner,profile:$owner.manufacturer,commands:[$command],timeout:5,baud:115200}')" || return 1
 response="$(printf '%s' "$request" | /usr/libexec/modem/at --json)"
 [ -n "$response" ] || return 1
 printf '%s' "$response" | jq -er 'if (.error // "")!="" then error(.error) elif (.result|type)=="string" then .result else error("native AT result missing") end' 
}
m_mode_set_value()
{
 local proof="$1" mode_num="$2" snapshot revision payload encoded
 snapshot="$(m_mode_transaction "$proof" 'AT+MWUIDEVICESETTINGS?')" || return 1
 revision="$(printf '%s' "$snapshot" | jq -er '.revision | select(type=="string" and length==64) | select(explode | all((.>=48 and .<=57) or (.>=97 and .<=102)))')" || return 1
 payload="$(jq -n --arg revision "$revision" --arg value "$mode_num" '{revision:$revision,field:"usbMode",value:$value}')" || return 1
 encoded="$(printf '%s' "$payload" | jq -Rs -r '@base64' | tr '+/' '-_' | tr -d '=')" || return 1
 m_mode_transaction "$proof" "AT+MWUIDEVICESETTINGS=$encoded"
}
m_hisilicon_mode_number()
{
 printf '%s\n' "$1" | tr -d '\r' | awk '
 /^ERROR$|ERROR:/ {bad=1}
 /^OK$/ {ok=1}
 /^\^SETMODE:[[:space:]]*[0-9]+[[:space:]]*$/ {sub(/^\^SETMODE:[[:space:]]*/,"");gsub(/[[:space:]]/,"");value=$0;count++;next}
 /^[0-9]+$/ {value=$0;count++}
 END {if(ok&&!bad&&count==1)print value;else exit 1}'
}
m_hisilicon_mode_label()
{
 case "$1" in 0|2) echo ecm;;1|3|4|5) echo ncm;;6)echo rndis;;7)echo mbim;;8)echo ppp;;*)printf '%s\n' "$1";;esac
}
