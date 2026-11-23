#!/bin/sh
umask 077
# Do not start a snapshot while native voice owns the physical AT endpoint.
if [ -f /var/run/modem/native-audio.lock ]; then
 (flock -n 8) 8<>/var/run/modem/native-audio.lock || exit 0
fi

SCRIPT_DIR="/usr/share/modem"
. "$SCRIPT_DIR/modem_util.sh"
at_port="$1"
manufacturer="$2"
platform="$3"
define_connect="$4"

safe_port="$(printf '%s' "${at_port:-unknown}" | sed 's/[^[:alnum:]]/_/g')"
cache="/tmp/modem-info-${safe_port}.json"
# One kernel lock is shared by LuCI, MT5700 and the background monitor.
exec 9>"/var/lock/modem-info-${safe_port}.lock"
flock -n 9 || exit 0
# Recheck after acquiring the collector lock: a page may have just become active.
if [ "$5" = monitor ]; then
    sh "$SCRIPT_DIR/modem_overview.sh" status && exit 0
fi
tmp="${cache}.new.$$"
collector_pid=""
capture="${cache}.at.$$"
if [ "$manufacturer" = tdtech ]; then
    mkdir -p "$capture" || exit 1
    export MODEM_OVERVIEW_CAPTURE_DIR="$capture"
fi
cleanup() {
    [ -n "$collector_pid" ] && kill "$collector_pid" 2>/dev/null
    rm -f "$tmp" "$tmp.full" "$tmp.owner"
    rm -rf "$capture"
    read uptime rest < /proc/uptime
    printf '%s\n' "${uptime%%.*}" > /var/run/modem/overview-completed
}
trap cleanup EXIT
trap 'exit 1' INT TERM

# A logical name alone cannot distinguish USB replacement or alias recreation.
[ "$at_port" = /dev/modem-at ] || exit 0
snapshot_owner="$(m_snapshot_owner)" || exit 1
# Reject a page refresh queued for a previous USB owner.
if [ -n "${MODEM_AT_EXPECTED_OWNER:-}" ] && [ "$snapshot_owner" != "$MODEM_AT_EXPECTED_OWNER" ]; then
    exit 1
fi

snapshot_parameters_current()
{
 local section actual_manufacturer actual_platform actual_context
 section="$(printf '%s' "$snapshot_owner" | jq -er '.section')" || return 1
 case "$section" in ''|*[!A-Za-z0-9_]*) return 1 ;; esac
 actual_manufacturer="$(printf '%s' "$snapshot_owner" | jq -er '.manufacturer | ascii_downcase')" || return 1
 actual_platform="$(printf '%s' "$snapshot_owner" | jq -er '.platform')" || return 1
 actual_context="$(uci -q get modem.${section}.define_connect)" || return 1
 case "$actual_context" in ''|0*|*[!0-9]*) return 1 ;; esac
 [ "$(printf '%s' "$manufacturer" | tr 'A-Z' 'a-z')" = "$actual_manufacturer" ] &&
 [ "$platform" = "$actual_platform" ] && [ "$define_connect" = "$actual_context" ] &&
 [ "$(m_snapshot_owner)" = "$snapshot_owner" ]
}
snapshot_parameters_current || exit 1
export MODEM_AT_EXPECTED_OWNER="$snapshot_owner"


# The same bounded, generation-checked lifecycle covers basic and optional reads.
collect_owned() {
    local limit="$1" sample="$2" output="$3" phase="${4:-}" result
    [ "$(m_snapshot_owner)" = "$snapshot_owner" ] || return 1
    set -- "$at_port" "$manufacturer" "$platform" "$define_connect"
    [ -z "$phase" ] || set -- "$@" "$phase"
    timeout "$limit" sh "$SCRIPT_DIR/$sample" "$@" >"$output" &
    collector_pid=$!
    while kill -0 "$collector_pid" 2>/dev/null; do
        sleep 1
        if [ "$(m_snapshot_owner)" != "$snapshot_owner" ]; then
            kill "$collector_pid" 2>/dev/null
            wait "$collector_pid" 2>/dev/null
            collector_pid=""
            return 1
        fi
    done
    wait "$collector_pid"; result=$?
    collector_pid=""
    [ "$result" = 0 ] && [ "$(m_snapshot_owner)" = "$snapshot_owner" ]
}
collect_owned 45 modem_info.sh "$tmp" || exit 1
[ "$(m_snapshot_owner)" = "$snapshot_owner" ] || exit 1

# Publish real basic identity and SIM state as soon as they are available.
# Operator, subscriber IDs and cell measurements are optional fields, while an
# all-failed AT collection must not replace the last valid native snapshot.
jq -e '
  ([.sim_info[]? | select(."SIM Status" != null) | ."SIM Status"] | first) as $s |
  (.base_info | type == "object") and (.sim_info | type == "array") and
  (.base_info.name != null and .base_info.name != "" and .base_info.name != "unknown") and
  (.base_info.manufacturer != null and .base_info.manufacturer != "" and .base_info.manufacturer != "unknown") and
  (.base_info.at_port == "/dev/modem-at") and
  (.base_info.update_time != null and .base_info.update_time != "" and .base_info.update_time != "-") and
  (.base_info.revision != null and .base_info.revision != "" and .base_info.revision != "-" and (.base_info.revision | ascii_downcase) != "unknown") and
  ($s != null and $s != "" and $s != "unknown")
' "$tmp" >/dev/null 2>&1 || exit 1

# Publish valid missing/locked/disconnected states too. Unknown/failed samples
# are rejected above, but a previous connected snapshot must not hide removal.

publish_snapshot() {
    [ "$(m_snapshot_owner)" = "$snapshot_owner" ] || return 1
    if [ "$manufacturer" = tdtech ]; then
        # Only complete command records are merged. Primary and supplemental
        # responses remain from this same collection, protected by lock 9.
        jq -s 'reduce .[] as $r ({}; . + $r)' "$capture"/*.json > "$capture/responses" || return 1
        jq --slurpfile responses "$capture/responses" '. + {overview_at: $responses[0]}' "$tmp" > "$tmp.full" || return 1
    else
        cp "$tmp" "$tmp.full" || return 1
    fi
    jq --argjson owner "$snapshot_owner" '. + {_native_owner:$owner}' "$tmp.full" > "$tmp.owner" || return 1
    [ "$(m_snapshot_owner)" = "$snapshot_owner" ] || return 1
    if cmp -s "$tmp.owner" "$cache"; then rm -f "$tmp.owner"; else mv -f "$tmp.owner" "$cache"; fi
}
# Publish the completed basic collection immediately. Optional webui commands
# may be slow or unsupported; they cannot retract this valid snapshot.
publish_snapshot || exit 1
if [ "$manufacturer" = tdtech ]; then
    collect_owned 15 modem_info_sample.sh /dev/null extra >/dev/null 2>&1 || true
    publish_snapshot || exit 1
fi
# Retire obsolete physical-port generations only after the logical snapshot is
# safely published.  There is therefore never an empty-cache interval.
if [ "$at_port" = "/dev/modem-at" ]; then
	rm -f /tmp/modem-info-_dev_ttyUSB[0-9].json \
		/tmp/modem-info-_dev_ttyUSB1[0-2].json 2>/dev/null
fi
exit 0
