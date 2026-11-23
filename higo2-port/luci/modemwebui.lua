module("luci.controller.modemwebui", package.seeall)

local fs = require "nixio.fs"

function index()
	if not fs.access("/etc/config/modemwebui") then
		return
	end
	entry({"admin", "cellular", "modemwebui"}, template("modemwebui/modemwebui"), _("模组面板"), 20)
	entry({"admin", "cellular", "modemwebui", "state"}, call("modemStateJSON"), nil).leaf = true
end


function panelEndpoint() return require("modemwebui.endpoint").panel("config") end

function modemState()
	local uci = require("luci.model.uci").cursor()
	local detected = fs.stat("/dev/modem-at", "type") == "chr"
	uci:foreach("modem", "modem-device", function(device)
		if device.path and fs.stat(device.path, "type") == "dir" then detected = true end
	end)
	local profile = (fs.readfile("/var/run/modemwebui/profile") or ""):match("^%s*(.-)%s*$")
	local enabled = uci:get("modemwebui", "config", "enabled") == "1"
	local ready = enabled and fs.stat("/dev/modem-at", "type") == "chr" and
		fs.access("/tmp/modem-service-ready") and profile ~= "" and profile ~= "unsupported"
	local endpoint=ready and panelEndpoint() or nil
	return { detected = detected, ready = not not (ready and endpoint), enabled = enabled, http_port = endpoint and endpoint.port or nil }
end

function modemStateJSON()
	require("luci.http").prepare_content("application/json")
	require("luci.http").write_json(modemState())
end

