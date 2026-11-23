-- Copyright 2024 Siriling <siriling@qq.com>
module("luci.controller.modem", package.seeall)
local http = require "luci.http"
local fs = require "nixio.fs"
local json = require("luci.jsonc")
local util = require "luci.util"
local i18n = require "luci.i18n"
uci = luci.model.uci.cursor()
local script_path="/usr/share/modem/"
local run_path="/tmp/run/modem/"
local logical_at_port="/dev/modem-at"

local function modemPresent(device)
	if device.path and device.path ~= "" then
		return fs.stat(device.path, "type") == "dir"
	end
    return false
end

local function resolveATPort(port)
    local physical = fs.realpath(logical_at_port)
    if not physical or fs.stat(physical, "type") ~= "chr" then return nil end
    if port == nil or port == logical_at_port or fs.realpath(port) == physical then return physical end
    return nil
end

local owner_keys={"bootId","section","physicalPort","portInode","aliasInode","devicePath","deviceInode","manufacturer","model","platform"}
local function currentSnapshotOwner()
    local result = util.exec("sh -c '. /usr/share/modem/modem_util.sh; m_snapshot_owner' 2>/dev/null")
    local owner = json.parse(result or "")
    if type(owner) ~= "table" then return nil end
    for _, key in ipairs(owner_keys) do if type(owner[key]) ~= "string" then return nil end end
    return owner
end
local function snapshotOwned(snapshot, owner)
    if not owner or type(snapshot) ~= "table" or type(snapshot._native_owner) ~= "table" then return false end
    for _, key in ipairs(owner_keys) do
        if snapshot._native_owner[key] ~= owner[key] then return false end
    end
    return true
end
local function actualDataState(device, interfaces)
    local reported=device.network_interface
    local hardware=device.path and fs.realpath(device.path)
    if type(reported) ~= "string" or #reported > 15 or not reported:match("^[%w_.-]+$") or not hardware then return "unknown",nil,nil end
    local physical=fs.realpath("/sys/class/net/"..reported.."/device")
    if not physical or (physical~=hardware and physical:sub(1,#hardware+1)~=hardware.."/") then return "unknown",nil,nil end
    local found,connected=false,false
    for _, row in ipairs(interfaces or {}) do
        if row.l3_device==reported then found=true;if row.up==true then connected=true end end
    end
    if not found then return "unknown",reported,nil end
    local driver=fs.realpath(physical.."/driver") or fs.realpath(physical.."/device/driver")
    return connected and "connect" or "disconnect",reported,driver and driver:match("([^/]+)$")
end

function index()
	entry({"admin", "cellular"}, firstchild(), "蜂窝", 25).dependent = false

    if not nixio.fs.access("/etc/config/modem") then
        return
    end

	entry({"admin", "cellular", "modem"}, alias("admin", "cellular", "modem", "modem_info"), translate("模组管理"), 10).dependent = true

	--模块信息
	entry({"admin", "cellular", "modem", "modem_info"}, template("modem/modem_info"), translate("Modem Information"),10).leaf = true
	entry({"admin", "cellular", "modem", "get_at_port"}, call("getATPort"), nil).leaf = true
	entry({"admin", "cellular", "modem", "get_modem_info"}, call("getModemInfo")).leaf = true

	--拨号配置
	entry({"admin", "cellular", "modem", "dial_overview"},cbi("modem/dial_overview"),translate("Dial Overview"),20).leaf = true
	entry({"admin", "cellular", "modem", "dial_config"}, cbi("modem/dial_config")).leaf = true
	entry({"admin", "cellular", "modem", "get_modems"}, call("getModems"), nil).leaf = true
	entry({"admin", "cellular", "modem", "get_dial_log_info"}, call("getDialLogInfo"), nil).leaf = true
	entry({"admin", "cellular", "modem", "clean_dial_log"}, call("cleanDialLog"), nil).leaf = true
	entry({"admin", "cellular", "modem", "status"}, call("act_status")).leaf = true

	--模块调试
	entry({"admin", "cellular", "modem", "modem_debug"},template("modem/modem_debug"),translate("Modem Debug"),30).leaf = true
	entry({"admin", "cellular", "modem", "get_mode_info"}, call("getModeInfo"), nil).leaf = true
	entry({"admin", "cellular", "modem", "set_mode"}, call("setMode"), nil).leaf = true
	entry({"admin", "cellular", "modem", "get_mode_switch"}, call("getModeSwitch"), nil).leaf = true
	entry({"admin", "cellular", "modem", "get_network_prefer_info"}, call("getNetworkPreferInfo"), nil).leaf = true
	entry({"admin", "cellular", "modem", "set_network_prefer"}, call("setNetworkPrefer"), nil).leaf = true
	entry({"admin", "cellular", "modem", "set_band_prefer"}, call("setBandPrefer"), nil).leaf = true
	entry({"admin", "cellular", "modem", "get_self_test_info"}, call("getSelfTestInfo"), nil).leaf = true
	entry({"admin", "cellular", "modem", "get_quick_commands"}, call("getQuickCommands"), nil).leaf = true
	entry({"admin", "cellular", "modem", "send_at_command"}, call("sendATCommand"), nil).leaf = true
	-- entry({"admin", "cellular", "modem", "get_modem_debug_info"}, call("getModemDebugInfo"), nil).leaf = true

	--插件设置
	entry({"admin", "cellular", "modem", "plugin_config"},cbi("modem/plugin_config"),translate("Plugin Config"),40).leaf = true
	entry({"admin", "cellular", "modem", "modem_scan"}, call("modemScan"), nil).leaf = true

	--插件信息
	entry({"admin", "cellular", "modem", "plugin_info"},template("modem/plugin_info"),translate("Plugin Info"),50).leaf = true
	entry({"admin", "cellular", "modem", "get_plugin_info"}, call("getPluginInfo"), nil).leaf = true

end

--[[
@Description 判断字符串是否含有字母
@Params
	str 字符串
]]
function hasLetters(str)
    local pattern = "%a" -- 匹配字母的正则表达式
    return string.find(str, pattern) ~= nil
end

--[[
@Description 执行Shell脚本
@Params
	command sh命令
]]
function shell(command)
	local odpall = io.popen(command)
	local odp = odpall:read("*a")
	odpall:close()
	return odp
end

--[[
@Description 执行AT命令
@Params
	at_port AT串口
	at_command AT命令
]]
function at(at_port,at_command)
	-- Keep the logical endpoint intact. modem_debug.sh is the single execution
	-- boundary which resolves it to the active modem AT port.
	at_port=logical_at_port
	local command=". "..util.shellquote(script_path.."modem_debug.sh")..
		" && at "..util.shellquote(at_port).." "..util.shellquote(at_command)
	local result=shell(command)
	result=string.gsub(result, "\r", "")
	return result
end

--[[
@Description 获取制造商
@Params
	at_port AT串口
]]
function getManufacturer(at_port)
    return getModemDeviceInfo(at_port).manufacturer or "unknown"
end

--[[
@Description 获取模组拨号模式
@Params
	at_port AT串口
	manufacturer 制造商
	platform 平台
]]
function getMode(at_port,manufacturer,platform)
 local owner=currentSnapshotOwner()
 if not owner or owner.manufacturer~=manufacturer or owner.platform~=(platform or'')or not manufacturer:match('^[a-z0-9_]+$')then return 'unknown'end
 local command='MODEM_AT_EXPECTED_OWNER='..util.shellquote(json.stringify(owner))..' sh -c '..util.shellquote('. '..script_path..manufacturer..'.sh; '..manufacturer..'_get_mode /dev/modem-at '..util.shellquote(platform or''))
 local result=shell(command)
 if not snapshotOwned({_native_owner=currentSnapshotOwner()},owner)then return 'unknown'end
 return(result or''):gsub('\n','')
end

--[[
@Description 获取模组支持的拨号模式
@Params
	at_port AT串口
]]
function getModes(at_port)
    return getModemDeviceInfo(at_port).modes
end

--[[
@Description 获取模组连接状态
@Params
	at_port AT串口
	manufacturer 制造商
	define_connect 连接定义
]]
function getModemConnectStatus(at_port,manufacturer,define_connect)

	local connect_status="unknown"

	if at_port and manufacturer~="unknown" then
		local command="source "..script_path..manufacturer..".sh && "..manufacturer.."_get_connect_status "..at_port.." "..define_connect
		local result=shell(command)
		connect_status=string.gsub(result, "\n", "")
	end

	return connect_status
end

--[[
@Description 获取模组设备信息
@Params
	at_port AT串口
]]
function getModemDeviceInfo(at_port)
    local physical=resolveATPort(at_port)
    local owner=currentSnapshotOwner()
    if not physical or not owner or owner.physicalPort~=physical then return {} end
    local device=uci:get_all("modem",owner.section)
    if not device or device[".type"]~="modem-device" or fs.realpath(device.at_port or "")~=physical
        or device.name~=owner.model or device.manufacturer~=owner.manufacturer
        or (device.platform or "")~=owner.platform then return {} end
    device.data_interface=(device.data_interface or "unknown"):upper()
    device.connect_status="unknown"
    return device
end

--[[
@Description 获取模组更多信息
@Params
	at_port AT串口
	manufacturer 制造商
]]
function getModemMoreInfo(at_port,manufacturer,platform,define_connect)
	-- Keep the logical endpoint as the cache identity.  Only UCI device matching
	-- needs a physical tty; resolving again here resurrected stale ttyUSB2/3
	-- caches after a port handoff and made the page report disconnect/empty data.
	local safe_port = string.gsub(at_port or "unknown", "[^%w]", "_")
	local cache = "/tmp/modem-info-" .. safe_port .. ".json"
    local id = http.formvalue("overview_client") or ""
    local seq = http.formvalue("overview_seq") or ""
    if #id > 0 and #id <= 64 and id:match("^[%w_-]+$") and seq:match("^%d+$") and #seq <= 9 then
        local action = http.formvalue("overview_leave") == "1" and "leave" or "active"
        os.execute("sh " .. script_path .. "modem_overview.sh " .. action .. " " ..
            util.shellquote(id) .. " " .. util.shellquote(seq) .. " >/dev/null 2>&1")
    else
        local command = "sh " .. script_path .. "modem_info_cache.sh " ..
            util.shellquote(at_port or "") .. " " .. util.shellquote(manufacturer or "") .. " " ..
            util.shellquote(platform or "") .. " " .. util.shellquote(define_connect or "")
        os.execute(command .. " >/dev/null 2>&1 &")
    end
    local result = fs.readfile(cache) or "{}"

	--设置值
	local modem_more_info=json.parse(result) or {}
    if fs.stat(cache,"uid")~=0 or not snapshotOwned(modem_more_info,currentSnapshotOwner()) then return {} end
	return modem_more_info
end

--[[
@Description 模块状态获取
]]
function getModemInfo()

	--获取AT串口
	local requested_port = http.formvalue("port")
	local logical_port = logical_at_port
	local at_port = resolveATPort(requested_port)

	--获取信息
	local modem_device_info
	local modem_more_info
	if at_port then
		modem_device_info=getModemDeviceInfo(at_port)
		if modem_device_info and next(modem_device_info) ~= nil then
			-- Match UCI with the physical tty, but collect and cache through the
			-- stable modem AT endpoint.  This prevents logical/physical cache pairs
			-- from alternating after a scan or USB renumbering.
			modem_more_info=getModemMoreInfo(logical_port,modem_device_info["manufacturer"],modem_device_info["platform"],modem_device_info["define_connect"])
		else
			modem_more_info={}
		end
		if modem_more_info and modem_more_info["base_info"] then
			modem_more_info["base_info"]["at_port"] = logical_at_port
		end
		if modem_more_info and modem_more_info["base_info"] and modem_more_info["base_info"]["connect_status"] then
			modem_device_info["connect_status"]=modem_more_info["base_info"]["connect_status"]
		end
	end

	--设置信息
	local modem_info={}
	modem_info["device_info"]=modem_device_info
	modem_info["more_info"]=modem_more_info

	--设置翻译
	local translation={}
	--设备信息翻译
	-- if modem_device_info then
	-- 	local name=modem_device_info["name"]
	-- 	translation[name]=luci.i18n.translate(name)
	-- 	local manufacturer=modem_device_info["manufacturer"]
	-- 	translation[manufacturer]=luci.i18n.translate(manufacturer)
	-- 	local mode=modem_device_info["mode"]
	-- 	translation[mode]=luci.i18n.translate(mode)
	-- 	local data_interface=modem_device_info["data_interface"]
	-- 	translation[data_interface]=luci.i18n.translate(data_interface)
	-- 	local network=modem_device_info["network"]
	-- 	translation[network]=luci.i18n.translate(network)
	-- end

	--基本信息翻译
	-- if modem_more_info["base_info"] then
	-- 	for key in pairs(modem_more_info["base_info"]) do
	-- 		local value=modem_more_info["base_info"][key]
	-- 		--翻译值
	-- 		translation[value]=luci.i18n.translate(value)
	-- 	end
	-- end
	--SIM卡信息翻译
	if modem_more_info and modem_more_info["sim_info"] then
		local sim_info=modem_more_info["sim_info"]
		for i = 1, #sim_info do
			local info = sim_info[i]
			for key in pairs(info) do
				--翻译键
				translation[key]=luci.i18n.translate(key)
				if key == "SIM Status" and type(info[key]) == "string" then
					translation[info[key]]=luci.i18n.translate(info[key])
				end
				-- local value=info[key]
				-- if hasLetters(value) then
				-- 	--翻译值
				-- 	translation[value]=luci.i18n.translate(value)
				-- end
			end
		end
	end
	--网络信息翻译
	if modem_more_info["network_info"] then
		local network_info=modem_more_info["network_info"]
		for i = 1, #network_info do
			local info = network_info[i]
			for key in pairs(info) do
				--翻译键
				translation[key]=luci.i18n.translate(key)
				-- local value=info[key]
				-- if hasLetters(value) then
				-- 	--翻译值
				-- 	translation[value]=luci.i18n.translate(value)
				-- end
			end
		end
	end
	--小区信息翻译
	if modem_more_info["cell_info"] then
		for network_mode_key in pairs(modem_more_info["cell_info"]) do
			--翻译网络模式
			translation[network_mode_key]=luci.i18n.translate(network_mode_key)
			if network_mode_key == "EN-DC Mode" then
				local network_mode=modem_more_info["cell_info"][network_mode_key]
				for i = 1, #network_mode do
					for key in pairs(network_mode[i]) do
						--获取每个网络类型信息
						local network_type=network_mode[i][key]
						for j = 1, #network_type do
							local info = network_type[j]
							for key in pairs(info) do
								translation[key]=luci.i18n.translate(key)
							end
						end
					end
				end
			else
				--获取网络类型信息
				local network_type=modem_more_info["cell_info"][network_mode_key]
				for i = 1, #network_type do
					local info = network_type[i]
					for key in pairs(info) do
						translation[key]=luci.i18n.translate(key)
					end
				end
			end
		end
	end
	--添加额外翻译
	translation["Unknown"]=luci.i18n.translate("Unknown")
	translation["Excellent"]=luci.i18n.translate("Excellent")
	translation["Good"]=luci.i18n.translate("Good")
	translation["Fair"]=luci.i18n.translate("Fair")
	translation["Bad"]=luci.i18n.translate("Bad")

	--整合数据
	local data={}
	data["modem_info"]=modem_info
	data["translation"]=translation
	
	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write_json(data)
end

--[[
@Description 获取模组信息
]]
function getModems()
	local status_cache="/tmp/modem-overview-status.json"
    local owner=currentSnapshotOwner()
    if fs.access("/tmp/modem-scan.running") then
        local cached=fs.readfile(status_cache)
        local parsed=cached and json.parse(cached)
        if parsed and fs.stat(status_cache,"uid")==0 and snapshotOwned(parsed,owner) then
            http.prepare_content("application/json");http.write(cached);return
        end
        http.status(503,"Modem ownership pending")
        http.prepare_content("application/json");http.write_json({unavailable=true});return
    end

	-- 获取所有模组
	local modems={}
	local translation={}
    local interfaces=(json.parse(shell("ubus call network.interface dump 2>/dev/null")) or {}).interface or {}
	uci:foreach("modem", "modem-device", function (modem_device)
		if not modemPresent(modem_device) then return end
		-- The overview is refreshed every five seconds.  Querying the AT port on
		-- every refresh races WebUI/CFUN work and makes an online modem alternate
		-- between red and green on a transient empty reply.  Netifd is the source
		-- of truth for an established data session and does not contend for AT.
        local connect_status,network,driver=actualDataState(modem_device,interfaces)
        local driver_modes={qmi_wwan_q="qmi",qmi_wwan="qmi",qmi_wwan_f="qmi",cdc_ether="ecm",cdc_ncm="ncm",rndis_host="rndis",cdc_mbim="mbim"}
        local mode=driver_modes[driver] or "unknown"

		-- 获取翻译
		translation[connect_status]=connect_status=="unknown" and "未知" or luci.i18n.translate(connect_status)
		if modem_device["name"] then
			translation[modem_device["name"]]=luci.i18n.translate(modem_device["name"])
		end
		translation[mode]=mode=="unknown" and "未知" or luci.i18n.translate(mode)

		-- 设置值
		local modem=modem_device
		modem["connect_status"]=connect_status
		modem["mode"]=mode
        modem["network"]=network

		local modem_tmp={}
		modem_tmp[modem_device[".name"]]=modem
		table.insert(modems,modem_tmp)
	end)
	
	-- 设置值
	local data={}
	data["modems"]=modems
	data["translation"]=translation
    data["_native_owner"]=owner
	local encoded=json.stringify(data)
	if encoded and encoded~="" and #modems>0 then
		fs.writefile(status_cache..".new", encoded)
		fs.rename(status_cache..".new", status_cache)
	end

	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write(encoded)
end

--[[
@Description 获取拨号日志信息
]]
function getDialLogInfo()
	
	local command="find "..run_path.." -name \"modem*_dial.cache\""
	local result=shell(command)

	local log_paths=string.split(result, "\n")
	table.sort(log_paths)

	local logs={}
	local names={}
	local translation={}
	for key in pairs(log_paths) do

		local log_path=log_paths[key]

		if log_path ~= "" then
			-- 获取模组
			local tmp=string.gsub(log_path, run_path, "")
			local modem=string.gsub(tmp, "_dial.cache", "")
			local modem_name=uci:get("modem", modem, "name")

			-- 获取日志内容
			local command="cat "..log_path
			log=shell(command)

			-- 排序插入
			modem_log={}
			modem_log[modem]=log
			table.insert(logs, modem_log)

			--设置模组名
			names[modem]=modem_name
			-- 设置翻译
			translation[modem_name]=luci.i18n.translate(modem_name)
		end
	end

	-- 设置值
	local data={}
	data["dial_log_info"]=logs
	data["modem_name_info"]=names
	data["translation"]=translation

	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write_json(data)
end

--[[
@Description 清空拨号日志
]]
function cleanDialLog()
	
	-- 获取拨号日志路径
    local dial_log_path = http.formvalue("path")

	-- 清空拨号日志
	local command=": > "..dial_log_path
	shell(command)

	-- 设置值
	local data={}
	data["clean_result"]="clean dial log"

	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write_json(data)
end

--[[
@Description 模块列表状态函数
]]
function act_status()
	local e = {}
	e.index = luci.http.formvalue("index")
	e.status = luci.sys.call(string.format("busybox ps -w | grep -v 'grep' | grep '/var/etc/socat/%s' >/dev/null", luci.http.formvalue("id"))) == 0
	luci.http.prepare_content("application/json")
	luci.http.write_json(e)
end

--[[
@Description 获取模组的备注
@Params
	network 移动网络
]]
function getModemRemarks(network)
	local remarks=""
	uci:foreach("modem", "dial-config", function (config)
		---配置启用，且备注存在
		if network == config["network"] and config["enable"] == "1" then
			if config["remarks"] then
				remarks=" ("..config["remarks"]..")" --" (备注)"
				
				return true --跳出循环
			end
		end
	end)
	return remarks
end

--[[
@Description 获取AT串口
]]
function getATPort()

	local at_ports={}
	local device_info={}
	local translation={}
	local manufacturer_names={
		tdtech="TD Tech Ltd.", quectel="Quectel"
	}

	uci:foreach("modem", "modem-device", function (modem_device)
		--设置模组AT串口
		if modemPresent(modem_device) and modem_device["name"] and modem_device["at_port"] then
			
			local name=modem_device["name"]:upper()
			if modem_device["name"] == "unknown" then
				translation[modem_device["name"]]=luci.i18n.translate(modem_device["name"])
				name=modem_device["name"]
			end

			local physical_port = modem_device["at_port"]
			local at_port = logical_at_port
			device_info[at_port]={
				name=modem_device["name"],
				manufacturer=manufacturer_names[modem_device["manufacturer"]] or modem_device["manufacturer"],
				data_interface=(modem_device["data_interface"] or ""):upper(),
				mode=modem_device["mode"],
				at_port=logical_at_port,
				network=modem_device["network"],
				connect_status="unknown"
			}
			--排序插入
			at_port_tmp={}
			at_port_tmp[at_port]=name
			table.insert(at_ports, at_port_tmp)
		end
	end)

	-- 设置值
	local data={}
	data["at_ports"]=at_ports
	data["device_info"]=device_info
	data["translation"]=translation

	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write_json(data)
end

--[[
@Description 获取拨号模式信息
]]
function getModeInfo()
 local owner=currentSnapshotOwner()
 local device=getModemDeviceInfo(logical_at_port)
 local info={mode='unknown',modes={}}
 if owner and device.name==owner.model and device.manufacturer==owner.manufacturer and(device.platform or'')==owner.platform then
  local mode=getMode(logical_at_port,owner.manufacturer,owner.platform)
  if snapshotOwned({_native_owner=currentSnapshotOwner()},owner)then info={mode=mode,modes=device.modes or{},owner=owner}end
 end
 http.prepare_content('application/json');http.write_json({mode_info=info})
end

--[[
@Description 设置拨号模式
]]
function setMode()
 local owner=currentSnapshotOwner()
 local expected=json.parse(http.formvalue('mode_owner')or'')
 local mode=http.formvalue('mode_config')
 local device=getModemDeviceInfo(logical_at_port)
 local function reject(message)http.prepare_content('application/json');http.write_json({status='error',message=message})end
 if not owner or not snapshotOwned({_native_owner=expected},owner)then reject('页面所属模组已变化，请重新读取');return end
 if device.name~=owner.model or device.manufacturer~=owner.manufacturer or(device.platform or'')~=owner.platform or type(mode)~='string'or not mode:match('^[a-z0-9_]+$')then reject('模式参数与实际模组不匹配');return end
 local allowed=false;for _,name in ipairs(device.modes or{})do if name==mode then allowed=true end end
 if not allowed then reject('所选模式未列入当前模组配置');return end
 if owner.manufacturer=='quectel'then
  local output=shell('/usr/bin/lua /usr/share/modem/modem_mode.lua start '..util.shellquote(owner.section)..' '..util.shellquote(mode)..' '..util.shellquote(json.stringify(owner)))
  http.prepare_content('application/json');http.write_json(json.parse(output or'')or{status='error',message='模式切换任务未启动'});return
 end
 if not owner.manufacturer:match('^[a-z0-9_]+$')then reject('实际模组厂商无效');return end
 local command='MODEM_AT_EXPECTED_OWNER='..util.shellquote(json.stringify(owner))..' sh -c '..util.shellquote('. '..script_path..owner.manufacturer..'.sh; '..owner.manufacturer..'_set_mode /dev/modem-at '..util.shellquote(mode))
 local output=shell(command..' 2>&1')
 if not snapshotOwned({_native_owner=currentSnapshotOwner()},owner)then reject('模组已变化，请重新读取模式');return end
 local actual=getMode(logical_at_port,owner.manufacturer,owner.platform)
 if actual~=mode then reject('模式保存未确认：'..tostring(actual));return end
 http.prepare_content('application/json');http.write_json(actual)
end

--[[
@Description 获取网络偏好信息
]]
function getNetworkPreferInfo()
 local owner=currentSnapshotOwner()
 if not owner or not resolveATPort(logical_at_port) then http.status(409,"Conflict");http.prepare_content("application/json");http.write_json({error="当前模组未就绪"});return end
 local command="MODEM_AT_EXPECTED_OWNER="..util.shellquote(json.stringify(owner)).." sh "..util.shellquote(script_path.."modem_radio_bands.sh").." get "..util.shellquote(logical_at_port)
 local result=json.parse(util.exec(command))
 if not result or type(result.network_prefer)~="table" then http.status(409,"Conflict");http.prepare_content("application/json");http.write_json({error="频段读取失败"});return end
 http.prepare_content("application/json");http.write_json({network_prefer_info=result})
end

function setNetworkPrefer()
 local function reject(message)
  http.status(409,"Conflict");http.prepare_content("application/json");http.write_json({error=message})
 end
 if http.getenv("REQUEST_METHOD")~="POST" then http.status(405,"Method Not Allowed");return end
 local owner=currentSnapshotOwner()
 if not owner or not resolveATPort(logical_at_port) then reject("当前模组未就绪");return end
 local request=http.formvalue("prefer_config")
 if type(request)~="string" or #request>4096 or type(json.parse(request))~="table" then reject("网络模式参数无效");return end
 local command="MODEM_AT_EXPECTED_OWNER="..util.shellquote(json.stringify(owner)).." sh "..util.shellquote(script_path.."modem_network_prefer.sh").." "..util.shellquote(logical_at_port).." "..util.shellquote(request)
 local result=json.parse(util.exec(command))
 if not result or not result.currentMode then reject("网络模式未获确认");return end
 http.prepare_content("application/json");http.write_json(result)
end

--[[
@Description 设置频段偏好
]]
function setBandPrefer()
 local function reject(message)
  http.status(409,"Conflict");http.prepare_content("application/json");http.write_json({error=message})
 end
 if http.getenv("REQUEST_METHOD")~="POST" then http.status(405,"Method Not Allowed");return end
 local owner=currentSnapshotOwner()
 if not owner or not resolveATPort(logical_at_port) then reject("当前模组未就绪");return end
 local request=http.formvalue("prefer_config")
 if type(request)~="string" or #request>8192 or type(json.parse(request))~="table" then reject("频段参数无效");return end
 local command="MODEM_AT_EXPECTED_OWNER="..util.shellquote(json.stringify(owner)).." sh "..util.shellquote(script_path.."modem_radio_bands.sh").." set "..util.shellquote(logical_at_port).." "..util.shellquote(request)
 local result=json.parse(util.exec(command))
 if not result or result.verified~=true then reject("频段配置未获确认");return end
 http.prepare_content("application/json");http.write_json(result)
end

--[[
@Description 获取自检信息
]]
function getSelfTestInfo()
	local at_port = logical_at_port
	
	--获取制造商
	local manufacturer=getManufacturer(at_port)

	--获取值
	local self_test_info={}
	if manufacturer~="unknown" then
		--获取模组电压
		local command="source "..script_path..manufacturer..".sh && "..manufacturer.."_get_voltage "..at_port
		local result=shell(command)
		self_test_info["voltage"]=json.parse(result)

		--获取模组温度
		command="source "..script_path..manufacturer..".sh && "..manufacturer.."_get_temperature "..at_port
		result=shell(command)
		self_test_info["temperature"]=json.parse(result)
	end

	--设置值
	local modem_debug_info={}
	modem_debug_info["self_test_info"]=self_test_info
	
	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write_json(modem_debug_info)
end

--[[
@Description 获取快捷命令
]]
function getQuickCommands()
    local lookup_port = resolveATPort(logical_at_port)
    local manufacturer, platform, model
    uci:foreach("modem", "modem-device", function(device)
        if lookup_port == device.at_port then
            manufacturer = device.manufacturer
            platform = device.platform
            model = string.lower(device.name or "")
            return false
        end
    end)
    local source = json.parse(require("nixio.fs").readfile(script_path .. "at_commands.json") or "")
    local commands = {}
    if manufacturer and manufacturer ~= "unknown" and source and source.quick_commands then
        for _, row in ipairs(source.quick_commands.general or {}) do
            for name, value in pairs(row) do
                if manufacturer ~= "tdtech" or (value ~= "AT+CBC" and value ~= "AT+CFUN=1,1") then
                    if manufacturer == "tdtech" and value == "AT+CESQ" then
                        table.insert(commands, {["查询网络信号质量 > AT^HCSQ?"] = "AT^HCSQ?"})
                    elseif manufacturer == "quectel" and model == "rm551e-gl" and value == "AT+CESQ" then
                        table.insert(commands, {["查询扩展信号质量 > AT+QCSQ"] = "AT+QCSQ"})
                    else
                        table.insert(commands, {[name] = value})
                    end
                end
            end
        end
        if manufacturer == "tdtech" then
            table.insert(commands, {["查询SIM卡ICCID > AT^ICCID?"] = "AT^ICCID?"})
        end
        local vendor = source.quick_commands[manufacturer] or {}
        for _, row in ipairs(vendor[platform] or {}) do
            table.insert(commands, row)
        end
    end
    luci.http.prepare_content("application/json")
    luci.http.write_json({quick_commands = commands})
end

--[[
@Description 发送AT命令
]]
function sendATCommand()
	local at_port = logical_at_port
	local at_command = http.formvalue("command")

	local response={}
    if at_port and at_command then
		response["response"]=at(at_port,at_command)
		response["time"]=os.date("%Y-%m-%d %H:%M:%S")
    end

	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write_json(response)
end

--[[
@Description 获取模组调试信息
]]
-- function getModemDebugInfo()
-- 	local at_port = http.formvalue("port")
	
-- 	--获取制造商
-- 	local manufacturer=getManufacturer(at_port)

-- 	--获取值
-- 	local mode_info={}
-- 	local network_prefer_info={}
-- 	local self_test_info={}
-- 	if manufacturer~="unknown" then
-- 		mode_info=getModeInfo(at_port,manufacturer)
-- 		network_prefer_info=getNetworkPreferInfo(at_port,manufacturer)
-- 		self_test_info=getSelfTestInfo(at_port,manufacturer)
-- 	end

--	-- 设置值
-- 	local modem_debug_info={}
-- 	modem_debug_info["mode_info"]=mode_info
-- 	modem_debug_info["network_prefer_info"]=network_prefer_info
-- 	modem_debug_info["self_test_info"]=self_test_info

-- 	-- 写入Web界面
-- 	luci.http.prepare_content("application/json")
-- 	luci.http.write_json(modem_debug_info)
-- end

--[[
@Description 模组扫描
]]
function modemScan()
	local command="source "..script_path.."modem_scan.sh && modem_scan"
	local result=shell(command)
	local modem_count=0
	uci:foreach("modem", "modem-device", function (device)
		if modemPresent(device) then modem_count=modem_count+1 end
	end)
	local busy=result:find("modem scan already running", 1, true) ~= nil
	local complete=result:find("modem scan complete", 1, true) ~= nil
	local message
	if busy then
		message=i18n.translate("A modem scan is already running. Please wait.")
	elseif not complete then
		message=i18n.translate("Scan failed")
	elseif modem_count == 0 then
		message=i18n.translate("No modem found")
	else
		message=i18n.translate("Modem scan completed")
	end
	local data={
		success=(complete and not busy and modem_count>0),
		count=modem_count,
		message=message
	}

	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write_json(data)
end

--[[
@Description 设置插件版本信息
@Params
	info 信息
]]
function setPluginVersionInfo(info)

	-- 正则表达式
	local version_regular_expression="[0-9]+.[0-9]+.[0-9]+"

	for key in pairs(info) do

		-- 获取插件版本
		local command="opkg list-installed | grep -oE '"..key.." - "..version_regular_expression.."' | awk -F' ' '{print $3}' | tr -d '\n'"
		local plugin_version
		if fs.access("/sbin/apk") or fs.access("/usr/bin/apk") then
			local installed=shell("apk list --installed "..util.shellquote(key).." 2>/dev/null")
			local prefix=key.."-"
			for line in installed:gmatch("[^\r\n]+") do
				if line:sub(1, #prefix)==prefix then
					plugin_version=line:sub(#prefix+1):match("^(%S+)")
					break
				end
			end
			plugin_version=plugin_version or ""
		else
			plugin_version=shell(command)
		end

		if plugin_version~="" then
			info[key]=plugin_version
		end
	end

end

--[[
@Description 获取内核模块状态
@Params
	result 命令返回值
]]
function getModelStatus(result)
	local model_status="Not loaded"

	if result~="" then
		model_status="Loaded"
    end

	return model_status
end

--[[
@Description 设置内核模块状态
@Params
	info 信息
]]
function setModelStatus(info)

	for key in pairs(info) do

		-- 获取内核模块名
		local model_name=key:gsub(".ko","")

		local command="lsmod | grep -oE '"..model_name.." '"
		local result=shell(command)
		local model_status=getModelStatus(result)

		-- 修改信息表
		info[key]=model_status
	end

end

--[[
@Description 获取插件信息
]]
function getPluginInfo()

	-- 设置翻译
	translation={}
	translation["Unknown"]=luci.i18n.translate("Unknown")
	translation["Not installed"]=luci.i18n.translate("Not installed")
	translation["Loaded"]=luci.i18n.translate("Loaded")
	translation["Not loaded"]=luci.i18n.translate("Not loaded")

	-- 获取插件信息
	local plugin_info={}
	plugin_info["luci-app-modem"]="Unknown"
	setPluginVersionInfo(plugin_info)

	-- 获取拨号工具信息
	local dial_tool_info={}
	dial_tool_info["quectel-CM-5G"]="Not installed"
	setPluginVersionInfo(dial_tool_info)

	-- 获取通用驱动信息
	local general_driver_info={}
	general_driver_info["usbnet.ko"]="Not loaded"
	general_driver_info["option.ko"]="Not loaded"
	-- general_driver_info["qcserial.ko"]="Not loaded"
	setModelStatus(general_driver_info)

	-- 获取模组USB驱动信息
	local usb_driver_info={}
	--通用驱动
	usb_driver_info["qmi_wwan.ko"]="Not loaded"
	usb_driver_info["GobiNet.ko"]="Not loaded"
	usb_driver_info["cdc_ether.ko"]="Not loaded"
	usb_driver_info["cdc_mbim.ko"]="Not loaded"
	usb_driver_info["rndis_host.ko"]="Not loaded"
	usb_driver_info["cdc_ncm.ko"]="Not loaded"
	--制造商私有驱动
	usb_driver_info["qmi_wwan_q.ko"]="Not loaded"
	setModelStatus(usb_driver_info)

	-- 获取模组PCIE驱动信息
	local pcie_driver_info={}
	--通用驱动
	pcie_driver_info["pcie_mhi.ko"]="Not loaded"
	setModelStatus(pcie_driver_info)

	-- 设置值
	local data={}
	data["translation"]=translation
	data["plugin_info"]=plugin_info
	data["dial_tool_info"]=dial_tool_info
	data["general_driver_info"]=general_driver_info
	data["usb_driver_info"]=usb_driver_info
	data["pcie_driver_info"]=pcie_driver_info

	-- 写入Web界面
	luci.http.prepare_content("application/json")
	luci.http.write_json(data)
end
