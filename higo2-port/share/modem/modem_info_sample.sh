#!/bin/sh
# Reuse each response inside one sample; every command still uses modem/at.
if [ "$5" != extra ]; then
    sh /usr/share/modem/modem_info.sh "$@" || exit $?
fi
if [ "$2" = tdtech ]; then
    for command in 'AT+CFUN?' 'AT+CGREG?' 'AT+CPIN?' 'AT+CNUM' 'AT^HCSQ?' 'AT^MONSC' 'AT^HFREQINFO?' 'AT^EONS=2' 'AT^CHIPTEMP?' 'AT^DHCP?' 'AT^DHCPV6?' 'AT^IPV6CAP?' 'AT^SETAUTODIAL?' 'AT+CGEQOSRDP' 'AT+CGEQOSRDP=1' 'AT^DSAMBR=1' 'AT^MCS=0' 'AT^MCS=1' 'AT^DSFLOWQRY'; do
        sh /usr/share/modem/modem_at.sh "$1" "$command" >/dev/null
    done
fi
