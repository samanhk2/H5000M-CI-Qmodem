#!/bin/sh
# Copyright (C) 2023 Siriling <siriling@qq.com>

#脚本目录
SCRIPT_DIR="/usr/share/modem"

# Return the first payload line from a plain AT response.  The local AT broker
# may emit an echoed command followed by one or more empty CRLF lines, so fixed
# line numbers are not reliable on Quectel modules (notably RM502Q-AE).
quectel_at_payload()
{
    local at_port="$1"
    local at_command="$2"

    sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" "$at_command" 2>/dev/null |
        tr -d '\r' |
        awk -v command="$at_command" '
            {
                line=$0
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
                if (line == "" || toupper(line) == toupper(command)) next
                if (line == "OK") { complete=1; next }
                if (line ~ /^(ERROR|\+CME ERROR:|\+CMS ERROR:)/) { failed=1; next }
                if (toupper(command) == "AT+CGMM" && line ~ /^\+CGMM:/) {
                    sub(/^\+CGMM:[[:space:]]*/, "", line)
                } else if (toupper(command) == "AT+CGMI" && line ~ /^\+CGMI:/) {
                    sub(/^\+CGMI:[[:space:]]*/, "", line)
                } else if (line ~ /^\+/ || line == "RING" || line == "NO CARRIER") {
                    next
                }
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
                if (line ~ /^".*"$/) line=substr(line, 2, length(line)-2)
                if (!found && line != "") { payload=line; found=1 }
            }
            END {
                if (complete && !failed && found) print payload
                else exit 1
            }
        '
}

# Read the native owner's exact current generation. Vendor scripts never pick
# the first modem or use a logical alias as a wildcard for every UCI section.
quectel_mode_owner()
{
 command -v m_mode_owner >/dev/null 2>&1 || . "${SCRIPT_DIR}/modem_mode_util.sh" || return 1
 local proof
 proof="$(m_mode_owner "$1" quectel "$2")" || return 1
 printf '%s' "$proof" | jq -e '.platform=="qualcomm" or .platform=="unisoc"' >/dev/null || return 1
 printf '%s\n' "$proof"
}
quectel_mode_transaction()
{
 m_mode_transaction "$1" "$2"
}
quectel_get_mode()
{
 command -v m_mode_owner >/dev/null 2>&1 || . "${SCRIPT_DIR}/modem_mode_util.sh" || return 1
 local proof platform raw mode_num
 proof="$(quectel_mode_owner "$1" "$2")" || { echo unknown;return 1; }
 platform="$(printf '%s' "$proof" | jq -r .platform)"
 raw="$(quectel_mode_transaction "$proof" 'AT+QCFG="usbnet"')" || { echo unknown;return 1; }
 mode_num="$(printf '%s' "$raw" | tr -d '\r' | sed -n 's/^[[:space:]]*+QCFG:[[:space:]]*"usbnet",\([0-9][0-9]*\)[[:space:]]*$/\1/p')"
 case "$mode_num" in ''|*[!0-9]*) echo unknown;return 1;; esac
 case "$platform:$mode_num" in
  qualcomm:0) echo qmi;;
  qualcomm:1|unisoc:1) echo ecm;;
  qualcomm:2|unisoc:2) echo mbim;;
  qualcomm:3|unisoc:3) echo rndis;;
  qualcomm:5|unisoc:5) echo ncm;;
  *) printf '%s\n' "$mode_num";;
 esac
}
quectel_set_mode()
{
 command -v m_mode_owner >/dev/null 2>&1 || . "${SCRIPT_DIR}/modem_mode_util.sh" || return 1
 local proof platform mode_num
 proof="$(quectel_mode_owner "$1")" || return 1
 platform="$(printf '%s' "$proof" | jq -r .platform)"
 case "$platform:$2" in
  qualcomm:qmi|qualcomm:gobinet) mode_num=0;;
  qualcomm:ecm|unisoc:ecm) mode_num=1;;
  qualcomm:mbim|unisoc:mbim) mode_num=2;;
  qualcomm:rndis|unisoc:rndis) mode_num=3;;
  qualcomm:ncm|unisoc:ncm) mode_num=5;;
  *) echo 'Unsupported actual platform/mode; no fallback write issued' >&2;return 1;;
 esac
 m_mode_set_value "$proof" "$mode_num"
}

#获取网络偏好
# $1:AT串口
# $2:数据接口
# $3:模组名称
quectel_get_network_prefer()
{
    sh "${SCRIPT_DIR}/modem_radio_bands.sh" get "$1"
}

quectel_set_network_prefer()
{
    sh "${SCRIPT_DIR}/modem_network_prefer.sh" "$1" "$2"
}

quectel_set_band_prefer()
{
    sh "${SCRIPT_DIR}/modem_radio_bands.sh" set "$1" "$2"
}


#获取电压
# $1:AT串口
quectel_get_voltage()
{
    local at_port="$1"
    
    #Voltage（电压）
    at_command="AT+CBC"
	local voltage=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "+CBC:" | awk -F',' '{print $3}' | sed 's/\r//g')
    echo "${voltage}"
}

#获取温度
# $1:AT串口
quectel_get_temperature()
{
    local at_port="$1" raw
    raw=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" 'AT+QTEMP') || return 1
    printf '%s\n' "$raw" | tr -d '\r' | awk '
      /^[[:space:]]*OK[[:space:]]*$/ { ok=1; next }
      /^[[:space:]]*(ERROR|\+CME ERROR:|\+CMS ERROR:)/ { bad=1; next }
      /^[[:space:]]*\+QTEMP:/ {
        if ($0 !~ /^[[:space:]]*\+QTEMP:[[:space:]]*"[^",]+"[[:space:]]*,/) { bad=1; next }
        value=$0; sub(/^[^,]*,/, "", value)
        gsub(/^[[:space:]]*"?|"?[[:space:]]*$/, "", value)
        if (value !~ /^[+-]?[0-9]+([.][0-9]+)?$/) { bad=1; next }
        if (value+0 >= -40 && value+0 <= 150) {
          if (!found || value+0 > maximum) maximum=value+0
          found=1
        }
      }
      END { if (!bad && ok && found) printf "%g°C\n", maximum; else exit 1 }'
}

#获取连接状态
# $1:AT串口
# $2:连接定义
quectel_get_connect_status()
{
    local at_port="$1"
    local define_connect="$2"

    #默认值为1
    [ -z "$define_connect" ] && {
        define_connect="1"
    }

    # The data interface is authoritative once QMI has acquired an address.
    # This also avoids another AT transaction while the information page and
    # modemwebui share the same serial port.
    local section network_interface
    for section in $(uci -q show modem | sed -n 's/^modem\.\([^.=]*\)=modem-device$/\1/p'); do
        [ "$(uci -q get modem.${section}.at_port)" = "$at_port" ] || continue
        network_interface="$(uci -q get modem.${section}.network_interface)"
        break
    done
    if [ -n "$network_interface" ] && ip -4 addr show dev "$network_interface" 2>/dev/null | grep 'inet ' >/dev/null; then
        echo "connect"
        return
    fi

    at_command="AT+CGPADDR=${define_connect}"
    local response=$(sh ${SCRIPT_DIR}/modem_at.sh "$at_port" "$at_command")
    # Quectel firmwares may return +CGPADDR: 1,"","10.x.x.x,...";
    # do not assume that the first quoted field contains the IPv4 address.
    # Drain the complete AT response before selecting the first address.
    # head closes early and can give upstream grep EPIPE on multi-address replies.
    local ipv4=$(printf '%s\n' "$response" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v '^0\.0\.0\.0$' | sed -n '1p')
    local not_ip="0.0.0.0"

    #设置连接状态
    local connect_status
    if [ -z "$ipv4" ] || [[ "$ipv4" = *"$not_ip"* ]]; then
        connect_status="disconnect"
    else
        connect_status="connect"
    fi
    
    #方法二
    # at_command="AT+QNWINFO"

	# local response=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | grep "+QNWINFO:")

    # local connect_status
	# if [[ "$response" = *"No Service"* ]]; then
    #     connect_status="disconnect"
    # elif [[ "$response" = *"Unknown Service"* ]]; then
    #     connect_status="disconnect"
    # else
    #     connect_status="connect"
    # fi

    echo "$connect_status"
}

#基本信息
quectel_base_info()
{
    debug "Quectel base info"

    #Name（名称）
    at_command="AT+CGMM"
    name=$(quectel_at_payload "$at_port" "$at_command")
    #Manufacturer（制造商）
    at_command="AT+CGMI"
    manufacturer=$(quectel_at_payload "$at_port" "$at_command")
    #Revision（固件版本）
    at_command="ATI"
    revision=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | grep "Revision:" | sed 's/Revision: //g' | sed 's/\r//g')
    # at_command="AT+CGMR"
    # revision=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | sed -n '2p' | sed 's/\r//g')

    #Mode（拨号模式）
    mode=$(quectel_get_mode ${at_port} ${platform} | tr 'a-z' 'A-Z')

    #Temperature（温度）
    temperature=$(quectel_get_temperature ${at_port})
}

#获取SIM卡状态
# $1:SIM卡状态标志
quectel_get_sim_status()
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
quectel_sim_info()
{
    debug "Quectel sim info"
    
    #SIM Slot（SIM卡卡槽）
    at_command="AT+QUIMSLOT?"
	sim_slot=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | grep "+QUIMSLOT:" | awk -F' ' '{print $2}' | sed 's/\r//g')

    #IMEI（国际移动设备识别码）
    at_command="AT+CGSN"
	imei=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | tr -d '\r' | awk '/^[0-9]+$/ && length($0)>=14 && length($0)<=16 {if (!emitted) {print; emitted=1}}')

    #SIM Status（SIM状态）
    at_command="AT+CPIN?"
	sim_status_flag=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" "$at_command")
    sim_status=$(quectel_get_sim_status "$sim_status_flag")

    if [ "$sim_status" != "ready" ]; then
        return
    fi

    #ISP（互联网服务提供商）
        ISP_Read(){
            sh "${SCRIPT_DIR}/modem_at.sh" /dev/modem-at "AT+COPS=3,2" > /dev/null 2>&1
            operatorCode=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" 'AT+COPS?' | tr -d '\r' | awk -F ',' '/^\+COPS:/ {gsub(/[" ]/, "", $3); if (!emitted) {print $3; emitted=1}}')
            case "$operatorCode" in
                [0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9]) ;;
                *)
                    imsi=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" 'AT+CIMI' | tr -d '\r' | awk '/^[0-9]+$/ && length($0)>=14 && length($0)<=15 {if (!emitted) {print; emitted=1}}')
                    operatorCode=$(printf '%s' "$imsi" | cut -c1-5)
                    ;;
            esac
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
    # # elif [ "$isp" = "CHN-UNICOM" ] || [ "$isp" = "UNICOM" ] || [ "$isp" = "46001" ]; then
    # elif [ "$isp" = "CHN-UNICOM" ] || [ "$isp" = "CUCC" ] || [ "$isp" = "46001" ]; then
    #     isp="中国联通"
    # # elif [ "$isp" = "CHN-CT" ] || [ "$isp" = "CT" ] || [ "$isp" = "46011" ]; then
    # elif [ "$isp" = "CHN-TELECOM" ] || [ "$isp" = "CTCC" ] || [ "$isp" = "46011" ]; then
    #     isp="中国电信"
    # fi

    #SIM Number（SIM卡号码，手机号）
    at_command="AT+CNUM"
	# Quectel commonly returns +CNUM: ,"+86...",145.  The old fixed
	# second-line/fourth-quote parser therefore discarded a valid number.
	# Read through the canonical AT endpoint and take the first non-empty
	# quoted phone number regardless of echoed lines or firmware formatting.
	sim_number=$(sh "${SCRIPT_DIR}/modem_at.sh" /dev/modem-at "$at_command" 2>/dev/null |
		tr -d '\r' | sed -n 's/^+CNUM:.*"\([+0-9][+0-9]*\)".*/\1/p' | sed -n '1p')
	[ -n "$sim_number" ] || sim_number="SIM卡未存储号码"

    #IMSI（国际移动用户识别码）
    at_command="AT+CIMI"
	imsi=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | tr -d '\r' | awk '/^[0-9]+$/ && length($0)>=14 && length($0)<=16 {if (!emitted) {print; emitted=1}}')

    #ICCID（集成电路卡识别码）
    at_command="AT+ICCID"
    iccid=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" "$at_command" 2>/dev/null |
        tr -d '\r' | sed -n 's/^+ICCID:[[:space:]]*\([0-9]\+\).*$/\1/p' | sed -n '1p')
    if [ -z "$iccid" ]; then
        at_command="AT+QCCID"
        iccid=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" "$at_command" 2>/dev/null |
            tr -d '\r' | sed -n 's/^+QCCID:[[:space:]]*\([0-9]\+\).*$/\1/p' | sed -n '1p')
    fi
}

#获取网络类型
# $1:网络类型数字
quectel_get_rat()
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

#获取信号强度指示
# $1:信号强度指示数字
quectel_get_rssi()
{
    local rssi
    case $1 in
		"99") rssi="unknown" ;;
		* )  rssi=$((2 * $1 - 113)) ;;
	esac
    echo "$rssi"
}

#网络信息
quectel_network_info()
{
    debug "Quectel network info"

    #Connect Status（连接状态）
    connect_status=$(quectel_get_connect_status ${at_port} ${define_connect})

    #Network Type（网络类型）
    at_command="AT+QNWINFO"
    network_type=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "+QNWINFO:" | awk -F'"' '{print $2}')

    [ -z "$network_type" ] && {
        at_command='AT+COPS?'
        local rat_num=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "+COPS:" | awk -F',' '{print $4}' | sed 's/\r//g')
        network_type=$(quectel_get_rat ${rat_num})
    }

    #CSQ（信号强度）
    at_command="AT+CSQ"
    response=$(sh ${SCRIPT_DIR}/modem_at.sh ${at_port} ${at_command} | grep "+CSQ:" | sed 's/+CSQ: //g' | sed 's/\r//g')

    #RSSI（信号强度指示）
    # rssi_num=$(echo $response | awk -F',' '{print $1}')
    # rssi=$(quectel_get_rssi $rssi_num)
    #Ber（信道误码率）
    # ber=$(echo $response | awk -F',' '{print $2}')

    #PER（信号强度）
    # if [ -n "$csq" ]; then
    #     per=$((csq * 100/31))"%"
    # fi

    # PDP 状态只约束承载参数，不约束无线注册和信号读取。
    [ "$connect_status" = "connect" ] || return 0

    #最大比特率，信道质量指示
    at_command='AT+QNWCFG="nr5g_ambr"'
    response=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | grep "+QNWCFG:")
    for context in $response; do
        local apn=$(echo "$context" | awk -F'"' '{print $4}' | tr 'a-z' 'A-Z')
        if [ -n "$apn" ] && [ "$apn" != "IMS" ]; then
            #CQL UL（上行信道质量指示）
            cqi_ul=$(echo "$context" | awk -F',' '{print $5}')
            #CQI DL（下行信道质量指示）
            cqi_dl=$(echo "$context" | awk -F',' '{print $3}')
            #AMBR UL（上行签约速率，单位，Mbps）
            ambr_ul=$(echo "$context" | awk -F',' '{print $6}' | sed 's/\r//g')
            #AMBR DL（下行签约速率，单位，Mbps）
            ambr_dl=$(echo "$context" | awk -F',' '{print $4}')
            break
        fi
    done

    #速率统计
    at_command='AT+QNWCFG="up/down"'
    response=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command | grep "+QNWCFG:" | sed 's/+QNWCFG: "up\/down",//g' | sed 's/\r//g')

    #当前上传速率（单位，Byte/s）
    tx_rate=$(echo $response | awk -F',' '{print $1}')

    #当前下载速率（单位，Byte/s）
    rx_rate=$(echo $response | awk -F',' '{print $2}')
}

#获取频段
# $1:网络类型
# $2:频段数字
quectel_get_band()
{
    local band
    case $1 in
        "WCDMA") band="$2" ;;
        "LTE") band="$2" ;;
        "NR") band="$2" ;;
	esac
    echo "$band"
}

#获取带宽
# $1:网络类型
# $2:带宽数字
quectel_get_bandwidth()
{
    local network_type="$1"
    local bandwidth_num="$2"

    local bandwidth
    case $network_type in
		"LTE")
            case $bandwidth_num in
                "0") bandwidth="1.4" ;;
                "1") bandwidth="3" ;;
                "2"|"3"|"4"|"5") bandwidth=$((($bandwidth_num - 1) * 5)) ;;
            esac
        ;;
        "NR")
            case $bandwidth_num in
                "0"|"1"|"2"|"3"|"4"|"5") bandwidth=$((($bandwidth_num + 1) * 5)) ;;
                "6"|"7"|"8"|"9"|"10"|"11"|"12") bandwidth=$((($bandwidth_num - 2) * 10)) ;;
                "13") bandwidth="200" ;;
                "14") bandwidth="400" ;;
                "15") bandwidth="35" ;;
                "16") bandwidth="45" ;;
            esac
        ;;
	esac
    echo "$bandwidth"
}

#获取NR子载波间隔
# $1:NR子载波间隔数字
quectel_get_scs()
{
    local scs
	case $1 in
		"0") scs="15" ;;
		"1") scs="30" ;;
        "2") scs="60" ;;
        "3") scs="120" ;;
        "4") scs="240" ;;
        *) scs="" ;;
	esac
    echo "$scs"
}

#获取物理信道
# $1:物理信道数字
quectel_get_phych()
{
    local phych
	case $1 in
		"0") phych="DPCH" ;;
        "1") phych="FDPCH" ;;
	esac
    echo "$phych"
}

#获取扩频因子
# $1:扩频因子数字
quectel_get_sf()
{
    local sf
	case $1 in
		"0"|"1"|"2"|"3"|"4"|"5"|"6"|"7") sf=$(awk "BEGIN{ print 2^$(($1+2)) }") ;;
        "8") sf="UNKNOWN" ;;
	esac
    echo "$sf"
}

#获取插槽格式
# $1:插槽格式数字
quectel_get_slot()
{
    local slot=$1
	# case $1 in
		# "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"11"|"12"|"13"|"14"|"15"|"16") slot=$1 ;;
        # "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9") slot=$1 ;;
	# esac
    echo "$slot"
}

#小区信息
quectel_cell_info()
{
    debug "Quectel cell info"

    at_command='AT+QENG="servingcell"'
    response=$(sh ${SCRIPT_DIR}/modem_at.sh $at_port $at_command)
    local rrc_state
    rrc_state=$(printf '%s\n' "$response" | awk -F, '/^\+QENG: *"servingcell"/ {gsub(/[" \r]/,"",$2); value=$2; count++} END {if(count==1) print value}')

    local lte=$(echo "$response" | grep "+QENG: \"LTE\"")
    local nr5g_nsa=$(echo "$response" | grep "+QENG: \"NR5G-NSA\"")
    if [ -n "$lte" ] && [ -n "$nr5g_nsa" ] ; then
        #EN-DC模式
        network_mode="EN-DC Mode"
        #LTE
        endc_lte_duplex_mode=$(echo "$lte" | awk -F',' '{print $2}' | sed 's/"//g')
        endc_lte_mcc=$(echo "$lte" | awk -F',' '{print $3}')
        endc_lte_mnc=$(echo "$lte" | awk -F',' '{print $4}')
        endc_lte_cell_id=$(echo "$lte" | awk -F',' '{print $5}')
        endc_lte_physical_cell_id=$(echo "$lte" | awk -F',' '{print $6}')
        endc_lte_earfcn=$(echo "$lte" | awk -F',' '{print $7}')
        endc_lte_freq_band_ind_num=$(echo "$lte" | awk -F',' '{print $8}')
        endc_lte_freq_band_ind=$(quectel_get_band "LTE" $endc_lte_freq_band_ind_num)
        ul_bandwidth_num=$(echo "$lte" | awk -F',' '{print $9}')
        endc_lte_ul_bandwidth=$(quectel_get_bandwidth "LTE" $ul_bandwidth_num)
        dl_bandwidth_num=$(echo "$lte" | awk -F',' '{print $10}')
        endc_lte_dl_bandwidth=$(quectel_get_bandwidth "LTE" $dl_bandwidth_num)
        endc_lte_tac=$(echo "$lte" | awk -F',' '{print $11}')
        endc_lte_rsrp=$(echo "$lte" | awk -F',' '{print $12}')
        endc_lte_rsrq=$(echo "$lte" | awk -F',' '{print $13}')
        endc_lte_rssi=$(echo "$lte" | awk -F',' '{print $14}')
        endc_lte_sinr=$(echo "$lte" | awk -F',' '{print $15}')
        endc_lte_cql=$(echo "$lte" | awk -F',' '{print $16}')
        endc_lte_srxlev=$(echo "$lte" | awk -F',' '{print $18}' | sed 's/\r//g')
        #NR5G-NSA
        endc_nr_mcc=$(echo "$nr5g_nsa" | awk -F',' '{print $2}')
        endc_nr_mnc=$(echo "$nr5g_nsa" | awk -F',' '{print $3}')
        endc_nr_physical_cell_id=$(echo "$nr5g_nsa" | awk -F',' '{print $4}')
        endc_nr_rsrp=$(echo "$nr5g_nsa" | awk -F',' '{print $5}')
        endc_nr_sinr=$(echo "$nr5g_nsa" | awk -F',' '{print $6}')
        endc_nr_rsrq=$(echo "$nr5g_nsa" | awk -F',' '{print $7}')
        endc_nr_arfcn=$(echo "$nr5g_nsa" | awk -F',' '{print $8}')
        endc_nr_band_num=$(echo "$nr5g_nsa" | awk -F',' '{print $9}')
        endc_nr_band=$(quectel_get_band "NR" $endc_nr_band_num)
        nr_dl_bandwidth_num=$(echo "$nr5g_nsa" | awk -F',' '{print $10}')
        endc_nr_dl_bandwidth=$(quectel_get_bandwidth "NR" $nr_dl_bandwidth_num)
        scs_num=$(echo "$nr5g_nsa" | awk -F',' '{print $11}' | sed 's/\r//g')
        endc_nr_scs=$(quectel_get_scs $scs_num)
    else
        #SA，LTE，WCDMA模式
        response=$(echo "$response" | grep "+QENG:")
        local rat=$(echo "$response" | awk -F',' '{print $3}' | sed 's/"//g')
        case $rat in
            "NR5G-SA")
                network_mode="NR5G-SA Mode"
                nr_duplex_mode=$(echo "$response" | awk -F',' '{print $4}' | sed 's/"//g')
                nr_mcc=$(echo "$response" | awk -F',' '{print $5}')
                nr_mnc=$(echo "$response" | awk -F',' '{print $6}')
                nr_cell_id=$(echo "$response" | awk -F',' '{print $7}')
                nr_physical_cell_id=$(echo "$response" | awk -F',' '{print $8}')
                nr_tac=$(echo "$response" | awk -F',' '{print $9}')
                nr_arfcn=$(echo "$response" | awk -F',' '{print $10}')
                nr_band_num=$(echo "$response" | awk -F',' '{print $11}')
                nr_band=$(quectel_get_band "NR" $nr_band_num)
                nr_dl_bandwidth_num=$(echo "$response" | awk -F',' '{print $12}')
                nr_dl_bandwidth=$(quectel_get_bandwidth "NR" $nr_dl_bandwidth_num)
                nr_rsrp=$(echo "$response" | awk -F',' '{print $13}')
                nr_rsrq=$(echo "$response" | awk -F',' '{print $14}')
                nr_sinr=$(echo "$response" | awk -F',' '{print $15}')
                nr_scs_num=$(echo "$response" | awk -F',' '{print $16}')
                nr_scs=$(quectel_get_scs $nr_scs_num)
                nr_srxlev=$(echo "$response" | awk -F',' '{print $17}' | sed 's/\r//g')
            ;;
            "LTE"|"CAT-M"|"CAT-NB")
                network_mode="LTE Mode"
                lte_duplex_mode=$(echo "$response" | awk -F',' '{print $4}' | sed 's/"//g')
                lte_mcc=$(echo "$response" | awk -F',' '{print $5}')
                lte_mnc=$(echo "$response" | awk -F',' '{print $6}')
                lte_cell_id=$(echo "$response" | awk -F',' '{print $7}')
                lte_physical_cell_id=$(echo "$response" | awk -F',' '{print $8}')
                lte_earfcn=$(echo "$response" | awk -F',' '{print $9}')
                lte_freq_band_ind_num=$(echo "$response" | awk -F',' '{print $10}')
                lte_freq_band_ind=$(quectel_get_band "LTE" $lte_freq_band_ind_num)
                ul_bandwidth_num=$(echo "$response" | awk -F',' '{print $11}')
                lte_ul_bandwidth=$(quectel_get_bandwidth "LTE" $ul_bandwidth_num)
                dl_bandwidth_num=$(echo "$response" | awk -F',' '{print $12}')
                lte_dl_bandwidth=$(quectel_get_bandwidth "LTE" $dl_bandwidth_num)
                lte_tac=$(echo "$response" | awk -F',' '{print $13}')
                lte_rsrp=$(echo "$response" | awk -F',' '{print $14}')
                lte_rsrq=$(echo "$response" | awk -F',' '{print $15}')
                lte_rssi=$(echo "$response" | awk -F',' '{print $16}')
                lte_sinr=$(echo "$response" | awk -F',' '{print $17}')
                lte_cql=$(echo "$response" | awk -F',' '{print $18}')
                lte_srxlev=$(echo "$response" | awk -F',' '{print $20}' | sed 's/\r//g')
            ;;
            "WCDMA")
                network_mode="WCDMA Mode"
                wcdma_mcc=$(echo "$response" | awk -F',' '{print $4}')
                wcdma_mnc=$(echo "$response" | awk -F',' '{print $5}')
                wcdma_lac=$(echo "$response" | awk -F',' '{print $6}')
                wcdma_cell_id=$(echo "$response" | awk -F',' '{print $7}')
                wcdma_uarfcn=$(echo "$response" | awk -F',' '{print $8}')
                wcdma_psc=$(echo "$response" | awk -F',' '{print $9}')
                wcdma_rac=$(echo "$response" | awk -F',' '{print $10}')
                wcdma_rscp=$(echo "$response" | awk -F',' '{print $11}')
                wcdma_ecio=$(echo "$response" | awk -F',' '{print $12}')
                wcdma_phych_num=$(echo "$response" | awk -F',' '{print $13}')
                wcdma_phych=$(quectel_get_phych $wcdma_phych_num)
                wcdma_sf_num=$(echo "$response" | awk -F',' '{print $14}')
                wcdma_sf=$(quectel_get_sf $wcdma_sf_num)
                wcdma_slot_num=$(echo "$response" | awk -F',' '{print $15}')
                wcdma_slot=$(quectel_get_slot $wcdma_slot_num)
                wcdma_speech_code=$(echo "$response" | awk -F',' '{print $16}')
                wcdma_com_mod=$(echo "$response" | awk -F',' '{print $17}' | sed 's/\r//g')
            ;;
        esac
    fi

    # Quectel defines QENG NR bandwidth only for RRC CONNECT. Idle values can
    # differ from the independently reported QCAINFO configured carrier width.
    if [ "$rrc_state" != "CONNECT" ]; then
        nr_dl_bandwidth=""; endc_nr_dl_bandwidth=""
    fi
    return 0
}

# Collect the carrier records actually returned by the module. Do not invent
# uplink fields: short NR QCAINFO records do not contain them.
quectel_carrier_info()
{
    local records row role channel width band rat ul_width ul_channel ext
    ca_carriers=""; ca_band=""; ca_dl_arfcn=""; ca_dl_bandwidth=""
    ca_ul_arfcn=""; ca_ul_bandwidth=""
    records=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" 'AT+QCAINFO' | tr -d '\r' | grep '^+QCAINFO:')
    [ -n "$records" ] || return 0
    while IFS= read -r row; do
        role=$(echo "$row" | cut -d',' -f1 | sed 's/.*"\([^" ]*\)"/\1/')
        channel=$(echo "$row" | cut -d',' -f2 | tr -d ' ')
        width=$(echo "$row" | cut -d',' -f3 | tr -d ' ')
        band=$(echo "$row" | cut -d',' -f4 | tr -d '"' | sed 's/^ *//')
        case "$role" in PCC|SCC) ;; *) continue ;; esac
        case "$channel" in ''|*[!0-9]*) channel="-" ;; esac
        case "$band" in
            'NR5G BAND '*) band="N${band#NR5G BAND }"; rat=NR
                width=$(quectel_get_bandwidth NR "$width") ;;
            'LTE BAND '*) band="B${band#LTE BAND }"; rat=LTE
                # QCAINFO LTE uses RB counts, unlike QENG's enum.
                case "$width" in 6) width=1.4;; 15) width=3;; 25) width=5;; 50) width=10;; 75) width=15;; 100) width=20;; *) width="-";; esac ;;
            *) continue ;;
        esac
        [ -n "$width" ] || width="-"
        ul_width="-"; ul_channel="-"
        if [ "$rat" = NR ]; then
            # Extended NR SCC: state,PCI,UL_configured,UL_BW,UL_ARFCN.
            # The short format has PCI,RSRP,RSRQ here. Validate the complete
            # discriminator, so a small PCI cannot masquerade as cell state.
            ext=$(printf '%s\n' "$row" | awk -F, '
                NF >= 9 && $5 ~ /^[012]$/ && $6 ~ /^[0-9]+$/ && $6+0<=1007 && $7 ~ /^[01]$/ {
                    if ($7==1 && $8 ~ /^[0-9]+$/ && $8+0<=16 && $9 ~ /^[0-9]+$/) print $8 "," $9
                }')
            if [ -n "$ext" ]; then
                ul_width=$(quectel_get_bandwidth NR "${ext%%,*}")
                ul_channel="${ext#*,}"
            fi
        elif [ "$role" = SCC ]; then
            ext=$(printf '%s\n' "$row" | awk -F, 'NF>=13 && $11==1 && $12 ~ /^[0-9]+$/ && $13 ~ /^[0-9]+$/ {print $12 "," $13}')
            if [ -n "$ext" ]; then
                case "${ext%%,*}" in 6) ul_width=1.4;; 15) ul_width=3;; 25) ul_width=5;; 50) ul_width=10;; 75) ul_width=15;; 100) ul_width=20;; esac
                ul_channel="${ext#*,}"
            fi
        fi
        ca_carriers="${ca_carriers:+$ca_carriers | }$role"
        ca_band="${ca_band:+$ca_band | }$band"
        ca_dl_arfcn="${ca_dl_arfcn:+$ca_dl_arfcn | }$channel"
        ca_dl_bandwidth="${ca_dl_bandwidth:+$ca_dl_bandwidth | }$width"
        ca_ul_arfcn="${ca_ul_arfcn:+$ca_ul_arfcn | }$ul_channel"
        ca_ul_bandwidth="${ca_ul_bandwidth:+$ca_ul_bandwidth | }$ul_width"
    done <<EOF
$records
EOF
}

# CSI is RAT-scoped serving-cell data. Never copy it to every CA carrier.
# Both consumers still use the modem transaction lock; this collector publishes
# its own complete snapshot, independently of a browser being open.
quectel_csi_read()
{
    local name="$1" raw now retry state
    # A successful native test response is the firmware's supported parameter
    # list. Do not probe absent keys on every overview refresh. Unknown or
    # failed capability reads retain the existing read/retry behaviour.
    if [ -n "$quectel_csi_capabilities" ] &&
       ! printf '%s\n' "$quectel_csi_capabilities" | grep -Fx "$name" >/dev/null; then
        return 0
    fi
    state="/tmp/modem-csi-$(printf '%s' "$(readlink -f "$at_port")-$name" | tr -c 'A-Za-z0-9' '_')"
    now=$(cut -d. -f1 /proc/uptime)
    retry=$(cat "$state.retry" 2>/dev/null)
    case "$retry" in ''|*[!0-9]*) retry=0 ;; esac
    [ "$now" -lt "$retry" ] && return 0
    raw=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" "AT+QNWCFG=\"$name\"")
    printf '%s\n' "$raw" | tr -d '\r' | awk -v name="$name" '
        index($0, "+QNWCFG: \"" name "\",") == 1 {
            sub(/^[^,]*,/, ""); gsub(/[[:space:]]/, ""); if (!found) {print; found=1}
        } END {if (!found) exit 1}' && return 0
    echo $((now + 60)) > "$state.retry"
}

quectel_csi_sample()
{
    local family="$1" control="$2" csi dl ul
    csi=$(quectel_csi_read "${family}_csi")
    dl=$(quectel_csi_read "${family}_dlMCS")
    ul=$(quectel_csi_read "${family}_ulMCS")
    jq -cn --arg family "$family" --arg control "$control" --arg csi "$csi" --arg dl "$dl" --arg ul "$ul" '
      def num($v; $max): if (($v // "" | length) > 0 and all(($v // "" | explode[]); . >= 48 and . <= 57)) then
        ($v | tonumber) as $n | if $n <= $max then ($n | tostring) else "-" end else "-" end;
      def modtype($v): {"1":"BPSK","2":"QPSK","4":"16QAM","6":"64QAM","8":"256QAM"}[$v] // "-";
      ($control | split(",")) as $ctrl | ($csi | split(",")) as $c |
      ($dl | split(",")) as $d | ($ul | split(",")) as $u |
      ($ctrl[if $family == "lte" then 0 else 1 end] // "-") as $enabled |
      (if $enabled != "0" and ($c|length) == 4 then num($c[0];31) else "-" end) as $mcs |
      [{"DL MCS": (if ($d|length)==3 and $d[0]=="1" then num($d[1];31) else $mcs end)},
       {"UL MCS": (if ($u|length)==3 and $u[0]=="1" then num($u[1];31) else "-" end)},
       {"DL Modulation": (if ($d|length)==3 and $d[0]=="1" and num($d[1];31)!="-" then modtype($d[2]) else "-" end)},
       {"UL Modulation": (if ($u|length)==3 and $u[0]=="1" and num($u[1];31)!="-" then modtype($u[2]) else "-" end)},
       {"RI": (if $enabled!="0" and ($c|length)==4 then num($c[1];8) else "-" end)},
       {"CSI CQI": (if $enabled!="0" and ($c|length)==4 then num($c[2];15) else "-" end)},
       {"PMI": (if $enabled!="0" and ($c|length)==4 then num($c[3];65535) else "-" end)},
       {"CSI Status": (if $enabled=="1" then "Enabled" elif $enabled=="0" then "Disabled" else "-" end)}]'
}

quectel_csi_info()
{
    local control capabilities_raw
    quectel_csi_nr='[]'; quectel_csi_lte='[]'
    quectel_csi_capabilities=""
    case "$network_mode" in 'NR5G-SA Mode'|'LTE Mode'|'EN-DC Mode') ;; *) return ;; esac
    capabilities_raw=$(sh "${SCRIPT_DIR}/modem_at.sh" "$at_port" 'AT+QNWCFG=?')
    if printf '%s\n' "$capabilities_raw" | tr -d '\r' | grep -x OK >/dev/null; then
        quectel_csi_capabilities=$(printf '%s\n' "$capabilities_raw" | tr -d '\r' |
            sed -n 's/^+QNWCFG: "\([A-Za-z0-9_]*\)".*$/\1/p')
    fi
    control=$(quectel_csi_read csi_ctrl)
    # Reads remain safe on unsupported firmware. Do not silently reconfigure
    # module acquisition from a status page; an explicitly disabled CSI is shown.
    case "$network_mode" in
        'NR5G-SA Mode') quectel_csi_nr=$(quectel_csi_sample nr5g "$control") ;;
        'LTE Mode') quectel_csi_lte=$(quectel_csi_sample lte "$control") ;;
        'EN-DC Mode')
            quectel_csi_lte=$(quectel_csi_sample lte "$control")
            quectel_csi_nr=$(quectel_csi_sample nr5g "$control") ;;
    esac
}

#获取移远模组信息
# $1:AT串口
# $2:平台
# $3:连接定义
get_quectel_info()
{
    debug "get quectel info"
    #设置AT串口
    at_port="$1"
    platform="$2"
    define_connect="$3"

    #基本信息
    quectel_base_info

	#SIM卡信息
    quectel_sim_info
    if [ "$sim_status" != "ready" ]; then
        return
    fi

    #网络信息
    quectel_network_info

    #小区信息
    quectel_cell_info
    quectel_carrier_info
    quectel_csi_info

    return 0
}
