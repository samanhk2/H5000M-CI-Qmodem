#!/bin/sh
# Copyright (C) 2023 Siriling <siriling@qq.com>

#脚本目录
SCRIPT_DIR="${IPKG_INSTROOT:-}/usr/share/modem"

#运行目录
MODEM_RUNDIR="/var/run/modem"
MODEM_PID_FILE="${MODEM_RUNDIR}/modem.pid"
MODEM_CDC_WDM_CACHE="${MODEM_RUNDIR}/cdc_wdm.cache"
MODEM_PHYSICAL_DEVICE_CACHE="${MODEM_RUNDIR}/physical_device.cache"
MODEM_EVENTS_CACHE="${MODEM_RUNDIR}/events.cache"

# A native audio rebind owns only its actual USB path and generated event
# interval. USB, net and late character discovery share this same guard.
m_audio_hotplug_owned()
{
 local event_path="$1" sequence="$2" audio_path audio_start audio_end
 [ -f /var/run/modem/native-audio.lock ] || return 1
 audio_path="$(cat /var/run/modem/native-audio.lock)"
 case "$audio_path" in /sys/devices/*) ;; *) return 1 ;; esac
 case "$audio_path" in *..*|*[[:space:]]*) return 1 ;; esac
 case "$event_path" in
  "$audio_path"|"$audio_path"/*|"$audio_path":*)
   (flock -n 9) 9<>/var/run/modem/native-audio.lock || return 0
   audio_start="$(cat /var/run/modem/native-audio.start 2>/dev/null)"
   audio_end="$(cat /var/run/modem/native-audio.end 2>/dev/null)"
   case "$sequence:$audio_start:$audio_end" in
    *[!0-9:]*|:*|*::*|*:) ;;
    *) [ "$sequence" -gt "$audio_start" ] && [ "$sequence" -le "$audio_end" ] && return 0 ;;
   esac ;;
 esac
 return 1
}

# Import OpenWrt runtime helpers only on the running router. During image
# construction IPKG_INSTROOT is set and target libraries must not be sourced
# by the build host shell.
if [ -z "${IPKG_INSTROOT:-}" ]; then
	[ -r /lib/functions.sh ] && . /lib/functions.sh
	[ -r /lib/netifd/netifd-proto.sh ] && . /lib/netifd/netifd-proto.sh
	[ -r "${SCRIPT_DIR}/modem_debug.sh" ] && . "${SCRIPT_DIR}/modem_debug.sh"
fi

# ECM lends an on-link /64 to LAN. Manage only the NDP sections we own;
# preserve the user's LAN setting and other DHCP/RA configuration.
sync_ecm_ndp()
{
 mkdir -p "$MODEM_RUNDIR"
 (
 flock -x 9 || exit 1
 local number="$1" section="modem_ndp_$1" upstream="$2" owned previous config roles logical lan_section live plan active=0 candidate users
 case "$number" in ''|*[!0-9]*) exit 1 ;; esac
 config="$(ubus call uci get '{"config":"dhcp"}')" || exit 1
 owned="$(uci -q get dhcp.${section}.modem_managed)" || owned=''
 if [ "$mode" = ecm ] && [ "$pdp_type" != ipv4 ]; then
  plan="$(/usr/libexec/modem/at --interface-plan "$(uci -q get modem.modem${number}.network_interface)")" || exit 1
  [ "$(printf '%s' "$plan" | jq -r '.owner.section')" = "modem${number}" ] || exit 1
  [ -n "$upstream" ] || upstream="$(printf '%s' "$plan" | jq -r '.ipv6')"
  [ "$upstream" = "$(printf '%s' "$plan" | jq -r '.ipv6')" ] || exit 1
  # Disabled alternate data clients do not lend IPv6 onto the management LAN.
  [ "$(uci -q get network.${upstream}.disabled)" = 1 ] || active=1
 fi
 if [ "$active" = 1 ]; then
  roles="$(ubus call uci get '{"config":"easymesh"}')" || exit 1
  logical="$(printf '%s' "$roles" | jq -er '[.values[] | select(.[".type"]=="device") | .lan_network] | if length==1 and (.[0]|type)=="string" then .[0] else error("LAN role missing or ambiguous") end')" || exit 1
  case "$logical" in ''|*[!A-Za-z0-9_]*) exit 1 ;; esac
  [ "$logical" != "$upstream" ] && [ "$(uci -q get network.${logical})" = interface ] || exit 1
  live="$(ubus call network.interface.${logical} status)" || exit 1
  printf '%s' "$live" | jq -e '.up==true' >/dev/null || exit 1
  candidate="$(printf '%s' "$live" | jq -er '.l3_device')" || exit 1
  case "$candidate" in ''|*[!A-Za-z0-9_.:-]*) exit 1 ;; esac
  [ -e "/sys/class/net/$candidate" ] || exit 1
  lan_section="$(printf '%s' "$config" | jq -er --arg logical "$logical" '[.values | to_entries[] | select(.value[".type"]=="dhcp" and .value.interface==$logical) | .key] | if length==1 then .[0] else error("LAN DHCP owner missing or ambiguous") end')" || exit 1
  case "$lan_section" in ''|*[!A-Za-z0-9_]*) exit 1 ;; esac
  if uci -q get dhcp.${section} >/dev/null && [ "$owned" != 1 ]; then
   logger -t modem "NDP section belongs to user; leaving it unchanged"; exit 1
  fi
  previous="$(uci -q get dhcp.${section}.managed_lan_section)" || previous=''
  [ -z "$previous" ] || [ "$previous" = "$lan_section" ] || { logger -t modem "Managed LAN role changed; retire the previous NDP binding first"; exit 1; }
  if [ "$(uci -q get dhcp.${lan_section}.ndp)" != relay ]; then
   if [ "$(uci -q get dhcp.${lan_section}.modem_ndp_managed)" != 1 ]; then
    uci set dhcp.${lan_section}.modem_ndp_previous="$(uci -q get dhcp.${lan_section}.ndp)"
    uci set dhcp.${lan_section}.modem_ndp_managed=1
   fi
   uci set dhcp.${lan_section}.ndp=relay
  fi
  uci set dhcp.${section}=dhcp
  uci set dhcp.${section}.modem_managed=1
  uci set dhcp.${section}.managed_lan_section="$lan_section"
  uci set dhcp.${section}.interface="$upstream"
  uci set dhcp.${section}.master=1
  uci set dhcp.${section}.ndproxy_routing=0
  uci set dhcp.${section}.ndp=relay
  uci set dhcp.${section}.ra=disabled
  uci set dhcp.${section}.dhcpv6=disabled
 else
  [ "$owned" != 1 ] || uci -q delete dhcp.${section}
  # Restore explicitly marked DHCP owners, including older records without a
  # guessed section name. A surviving unscoped old relay prevents restoration.
  config="$(ubus call uci get '{"config":"dhcp"}')" || exit 1
  for lan_section in $(printf '%s' "$config" | jq -r '.values | to_entries[] | select(.value[".type"]=="dhcp" and .value.modem_ndp_managed=="1") | .key'); do
   case "$lan_section" in ''|*[!A-Za-z0-9_]*) exit 1 ;; esac
   users="$(printf '%s' "$config" | jq -r --arg lan "$lan_section" '[.values[] | select(.modem_managed=="1" and ((.managed_lan_section // "")=="" or .managed_lan_section==$lan))] | length')" || exit 1
   [ "$users" = 0 ] || continue
   previous="$(uci -q get dhcp.${lan_section}.modem_ndp_previous)" || previous=''
   if [ "$(uci -q get dhcp.${lan_section}.ndp)" = relay ]; then
    if [ -n "$previous" ]; then uci set dhcp.${lan_section}.ndp="$previous"; else uci -q delete dhcp.${lan_section}.ndp; fi
   fi
   uci -q delete dhcp.${lan_section}.modem_ndp_managed
   uci -q delete dhcp.${lan_section}.modem_ndp_previous || :
  done
 fi
 if [ -n "$(uci -q changes dhcp)" ]; then
  uci commit dhcp || exit 1
  /etc/init.d/odhcpd reload
 fi
 ) 9>"${MODEM_RUNDIR}/ndp.lock"
}

# Select only this native plugin's exact data jobs, never any matching argv.
m_native_dial_instances()
{
 local number="$1" network="$2"
 case "$number" in ''|0[0-9]*|*[!0-9]*) return 1 ;; esac
 ubus call service list '{"name":"modem"}' | jq --arg network "$network" --arg number "$number" --arg directory "$MODEM_RUNDIR" '
 [.modem.instances // {} | to_entries[] | select((.value.command // []) as $c |
 (($c[1]=="/usr/share/modem/modem_network_task.sh" and $c[3]==$number) or
 ((($c[0] // "") | split("/") | last)=="quectel-CM" and
 ($c | to_entries | any(.key as $i | .value=="-i" and $c[$i+1]==$network and $network!="")) and
 ($c | to_entries | any(.key as $i | .value=="-f" and $c[$i+1]==($directory+"/modem"+$number+"_dial.cache"))))))]'
}

# Native section numbering is an allocation contract, never a discovery order.
m_modem_section_for_path()
{
 local path="$1" config section number
 case "$path" in /sys/devices/*) ;; *) return 1 ;; esac
 case "$path" in *..*|*[[:space:]]*) return 1 ;; esac
 config="$(ubus call uci get '{"config":"modem"}')" || return 1
 section="$(printf '%s' "$config" | jq -er --arg path "$path" '[.values | to_entries[] | select(.value[".type"]=="modem-device" and .value.path==$path) | .key] | if length==1 then .[0] else error("physical modem owner missing or ambiguous") end')" || return 1
 case "$section" in modem*) ;; *) return 1 ;; esac
 number="${section#modem}"
 case "$number" in ''|0[0-9]*|*[!0-9]*) return 1 ;; esac
 [ "${#number}" -le 4 ] && [ "$number" -lt 1024 ] || return 1
 printf '%s\n' "$section"
}

m_removed_modem_section()
{
 local network="$1" event="$2" config section physical
 case "$network" in ''|*[!A-Za-z0-9_.:-]*) return 1 ;; esac
 case "$event" in /sys/devices/*) ;; *) return 1 ;; esac
 case "$event" in *..*|*[[:space:]]*) return 1 ;; esac
 config="$(ubus call uci get '{"config":"modem"}')" || return 1
 section="$(printf '%s' "$config" | jq -er --arg network "$network" --arg event "$event" '[.values | to_entries[] | select(.value[".type"]=="modem-device" and .value.network==$network and (.value.path|type)=="string") | .value.path as $physical | select($event | startswith($physical+"/")) | .key] | if length==1 then .[0] else error("removed modem binding missing or ambiguous") end')" || return 1
 physical="$(uci -q get modem.${section}.path)"
 [ "$(m_modem_section_for_path "$physical")" = "$section" ] || return 1
 printf '%s\n' "$section"
}

# Removal is not a request to disable the saved dial profile. Stop its procd
# instance, bring down stale logical interfaces and restore NDP immediately.
m_suspend_network()
{
 local network="$1" event_path="$2" config section number physical
 case "$network" in ''|*[!A-Za-z0-9_.:-]*) return 1 ;; esac
 case "$event_path" in /sys/devices/*) ;; *) return 1 ;; esac
 case "$event_path" in *..*|*[[:space:]]*) return 1 ;; esac
 # A live name/path can already be a replacement generation. Never tear it
 # down for an older queued remove event.
 [ ! -e "/sys/class/net/$network" ] && [ ! -e "$event_path" ] || return 1
 section="$(m_removed_modem_section "$network" "$event_path")" || return 1
 physical="$(uci -q get modem.${section}.path)"
 case "$event_path" in "$physical"/*) ;; *) return 1 ;; esac
 [ "$(m_modem_section_for_path "$physical")" = "$section" ] || return 1
 number="${section#modem}"
 /etc/init.d/modem suspend_modem "$number" "" "$event_path" "$physical" "$network"
}

#日志
# $1:日志等级
m_log()
{
	local level="$1";
	logger -p "daemon.${level}" -t "Modem[$$]" "hotplug: $*"
}

#上报USB事件
# $1:事件行为（add，remove，bind）
# $2:类型
# $3:名称或设备ID
# $4:路径
m_report_event()
{
	local action="$1"
	local type="$2"
	local name="$3"
	local physical_path="$4"

	#缓存事件信息
	echo "${action},${type},${name},${physical_path}" >> "${MODEM_EVENTS_CACHE}"
	#输出事件处理日志
	m_log "debug" "event reported: action=${action}, type=${type}, name=${name}"
}

#获取设备物理路径
# $1:网络设备路径
m_get_device_physical_path()
{
	local tmp_path="$1"

	while true; do
		tmp_path=$(dirname "${tmp_path}")

		#跳出循环条件
		[ -z "${tmp_path}" ] || [ "${tmp_path}" = "/" ] && return

		#USB设备
		[ -f "${tmp_path}"/idVendor ] && [ -f "${tmp_path}"/idProduct ] && {
			tmp_path=$(readlink -f "$tmp_path")
			echo "${tmp_path}"
			return
		}

		#PCIE设备
		[ -f "${tmp_path}"/vendor ] && [ -f "${tmp_path}"/device ] && {
			tmp_path=$(readlink -f "$tmp_path")
			echo "${tmp_path}"
			return
		}
	done
}

#删除物理路径状态
# $1:设备物理路径
m_del_physical_path_status()
{
 local physical_path="$1"
 mkdir -p "$MODEM_RUNDIR"
 (
  flock -x 7 || exit 1
  [ -f "$MODEM_PHYSICAL_DEVICE_CACHE" ] || exit 0
  umask 077
  awk -F, -v path="$physical_path" '$1!=path' "$MODEM_PHYSICAL_DEVICE_CACHE" > "${MODEM_PHYSICAL_DEVICE_CACHE}.new.$$" || exit 1
  mv "${MODEM_PHYSICAL_DEVICE_CACHE}.new.$$" "$MODEM_PHYSICAL_DEVICE_CACHE"
 ) 7>"${MODEM_RUNDIR}/physical-cache.lock"
}

m_get_physical_path_status()
{
 local physical_path="$1" inode boot value
 [ -f "$MODEM_PHYSICAL_DEVICE_CACHE" ] || return 1
 inode="$(m_kernel_inode "$physical_path")" || return 1
 boot="$(cat /proc/sys/kernel/random/boot_id)" || return 1
 [ -n "$boot" ] || return 1
 value="$(awk -F, -v path="$physical_path" -v inode="$inode" -v boot="$boot" '$1==path && $3==inode && $4==boot {value=$2;n++} END {if(n==1)print value;else exit 1}' "$MODEM_PHYSICAL_DEVICE_CACHE")" || return 1
 [ "$(m_kernel_inode "$physical_path")" = "$inode" ] || return 1
 printf '%s\n' "$value"
}

m_set_physical_path_status()
{
 local physical_path="$1" status="$2" inode boot
 inode="$(m_kernel_inode "$physical_path")" || return 1
 boot="$(cat /proc/sys/kernel/random/boot_id)" || return 1
 [ -n "$boot" ] || return 1
 mkdir -p "$MODEM_RUNDIR"
 (
  flock -x 7 || exit 1
  umask 077
  if [ -f "$MODEM_PHYSICAL_DEVICE_CACHE" ]; then
   awk -F, -v path="$physical_path" '$1!=path' "$MODEM_PHYSICAL_DEVICE_CACHE" > "${MODEM_PHYSICAL_DEVICE_CACHE}.new.$$" || exit 1
  else : > "${MODEM_PHYSICAL_DEVICE_CACHE}.new.$$";fi
  [ "$(m_kernel_inode "$physical_path")" = "$inode" ] || { rm -f "${MODEM_PHYSICAL_DEVICE_CACHE}.new.$$";exit 1; }
  printf '%s,%s,%s,%s\n' "$physical_path" "$status" "$inode" "$boot" >> "${MODEM_PHYSICAL_DEVICE_CACHE}.new.$$" || exit 1
  mv "${MODEM_PHYSICAL_DEVICE_CACHE}.new.$$" "$MODEM_PHYSICAL_DEVICE_CACHE"
 ) 7>"${MODEM_RUNDIR}/physical-cache.lock"
}

#缓存cdc-wdm
# $1:网络设备
m_cdc_wdm_cache()
{
	local network="$1"

    #获取cdc-wdm
	local cdc_wdm=$(ls "/sys/class/net/${network}/device/usbmisc/")
    [ -z "${cdc_wdm}" ] && return

    #缓存
	echo "${network},${cdc_wdm}" >> "${MODEM_CDC_WDM_CACHE}"

	echo "${cdc_wdm}"
}

#取消缓存cdc-wdm
# $1:网络设备
m_cdc_wdm_del_cache()
{
	local wwan="$1"

	[ -f "${MODEM_CDC_WDM_CACHE}" ] || return

    #获取cdc-wdm（不包含注释并且包含network的行，获取以,分割的第二个字符串）
	local cdc_wdm=$(awk -v network="${network}" -F',' '!/^#/ && $1 == network { print $2 }' "${MODEM_CDC_WDM_CACHE}")
	[ -n "${cdc_wdm}" ] || return

	#取消缓存
	sed -i "/${network},${cdc_wdm}/d" "${MODEM_CDC_WDM_CACHE}"

	echo "${cdc_wdm}"
}

#cdc-wdm处理
# $1:事件行为（add，remove，bind）
# $2:名称
# $3:路径
m_cdc_wdm()
{
	local action="$1"
	local name="$2"
	local physical_path="$4"

	#获取cdc-wdm
    local cdc_wdm=""
    #操作缓存
    case "${action}" in
        "add") cdc_wdm=$(m_cdc_wdm_cache "${name}") ;;
        "remove") cdc_wdm=$(m_cdc_wdm_del_cache "${name}") ;;
    esac

    if [ -n "${cdc_wdm}" ]; then
        #输出cdc-wdm事件处理日志
        m_log "${action} cdc interface ${cdc_wdm}: cdc-wdm event processed"
        #上报cdc-wdm事件
        m_report_event "${action}" "usbmisc" "${cdc_wdm}" "/sys${physical_path}"
    fi
}

#添加USB模组ID
# $1:制造商ID
# $2:产品ID
m_add_usb_id()
{
	local manufacturer_id="$1"
	local product_id="$2"

	# Quectel has native option serial IDs and its own QMI data driver.
	# A vendor-wide generic serial ID also claims the QMI interface.
	case "$manufacturer_id" in
		2c7c|2C7C) modprobe option 2>/dev/null; return 0 ;;
	esac

	# TDTECH_MT5700_STATIC_OPTION_ID
	[ "${manufacturer_id}:${product_id}" = "3466:3301" ] && return 0

	local new_id_path="/sys/bus/usb-serial/drivers/generic/new_id"

	#如果已经添加则返回
	grep -q "${manufacturer_id} ${product_id}" "${new_id_path}" && return

	while true; do
		if [ -f "$new_id_path" ]; then
			#添加ID
			echo "${manufacturer_id} ${product_id}" >> "${new_id_path}"
			break
		fi
		sleep 5s
	done
}

#设置模组硬件配置
# $1:物理路径
m_set_modem_hardware_config()
{
 local physical_path="$1"
 mkdir -p "$MODEM_RUNDIR"
 (
 flock -x 8 || exit 1
 local bus data_interface config matching modem_no=0 upper section count
 bus="$(readlink -f "$physical_path/subsystem")" || exit 1
 case "$bus" in /sys/bus/usb) data_interface=usb ;; /sys/bus/pci) data_interface=pcie ;; *) logger -t modem "Hardware bus ownership unavailable; discovery refused"; exit 1 ;; esac
 count=0
 for section in $(awk -F, '$2=="processed" {print $1}' "$MODEM_PHYSICAL_DEVICE_CACHE" 2>/dev/null); do
  [ "$(m_get_physical_path_status "$section")" != processed ] || count=$((count + 1))
 done
 if [ "${count:-0}" = 0 ]; then
  # Auto-discovered hardware records are regenerated; dial profiles are kept.
  sh "${SCRIPT_DIR}/modem_init.sh" || exit 1
 fi
 config="$(ubus call uci get '{"config":"modem"}')" || exit 1
 matching="$(printf '%s' "$config" | jq -r --arg path "$physical_path" '[.values | to_entries[] | select(.value[".type"]=="modem-device" and .value.path==$path) | .key] | if length==1 then .[0] elif length==0 then "" else error("duplicate physical hardware record") end')" || exit 1
 if [ -n "$matching" ]; then
  [ "$(m_modem_section_for_path "$physical_path")" = "$matching" ] || exit 1
 else
  # Default numbering is used only to allocate a genuinely unoccupied record.
  while printf '%s' "$config" | jq -e --arg section "modem${modem_no}" '.values | has($section)' >/dev/null; do
   modem_no=$((modem_no + 1));[ "$modem_no" -lt 1024 ] || exit 1
  done
  matching="modem${modem_no}"
  uci set modem.${matching}=modem-device || exit 1
  uci set modem.${matching}.data_interface="$data_interface" || exit 1
  uci set modem.${matching}.path="$physical_path" || exit 1
  upper="$(printf '%s' "$config" | jq -r '[.values | to_entries[] | select(.value[".type"]=="modem-device") | .key | select(startswith("modem")) | .[5:] | select(length>0 and all(explode[]; .>=48 and .<=57) and (.=="0" or .[0:1]!="0")) | tonumber] | if length==0 then 0 else max+1 end')" || exit 1
  [ "$upper" -gt "$modem_no" ] || upper=$((modem_no + 1))
  uci set modem.@global[0].modem_number="$upper" || exit 1
  uci commit modem || exit 1
 fi
 m_set_physical_path_status "$physical_path" processed
 ) 8>"${MODEM_RUNDIR}/enumeration.lock"
}

#删除模组配置
# $1:物理路径
m_del_modem_config()
{
 local physical_path="$1" section modem_no config upper network
 [ ! -e "$physical_path" ] || { logger -t modem "Delayed removal reached a live hardware path; leaving current owner intact"; return 1; }
 section="$(m_modem_section_for_path "$physical_path")" || return 1
 modem_no="${section#modem}"
 network="$(uci -q get modem.${section}.network)"
 /etc/init.d/modem suspend_modem "$modem_no" "" "$physical_path" "$physical_path" "$network" || return 1
 [ ! -e "$physical_path" ] && [ "$(m_modem_section_for_path "$physical_path")" = "$section" ] || return 1
 uci -q del modem.${section} || return 1
 config="$(ubus call uci get '{"config":"modem"}')" || return 1
 upper="$(printf '%s' "$config" | jq -er --arg removed "$section" '[.values | to_entries[] | select(.key!=$removed and .value[".type"]=="modem-device") | .key | select(startswith("modem")) | .[5:] | select(length>0 and all(explode[]; .>=48 and .<=57) and (.=="0" or .[0:1]!="0")) | tonumber] | if length==0 then 0 else max+1 end')" || return 1
 uci -q set modem.@global[0].modem_number="$upper" || return 1
 uci commit modem || return 1
 m_del_physical_path_status "$physical_path"
 m_log info "${section} (${physical_path}) removed"
}

#设置USB设备
# $1:事件行为（add，remove，bind）
# $2:制造商ID
# $3:产品ID
# $4:物理路径
m_set_usb_device()
{
	local action="$1"
	local manufacturer_id="$2"
	local product_id="$3"
	local physical_path="$4"

	if [ "$action" = "add" ]; then
		#添加USB模组ID
		m_add_usb_id "${manufacturer_id}" "${product_id}"

		#设置模组配置
		# m_set_modem_hardware_config "${physical_path}"

	elif [ "$action" = "remove" ]; then

		#删除模组配置
		m_del_modem_config "${physical_path}"
	fi
}

#处理特殊的模组名称
# $1:模组名称
handle_special_modem_name()
{
	local modem_name="$1"

	#SRM825-PV
	[[ "$modem_name" = *"srm825-pv"* ]] && {
		modem_name="srm825"
	}

	echo "$modem_name"
}

# Query one modem name through the discovery-owned physical endpoint.  Keep all
# response-layout handling in one place so initial detection and retry cannot
# disagree about the same module.
query_modem_name()
{
	local at_port="$1" response modem_name
	response="$(at "${at_port}" 'AT+CGMM')" || return 1
	printf '%s\n' "$response" | tr -d '\r' | awk '
		$0 == "OK" { complete=1 }
		/^(ERROR|\+CME ERROR:|\+CMS ERROR:)/ { failed=1 }
		END { exit !(complete && !failed) }
	' || return 1
	modem_name="$(printf '%s\n' "${response}" | awk -F'"' '/^\+CGMM:[[:space:]]*"/ {if (!emitted) {print $2; emitted=1}}')"
	[ -n "${modem_name}" ] || modem_name="$(printf '%s\n' "${response}" | awk -F':[[:space:]]*' '/^\+CGMM:/ {if (!emitted) {print $2; emitted=1}}')"
	# Some modules return only a bare model line.  Accept that form only when it
	# contains a digit and is not an AT status/URC line.  In particular, never
	# mistake asynchronous +CFUN/+CPIN notifications for a model name.
	[ -n "${modem_name}" ] || modem_name="$(printf '%s\n' "${response}" | tr -d '\r' | awk '
		/^[[:space:]]*$/ { next }
		/^(AT|OK$|ERROR|\+|Manufacturer:|Revision:|IMEI:)/ { next }
		/[0-9]/ { if (!emitted) { print; emitted=1 } }
	')"
	modem_name="$(printf '%s' "${modem_name}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr 'A-Z' 'a-z')"
	[ -n "${modem_name}" ] && handle_special_modem_name "${modem_name}"
}

# Shared native identity publication. Callers own discovery/recovery locking.
m_write_modem_identity()
{
 local section="$1" model="$2" manufacturer="$3" platform="$4" define="$5" modes="$6" mode
 uci set "modem.${section}.name=$model"
 uci set "modem.${section}.manufacturer=$manufacturer"
 uci set "modem.${section}.platform=$platform"
 uci set "modem.${section}.define_connect=$define"
 uci -q delete "modem.${section}.modes"
 for mode in $modes; do uci add_list "modem.${section}.modes=$mode"; done
}

# Resolve the native owner of the published endpoint, never the first section.
m_logical_modem_owner()
{
 local owner section
 owner="$(/usr/libexec/modem/at --owner)" || return 1
 section="$(printf '%s' "$owner" | jq -er '.section | select(type == "string")')" || return 1
 case "$section" in ''|*[!a-zA-Z0-9_]*) return 1 ;; esac
 printf '%s\n' "$section"
}

# Snapshot provenance belongs to modem's current logical AT owner. No AT query.
m_snapshot_owner()
{
 /usr/libexec/modem/at --owner
}

# An initial AT timeout must not leave identity permanently unknown. This is
# modem's own monitor, using its existing serialized logical transport. Only
# identity fields are repaired: no presets, reset, dial, alias or Mesh changes.
m_refresh_runtime_identity()
(
 local section="$1" number lock target generation before physical bus model info device_path
 [ "$(m_logical_modem_owner)" = "$section" ] || return 1
 number="${section#modem}"
 case "$number" in ''|*[!0-9]*) return 1 ;; esac
 lock="/var/lock/modem-at-select-${number}.lock"
 exec 6>"$lock" || return 1
 flock -n -x 6 || return 1
 trap 'exit 1' INT TERM
 target="$(readlink -f /dev/modem-at)" || return 1
 generation="$(ls -idL /dev/modem-at | awk '{print $1}')" || return 1
 before="$(uci -q show "modem.$section")" || return 1
 physical="$(readlink -f "$(uci -q get "modem.$section.path")")" || return 1
 device_path="$(readlink -f "/sys/class/tty/${target##*/}/device")"
 [ -n "$device_path" ] || device_path="$(readlink -f "/sys/class/wwan/${target##*/}/device")"
 case "$device_path" in "$physical"/*) ;; *) return 1 ;; esac
 case "$(readlink -f "$physical/subsystem")" in
  /sys/bus/usb) grep -qx 'DEVTYPE=usb_device' "$physical/uevent" || return 1; bus=usb ;;
  /sys/bus/pci) [ -r "$physical/vendor" ] || return 1; bus=pcie ;;
  *) return 1 ;;
 esac
 [ "$(uci -q get "modem.$section.data_interface")" = "$bus" ] || return 1
 model="$(query_modem_name /dev/modem-at)"
 info="$(jq -ce --arg bus "$bus" --arg model "$model" '.modem_support[$bus][$model] // empty' "$SCRIPT_DIR/modem_support.json")" || return 1
 [ "$(m_logical_modem_owner)" = "$section" ] &&
 [ "$(readlink -f /dev/modem-at)" = "$target" ] &&
 [ "$(ls -idL /dev/modem-at | awk '{print $1}')" = "$generation" ] &&
 [ "$(uci -q show "modem.$section")" = "$before" ] &&
 [ "$(readlink -f "$(uci -q get "modem.$section.path")")" = "$physical" ] || return 1
 m_write_modem_identity "$section" "$model" "$(printf '%s' "$info" | jq -r '.manufacturer')" "$(printf '%s' "$info" | jq -r '.platform')" "$(printf '%s' "$info" | jq -r '.define_connect')" "$(printf '%s' "$info" | jq -r '.modes[]')"
 uci commit modem || return 1
 m_log info "Native modem identity recovered for $section"
)

#重新尝试设置模组
# $1:模组序号
# $2:AT串口
# $3:模组支持列表
retry_set_modem_config()
{
	local modem_no="$1"
	local at_port="$2"
	local modem_support="$3"

	local time=0
	while true; do

		#打印日志
		m_log "info" "Try again to configure the Modem${modem_no}"

		[ "$time" = "2" ] && break

		local modem_name="$(query_modem_name "${at_port}")"

		#获取模组信息
		local data_interface=$(uci -q get modem.modem${modem_no}.data_interface)
		local modem_info="$(printf '%s' "${modem_support}" | jq -c --arg iface "${data_interface}" --arg model "${modem_name}" '.modem_support[$iface][$model] // empty')"

		[ -n "$modem_name" ] && [ -n "$modem_info" ] && {

			#获取制造商
			local manufacturer=$(echo ${modem_info} | jq -r '.manufacturer')
			#获取平台
			local platform=$(echo ${modem_info} | jq -r '.platform')
			#获取连接定义
			local define_connect=$(echo ${modem_info} | jq -r '.define_connect')
			#获取支持的拨号模式
			local modes=$(echo ${modem_info} | jq -r '.modes[]')

			m_write_modem_identity "modem${modem_no}" "$modem_name" "$manufacturer" "$platform" "$define_connect" "$modes" || return 1

			# Discovery publishes identity without changing operator or radio settings.

			#打印日志
			m_log "info" "Successfully retrying to configure the Modem ${modem_name}"

			break
		}

		time=$((time+1))
        sleep 5s
    done
}

#设置模组配置
# $1:模组序号
# $2:物理路径
# $3:已经选定的真实AT串口（仅发现层使用）
m_set_modem_config()
{
	local modem_no="$1"
	local physical_path="$2"

	# Identification runs inside the discovery boundary and therefore receives
	# the selected physical tty explicitly.  Never start an AT transaction with
	# an empty UCI value while USB sibling interfaces are still enumerating.
	local at_port="${3:-$(uci -q get modem.modem${modem_no}.at_port)}"
	[ -n "${at_port}" ] && [ -c "${at_port}" ] || return 1

	# Load the support table before considering a cached identity.  A stale or
	# interrupted previous boot must never turn a URC such as "+cfun: 1" into a
	# trusted model merely because it is already present in UCI.
	local modem_support="$(cat "${SCRIPT_DIR}/modem_support.json")"
	local data_interface=$(uci -q get modem.modem${modem_no}.data_interface)

	# Reuse identity only for the same verified boot, device, tty and alias.
	# Persisted UCI fields alone do not prove which modem is currently present.
	local modem_name=$(uci -q get modem.modem${modem_no}.name)
	local current_owner
	current_owner="$(/usr/libexec/modem/at --owner 2>/dev/null)" || current_owner=null
	if [ "${modem_name}" = "unknown" ] ||
	   ! printf '%s' "${modem_support}" | jq -e --arg iface "${data_interface}" --arg model "${modem_name}" '.modem_support[$iface][$model] != null' >/dev/null 2>&1 ||
	   ! jq -e --argjson owner "$current_owner" --arg section "modem${modem_no}" --arg port "$(readlink -f "$at_port")" --arg path "$(readlink -f "$physical_path")" '$owner != null and . == $owner and .section == $section and .physicalPort == $port and .devicePath == $path' "$MODEM_RUNDIR/service-owner.json" >/dev/null 2>&1; then
		modem_name=""
	fi
	if [ -z "${modem_name}" ]; then
		local identify_try=0
		while [ "${identify_try}" -lt 3 ] && [ -z "${modem_name}" ]; do
			modem_name="$(query_modem_name "${at_port}")"
			[ -n "${modem_name}" ] || sleep 2
			identify_try=$((identify_try + 1))
		done
	fi

	#获取模组信息
	local modem_info="$(printf '%s' "${modem_support}" | jq -c --arg iface "${data_interface}" --arg model "${modem_name}" '.modem_support[$iface][$model] // empty')"

	local manufacturer
	local platform
	local define_connect
	local modes
	local log_message
	if [ -z "$modem_name" ] || [ -z "$modem_info" ]; then
        modem_name="unknown"
        manufacturer="unknown"
        platform="unknown"
		define_connect=""
        modes=""
		#设置日志信息
		log_message="An unknown Modem${modem_no} (${physical_path}) was found"
	else
		#获取制造商
		manufacturer=$(echo ${modem_info} | jq -r '.manufacturer')
		#获取平台
		platform=$(echo ${modem_info} | jq -r '.platform')
		#获取连接定义
		define_connect=$(echo ${modem_info} | jq -r '.define_connect')
		#获取支持的拨号模式
		modes=$(echo ${modem_info} | jq -r '.modes[]')
		#设置日志信息
		log_message="Configuration Modem${modem_no} ${modem_name} (${physical_path}) successful"
	fi

	m_write_modem_identity "modem${modem_no}" "$modem_name" "$manufacturer" "$platform" "$define_connect" "$modes" || return 1

	# Discovery publishes identity without changing operator or radio settings.

	#打印日志
	m_log "info" "${log_message}"

	#重新尝试设置模组
	if [ "$modem_name" = "unknown" ]; then
		retry_set_modem_config "${modem_no}" "${at_port}" "${modem_support}"
	fi
}

#设置USB AT串口
# $1:模组序号
# $2:串口
# $3:物理路径
m_set_usb_at_port()
{
	# Do not identify or publish a tty while sibling USB interfaces are still
	# enumerating.  m_set_modem_port() collects the complete set and performs
	# one deterministic vendor-aware selection below.  The old first-response
	# rule exposed Quectel USB3 for a few seconds before correcting it to USB2.
	return 0
}

#设置PCIE AT串口
# $1:模组序号
# $2:串口
# $3:物理路径
m_set_pcie_at_port()
{
	local modem_no="$1"
	local port="$2"
	local physical_path="$3"

	#设置AT串口
	uci set modem.modem${modem_no}.at_port="${port}"

	#设置模组配置
	m_set_modem_config "${modem_no}" "${physical_path}" "${port}"
	uci commit modem
}

#检查USB设备
# $1:事件行为（add，remove，bind）
# $2:设备号
# $2:设备ID
# $3:物理路径
m_check_usb_device()
{
	local action="$1"
	local device_num="$2"
	local device_id="$3"
	local physical_path="$4"

	#获取制造商ID
	local manufacturer_id=$(echo "$device_id" | awk -F'/' '{printf "%04s", $1}' | tr ' ' '0')
	#获取产品ID
	local product_id=$(echo "$device_id" | awk -F'/' '{printf "%04s", $2}' | tr ' ' '0')

	#获取模组支持列表
	local modem_support=$(cat ${SCRIPT_DIR}/modem_support.json)

	[[ "$modem_support" = *"$manufacturer_id"* ]] && {
		#上报USB事件
		m_report_event "${action}" "usb" "${manufacturer_id}:${product_id}" "${physical_path}"

		if [ -n "$device_num" ]; then
			#设置USB设备
			m_set_usb_device "${action}" "${manufacturer_id}" "${product_id}" "${physical_path}"
		# else
			#设置ttyUSB设备
			# m_set_tty_device "${action}" "${physical_path}"
		fi
	}
}

# Resolve a base data link and its actual kernel child, not the first/second
# directory returned by find. Multiple child sessions require explicit choice.
m_kernel_inode()
{
 local value
 value="$(ls -id "$1" 2>/dev/null | awk 'NR==1 {print $1}')"
 case "$value" in ''|*[!0-9]*) return 1 ;; esac
 printf '%s\n' "$value"
}

m_data_interface_for_network()
{
 local network="$1" physical="$2" physical_inode base device index inode entry child child_path selected="" selected_index="" selected_inode="" count=0
 case "$network" in ''|*[!A-Za-z0-9_.:-]*) return 1 ;; esac
 [ "${#network}" -le 15 ] || return 1
 physical="$(readlink -f "$physical")" || return 1
 physical_inode="$(m_kernel_inode "$physical")" || return 1
 base="$(readlink -f "/sys/class/net/$network")" || return 1
 device="$(readlink -f "/sys/class/net/$network/device")" || return 1
 case "$base" in "$physical"/*) ;; *) return 1 ;; esac
 case "$device" in "$physical"|"$physical"/*) ;; *) return 1 ;; esac
 index="$(cat "/sys/class/net/$network/ifindex")" || return 1
 inode="$(m_kernel_inode "$base")" || return 1
 for entry in /sys/class/net/*; do
  child="${entry##*/}"
  [ "$child" != "$network" ] || continue
  child_path="$(readlink -f "$entry")" || continue
  case "$child_path" in "$base/net/"*) ;; *) continue ;; esac
  [ "$child_path" = "$base/net/$child" ] && [ "$(readlink -f "$entry/device")" = "$base" ] || return 1
  count=$((count + 1))
  selected="$child"
  selected_index="$(cat "$entry/ifindex")" || return 1
  selected_inode="$(m_kernel_inode "$child_path")" || return 1
 done
 [ "$count" -le 1 ] || { logger -t modem "Multiple kernel data children; no implicit first session selected"; return 1; }
 [ "$(m_kernel_inode "$physical")" = "$physical_inode" ] && [ "$(readlink -f "/sys/class/net/$network/device")" = "$device" ] && [ "$(readlink -f "/sys/class/net/$network")" = "$base" ] && [ "$(cat "/sys/class/net/$network/ifindex")" = "$index" ] && [ "$(m_kernel_inode "$base")" = "$inode" ] || return 1
 if [ "$count" = 1 ]; then
  [ "$(readlink -f "/sys/class/net/$selected/device")" = "$base" ] && [ "$(cat "/sys/class/net/$selected/ifindex")" = "$selected_index" ] && [ "$(m_kernel_inode "$(readlink -f "/sys/class/net/$selected")")" = "$selected_inode" ] || return 1
  printf '%s\n' "$selected"
 else
  printf '%s\n' "$network"
 fi
}

#设置模组网络配置
# $1:网络设备
# $2:物理路径
m_set_network_config()
{
	local network="$1"
	local physical_path="$2"

 local section modem_no
 section="$(m_modem_section_for_path "$physical_path")" || return 1
 modem_no="${section#modem}"

	#没有模组时跳过
	[ -z "$modem_no" ] && return

 # Read and validate the current kernel relationship. Native data jobs own
 # subsequent session children. Elapsed time cannot establish that ownership.
 local network_interface
 network_interface="$(m_data_interface_for_network "$network" "$physical_path")" || return 1

	#设置模组网络配置
	uci set modem.modem${modem_no}.network="${network}"
	uci set modem.modem${modem_no}.network_interface="${network_interface}"
	uci commit modem

	# The network hotplug event is authoritative even when the physical-device
	# handler was already marked processed. Re-publish the logical endpoint here
	# so a cold boot cannot leave consumers without /dev/modem-at.
	m_set_modem_port "${physical_path}" || return 1

	#打印日志
	m_log "info" "Configuration Modem${modem_no} Network ${network} (${physical_path}) successful"
}

# Ensure every discovered modem has one default dial profile after a clean
# sysupgrade.  This is generic for all supported modules: the dialer and APN
# remain auto-selected, PDP defaults to dual-stack, and bridge mode is enabled
# by default for the generated OpenWrt network interfaces.
ensure_default_dial_config()
{
 local modem_no="$1" network="$2"
 case "$modem_no" in ''|0[0-9]*|*[!0-9]*) return 1 ;; esac
 case "$network" in ''|*[!A-Za-z0-9_.:-]*) return 1 ;; esac
 /usr/bin/lua /usr/share/modem/modem_mode.lua reconcile-profile "modem${modem_no}" "$network" >/dev/null
}

#启用拨号
# $1:网络设备
# Only the original reset generation is pending. A new kernel USB owner
# must proceed through native initialization even if an old record remains.
m_boot_recovery_pending()
{
 local owner="$1" result
 printf '%s' "$owner" | jq -e '.manufacturer=="tdtech" and .model=="mt5700m-cn"' >/dev/null || return 1
 [ -e /tmp/modem-td-boot-recovery.json ] || return 1
 jq -e --argjson owner "$owner" '.state=="reset-issued" and .resetIssued==true and .owner==$owner' /tmp/modem-td-boot-recovery.json >/dev/null
 result=$?
 case "$result" in 0|1) return "$result" ;; *) return 2 ;; esac
}

m_mesh_data_suspended()
{
 [ "$(uci -q get easymesh.device.enabled)" = 1 ] &&
 [ "$(uci -q get easymesh.device.role)" = agent ]
}

enable_dial()
{
 local network="$1" owner section number config profile id instances current_mode preparation profile_owner
 case "$network" in ''|*[!A-Za-z0-9_.:-]*) return 1 ;; esac
 if [ -L /etc/rc.d/S95modem ] && [ ! -e /tmp/modem-boot-complete ]; then
  touch /tmp/modem-boot-pending
  [ -e /tmp/modem-boot-complete ] || return 0
 fi
 owner="$(/usr/libexec/modem/at --owner 2>/dev/null)" || return 0
 m_boot_recovery_pending "$owner"
 local recovery_pending=$?
 case "$recovery_pending" in
  0) return 0 ;;
  1) ;;
  *) logger -p daemon.err -t modem 'Invalid native modem boot recovery record'; return 1 ;;
 esac
 section="$(printf '%s' "$owner" | jq -er '.section')" || return 1
 case "$section" in modem*) ;; *) return 1 ;; esac
 number="${section#modem}"
 case "$number" in ''|0[0-9]*|*[!0-9]*) return 1 ;; esac
 [ "$(uci -q get modem.${section}.network)" = "$network" ] || return 1
 profile_owner="$(uci -q get modem.${section}.profile_owner)" || profile_owner=""
 if [ -z "$profile_owner" ]; then
  service modem reload
  return $?
 fi
 config="$(ubus call uci get '{"config":"modem"}')" || return 1
 profile="$(printf '%s' "$config" | jq -r --arg network "$network" --arg owner "$profile_owner" '[.values | to_entries[] | select(.value[".type"]=="dial-config" and .value.network==$network and .value.profile_owner==$owner)] as $owned | [$owned[] | select(.value.enable!="0")] | if length==1 then .[0].value.id elif length==0 then (if ($owned|length)>0 then "," else "" end) else error("multiple enabled dial profiles") end')" || return 1
 # A comma cannot be a valid cache/profile ID. Existing disabled profiles need no reload.
 [ "$profile" != , ] || return 0
 if [ -z "$profile" ]; then
  service modem reload
  return $?
 fi
 [ "$profile" != null ] || return 1
 # A Mesh agent intentionally submits no independent data jobs. A later
 # net-add must not interpret their absence as failed AT/SMS initialization.
 # An incomplete or replaced owner still follows normal native activation.
 if m_mesh_data_suspended && [ -e /tmp/modem-service-ready ] &&
    [ "$(cat "${MODEM_RUNDIR}/service-owner.json" 2>/dev/null)" = "$owner" ] &&
    [ "$(/usr/libexec/modem/at --owner 2>/dev/null)" = "$owner" ]; then
  return 0
 fi
 # The native modem job owns firmware/host dial handoff. It acts only on
 # enabled, currently owned data interfaces. AT/SMS readiness stays independent.
 if [ "$(printf '%s' "$owner" | jq -r '.manufacturer')" = quectel ]; then
  # Hotplug sources modem_util/debug/vendor helpers, never init.d/modem's
  # local get_mode wrapper. Read through the existing vendor owner guard.
  current_mode="$(MODEM_AT_EXPECTED_OWNER="$owner" quectel_get_mode /dev/modem-at "$(printf '%s' "$owner" | jq -er '.platform')")" || return 1
  case "$current_mode" in
   qmi|mbim|ecm|rndis|ncm)
    preparation="$(/usr/bin/lua /usr/share/modem/modem_mode.lua ensure-data-owner "$section" "$current_mode" "$owner")" || return 1
    case "$(printf '%s' "$preparation" | jq -er '.status')" in
     unchanged) ;;
     running) return 0 ;;
     *) logger -t modem 'Native data ownership preparation not confirmed; no competing dialer started'; return 1 ;;
    esac
   ;;
   *) logger -t modem 'Current modem data mode is not confirmed; ownership handoff refused'; return 1 ;;
  esac
 fi
 instances="$(m_native_dial_instances "$number" "$network")" || return 1
 # A real procd submission (running or pending respawn), the current profile
 # receipt and current readiness must agree. A stale cache alone is not enough.
 if [ -e /tmp/modem-service-ready ] &&
    [ "$(cat "${MODEM_RUNDIR}/service-owner.json" 2>/dev/null)" = "$owner" ] &&
    [ "$(/usr/libexec/modem/at --owner 2>/dev/null)" = "$owner" ]; then
  # Native activation may have completed while data ownership was checked.
  m_mesh_data_suspended && return 0
  if grep -Fqx -- "${network},${profile}" "${MODEM_RUNDIR}/config.cache" 2>/dev/null &&
     printf '%s' "$instances" | jq -e 'length>0' >/dev/null; then return 0; fi
 fi
 service modem reload
}

#禁用拨号
# $1:网络设备
disable_dial()
{
 local network="$1" config profile
 case "$network" in ''|*[!A-Za-z0-9_.:-]*) return 1 ;; esac
 config="$(ubus call uci get '{"config":"modem"}')" || return 1
 profile="$(printf '%s' "$config" | jq -r --arg network "$network" '[.values | to_entries[] | select(.value[".type"]=="dial-config" and .value.network==$network and .value.enable=="1") | .key] | if length==1 then .[0] elif length==0 then "" else error("multiple enabled dial profiles") end')" || return 1
 [ -n "$profile" ] || return 0
 case "$profile" in *[!A-Za-z0-9_]*) return 1 ;; esac
 uci set modem.${profile}.enable=0 || return 1
 uci commit modem || return 1
 service modem reload
}

#设置模组串口
# $1:物理路径
# Enumerate current character nodes by their actual USB device and interface
# descriptors. Kernel tty numbering is not a USB interface number.
m_usb_port_records()
{
	local owner="$1" entry node cursor interface_number interface_class interface_subclass interface_protocol actual_owner
	owner="$(readlink -f "$owner")" || return 1
	[ -r "$owner/idVendor" ] && grep -qx 'DEVTYPE=usb_device' "$owner/uevent" || return 1
	for entry in /sys/class/tty/*; do
		node="/dev/${entry##*/}"
		[ -c "$node" ] || continue
		cursor="$(readlink -f "$entry/device")" || continue
		interface_number=""; interface_class=""; interface_subclass=""; interface_protocol=""; actual_owner=""
		while [ -n "$cursor" ] && [ "$cursor" != / ]; do
			if [ -r "$cursor/bInterfaceNumber" ]; then
				[ -z "$interface_number" ] || break
				interface_number="$(cat "$cursor/bInterfaceNumber")"
				interface_class="$(cat "$cursor/bInterfaceClass" 2>/dev/null | tr 'A-F' 'a-f')"
				interface_subclass="$(cat "$cursor/bInterfaceSubClass" 2>/dev/null | tr 'A-F' 'a-f')"
				interface_protocol="$(cat "$cursor/bInterfaceProtocol" 2>/dev/null | tr 'A-F' 'a-f')"
			fi
			if [ -r "$cursor/idVendor" ] && grep -qx 'DEVTYPE=usb_device' "$cursor/uevent" 2>/dev/null; then
				actual_owner="$cursor"; break
			fi
			cursor="${cursor%/*}"
		done
		[ "$actual_owner" = "$owner" ] || continue
		case "$interface_number" in [0-9a-fA-F][0-9a-fA-F]) ;; *) continue;; esac
		case "$interface_class:$interface_subclass:$interface_protocol" in
			[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]) ;;
			*) continue;;
		esac
		printf '%s %s %s %s %s\n' "$node" "$interface_number" "$interface_class" "$interface_subclass" "$interface_protocol"
	done
}

m_usb_descriptor_at_port()
{
	local vendor="$1" records="$2"
	case "$vendor" in 2c7c|3466) ;; *) return 2;; esac
	# MT5700's AT function is vendor ff/06/12 (observed interface03),
	# not interface01, which is CDC data. Never derive either from tty indices.
	printf '%s\n' "$records" | awk -v vendor="$vendor" '
		NF == 5 && ((vendor == "2c7c" && $2 == "02" && $3 == "ff") ||
		             (vendor == "3466" && $3 == "ff" && $4 == "06" && $5 == "12")) {
			found=$1; count++
		}
		END { if (count == 1) print found; else exit 1 }'
}

m_set_modem_port()
(
 local physical_path="$1" section modem_no
 section="$(m_modem_section_for_path "$physical_path")" || return 1
 modem_no="${section#modem}"

	#没有模组时跳过
	[ -z "$modem_no" ] && return


	# Port discovery can be triggered by several hotplug events for the same USB
	# device.  Serialize it and expose a readiness marker so consumers never use
	# the first responsive tty as if it were the final, preferred AT endpoint.
    local select_lock="/var/lock/modem-at-select-${modem_no}.lock" physical_inode
    physical_inode="$(m_kernel_inode "$physical_path")" || return 1
    exec 6>"$select_lock" || return 1
    flock -x 6 || return 1
    [ "$(m_kernel_inode "$physical_path")" = "$physical_inode" ] &&
    [ "$(m_modem_section_for_path "$physical_path")" = "$section" ] || return 1
	local ready_file="/tmp/modem-at-ready-${modem_no}"
	rm -f "${ready_file}"

	#获取当前路径下所有的串口
	local data_interface=$(uci -q get modem.modem${modem_no}.data_interface)
	# Validate the current physical bus even if an old UCI value exists.
	local actual_bus
	actual_bus="$(readlink -f "$physical_path/subsystem")"
	if [ "$actual_bus" = /sys/bus/usb ] && grep -qx 'DEVTYPE=usb_device' "$physical_path/uevent"; then
		data_interface=usb
	elif [ "$actual_bus" = /sys/bus/pci ] && [ -r "$physical_path/vendor" ]; then
		data_interface=pcie
	else
		m_log "err" "Modem physical bus is missing or ambiguous"
		return 1
	fi
	uci set modem.modem${modem_no}.data_interface="$data_interface"
	uci commit modem
	local all_port="" usb_records=""
    # Enumerate the current kernel generation once. A late character child
    # submits a native discovery event after its real descriptor exists.
	if [ "$data_interface" = "usb" ]; then
		# Read actual descriptors. A later character event retries incomplete enumeration.
		usb_records="$(m_usb_port_records "$physical_path")" || usb_records=""
		all_port="$(printf '%s\n' "$usb_records" | awk 'NF == 5 { print $1 }')"
		case "$(cat "$physical_path/idVendor" | tr 'A-F' 'a-f')" in
			2c7c|3466)
				m_usb_descriptor_at_port "$(cat "$physical_path/idVendor" | tr 'A-F' 'a-f')" "$usb_records" >/dev/null || all_port=""
				;;
		esac
	else
		local mhi_hwip=$(find ${physical_path} -name mhi_hwip*)
		if [ -n "$mhi_hwip" ]; then
			all_port=$(find ${physical_path} -name wwan*)
			all_port=$(echo "$all_port" | sed '1,2d')
		else
			all_port=$(find ${physical_path} -name mhi_*)
		fi
	fi

	#不存在串口，返回
	if [ -z "${all_port}" ]; then
		return
	fi

	#删除原串口
	uci -q del modem.modem${modem_no}.ports
	#设置串口
	local port_cache
	for port_path in $all_port; do

		local port_tmp="$(basename ${port_path})"
		local port="/dev/${port_tmp}"

		#跳过重复的串口
		[ "$port" = "$port_cache" ] && continue
		#跳过多余串口（PCIE）
		[[ "$port" = *"mhi_uci_q"* ]] && continue
		[[ "$port" = *"mhi_cntrl_q"* ]] && continue

		#添加串口
		uci add_list modem.modem${modem_no}.ports="${port}"
		uci commit modem

		#设置AT串口
		if [ "$data_interface" = "usb" ]; then
			m_set_usb_at_port "${modem_no}" "${port}" "${physical_path}"
		elif [[ "$port" = *"at"* ]]; then
			m_set_pcie_at_port "${modem_no}" "${port}" "${physical_path}"
		elif [[ "$port" = *"DUN"* ]]; then
			m_set_pcie_at_port "${modem_no}" "${port}" "${physical_path}"
		fi

		#缓存当前串口
		port_cache="${port}"
    done

	# Known USB vendors use their actual interface descriptor, scoped to this
	# physical device. Missing/duplicate descriptors must not fall back to a
	# secondary AT channel. Unknown vendors require exactly one responsive port.
	local manufacturer modem_name preferred_port current_port probe vendor_id match_count=0
	manufacturer="$(uci -q get modem.modem${modem_no}.manufacturer | tr 'A-Z' 'a-z')"
	modem_name="$(uci -q get modem.modem${modem_no}.name | tr 'A-Z' 'a-z')"
	current_port="$(uci -q get modem.modem${modem_no}.at_port)"
	vendor_id="$(cat "${physical_path}/idVendor" 2>/dev/null | tr 'A-F' 'a-f')"
	preferred_port=""
	if [ "$data_interface" = usb ] && { [ "$vendor_id" = 2c7c ] || [ "$vendor_id" = 3466 ]; }; then
		preferred_port="$(m_usb_descriptor_at_port "$vendor_id" "$usb_records")" || preferred_port=""
	else
		for port in $(uci -q get modem.modem${modem_no}.ports); do
			[ -c "$port" ] || continue
			probe="$(timeout 5 sh "${SCRIPT_DIR}/modem_at.sh" "$port" ATI 2>/dev/null)"
			if echo "$probe" | grep 'OK' >/dev/null; then
				preferred_port="$port"; match_count=$((match_count + 1))
			fi
		done
		[ "$match_count" = 1 ] || preferred_port=""
	fi
	if [ -z "$preferred_port" ]; then
		m_log "err" "Modem AT interface is missing or ambiguous; refusing publication"
		return 1
	fi
	if [ "$data_interface" = usb ] && [ "$(m_usb_port_records "$physical_path")" != "$usb_records" ]; then
		m_log "err" "Modem USB enumeration changed; refusing publication"
		return 1
	fi
	if [ -n "${preferred_port}" ] && [ "${preferred_port}" != "${current_port}" ]; then
		uci set modem.modem${modem_no}.at_port="${preferred_port}"
	fi
	# Identify exactly once, after the authoritative physical endpoint has been
	# chosen but before /dev/modem-at and its readiness marker are published.
	# Consumers never select an intermediate USB tty. If identification times
	# out, native monitor recovery repairs the still-unknown profile later.
    # The identity helper accepts cached fields only with a matching current
    # kernel owner receipt. Known UCI strings alone cannot identify a new USB
    # generation at the same path.
    m_set_modem_config "$modem_no" "$physical_path" "$preferred_port" || return 1
	uci commit modem
	# This is the sole publication point for the logical AT endpoint.  WebUI and
	# every other consumer must open /dev/modem-at, never the kernel tty name.
    [ -c "${preferred_port}" ] || return 1
    if [ -e /dev/modem-at ] && [ ! -L /dev/modem-at ]; then
        m_log err "Logical AT endpoint has an unrelated owner"
        return 1
    fi
    # Keep the alias inode for the same actual endpoint. Republishing an
    # unchanged symlink invented a new owner generation and reinitialized UI.
    if [ "$(readlink /dev/modem-at 2>/dev/null)" != "$preferred_port" ]; then
        ln -sfn "$preferred_port" /dev/modem-at.tmp || return 1
        mv -f /dev/modem-at.tmp /dev/modem-at || return 1
    fi
    touch "$ready_file"
)

#设置物理设备
# $1:事件行为（add，remove，bind，scan）
# $2:网络设备
# $3:物理路径
m_set_physical_device()
{
	local action="$1"
	local network="$2"
	local physical_path="$3"

	if [ "$action" = "add" ]; then

		#已经添加过路径，退出
		local physical_path_status=$(m_get_physical_path_status ${physical_path})
        if [ "$physical_path_status" = processed ]; then
            local current_owner current_section
            current_owner="$(/usr/libexec/modem/at --owner 2>/dev/null)" || current_owner=""
            current_section="$(printf '%s' "$current_owner" | jq -r '.section // empty' 2>/dev/null)"
            if [ "$(printf '%s' "$current_owner" | jq -r '.devicePath // empty' 2>/dev/null)" = "$physical_path" ] && [ -n "$current_section" ] && [ "$(uci -q get modem.${current_section}.network)" = "$network" ]; then return 0;fi
        fi

		#设置模组硬件配置
		m_set_modem_hardware_config "${physical_path}" || return 1

		#设置模组网络配置
		m_set_network_config "${network}" "${physical_path}" || return 1


	elif [ "$action" = "remove" ]; then
		#删除模组配置
		m_del_modem_config "${physical_path}"
	elif [ "$action" = "scan" ]; then
		
		#设置模组硬件配置
		m_set_modem_hardware_config "${physical_path}" || return 1

		#设置模组网络配置
		m_set_network_config "${network}" "${physical_path}" || return 1

	fi
}

# Hotplug dispatch is based on hardware ownership/driver, not interface names.
m_net_event_bus()
{
 local action="$1" network="$2" event="$3" physical bus config row vendor driver
 case "$network" in ''|*[!A-Za-z0-9_.:-]*) return 1 ;; esac
 case "$event" in /sys/devices/*) ;; *) return 1 ;; esac
 case "$event" in *..*|*[[:space:]]*) return 1 ;; esac
 config="$(ubus call uci get '{"config":"modem"}')" || return 1
 if [ "$action" = remove ]; then
  row="$(m_removed_modem_section "$network" "$event")" || return 1
  bus="$(uci -q get modem.${row}.data_interface)"

 else
  physical="$(m_get_device_physical_path "$event")" || return 1
  [ -n "$physical" ] || return 1
  bus="$(readlink -f "$physical/subsystem")" || return 1
  case "$bus" in
   /sys/bus/usb)
    vendor="$(cat "$physical/idVendor" | tr 'A-F' 'a-f')" || return 1
    jq -e --arg vendor "$vendor" '.modem_support.usb | any(.[]; (.manufacturer_id|ascii_downcase)==$vendor)' "$SCRIPT_DIR/modem_support.json" >/dev/null || return 1
    bus=usb ;;
   /sys/bus/pci)
    driver="$(readlink -f "/sys/class/net/$network/device/driver")" || return 1
    case "${driver##*/}" in mhi_net|mhi_wwan_mbim) ;; *)
     # An ordinary WiFi/Ethernet PCI device is not a failed modem.
     printf '%s' "$config" | jq -e --arg path "$physical" '[.values[] | select(.[".type"]=="modem-device" and .path==$path)] | length>0' >/dev/null || return 1
     m_modem_section_for_path "$physical" >/dev/null || return 1 ;;
    esac
    bus=pcie ;;
   *) return 1 ;;
  esac
 fi
 case "$bus" in usb|pcie) printf '%s\n' "$bus" ;; *) return 1 ;; esac
}

#设置网络设备
# $1:事件行为（add，remove，bind）
# $2:网络设备
# $3:物理路径
# $4:数据接口
m_set_network_device()
{
	local action="$1"
	local network="$2"
	local network_path="$3"
	local data_interface="$4"

	#上报事件
    m_report_event "${action}" "net" "${network}" "${network_path}"

 if [ "$action" = remove ]; then
  local removed_section removed_physical
  removed_section="$(m_removed_modem_section "$network" "$network_path")" || return 1
  removed_physical="$(uci -q get modem.${removed_section}.path)"
  if [ -e "$removed_physical" ]; then
   m_suspend_network "$network" "$network_path" || return 1
   m_del_physical_path_status "$removed_physical"
  else
   m_del_modem_config "$removed_physical" || return 1
  fi
  return 0
 fi

 # A kernel data child points at its parent netdev; only the base owns
 # discovery. The name itself carries no role information.
 if [ "$action" != remove ]; then
  local parent_device
  parent_device="$(readlink -f "/sys/class/net/$network/device")" || return 1
  # Kernel session children belong to the native data job. Discovery must
  # not restart that job in response to the child the job itself created.
  [ ! -r "$parent_device/ifindex" ] || return 0
 fi


	if [ "$action" = "add" ]; then

		if [ "$data_interface" = "usb" ]; then
			#获取物理路径
			local device_physical_path=$(m_get_device_physical_path ${network_path})
			#设置USB网络设备
			# m_set_network_config "${network}" "${device_physical_path}"
			#设置物理设备
			m_set_physical_device "${action}" "${network}" "${device_physical_path}"
		else
			#获取物理路径
			local device_physical_path=$(m_get_device_physical_path ${network_path})
			#设置物理设备
			m_set_physical_device "${action}" "${network}" "${device_physical_path}"
		fi
		#启用拨号
		# sleep 60s
		enable_dial "${network}"

	elif [ "$action" = "remove" ]; then
		
		#USB设备通过USB事件删除
		[ "$data_interface" = "pcie" ] && {
			#获取物理路径
			local device_physical_path=$(m_get_device_physical_path ${network_path})
			#设置物理设备
			m_set_physical_device "${action}" "${network}" "${device_physical_path}"
		}

		#停止拨号
		# disable_dial "${network}"

		#打印日志
		m_log "info" "Network ${network} (${network_path}) removed"
	fi
}

#测试Net热插拔
test_net_hotplug()
{
	echo ACTION:"$ACTION" >> /root/test
	echo DEVICENAME:"$DEVICENAME" >> /root/test
	echo PATH:"$PATH" >> /root/test
	echo DEVPATH:"$DEVPATH" >> /root/test
	echo DEVTYPE:"$DEVTYPE" >> /root/test
	echo INTERFACE:"$INTERFACE" >> /root/test
	echo PRODUCT:"$PRODUCT" >> /root/test
}

#测试USB热插拔
test_usb_hotplug()
{
	echo ACTION:"$ACTION" >> /root/test
	echo DEVICENAME:"$DEVICENAME" >> /root/test
	echo DEVPATH:"$DEVPATH" >> /root/test
	echo DEVNUM:"$DEVNUM" >> /root/test
	echo DRIVER:"$DRIVER" >> /root/test
	echo TYPE:"$TYPE" >> /root/test
	echo PRODUCT:"$PRODUCT" >> /root/test
	echo SEQNUM:"$SEQNUM" >> /root/test
	echo BUSNUM:"$BUSNUM" >> /root/test
	echo MAJOR:"$MAJOR" >> /root/test
	echo MINOR:"$MINOR" >> /root/test
}

#测试tty热插拔
test_tty_hotplug()
{
	echo ACTION:"$ACTION" >> /root/test
	echo DEVICENAME:"$DEVICENAME" >> /root/test
	echo DEVPATH:"$DEVPATH" >> /root/test
	echo DEVNUM:"$DEVNUM" >> /root/test
	echo DRIVER:"$DRIVER" >> /root/test
	echo TYPE:"$TYPE" >> /root/test
	echo PRODUCT:"$PRODUCT" >> /root/test
	echo SEQNUM:"$SEQNUM" >> /root/test
	echo BUSNUM:"$BUSNUM" >> /root/test
	echo MAJOR:"$MAJOR" >> /root/test
	echo MINOR:"$MINOR" >> /root/test
}
