#!/bin/sh
# Copyright (C) 2023 Siriling <siriling@qq.com>

#脚本目录
SCRIPT_DIR="/usr/share/modem"

source "${SCRIPT_DIR}/quectel.sh"
source "${SCRIPT_DIR}/tdtech.sh"

#调试开关
# 0关闭
# 1打开
# 2输出到文件
switch=0
out_file="/tmp/modem.log"	#输出文件
#日志信息
debug()
{
	time=$(date "+%Y-%m-%d %H:%M:%S")	#获取系统时间
	if [ $switch = 1 ]; then
		echo $time $1					#打印输出
	elif [ $switch = 2 ]; then
		echo $time $1 >> $outfile		#输出到文件
	fi
}

#发送at命令
# $1 AT串口
# $2 AT命令
at()
{
	local at_port="$1"
	local at_command="$2"
	# modem's internal tool serializes complete AT transactions. Discovery
	# may pass a physical candidate; upper layers use /dev/modem-at.
	/usr/libexec/modem/at "${at_port}" "${at_command}"

}

#测试时打开
# debug $1
# at $1 $2

#拨号日志
# $1:AT命令
# $2:日志路径
dial_log()
{
	local at_command="$1"
	local path="$2"

	#打印日志
    local update_time=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[${update_time}] Send AT command ${at_command} to modem" >> "${path}"
}
