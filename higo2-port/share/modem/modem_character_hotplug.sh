#!/bin/sh
# Character-node readiness is a kernel event. The modem plugin remains the
# only owner of physical AT selection, identity queries and service activation.
[ "$ACTION" = add ] || exit 0
case "$DEVPATH" in /devices/*) ;; *) exit 0 ;; esac
. /usr/share/modem/modem_scan.sh
m_audio_hotplug_owned "/sys${DEVPATH}" "$SEQNUM" && exit 0
actual="$(readlink -f "/sys$DEVPATH")" || exit 0
[ -e "$actual" ] || exit 0
physical="$(m_get_device_physical_path "$actual")" || exit 0
[ -n "$physical" ] || exit 0
eligible=0
for entry in /sys/class/net/*; do
    [ -e "$entry" ] || continue
    record="$(m_network_discovery_record "${entry##*/}")" || continue
    IFS='|' read -r candidate network bus physical_inode network_inode ifindex device <<EOF
$record
EOF
    [ "$candidate" = "$physical" ] || continue
    eligible=$((eligible + 1))
done
# An unrelated console, WiFi PCI device or ambiguous modem cannot wake probing.
[ "$eligible" = 1 ] || exit 0
if [ -L /etc/rc.d/S95modem ] && [ ! -e /tmp/modem-boot-complete ]; then
    touch /tmp/modem-boot-pending
    [ -e /tmp/modem-boot-complete ] || exit 0
fi
exec /usr/share/modem/modem_boot_discovery.sh
