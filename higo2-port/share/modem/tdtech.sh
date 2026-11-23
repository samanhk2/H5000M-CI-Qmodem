#!/bin/sh
# Copyright (C) 2023 Siriling <siriling@qq.com>

#脚本目录
SCRIPT_DIR="/usr/share/modem"

#获取DNS
# $1:AT串口
# $2:连接定义
tdtech_get_dns()
{
    local at_port="$1"
    local define_connect="$2"

    [ -z "$define_connect" ] && {
        define_connect="1"
    }

    local public_dns1_ipv4="223.5.5.5"
    local public_dns2_ipv4="119.29.29.29"
    local public_dns1_ipv6="2400:3200::1" #下一代互联网北京研究中心：240C::6666，阿里：2400:3200::1，腾讯：2402:4e00::
    local public_dns2_ipv6="2402:4e00::"

    #获取DNS地址（IPv4）
    at_command="AT^DHCP=${define_connect}"
    local response=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "\^DHCP:" | sed -n '1p')

    local ipv4_dns1=$(echo "${response}" | awk -F',' '{print $5}')
    if [ -z "$ipv4_dns1" ]; then
        ipv4_dns1="${public_dns1_ipv4}"
    else
        #按字节（byte）将十六进制拆分并转换为对应的十进制表示
        ipv4_dns1=$(echo "$ipv4_dns1" | awk '{
            for (i = length; i >= 1; i -= 2) {
                printf "%d.", "0x" substr($0, i-1, 2)
            }
        }')
        ipv4_dns1="${ipv4_dns1%?}"
    fi

    local ipv4_dns2=$(echo "${response}" | awk -F',' '{print $6}')
    if [ -z "$ipv4_dns2" ]; then
        ipv4_dns2="${public_dns1_ipv4}"
    else
        #按字节（byte）将十六进制拆分并转换为对应的十进制表示
        ipv4_dns2=$(echo "$ipv4_dns2" | awk '{
            for (i = length; i >= 1; i -= 2) {
                printf "%d.", "0x" substr($0, i-1, 2)
            }
        }')
        ipv4_dns2="${ipv4_dns2%?}"
    fi

    #获取DNS地址（IPv6）
    at_command="AT^DHCPV6=${define_connect}"
    local response=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "\^DHCPV6:" | sed -n '1p')

    local ipv6_dns1=$(echo "${response}" | awk -F',' '{print $5}')
    [ -z "$ipv6_dns1" ] && {
        ipv6_dns1="${public_dns1_ipv6}"
    }

    local ipv6_dns2=$(echo "${response}" | awk -F',' '{print $6}')
    [ -z "$ipv6_dns2" ] && {
        ipv6_dns2="${public_dns2_ipv6}"
    }

    dns="{
        \"dns\":{
            \"ipv4_dns1\":\"$ipv4_dns1\",
            \"ipv4_dns2\":\"$ipv4_dns2\",
            \"ipv6_dns1\":\"$ipv6_dns1\",
            \"ipv6_dns2\":\"$ipv6_dns2\"
        }
    }"

    echo "$dns"
}

#获取拨号模式
# $1:AT串口
# $2:平台
tdtech_mode_owner()
{
 command -v m_mode_owner >/dev/null 2>&1 || . "${SCRIPT_DIR}/modem_mode_util.sh" || return 1
 local proof
 proof="$(m_mode_owner "$1" tdtech "$2")" || return 1
 [ "$(printf '%s' "$proof" | jq -r .platform)" = hisilicon ] || return 1
 printf '%s\n' "$proof"
}
tdtech_get_mode()
{
 command -v m_mode_owner >/dev/null 2>&1 || . "${SCRIPT_DIR}/modem_mode_util.sh" || return 1
 local proof raw number
 proof="$(tdtech_mode_owner "$1" "$2")" || { echo unknown;return 1; }
 raw="$(m_mode_transaction "$proof" 'AT^SETMODE?')" || { echo unknown;return 1; }
 number="$(m_hisilicon_mode_number "$raw")" || { echo unknown;return 1; }
 m_hisilicon_mode_label "$number"
}
tdtech_set_mode()
{
 command -v m_mode_owner >/dev/null 2>&1 || . "${SCRIPT_DIR}/modem_mode_util.sh" || return 1
 local proof mode_num
 proof="$(tdtech_mode_owner "$1")" || return 1
 case "$2" in ecm)mode_num=0;;ncm)mode_num=4;;*)echo 'Unsupported actual modem mode; no fallback write issued' >&2;return 1;;esac
 m_mode_set_value "$proof" "$mode_num"
}

#获取位
# $1:频段名称
tdtech_get_network_prefer()
{
    sh "${SCRIPT_DIR}/modem_radio_bands.sh" get "$1"
}

tdtech_set_network_prefer()
{
    sh "${SCRIPT_DIR}/modem_network_prefer.sh" "$1" "$2"
}

#设置频段
# $1:AT串口
# $2:频段偏好配置
tdtech_set_band_prefer()
{
    sh "${SCRIPT_DIR}/modem_radio_bands.sh" set "$1" "$2"
}

tdtech_get_voltage()
{
    local at_port="$1"
    
    # #Voltage（电压）
    # at_command="AT+ADCREAD=0"
	# local voltage=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | grep "+ADCREAD:" | awk -F' ' '{print $2}' | sed 's/\r//g')
    # voltage=$(awk "BEGIN{ printf \"%.2f\", $voltage / 1000000 }" | sed 's/\.*0*$//')
    # echo "${voltage}"
}

#获取温度
# $1:AT串口
tdtech_get_temperature()
{
    local at_port="$1" raw
    raw=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" 'AT^CHIPTEMP?') || return 1
    printf '%s\n' "$raw" | tr -d '\r' | awk '
      /^[[:space:]]*OK[[:space:]]*$/ { ok=1; next }
      /^[[:space:]]*(ERROR|\+CME ERROR:|\+CMS ERROR:)/ { bad=1; next }
      /^[[:space:]]*\^CHIPTEMP:[[:space:]]*/ {
        rows++; if (rows > 1) { bad=1; next }
        values=$0; sub(/^[^:]*:[[:space:]]*/, "", values)
        count=split(values, fields, ",")
        if (count != 12) { bad=1; next }
        for (i=1; i<=count; i++) {
          value=fields[i]; gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
          if (value !~ /^[+-]?[0-9]+$/) { bad=1; continue }
          if (value+0 >= -400 && value+0 <= 1200) {
            if (!found || value+0 > maximum) maximum=value+0
            found=1
          }
        }
      }
      END { if (!bad && ok && found) printf "%g°C\n", maximum/10; else exit 1 }'
}

#获取连接状态
# $1:AT串口
# $2:连接定义
tdtech_get_connect_status()
{
    local at_port="$1"
    local define_connect="$2"

    #默认值为1
    [ -z "$define_connect" ] && {
        define_connect="1"
    }

    at_command="AT+CGPADDR=${define_connect}"
    local ipv4=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "+CGPADDR: " | awk -F'"' '{print $2}')
    local not_ip="0.0.0.0"

    #设置连接状态
    local connect_status
    if [ -z "$ipv4" ] || [[ "$ipv4" = *"$not_ip"* ]]; then
        connect_status="disconnect"
    else
        connect_status="connect"
    fi

    echo "${connect_status}"
}

#基本信息
tdtech_base_info()
{
    debug "TDTech base info"
    local runtime_identity=""
    if [ "$(cat /var/run/modemwebui/at_port 2>/dev/null)" = "$at_port" ]; then
        runtime_identity=$(cat /var/run/modemwebui/identity 2>/dev/null)
    fi

    #Name（名称）
    name=$(printf '%s\n' "$runtime_identity" | sed -n 's/^Model:[[:space:]]*//p' | sed -n '1p' | tr -d '\r')
    [ -n "$name" ] || name=$(sh ${SCRIPT_DIR}/modem_at.sh "$at_port" "AT+CGMM" | sed -n '2p' | tr -d '\r')
    #Manufacturer（制造商）
    manufacturer=$(printf '%s\n' "$runtime_identity" | sed -n 's/^Manufacturer:[[:space:]]*//p' | sed -n '1p' | tr -d '\r')
    [ -n "$manufacturer" ] || manufacturer=$(sh ${SCRIPT_DIR}/modem_at.sh "$at_port" "AT+CGMI" | sed -n '2p' | tr -d '\r')
    #Revision（固件版本）
    revision=$(printf '%s\n' "$runtime_identity" | sed -n 's/^Revision:[[:space:]]*//p' | sed -n '1p' | tr -d '\r')
    [ -n "$revision" ] || revision=$(sh ${SCRIPT_DIR}/modem_at.sh "$at_port" "AT+CGMR" | sed -n '2p' | tr -d '\r')

    #Mode（拨号模式）
    local modem_number=$(uci -q get modem.@global[0].modem_number)
    local modem_index
    for modem_index in $(seq 0 $((${modem_number:-0}-1))); do
        if [ "$(uci -q get modem.modem${modem_index}.at_port)" = "$at_port" ]; then
            mode=$(uci -q get modem.modem${modem_index}.mode)
            break
        fi
    done
	case "$(printf '%s' "$mode" | tr 'A-Z' 'a-z')" in
		""|unknown) mode=$(tdtech_get_mode "$at_port" "$platform") ;;
	esac
    mode=$(printf '%s' "$mode" | tr 'a-z' 'A-Z')

    #Temperature（温度）
    temperature=$(tdtech_get_temperature ${at_port})
}

#获取SIM卡状态
# $1:SIM卡状态标志
tdtech_get_sim_status()
{
    local status
    status=$(printf '%s\n' "$1" | tr -d '\r' | sed -n 's/^[[:space:]]*+CPIN:[[:space:]]*//p' | sed 's/[[:space:]]*$//' | sed -n '1p')
    if [ -z "$status" ]; then
        case "$(printf '%s\n' "$1" | tr -d '\r')" in
            *"SIM not inserted"*|*"SIM NOT INSERTED"*) echo miss; return ;;
        esac
        if printf '%s\n' "$1" | tr -d '\r' | grep -E '^[[:space:]]*\+CME ERROR:[[:space:]]*10[[:space:]]*$' >/dev/null; then
            echo miss; return
        fi
        # Some callers supply only the CPIN value, without its prefix.
        status=$(printf '%s' "$1" | tr -d '\r')
    fi
    case "$status" in
        "READY") echo "ready" ;;
        "SIM PIN") echo "MT is waiting SIM PIN to be given" ;;
        "SIM PUK") echo "MT is waiting SIM PUK to be given" ;;
        "PH-SIM PIN") echo "MT is waiting phone-to-SIM card password to be given" ;;
        "PH-FSIM PIN") echo "MT is waiting phone-to-very first SIM card password to be given" ;;
        "PH-FSIM PUK") echo "MT is waiting phone-to-very first SIM card unblocking password to be given" ;;
        "SIM PIN2") echo "MT is waiting SIM PIN2 to be given" ;;
        "SIM PUK2") echo "MT is waiting SIM PUK2 to be given" ;;
        "PH-NET PIN") echo "MT is waiting network personalization password to be given" ;;
        "PH-NET PUK") echo "MT is waiting network personalization unblocking password to be given" ;;
        "PH-NETSUB PIN") echo "MT is waiting network subset personalization password to be given" ;;
        "PH-NETSUB PUK") echo "MT is waiting network subset personalization unblocking password to be given" ;;
        "PH-SP PIN") echo "MT is waiting service provider personalization password to be given" ;;
        "PH-SP PUK") echo "MT is waiting service provider personalization unblocking password to be given" ;;
        "PH-CORP PIN") echo "MT is waiting corporate personalization password to be given" ;;
        "PH-CORP PUK") echo "MT is waiting corporate personalization unblocking password to be given" ;;
        *) echo unknown ;;
    esac
}

#SIM卡信息
tdtech_sim_info()
{
    debug "TDTech sim info"
    
    #SIM Slot（SIM卡卡槽）
    # at_command="AT^SIMSLOT?"
	# response=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "\^SIMSLOT:" | awk -F': ' '{print $2}' | awk -F',' '{print $2}')

    # if [ "$response" != "0" ]; then
    #     sim_slot="1"
    # else
    #     sim_slot="2"
    # fi
    sim_slot="1"

    #IMEI（国际移动设备识别码）
    imei=""
    if [ "$(cat /var/run/modemwebui/at_port 2>/dev/null)" = "$at_port" ]; then
        imei=$(sed -n 's/^IMEI:[[:space:]]*//p' /var/run/modemwebui/identity 2>/dev/null | sed -n '1p' | tr -d '\r')
    fi
    printf '%s\n' "$imei" | grep -E '^[0-9]{14,16}$' >/dev/null || imei=$(sh ${SCRIPT_DIR}/modem_at.sh "$at_port" "AT+CGSN" | tr -d '\r' | awk '/^[0-9]+$/ && length($0)>=14 && length($0)<=16 {if (!emitted) {print; emitted=1}}')

    #SIM Status（SIM状态）
    at_command="AT+CPIN?"
    sim_status="unknown"
    sim_status_flag=""
    sim_attempt=1
    while [ "$sim_attempt" -le 3 ]; do
        sim_status_flag=$(sh ${SCRIPT_DIR}/modem_at.sh "${at_port}" "${at_command}")
        sim_status=$(tdtech_get_sim_status "$sim_status_flag")
        [ "$sim_status" = "unknown" ] || break
        sim_attempt=$((sim_attempt + 1))
        [ "$sim_attempt" -le 3 ] && sleep 1
    done

    if [ "$sim_status" != "ready" ]; then
        return
    fi

    # Query IMSI before the operator name.  MCC/MNC is stable and avoids the
    # multi-second EONS retry during MT5700 cold registration.
    at_command="AT+CIMI"
	imsi=$(sh ${SCRIPT_DIR}/modem_at.sh "$at_port" "$at_command" | tr -d '\r' | awk '/^[0-9]+$/ && length($0)>=14 && length($0)<=16 {if (!emitted) {print; emitted=1}}')

    ISP_Read(){
            local operator_attempt=1
            operatorCode=$(printf '%s' "$imsi" | cut -c1-5)
            while [ -z "$operatorCode" ] && [ "$operator_attempt" -le 2 ]; do
                operatorCode=$(sh "${SCRIPT_DIR}/modem_at.sh" "${at_port}" 'AT^EONS=2' | awk -F ',' '{print $2}' | tr -d '\r" ' | sed -n '/^[0-9][0-9]*$/p' | sed -n '1p')
                [ -n "$operatorCode" ] && break
                operator_attempt=$((operator_attempt + 1))
                [ "$operator_attempt" -le 2 ] && sleep 1
            done
            case "$operatorCode" in
            "46000" | "46002" | "46004" | "46007" | "46008" | "46020")
                isp="中国移动"
                ;;
            "46001" | "46006" | "46009")
                isp="中国联通"
                ;;
            "46003" | "46005" | "46011")
                isp="中国电信"
                ;;
            "46015")
                isp="中国广电"
                ;;
            *)
                isp="未知运营商"
                ;;
            esac
    }
    ISP_Read 
    # if [ "$isp" = "CHN-CMCC" ] || [ "$isp" = "CMCC" ]|| [ "$isp" = "46000" ]; then
    #     isp="中国移动"
    # elif [ "$isp" = "CHN-UNICOM" ] || [ "$isp" = "UNICOM" ] || [ "$isp" = "46001" ]; then
    #     isp="中国联通"
    # elif [ "$isp" = "CHN-CT" ] || [ "$isp" = "CT" ] || [ "$isp" = "46011" ]; then
    #     isp="中国电信"
    # fi

    #SIM Number（SIM卡号码，手机号）
    at_command="AT+CNUM"
	sim_number=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "+CNUM: " | awk -F'"' '{print $2}')
    [ -z "$sim_number" ] && {
        sim_number=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "+CNUM: " | awk -F'"' '{print $4}')
    }
	
    #ICCID（集成电路卡识别码）
    iccid=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" 'AT^ICCID?' | tr -d '\r"' | sed -n 's/^[[:space:]]*\^ICCID:[[:space:]]*\([0-9][0-9]*\)[Ff]*[[:space:]]*$/\1/p' | awk 'length($0)>=18 && length($0)<=22 {if (!emitted) {print; emitted=1}}')
}

#获取网络类型
# $1:网络类型数字
tdtech_get_rat()
{
    local rat
    case $1 in
		"0"|"1"|"3"|"8") rat="GSM" ;;
		"2"|"4"|"5"|"6"|"9"|"10") rat="WCDMA" ;;
        "7") rat="LTE" ;;
        "11"|"12") rat="NR" ;;
	esac
    echo "${rat}"
}

#获取信号强度指示（4G）
# $1:信号强度指示数字
tdtech_get_rssi()
{
    local rssi
    case $1 in
		"99") rssi="unknown" ;;
		* )  rssi=$((2 * $1 - 113)) ;;
	esac
    echo "$rssi"
}

#网络信息
tdtech_network_info()
{
    debug "TDTech network info"

    #Connect Status（连接状态）
    connect_status=$(tdtech_get_connect_status ${at_port} ${define_connect})

    # MONSC同时包含网络制式与完整小区信息，只查询一次并在
    # tdtech_cell_info 中复用，避免重复SYSINFOEX/CSQ请求。
    tdtech_monsc_response=$(sh ${SCRIPT_DIR}/modem_at.sh "$at_port" "AT^MONSC" | grep "\^MONSC:" | sed 's/\^MONSC: //')
    network_type=$(printf '%s' "$tdtech_monsc_response" | awk -F',' '{print $1}')

    # MONSC 是无线状态；AMBR 属于实际数据承载。
    [ "$connect_status" = "connect" ] || return 0

    #AMBR（最大比特率）
    at_command="AT^DSAMBR=${define_connect}"
    response=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | grep "\^DSAMBR:" | sed 's/\^DSAMBR: //g' | sed 's/\r//g')
    ambr_ul_tmp=$(echo "$response" | awk -F',' '{print $2}')
    ambr_dl_tmp=$(echo "$response" | awk -F',' '{print $3}')

    #AMBR UL（上行签约速率，单位，Mbps）
    ambr_ul=$(awk "BEGIN{ printf \"%.2f\", $ambr_dl_tmp / 1000 }" | sed 's/\.*0*$//')
    #AMBR DL（下行签约速率，单位，Mbps）
    ambr_dl=$(awk "BEGIN{ printf \"%.2f\", $ambr_ul_tmp / 1000 }" | sed 's/\.*0*$//')

    # #速率统计
    # at_command='AT^DSFLOWQRY'
    # response=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | grep "\^DSFLOWRPT:" | sed 's/\^DSFLOWRPT: //g' | sed 's/\r//g')

    # #当前上传速率（单位，Byte/s）
    # tx_rate=$(echo $response | awk -F',' '{print $1}')

    # #当前下载速率（单位，Byte/s）
    # rx_rate=$(echo $response | awk -F',' '{print $2}')
}

#获取NR子载波间隔
# $1:NR子载波间隔数字
tdtech_get_scs()
{
    local scs
	case $1 in
		"0") scs="15" ;;
		"1") scs="30" ;;
        "2") scs="60" ;;
        "3") scs="120" ;;
        "4") scs="240" ;;
        *) scs=$(awk "BEGIN{ print 2^$1 * 15 }") ;;
	esac
    echo "$scs"
}

#获取频段
# $1:网络类型
# $2:频段数字
tdtech_get_band()
{
    local band
    case $1 in
        "GSM")
            case $2 in
                "0") band="850" ;;
                "1") band="900" ;;
                "2") band="1800" ;;
                "3") band="1900" ;;
            esac
        ;;
		"WCDMA") band="$2" ;;
		"LTE") band="$(($2-100))" ;;
        "NR") band="$2" band="${band#*50}" ;;
	esac
    echo "$band"
}

#小区信息
tdtech_cell_info()
{
    debug "TDTech cell info"

    response="$tdtech_monsc_response"
    [ -n "$response" ] || response=$(sh ${SCRIPT_DIR}/modem_at.sh "$at_port" "AT^MONSC" | grep "\^MONSC:" | sed 's/\^MONSC: //')
    
    local rat=$(echo "$response" | awk -F',' '{print $1}')

    case $rat in
        "NR")
            network_mode="NR5G-SA Mode"
            nr_mcc=$(echo "$response" | awk -F',' '{print $2}')
            nr_mnc=$(echo "$response" | awk -F',' '{print $3}')
            nr_arfcn=$(echo "$response" | awk -F',' '{print $4}')
            nr_scs_num=$(echo "$response" | awk -F',' '{print $5}')
            nr_scs=$(tdtech_get_scs ${nr_scs_num})
            nr_cell_id_hex=$(echo "$response" | awk -F',' '{print $6}')
            nr_cell_id=$(echo "ibase=16; $nr_cell_id_hex" | bc)
            nr_physical_cell_id_hex=$(echo "$response" | awk -F',' '{print $7}')
            nr_physical_cell_id=$(echo "ibase=16; $nr_physical_cell_id_hex" | bc)
            nr_tac=$(echo "$response" | awk -F',' '{print $8}')
            nr_rsrp=$(echo "$response" | awk -F',' '{print $9}')
            nr_rsrq=$(echo "$response" | awk -F',' '{print $10}')
            nr_sinr=$(echo "$response" | awk -F',' '{print $11}' | sed 's/\r//g')
        ;;
        "LTE-NR")
            network_mode="EN-DC Mode"
            #LTE
            endc_lte_mcc=$(echo "$response" | awk -F',' '{print $2}')
            endc_lte_mnc=$(echo "$response" | awk -F',' '{print $3}')
            endc_lte_earfcn=$(echo "$response" | awk -F',' '{print $4}')
            endc_lte_cell_id_hex=$(echo "$response" | awk -F',' '{print $5}')
            endc_lte_cell_id=$(echo "ibase=16; $endc_lte_cell_id_hex" | bc)
            endc_lte_physical_cell_id_hex=$(echo "$response" | awk -F',' '{print $6}')
            endc_lte_physical_cell_id=$(echo "ibase=16; $endc_lte_physical_cell_id_hex" | bc)
            endc_lte_tac=$(echo "$response" | awk -F',' '{print $7}')
            endc_lte_rsrp=$(echo "$response" | awk -F',' '{print $8}')
            endc_lte_rsrq=$(echo "$response" | awk -F',' '{print $9}')
            endc_lte_rxlev=$(echo "$response" | awk -F',' '{print $10}' | sed 's/\r//g')
            #NR5G-NSA
            endc_nr_mcc=$(echo "$response" | awk -F',' '{print $2}')
            endc_nr_mnc=$(echo "$response" | awk -F',' '{print $3}')
            endc_nr_arfcn=$(echo "$response" | awk -F',' '{print $4}')
            endc_nr_scs_num=$(echo "$response" | awk -F',' '{print $5}')
            endc_nr_scs=$(tdtech_get_scs ${nr_scs_num})
            endc_nr_cell_id_hex=$(echo "$response" | awk -F',' '{print $6}')
            endc_nr_cell_id=$(echo "ibase=16; $endc_nr_cell_id_hex" | bc)
            endc_nr_physical_cell_id_hex=$(echo "$response" | awk -F',' '{print $7}')
            endc_nr_physical_cell_id=$(echo "ibase=16; $endc_nr_physical_cell_id_hex" | bc)
            endc_nr_tac=$(echo "$response" | awk -F',' '{print $8}')
            endc_nr_rsrp=$(echo "$response" | awk -F',' '{print $9}')
            endc_nr_rsrq=$(echo "$response" | awk -F',' '{print $10}')
            endc_nr_sinr=$(echo "$response" | awk -F',' '{print $11}' | sed 's/\r//g')
        ;;
        "LTE"|"eMTC"|"NB-IoT")
            network_mode="LTE Mode"
            lte_mcc=$(echo "$response" | awk -F',' '{print $2}')
            lte_mnc=$(echo "$response" | awk -F',' '{print $3}')
            lte_earfcn=$(echo "$response" | awk -F',' '{print $4}')
            lte_cell_id_hex=$(echo "$response" | awk -F',' '{print $5}')
            lte_cell_id=$(echo "ibase=16; $lte_cell_id_hex" | bc)
            lte_physical_cell_id_hex=$(echo "$response" | awk -F',' '{print $6}')
            lte_physical_cell_id=$(echo "ibase=16; $lte_physical_cell_id_hex" | bc)
            lte_tac=$(echo "$response" | awk -F',' '{print $7}')
            lte_rsrp=$(echo "$response" | awk -F',' '{print $8}')
            lte_rsrq=$(echo "$response" | awk -F',' '{print $9}')
            lte_rxlev=$(echo "$response" | awk -F',' '{print $10}' | sed 's/\r//g')
        ;;
        "WCDMA"|"TD-SCDMA"|"UMTS")
            network_mode="WCDMA Mode"
            wcdma_mcc=$(echo "$response" | awk -F',' '{print $2}')
            wcdma_mnc=$(echo "$response" | awk -F',' '{print $3}')
            wcdma_arfcn=$(echo "$response" | awk -F',' '{print $4}')
            wcdma_psc=$(echo "$response" | awk -F',' '{print $5}')
            wcdma_cell_id_hex=$(echo "$response" | awk -F',' '{print $6}')
            wcdma_cell_id=$(echo "ibase=16; $wcdma_cell_id_hex" | bc)
            wcdma_lac=$(echo "$response" | awk -F',' '{print $7}')
            wcdma_rscp=$(echo "$response" | awk -F',' '{print $8}')
            wcdma_rxlev=$(echo "$response" | awk -F',' '{print $9}')
            wcdma_ecn0=$(echo "$response" | awk -F',' '{print $10}')
            wcdma_drx=$(echo "$response" | awk -F',' '{print $11}')
            wcdma_ura=$(echo "$response" | awk -F',' '{print $12}' | sed 's/\r//g')
        ;;
        "GSM")
            network_mode="GSM Mode"
            gsm_mcc=$(echo "$response" | awk -F',' '{print $2}')
            gsm_mnc=$(echo "$response" | awk -F',' '{print $3}')
            gsm_band_num=$(echo "$response" | awk -F',' '{print $4}')
            gsm_band=$(tdtech_get_band "GSM" ${gsm_band_num})
            gsm_arfcn=$(echo "$response" | awk -F',' '{print $5}')
            gsm_bsic=$(echo "$response" | awk -F',' '{print $6}')
            gsm_cell_id_hex=$(echo "$response" | awk -F',' '{print $7}')
            gsm_cell_id=$(echo "ibase=16; $gsm_cell_id_hex" | bc)
            gsm_lac=$(echo "$response" | awk -F',' '{print $8}')
            gsm_rxlev=$(echo "$response" | awk -F',' '{print $9}')
            gsm_rx_quality=$(echo "$response" | awk -F',' '{print $10}')
            gsm_ta=$(echo "$response" | awk -F',' '{print $11}' | sed 's/\r//g')
        ;;
    esac

    tdtech_ca_info
}

tdtech_ca_info()
{
    local response sysmode prefix carrier fields band dl_fcn dl_freq dl_bw
    local ul_fcn ul_freq ul_bw role

    response=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" "AT^HFREQINFO?" | grep "\^HFREQINFO:" | sed -n '1p')
    [ -n "$response" ] || return
    fields=$(echo "$response" | sed 's/^.*\^HFREQINFO:[[:space:]]*//;s/\r//g')
    sysmode=$(echo "$fields" | cut -d, -f2)
    [ "$sysmode" = "7" ] && prefix="N" || prefix="B"
    fields=$(echo "$fields" | cut -d, -f3-)
    carrier=0
    while [ -n "$fields" ]; do
        carrier=$((carrier + 1))
        band=$(echo "$fields" | cut -d, -f1); dl_fcn=$(echo "$fields" | cut -d, -f2)
        dl_freq=$(echo "$fields" | cut -d, -f3); dl_bw=$(echo "$fields" | cut -d, -f4)
        ul_fcn=$(echo "$fields" | cut -d, -f5); ul_freq=$(echo "$fields" | cut -d, -f6)
        ul_bw=$(echo "$fields" | cut -d, -f7)
        [ "$carrier" -eq 1 ] && role="PCC" || role="SCC$((carrier - 1))"
        ca_carriers="$ca_carriers${ca_carriers:+ | }$role"
        ca_band="$ca_band${ca_band:+ | }${prefix}${band}"
        ca_dl_arfcn="$ca_dl_arfcn${ca_dl_arfcn:+ | }$dl_fcn"
        ca_dl_frequency="$ca_dl_frequency${ca_dl_frequency:+ | }$(awk -v f="$dl_freq" -v m="$sysmode" 'BEGIN { printf "%g MHz", f/(m==7?1000:10) }')"
        ca_dl_bandwidth="$ca_dl_bandwidth${ca_dl_bandwidth:+ | }$(awk -v b="$dl_bw" 'BEGIN { printf "%g MHz", b/1000 }')"
        ca_ul_arfcn="$ca_ul_arfcn${ca_ul_arfcn:+ | }$ul_fcn"
        ca_ul_frequency="$ca_ul_frequency${ca_ul_frequency:+ | }$(awk -v f="$ul_freq" -v m="$sysmode" 'BEGIN { printf "%g MHz", f/(m==7?1000:10) }')"
        ca_ul_bandwidth="$ca_ul_bandwidth${ca_ul_bandwidth:+ | }$(awk -v b="$ul_bw" 'BEGIN { printf "%g MHz", b/1000 }')"
        fields=$(echo "$fields" | cut -d, -f8-)
        [ "$fields" = "$ul_bw" ] && break
    done
}

#获取鼎桥模组信息
# $1:AT串口
# $2:平台
# $3:连接定义
get_tdtech_info()
{
    debug "get tdtech info"
    #设置AT串口
    at_port="$1"
    platform="$2"
    define_connect="$3"

    #基本信息
    tdtech_base_info

	#SIM卡信息
    tdtech_sim_info
    if [ "$sim_status" != "ready" ]; then
        return
    fi

    #网络信息
    tdtech_network_info

    #小区信息
    tdtech_cell_info
}
