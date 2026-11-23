#!/bin/sh
# Copyright (C) 2023 Siriling <siriling@qq.com>

#脚本目录
SCRIPT_DIR="/usr/share/modem"

#运行目录
MODEM_RUNDIR="/var/run/modem"
LOGICAL_AT_PORT="/dev/modem-at"

network_sim_ready()
{
    # Missing/locked SIM and rejected queries are not failed data sessions.
    # Keep recovery on the unified endpoint without reloading the service.
    at "$1" 'AT+CPIN?' | grep -E '^[[:space:]]*\+CPIN:[[:space:]]*READY[[:space:]]*$' >/dev/null
}

network_radio_ready()
{
 # A user's minimum-function/flight setting must not trigger data recovery.
 # Missing, rejected or ambiguous state never authorizes a dial command.
 at "$1" 'AT+CFUN?' | tr -d '\r' | awk '
 /^ERROR$|ERROR:/ {bad=1}
 /^OK$/ {ok=1}
 /^\+CFUN:/ {count++;sub(/^\+CFUN:[[:space:]]*/, "");gsub(/[[:space:]]/,"");if($0!="1")bad=1}
 END {exit !(ok && count==1 && !bad)}'
}

network_probe_ok()
{
 local interface_network="$1" family="$2" probe_target
 [ -n "$interface_network" ] || return 1
 case "$family" in ipv4|ipv4v6)
  for probe_target in 223.5.5.5 223.6.6.6; do ping -4 -c 1 -W 3 -I "$interface_network" "$probe_target" >/dev/null 2>&1 && return 0; done ;;
 esac
 case "$family" in ipv6|ipv4v6)
  for probe_target in 2400:3200::1 2400:3200:baba::1; do ping -6 -c 1 -W 3 -I "$interface_network" "$probe_target" >/dev/null 2>&1 && return 0; done ;;
 esac
 return 1
}

# Success means the modem explicitly reported no PDP address. Unparseable,
# rejected, or nonzero IPv6/vendor formats never authorize blind redial.
network_pdp_confirmed_empty()
{
 printf '%s' "$1" | tr -d '\r' | awk -v context="$2" '
 /^ERROR$|ERROR:/ {bad=1}
 /^OK$/ {ok=1}
 /^\+CGPADDR:/ {
  count++;sub(/^\+CGPADDR:[[:space:]]*/, "");n=split($0,fields,",");gsub(/[[:space:]]/,"",fields[1]);if(fields[1]!=context)bad=1;
  for(i=2;i<=n;i++){gsub(/[[:space:]\"]/,"",fields[i]);if(fields[i]!="" && fields[i]!="0.0.0.0" && fields[i]!="::" && fields[i]!="0:0:0:0:0:0:0:0")nonempty=1}
 }
 END {exit !(ok && count==1 && !bad && !nonempty)}'
}

#导入组件工具
source "${SCRIPT_DIR}/modem_debug.sh"

#重设网络接口
# $1:AT串口
# $4:连接定义
# $5:模组序号
#GobiNet拨号
# $1:AT串口
# $2:制造商
# $3:连接定义
gobinet_dial()
{
 local at_port="$1" define_connect="$3" at_command
 at_command="AT+CGACT=1,${define_connect}"
 dial_log "$at_command" "${MODEM_RUNDIR}/modem${modem_no}_dial.cache"
 at "$at_port" "$at_command"
}

#ECM拨号
# $1:AT串口
# $2:制造商
# $3:连接定义
ecm_dial()
{
    local at_port="$1"
    local manufacturer="$2"
    local define_connect="$3"

    #激活
    # local at_command="AT+CGACT=1,${define_connect}"
    # #打印日志
    # dial_log "${at_command}" "${MODEM_RUNDIR}/modem${modem_no}_dial.cache"

    # at "${at_port}" "${at_command}"

    #拨号
    local at_command
    if [ "$manufacturer" = "quectel" ]; then
        at_command="AT+QNETDEVCTL=${define_connect},3,1"
    elif [ "$manufacturer" = "tdtech" ]; then
        at_command="AT^NDISDUP=${define_connect},1"
    else
        logger -t modem "Unsupported data recovery vendor; no guessed command issued"
        return 1
    fi

    #打印日志
    dial_log "${at_command}" "${MODEM_RUNDIR}/modem${modem_no}_dial.cache"

    at "${at_port}" "${at_command}" || return 1

    sleep 2s
}

#RNDIS拨号
# $1:AT串口
# $2:制造商
# $3:平台
# $4:连接定义
# $5:模组序号
rndis_dial()
{
 # RNDIS and ECM use the vendor's same PDP data-session control; USB
 # transport selection is owned by the modem's actual configured mode.
 ecm_dial "$1" "$2" "$4"
}

#Modem Manager拨号
# $1:接口名称
# $2:连接定义
modemmanager_dial()
{
    local interface_name="$1"
    local define_connect="$2"

    # #激活
    # local at_command="AT+CGACT=1,${define_connect}"
    # #打印日志
    # dial_log "${at_command}" "${MODEM_RUNDIR}/modem${modem_no}_dial.cache"
    # at "${at_port}" "${at_command}"

    #启动网络接口
    ifup "${interface_name}";
}

#检查模组网络连接
# $1:配置ID
# $2:模组序号
# $3:拨号模式
resolve_dial_config_section()
{
 local wanted="$1" config
 case "$wanted" in ''|*[!A-Za-z0-9_-]*) return 1 ;; esac
 config="$(ubus call uci get '{"config":"modem"}')" || return 1
 printf '%s' "$config" | jq -er --arg wanted "$wanted" '[.values | to_entries[] | select(.value[".type"]=="dial-config" and (.key==$wanted or .value.id==$wanted)) | .key] | if length==1 then .[0] else error("dial profile missing or ambiguous") end'
}

network_profile_revision()
{
 local raw
 raw="$(ubus call uci get '{"config":"modem"}')" || return 1
 raw="$(printf '%s' "$raw" | jq -ce --arg section "$1" '.values[$section] | select(.[".type"]=="dial-config") | {id,enable,network,dial_tool,pdp_type,network_bridge,apn,username,password,auth}')" || return 1
 printf '%s' "$raw" | sha256sum | awk '{print $1}'
}

network_owner_current()
{
 local current plan current_section pdp ipv4_name ipv6_name
 current="$(/usr/libexec/modem/at --owner)" || return 1
 [ "$current" = "$network_owner" ] && [ "$(cat "${MODEM_RUNDIR}/service-owner.json" 2>/dev/null)" = "$network_owner" ] || return 1
 [ "$(network_profile_revision "$config_section")" = "$profile_revision" ] || return 1
 [ "$(uci -q get modem.modem${modem_no}.network)" = "$(uci -q get modem.${config_section}.network)" ] || return 1
 interface_network="$(uci -q get modem.modem${modem_no}.network_interface)"
 plan="$(/usr/libexec/modem/at --interface-plan "$interface_network")" || return 1
 [ "$(printf '%s' "$plan" | jq -c '.owner')" = "$network_owner" ] || return 1
 interface_name="$(printf '%s' "$plan" | jq -r '.ipv4')"
 interface_name_ipv6="$(printf '%s' "$plan" | jq -r '.ipv6')"
 case "$pdp_type" in
  ipv4) [ "$(uci -q get network.${interface_name}.disabled)" != 1 ] || return 2 ;;
  ipv6) [ "$(uci -q get network.${interface_name_ipv6}.disabled)" != 1 ] || return 2 ;;
  ipv4v6) [ "$(uci -q get network.${interface_name}.disabled)" != 1 ] || [ "$(uci -q get network.${interface_name_ipv6}.disabled)" != 1 ] || return 2 ;;
  *) return 1 ;;
 esac
}

modem_network_task()
{
 local config_id="$1" modem_no="$2" mode="$3" config_section network_owner profile_revision
 local at_port="$LOGICAL_AT_PORT" manufacturer platform define_connect pdp_type interface_name interface_name_ipv6 interface_network result raw
 local probe_failures=0
 case "$modem_no" in ''|0[0-9]*|*[!0-9]*) return 1 ;; esac
 config_section="$(resolve_dial_config_section "$config_id")" || return 1
 network_owner="$(/usr/libexec/modem/at --owner)" || return 1
 [ "$(printf '%s' "$network_owner" | jq -r '.section')" = "modem${modem_no}" ] || return 1
 manufacturer="$(printf '%s' "$network_owner" | jq -r '.manufacturer | ascii_downcase')"
 platform="$(printf '%s' "$network_owner" | jq -r '.platform')"
 define_connect="$(uci -q get modem.modem${modem_no}.define_connect)"
 case "$define_connect" in ''|0*|*[!0-9]*) return 1 ;; esac
 pdp_type="$(uci -q get modem.${config_section}.pdp_type)"
 case "$pdp_type" in ipv4|ipv6|ipv4v6) ;; *) return 1 ;; esac
 profile_revision="$(network_profile_revision "$config_section")" || return 1
 export MODEM_AT_EXPECTED_OWNER="$network_owner"
 echo "[$(date +"%Y-%m-%d %H:%M:%S")] 数据链路监测启动" >> "${MODEM_RUNDIR}/modem${modem_no}_dial.cache"
 while :; do
  [ "$(uci -q get modem.@global[0].enable_dial)" = 1 ] && [ "$(uci -q get modem.${config_section}.enable)" = 1 ] || break
  network_owner_current;result=$?
  if [ "$result" = 2 ]; then sleep 15;continue;fi
  [ "$result" = 0 ] || break
  if network_probe_ok "$interface_network" "$pdp_type"; then probe_failures=0;sleep 5;continue;fi
  probe_failures=$((probe_failures + 1))
  if [ "$probe_failures" -lt 3 ]; then sleep 5;continue;fi
  # Resolver ICMP failure is not proof that the PDP session failed. Keep
  # AT/SMS/call services intact and only redial a confirmed empty context.
  if ! network_radio_ready "$at_port";then sleep 15;continue;fi
  if ! network_sim_ready "$at_port";then sleep 15;continue;fi
  raw="$(at "$at_port" "AT+CGPADDR=${define_connect}")" || { sleep 15;continue; }
  if ! network_pdp_confirmed_empty "$raw" "$define_connect";then sleep 15;continue;fi
  network_owner_current || break
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] 当前 PDP 无地址，重建数据连接" >> "${MODEM_RUNDIR}/modem${modem_no}_dial.cache"
  case "$mode" in
   gobinet) gobinet_dial "$at_port" "$manufacturer" "$define_connect" ;;
   ecm|ncm) ecm_dial "$at_port" "$manufacturer" "$define_connect" ;;
   rndis) rndis_dial "$at_port" "$manufacturer" "$platform" "$define_connect" "$modem_no" ;;
   modemmanager) modemmanager_dial "$interface_name" "$define_connect" ;;
   *) logger -t modem "Unsupported data recovery mode; no fallback command issued";break ;;
  esac
  probe_failures=0
  sleep 15
 done
}

modem_network_task "$1" "$2" "$3"
