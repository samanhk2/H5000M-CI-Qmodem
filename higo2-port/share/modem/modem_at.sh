#!/bin/sh
# Copyright (C) 2023 Siriling <siriling@qq.com>

#脚本目录
SCRIPT_DIR="/usr/share/modem"
source "${SCRIPT_DIR}/modem_debug.sh"

#发送at命令
# $1 AT串口
# $2 AT命令
if [ -n "$MODEM_OVERVIEW_CAPTURE_DIR" ] && [ -d "$MODEM_OVERVIEW_CAPTURE_DIR" ]; then
    key=$(printf '%s' "$2" | md5sum | cut -d ' ' -f 1)
    record="$MODEM_OVERVIEW_CAPTURE_DIR/$key.json"
    if [ -s "$record" ]; then
        jq -r --arg command "$2" '.[$command].data' "$record"
    else
        response=$(at "$1" "$2")
        result=$?
        printf '%s\n' "$response"
        success=false
        printf '%s\n' "$response" | tr -d '\r' | grep -x OK >/dev/null && success=true
        record_tmp="${record}.new.$$"
        jq -n --arg command "$2" --arg data "$response" --argjson success "$success" '{($command): {data: $data, success: $success}}' > "$record_tmp" && mv -f "$record_tmp" "$record"
        rm -f "$record_tmp"
        exit "$result"
    fi
else
    at "$1" "$2"
fi