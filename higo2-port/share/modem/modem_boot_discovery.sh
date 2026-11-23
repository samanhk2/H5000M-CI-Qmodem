#!/bin/sh
# One native reconciliation after procd startup. USB/net/character producers
# submit later generations. A queued reload never counts as readiness.
. /usr/share/modem/modem_scan.sh
mkdir -p "$MODEM_RUNDIR" || exit 1
status_file="$MODEM_RUNDIR/boot-discovery.status"
status() { printf '%s\n' "$1" > "$status_file"; }
(
    # Only Quectel USB recovery can hold lifecycle while entering procd.
    # Keep the accepted TD5700 discovery sequence unchanged.
    lock_owner="$(/usr/libexec/modem/at --owner 2>/dev/null)" || lock_owner=""
    lock_vendor="$(printf '%s' "$lock_owner" | jq -r '.manufacturer // empty' 2>/dev/null)"
    if [ "$lock_vendor" = quectel ]; then
        flock -x 8 || exit 1
        flock -x 7 || exit 1
        [ "$(/usr/libexec/modem/at --owner 2>/dev/null)" = "$lock_owner" ] || {
            status owner-changed
            exit 1
        }
    else
        # Block on actual lock release instead of retrying startup every five seconds.
        flock -x 7 || exit 1
        flock -x 8 || exit 1
    fi
    flock -x 9 || exit 1
    owner="$(/usr/libexec/modem/at --owner 2>/dev/null)" || owner=""
    if [ -n "$owner" ] && [ -e /tmp/modem-service-ready ] &&
       [ "$(cat "$MODEM_RUNDIR/service-owner.json" 2>/dev/null)" = "$owner" ]; then
        status ready
        exit 0
    fi
    if [ -z "$owner" ] || ! printf '%s' "$owner" | jq -e '.model | type=="string" and length>0 and .!="unknown"' >/dev/null; then
        if ! m_reconcile_present_networks; then
            status failed
            logger -p daemon.err -t modem 'Native modem discovery failed'
            exit 1
        fi
    fi
    owner="$(/usr/libexec/modem/at --owner 2>/dev/null)" || {
        status waiting-enumeration
        exit 0
    }
    if ! printf '%s' "$owner" | jq -e '.model | type=="string" and length>0 and .!="unknown"' >/dev/null; then
        status waiting-identity
        exit 0
    fi
    [ "$(/usr/libexec/modem/at --owner)" = "$owner" ] || {
        status owner-changed
        exit 1
    }
    # The native boot recovery owns this USB retirement. Re-entering the
    # service while the same reset generation is pending cannot advance it.
    m_boot_recovery_pending "$owner"
    recovery_pending=$?
    case "$recovery_pending" in
        0) status waiting-enumeration; exit 0 ;;
        1) ;;
        *) status failed; exit 1 ;;
    esac
    if [ -e /tmp/modem-service-ready ] &&
       [ "$(cat "$MODEM_RUNDIR/service-owner.json" 2>/dev/null)" = "$owner" ]; then
        status ready
        exit 0
    fi
    if [ "$(cat "$MODEM_RUNDIR/boot-discovery.notified" 2>/dev/null)" = "$owner" ]; then
        status wakeup-requested
        exit 0
    fi
    # The procd lock proves the trigger registration has completed before
    # submitting the event. The next service start verifies the real owner.
    if ! ubus call service event '{"type":"modem.discovery","data":{}}'; then
        status failed
        exit 1
    fi
    (umask 077; printf '%s\n' "$owner" > "$MODEM_RUNDIR/boot-discovery.notified.new.$$") || exit 1
    mv "$MODEM_RUNDIR/boot-discovery.notified.new.$$" "$MODEM_RUNDIR/boot-discovery.notified" || exit 1
    status wakeup-requested
) 7>/var/lock/procd_modem.lock 8>/var/lock/modem-lifecycle.lock 9>"$MODEM_RUNDIR/scan.lock"
