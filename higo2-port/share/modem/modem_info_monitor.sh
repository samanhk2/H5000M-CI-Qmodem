#!/bin/sh
# Stop scheduling on shutdown without killing an in-flight collection.
trap 'exit 0' INT TERM
. /usr/share/modem/modem_util.sh
mkdir -p /var/run/modem
was_active=0
identity_retry=0
while :; do
    read uptime rest < /proc/uptime
    now=${uptime%%.*}
    completed=$(cat /var/run/modem/overview-completed 2>/dev/null)
    case "$completed" in ''|*[!0-9]*) completed=0 ;; esac
    # During USB re-enumeration, native discovery owns identity publication.
    section=""
    if [ -f /tmp/modem-service-ready ] && [ -c /dev/modem-at ] &&
       [ -S /var/run/modem/at.sock ]; then
        section="$(m_logical_modem_owner)" || section=""
    fi
    manufacturer=""
    model=""
    [ -z "$section" ] || manufacturer="$(uci -q get "modem.$section.manufacturer")"
    [ -z "$section" ] || model="$(uci -q get "modem.$section.name")"
    if [ -n "$section" ] && { [ -z "$manufacturer" ] || [ "$manufacturer" = unknown ] || [ -z "$model" ] || [ "$model" = unknown ]; } &&
       [ -S /var/run/modem/at.sock ] && [ "$now" -ge "$identity_retry" ]; then
        m_refresh_runtime_identity "$section"
        read refreshed rest < /proc/uptime
        identity_retry=$(( ${refreshed%%.*} + 10 ))
        manufacturer="$(uci -q get "modem.$section.manufacturer")"
    fi
    if sh /usr/share/modem/modem_overview.sh status; then
        was_active=1
    elif { [ "$was_active" = 1 ] || [ $((now-completed)) -ge 10 ]; } &&
       [ -c /dev/modem-at ] && [ -S /var/run/modem/at.sock ] && [ -f /tmp/modem-service-ready ]; then
        [ -n "$section" ] || { sleep 1; continue; }
        platform=$(uci -q get "modem.$section.platform")
        define=$(uci -q get "modem.$section.define_connect")
        if [ -n "$manufacturer" ] && [ "$manufacturer" != unknown ]; then
            was_active=0
            sh /usr/share/modem/modem_info_cache.sh /dev/modem-at "$manufacturer" "$platform" "${define:-1}" monitor
        fi
    fi
    sleep 1 &
    wait $!
done
