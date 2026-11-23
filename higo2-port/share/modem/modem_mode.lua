#!/usr/bin/lua
-- Modem mode jobs use canonical owner/identity proofs, independent of Mesh.
local fs=require 'nixio.fs'
local nixio=require 'nixio'
local json=require 'luci.jsonc'
local util=require 'luci.util'
local uci=require('uci').cursor()
local directory='/tmp/run/modem'
local statefile=directory..'/mode-switch.json'
local lock=directory..'/mode-switch.lock'
local modes={
 qmi={number=0,drivers={qmi_wwan_q=true,qmi_wwan=true}},
 ecm={number=1,drivers={cdc_ether=true}},
 mbim={number=2,drivers={cdc_mbim=true}},
 rndis={number=3,drivers={rndis_host=true}},
 ncm={number=5,drivers={cdc_ncm=true}},
}
local keys={'bootId','section','physicalPort','portInode','aliasInode','devicePath','deviceInode','manufacturer','model','platform'}
local function same(a,b)
 if type(a)~='table' or type(b)~='table' then return false end
 for _,key in ipairs(keys)do if type(a[key])~='string' or a[key]~=b[key]then return false end end
 return true
end
local function run(command)return util.exec(command)end
local function load()return json.parse(fs.readfile(statefile)or'{}')or{}end
local state
local function publish(status,phase,message)
 state.status,state.phase,state.message,state.updated=status,phase,message,os.time()
 assert(fs.writefile(statefile..'.new',json.stringify(state)), '无法写入模式状态')
 assert(fs.chmod(statefile..'.new','600'), '无法保护模式状态')
 assert(fs.rename(statefile..'.new',statefile), '无法发布模式状态')
end
local function read_owner()
 local owner=json.parse(run('/usr/libexec/modem/at --owner 2>/dev/null'))
 if not same(owner,owner)then error('实际模组归属缺失或多义',0)end
 return owner
end
local function at_response(commands,owner)
 local request=json.stringify({port='/dev/modem-at',owner=owner,profile=owner.manufacturer,commands=commands,timeout=8})
 return json.parse(run('printf %s '..util.shellquote(request)..' | timeout 30 /usr/libexec/modem/at --json'))
end
local function transaction(commands,owner)
 local response=at_response(commands,owner)
 if not response or response.error or(response.result or''):find('ERROR',1,true)then error('原生 AT 请求失败或模组已变化',0)end
 return response.result or''
end
-- Host-managed QMI/MBIM and firmware-managed Ethernet data must have one
-- dial owner. Probe the actual firmware capability; other vendors never see
-- Quectel commands and unsupported firmware keeps its existing dial path.
local function desired_autodial(owner,mode)
 if owner.manufacturer~='quectel'then return nil end
 if mode=='qmi'or mode=='mbim'then return 0 end
 if mode=='ecm'or mode=='rndis'or mode=='ncm'then return 1 end
 return nil
end
local function read_autodial(owner)
 local response=at_response({'AT+QMAPWAC?'},owner)
 if response and response.error=='modem rejected AT command'and(response.result or''):match('ERROR%s*$')then return nil end
 if not response or response.error then error('无法核对模组内部拨号归属，未修改',0)end
 local value,count
 for line in(response.result or''):gmatch('[^\r\n]+')do
  if line:find('+QMAPWAC:',1,true)then
   local number=line:match('^%s*%+QMAPWAC:%s*([01])%s*$')
   if not number then error('模组内部拨号状态无效，未修改',0)end
   value=tonumber(number);count=(count or 0)+1
  end
 end
 if count~=1 then error('模组内部拨号状态缺失或多义，未修改',0)end
 return value
end
local function data_owner_change(owner,mode)
 local wanted=desired_autodial(owner,mode)
 if wanted==nil then return false end
 local before=read_autodial(owner)
 return before~=nil and before~=wanted,wanted,before
end
local function identity(owner, profile)
 local proof=json.parse(run('MODEM_AT_EXPECTED_OWNER='..util.shellquote(json.stringify(owner))..' timeout 30 /usr/libexec/modem/at --identity 2>/dev/null'))
 local value=proof and(profile and proof.profileIdentity or proof.identity)
 if not proof or not same(proof.owner,owner)or type(value)~='string'or #value~=64 or value:find('[^a-f0-9]')then error('无法确认本次模组身份',0)end
 return value
end
local function device(owner)
 uci:unload('modem');uci:load('modem')
 local d=uci:get_all('modem',owner.section)
 if not d or d['.type']~='modem-device'or d.manufacturer~='quectel'or(d.platform~='qualcomm'and d.platform~='unisoc')or d.data_interface~='usb'
  or d.name~=owner.model or d.manufacturer~=owner.manufacturer or d.platform~=owner.platform or fs.realpath(d.path or'')~=owner.devicePath or fs.realpath(d.at_port or'')~=owner.physicalPort then error('所选模式配置与当前实际模组不匹配',0)end
 if type(d.network)~='string'or #d.network>15 or not d.network:match('^[%w_.-]+$')then error('实际数据接口缺失',0)end
 local physical=fs.realpath('/sys/class/net/'..d.network..'/device')
 if not physical or(physical~=owner.devicePath and physical:sub(1,#owner.devicePath+1)~=owner.devicePath..'/')then error('数据接口不属于当前模组',0)end
 return d
end
local function read_mode(owner)
 local raw=transaction({'AT+QCFG="usbnet"'},owner)
 local value,count
 for number in raw:gmatch('%+QCFG:%s*"usbnet",(%d+)')do value=tonumber(number);count=(count or 0)+1 end
 if count~=1 then error('模组未返回唯一 USB 模式',0)end
 return value
end
local function driver_for(d)
 local path=fs.realpath('/sys/class/net/'..d.network..'/device/driver')or''
 return path:match('([^/]+)$')or''
end
local function driver_available(wanted)
 local kernel=(fs.readfile('/proc/sys/kernel/osrelease')or''):gsub('%s+$','')
 for name in pairs(wanted.drivers)do
  if fs.stat('/sys/bus/usb/drivers/'..name)or(kernel~=''and fs.stat('/lib/modules/'..kernel..'/'..name..'.ko'))then return true end
 end
 return false
end
local function data_state(owner,d)
 local links=json.parse(run('/usr/libexec/modem/at --data-links 2>/dev/null'))
 if not links or not same(links.owner,owner)or type(links.interfaces)~='table'then error('实际数据接口归属未确认',0)end
 uci:unload('network');uci:load('network')
 local globals,global,enabledProfiles=0,nil,0
 uci:foreach('modem','global',function(row)globals=globals+1;global=row.enable_dial end)
 local profile_owner=uci:get('modem',owner.section,'profile_owner')
 if type(profile_owner)~='string' or #profile_owner~=64 then error('实际拨号配置归属未确认',0)end
 uci:foreach('modem','dial-config',function(row)if row.network==d.network and row.profile_owner==profile_owner and row.enable~='0'then enabledProfiles=enabledProfiles+1 end end)
 if globals~=1 or(global~='0'and global~='1')or enabledProfiles>1 then error('实际拨号策略缺失或多义',0)end
 local requested=global=='1'and enabledProfiles==1
 local wanted=requested and #links.interfaces==0;local ready=false;local active={}
 for _,link in ipairs(links.interfaces)do
  if type(link.name)~='string'or not link.name:match('^[%w_]+$')then error('实际逻辑接口无效',0)end
  if uci:get('network',link.name)=='interface'and uci:get('network',link.name,'disabled')~='1'then
   wanted=requested
   local row=json.parse(run('ubus call network.interface.'..link.name..' status 2>/dev/null'))
   if row and row.up and row.l3_device==link.device and(#(row['ipv4-address']or{})>0 or #(row['ipv6-address']or{})>0)then ready=true;active[link.device]=true end
  end
 end
 local count,network=0,nil;for name in pairs(active)do count=count+1;network=name end
 if count>1 then error('实际模组数据出口多义',0)end
 if not same(read_owner(),owner)then error('核对数据状态时模组已变化',0)end
 return wanted,ready,network or d.network
end
local function process_birth(pid)
 local raw=fs.readfile('/proc/'..tostring(pid)..'/stat')or''
 local rest=raw:match('^.*%)%s+(.*)$');if not rest then return nil end
 local i=0;for value in rest:gmatch('%S+')do i=i+1;if i==20 then return value end end
end
local function running(saved)
 return saved.pid and saved.pidBirth and nixio.kill(saved.pid,0)and process_birth(saved.pid)==saved.pidBirth
end
local function perform()
 local owner=read_owner()
 if not same(owner,state.owner)then error('任务启动前模组已变化，未执行切换',0)end
 local d=device(owner);local wanted=modes[state.mode]
 if not wanted or(owner.platform=='unisoc'and state.mode=='qmi')then error('当前模组平台不支持所选模式',0)end
 if type(d.modes)~='table'then error('当前实际模组模式列表缺失',0)end
 local allowed=false;for _,name in ipairs(d.modes or{})do if name==state.mode or(name=='gobinet'and state.mode=='qmi')then allowed=true end end
 if not allowed then error('所选模式未列入当前实际模组配置',0)end
 if not driver_available(wanted)then error('当前固件缺少该模式驱动，未修改模组',0)end
 local receipt=identity(owner);if receipt~=state.identity then error('模组重启身份已变化，未执行切换',0)end
 local previous=read_mode(owner);state.previous_number=previous
 if state.automatic_data_owner then
  if previous~=wanted.number then error('实际模式已变化，未自动切换',0)end
  local requested=data_state(owner,d)
  if not requested then error('当前数据连接已禁用，未修改模组',0)end
 end
 local owner_changed,autodial,before_autodial=data_owner_change(owner,state.mode)
 if owner_changed then
  state.previous_autodial,state.desired_autodial=before_autodial,autodial
  publish('running','ownership','正在交接模组数据连接')
  local raw=transaction({'AT+MWUIFIRMWAREAUTODIAL='..autodial},owner)
  if not raw:match('%+QMAPWAC:%s*'..autodial..'%s*')then error('模组数据归属回读不一致，未重启',0)end
  state.data_owner_reset_pending=true
 end
 if previous~=wanted.number then
  publish('running','configure','正在保存并回读 USB 模式')
  local output=run('MODEM_AT_EXPECTED_OWNER='..util.shellquote(json.stringify(owner))..' sh -c '..util.shellquote('. /usr/share/modem/quectel.sh; quectel_set_mode /dev/modem-at '..state.mode))
  local saved=json.parse(output or'')
  if not saved or not saved.fields or not saved.fields.usbMode or tonumber(saved.fields.usbMode.value)~=wanted.number or read_mode(owner)~=wanted.number then error('模式保存未确认，未重启模组',0)end
 end
 local event_loop = require 'uloop'
 event_loop.init()
 local event_bus = assert(require('ubus').connect(nil, 10), '原生模组事件连接失败')
 local accepted, complete, failure
 local subscribed = false
 local deadline
 local function inspect()
  local found, current = pcall(read_owner)
  if not found then return false end
  if current.bootId ~= owner.bootId or current.devicePath ~= owner.devicePath then
   error('重连设备与原模组不符，未继续操作', 0)
  end
  -- A reset acknowledgement does not retire the previous USB generation.
  if state.reset_issued and same(current, owner) then return false end
  local prepared = fs.stat('/tmp/modem-service-ready')
   and same(json.parse(fs.readfile('/var/run/modem/service-owner.json') or ''), current)
  local valid, current_device = pcall(device, current)
  if not valid or not prepared then return false end
  if current.model ~= owner.model or current.manufacturer ~= owner.manufacturer then
   error('重连设备与原模组不符，未继续操作', 0)
  end
  if not accepted or not same(accepted, current) then
   if identity(current) ~= receipt then error('重连模组身份不符，未继续操作', 0) end
   accepted = current
  end
  local driver = driver_for(current_device)
  if not wanted.drivers[driver] or read_mode(current) ~= wanted.number then return false end
  state.section, state.owner, state.driver, state.driver_ready = current.section, current, driver, true
  if not same(current, owner) then state.data_owner_reset_pending = false end
  local expected, ready, network = data_state(current, current_device)
  state.network, state.dial_ready = network, ready
  if not expected or ready then
   publish('done', 'ready', ready and '模式、驱动及数据连接已确认' or '模式与驱动已切换，当前无启用的数据接口')
   return true
  end
  publish('running', 'dial', '正在等待实际数据接口连接')
  return false
 end
 local function changed()
  if complete or failure then return end
  local ok, ready = pcall(inspect)
  if ok then complete = ready else failure = ready end
  if complete or failure then event_loop.cancel() end
 end
 local function subscribe_network()
  if subscribed then return end
  subscribed = pcall(event_bus.subscribe, event_bus, 'network.interface', {
   notify = changed,
   remove = function()
    subscribed = false
    changed()
   end,
  })
 end
 event_bus:listen({
  ['modem.ready'] = changed,
  ['network.interface'] = changed,
  ['ubus.object.add'] = function()
   subscribe_network()
   changed()
  end,
 })
 subscribe_network()
 if previous ~= wanted.number or owner_changed then
  publish('running', 'reset', owner_changed and '数据归属已确认，正在等待模组重连' or '模式已确认，正在等待模组重连')
  state.reset_issued = true
  publish('running', 'reset', state.message)
  transaction({'AT+CFUN=1,1'}, owner)
 end
 changed()
 if not complete and not failure then
  deadline = event_loop.timer(function()
   failure = state.driver_ready and '模式与驱动已切换，数据连接尚未恢复' or '等待模组归属、模式或驱动确认超时'
   event_loop.cancel()
  end, 150000)
  event_loop.run()
 end
 if deadline then deadline:cancel() end
 event_bus:close()
 if failure then error(failure, 0) end

end
local function reconcile_profiles(section, network)
 local owner = read_owner()
 if owner.section ~= section or type(network) ~= 'string' or not network:match('^[%w_.:%-]+$') then
  error('实际拨号配置归属无效', 0)
 end
 local profile_owner = identity(owner, true)
 local physical = fs.realpath('/sys/class/net/' .. network .. '/device')
 if not physical or (physical ~= owner.devicePath and physical:sub(1, #owner.devicePath + 1) ~= owner.devicePath .. '/') then
  error('数据接口不属于当前模组', 0)
 end
 if run('uci -q changes modem') ~= '' then error('模组存在未提交配置', 0) end
 local original = run('uci -q export modem')
 if original == '' then error('原生模组配置不可读', 0) end
 fs.mkdirr(directory)
 local staging = directory .. '/profile-' .. nixio.getpid() .. '-' .. os.time()
 if not fs.mkdir(staging, '700') then error('拨号配置事务正在使用', 0) end
 local cursor = require('uci').cursor(nil, staging)
 local ok, result = pcall(function()
  cursor:load('modem')
  if cursor:get('modem', section, 'network') ~= network then error('模组数据接口已变化', 0) end
  local profiles, ids, active = {}, {}, 0
  cursor:foreach('modem', 'dial-config', function(row)
   if row.profile_owner == profile_owner or ((row.profile_owner or '') == '' and row.network == network) then
    local id = row.id
    if not id or id == '' then id = row['.name'] end
    if type(id) ~= 'string' or id == '' or id:find('[,\r\n]') then error('当前模组拨号标识无效', 0) end
    if ids[id] then error('当前模组拨号标识重复', 0) end
    ids[id] = true
    if row.enable ~= '0' then active = active + 1 end
    profiles[#profiles + 1] = {section = row['.name'], id = id}
   end
  end)
  if active > 1 then error('当前模组存在多个启用的拨号配置', 0) end
  local changed = cursor:get('modem', section, 'profile_owner') ~= profile_owner
  for _, profile in ipairs(profiles) do
   if cursor:get('modem', profile.section, 'network') ~= network then
    assert(cursor:set('modem', profile.section, 'network', network))
    changed = true
   end
   for key, value in pairs({id = profile.id, profile_owner = profile_owner}) do
    if cursor:get('modem', profile.section, key) ~= value then
     assert(cursor:set('modem', profile.section, key, value))
     changed = true
    end
   end
  end
  local created = #profiles == 0
  if created then
   local name = assert(cursor:add('modem', 'dial-config'))
   for key, value in pairs({
    enable = '1', remarks = '模组 ' .. section:sub(6), network = network,
    dial_tool = '', pdp_type = 'ipv4v6', network_bridge = '1', profile_owner = profile_owner,
    id = name,
   }) do
    assert(cursor:set('modem', name, key, value))
   end
   profiles[1] = {section = name, id = name}
   changed = true
  end
  assert(cursor:set('modem', section, 'profile_owner', profile_owner))
  if not same(read_owner(), owner) or run('uci -q changes modem') ~= '' or run('uci -q export modem') ~= original then
   error('模组或拨号配置已变化，未提交', 0)
  end
  if changed and not cursor:commit('modem') then error('原生拨号配置提交失败', 0) end
  if not same(read_owner(), owner) then error('提交后模组已变化', 0) end
  return {status = 'ready', profileOwner = profile_owner, created = created, profiles = profiles}
 end)
 cursor:unload('modem')
 fs.unlink(staging .. '/modem')
 fs.rmdir(staging)
 if not ok then error(result, 0) end
 return result
end

local action=arg[1]
if action == 'reconcile-profile' then
 local ok, result = pcall(reconcile_profiles, arg[2], arg[3])
 if not ok then io.stderr:write(tostring(result), '\n');os.exit(1) end
 print(json.stringify(result))
 return
end
if action=='status'then
 state=load()
 if arg[2]and state.job~=arg[2]then print(json.stringify({status='error',message='切换任务已变化，请刷新页面'}));return end
 if state.status=='running'and((state.pid and not running(state))or(not state.pid and os.time()-(state.started or 0)>10))then publish('error','stopped','切换任务已停止，请重新读取状态');fs.rmdir(lock)end
 print(json.stringify(state));return
end
local automatic_data_owner=action=='ensure-data-owner'
if action=='start'or automatic_data_owner then
 local section,mode=arg[2],arg[3];if mode=='gobinet'then mode='qmi'end
 if type(section)~='string'or not section:match('^[%w_]+$')or not modes[mode]then print(json.stringify({status='error',message='模组或模式参数无效'}));return end
 local ok,owner=pcall(read_owner)
 if not ok or owner.section~=section then print(json.stringify({status='error',message='所选模组不是当前原生 owner'}));return end
 local expected=arg[4]and json.parse(arg[4])or owner
 if not same(owner,expected)then print(json.stringify({status='error',message='页面所属模组已变化，请重新读取'}));return end
 local valid,d=pcall(device,owner);if not valid then print(json.stringify({status='error',message=tostring(d)}));return end

 if automatic_data_owner then
  local previous=load()
  if previous.data_owner_reset_pending and previous.reset_issued and same(previous.owner,owner)then
   print(json.stringify({status='error',message='上次数据归属重启尚未确认，未重复重启'}));return
  end
  local checked,required=pcall(function()
   local requested=data_state(owner,d)
   if not requested then return false end
   return data_owner_change(owner,mode)
  end)
  if not checked then print(json.stringify({status='error',message=tostring(required)}));return end
  if not required then print(json.stringify({status='unchanged',message='当前拨号归属无需变更'}));return end
 end
 local identified,receipt=pcall(identity,owner);if not identified then print(json.stringify({status='error',message='无法确认本次模组身份，未修改模式'}));return end
 fs.mkdirr(directory)
 if not fs.mkdir(lock,'700')then
  state=load();if running(state)or(state.status=='running'and not state.pid and os.time()-(state.started or 0)<=10)then print(json.stringify(state));return end
  fs.rmdir(lock);if not fs.mkdir(lock,'700')then print(json.stringify({status='error',message='另一个模式切换任务正在进行'}));return end
 end
 state={job=tostring(os.time())..'-'..tostring(nixio.getpid()),section=section,mode=mode,owner=owner,identity=receipt,started=os.time(),automatic_data_owner=automatic_data_owner}
 publish('running','queued','正在准备切换模式')
 run('nohup setsid /usr/bin/lua /usr/share/modem/modem_mode.lua run '..util.shellquote(state.job)..' >/dev/null 2>&1 </dev/null &')
 print(json.stringify(state));return
end
if action=='run'then
 state=load();if state.job~=arg[2]or state.status~='running'then return end
 state.pid=nixio.getpid();state.pidBirth=process_birth(state.pid);if not state.pidBirth then publish('error','failed','无法确认任务进程归属');fs.rmdir(lock);return end
 publish('running','inspect','正在核对实际模组')
 local ok,message=pcall(perform);if not ok then publish('error','failed',tostring(message))end
 if load().job==state.job then fs.rmdir(lock)end
end
