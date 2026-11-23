#!/bin/sh
# Copyright (C) 2023 Siriling <siriling@qq.com>

#脚本目录
SCRIPT_DIR="/usr/share/modem"
source "${SCRIPT_DIR}/modem_util.sh"

#模组配置初始化
modem_init()
{
    m_log "info" "Clearing all modem configurations"
    local section sections
    sections="$(ubus call uci get '{"config":"modem"}' | jq -r '.values | to_entries[] | select(.value[".type"]=="modem-device") | .key')" || return 1
    for section in $sections; do
        case "$section" in ''|*[!A-Za-z0-9_]*) return 1 ;; esac
        uci -q del modem.${section} || return 1
    done
    uci set modem.@global[0].modem_number=0
    uci commit modem
    m_log "info" "All module configurations cleared"
}

modem_init