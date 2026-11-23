#!/bin/sh
root=/var/run/modem
mkdir -p "$root/overview-clients" /var/lock
exec 8> /var/lock/modem-overview-clients.lock
flock -x 8 || exit 1
read uptime rest < /proc/uptime
now=${uptime%%.*}
if [ "$1" = status ]; then
    active=1
    for f in "$root"/overview-clients/*; do
        [ -f "$f" ] || continue
        read stamp seq state < "$f"
        case "$stamp" in ''|*[!0-9]*) continue ;; esac
        age=$((now-stamp))
        [ "$age" -ge 0 ] && [ "$age" -lt 8 ] && [ "$state" = active ] && active=0
        [ "$age" -gt 120 ] && rm -f "$f"
    done
    exit "$active"
fi
action=$1; id=$2; seq=$3
case "$action" in active|leave) ;; *) exit 2 ;; esac
case "$id" in ''|*[!a-zA-Z0-9_-]*) exit 2 ;; esac
[ "${#id}" -le 64 ] || exit 2
case "$seq" in ''|*[!0-9]*) exit 2 ;; esac
[ "${#seq}" -le 9 ] || exit 2
f="$root/overview-clients/$id"
if [ -f "$f" ]; then
    read stamp previous state < "$f"
    [ "$seq" -gt "$previous" ] || exit 0
fi
printf '%s %s %s\n' "$now" "$seq" "$action" > "$f"
flock -u 8
exec 8>&-
# Keep the lease even when discovery is pending, then let the next poll
# refresh from the native endpoint that actually owns the modem.
[ -f /tmp/modem-service-ready ] && [ -c /dev/modem-at ] &&
    [ -S /var/run/modem/at.sock ] || exit 0
. /usr/share/modem/modem_util.sh
owner="$(m_snapshot_owner)" || exit 1
section="$(printf '%s' "$owner" | jq -er '.section')" || exit 1
case "$section" in ''|*[!A-Za-z0-9_]*) exit 1 ;; esac
manufacturer="$(printf '%s' "$owner" | jq -er '.manufacturer | ascii_downcase')" || exit 1
case "$manufacturer" in quectel|tdtech) ;; *) exit 1 ;; esac
platform="$(printf '%s' "$owner" | jq -er '.platform | select(type=="string" and length>0)')" || exit 1
define="$(uci -q get "modem.$section.define_connect")" || exit 1
case "$define" in ''|0*|*[!0-9]*) exit 1 ;; esac
[ "$(m_snapshot_owner)" = "$owner" ] || exit 1
(MODEM_AT_EXPECTED_OWNER="$owner" sh /usr/share/modem/modem_info_cache.sh /dev/modem-at "$manufacturer" "$platform" "$define" >/dev/null 2>&1) </dev/null &
exit 0
