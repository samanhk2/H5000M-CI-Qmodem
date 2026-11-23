#!/bin/sh
# Native discovery uses current hardware ancestry, never interface-name prefixes.
SCRIPT_DIR="${IPKG_INSTROOT:-}/usr/share/modem"
. "${SCRIPT_DIR}/modem_util.sh"

m_network_discovery_record()
{
 local network="$1" entry event device physical bus physical_inode network_inode ifindex
 case "$network" in ''|*[!A-Za-z0-9_.:-]*) return 1 ;; esac
 entry="/sys/class/net/$network"
 [ -e "$entry" ] || return 1
 event="$(readlink -f "$entry")" || return 1
 device="$(readlink -f "$entry/device")" || return 1
 # A QMAP/data child belongs to its parent netdev; it is not a second modem.
 [ ! -r "$device/ifindex" ] || return 1
 bus="$(m_net_event_bus add "$network" "$event")" || return 1
 physical="$(m_get_device_physical_path "$event")" || return 1
 physical_inode="$(m_kernel_inode "$physical")" || return 1
 network_inode="$(m_kernel_inode "$entry")" || return 1
 ifindex="$(cat "$entry/ifindex")" || return 1
 case "$ifindex" in ''|*[!0-9]*) return 1 ;; esac
 printf '%s|%s|%s|%s|%s|%s|%s\n' "$physical" "$network" "$bus" "$physical_inode" "$network_inode" "$ifindex" "$device"
}

m_reconcile_present_networks()
{
 local entry network row records="" count physical bus physical_inode network_inode ifindex device
 # At S95 UCI is available. Reconcile devices whose early net hotplug event
 # arrived before the UCI provider, including a clean sysupgrade with no rows.
 ubus call uci get '{"config":"modem"}' >/dev/null || return 1
 for entry in /sys/class/net/*; do
  [ -e "$entry" ] || continue
  network="${entry##*/}"
  row="$(m_network_discovery_record "$network")" || continue
  records="${records}${records:+
}$row"
 done
 count="$(printf '%s\n' "$records" | awk 'NF {n++} END {print n+0}')"
 [ "$count" != 0 ] || return 0
 [ "$count" = 1 ] || { logger -t modem 'Multiple eligible modem data links; discovery refused'; return 1; }
 IFS='|' read -r physical network bus physical_inode network_inode ifindex device <<EOF
$records
EOF
 [ "$(m_network_discovery_record "$network")" = "$records" ] || { logger -t modem 'Modem hardware enumeration changed before reconciliation'; return 1; }
 # Only the modem plugin creates the record and publishes its AT endpoint.
 # Do not recursively reload procd here; this same start_service will dial.
 m_set_physical_device scan "$network" "$physical"
}

modem_scan()
{
 mkdir -p "$MODEM_RUNDIR" || return 1
 (
  flock -n 9 || exit 1
  m_reconcile_present_networks || exit 1
  local owner section network
  owner="$(/usr/libexec/modem/at --owner)" || exit 1
  section="$(printf '%s' "$owner" | jq -er '.section')" || exit 1
  case "$section" in ''|*[!A-Za-z0-9_]*) exit 1 ;; esac
  network="$(uci -q get modem.${section}.network)" || exit 1
  enable_dial "$network"
 ) 9>"${MODEM_RUNDIR}/scan.lock"
}
