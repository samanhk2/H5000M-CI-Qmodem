-- Observe netifd's completed teardown before retiring an owned carrier.
local uloop = require 'uloop'
local ubus = require 'ubus'
local logical = arg[1]
local seconds = tonumber(arg[2])
if type(logical) ~= 'string' or #logical > 64 or not logical:match('^[%w_][%w_.-]*$')
    or not seconds or seconds < 0 or seconds > 20 or seconds % 1 ~= 0 then
    io.stderr:write('invalid native interface retirement request\n')
    os.exit(1)
end

uloop.init()
local bus = assert(ubus.connect(nil, math.max(seconds, 1)), 'native network event connection unavailable')
local complete = false
local failure
local deadline

local function inspect()
    local snapshot = bus:call('network.interface', 'dump', {})
    if type(snapshot) ~= 'table' or type(snapshot.interface) ~= 'table' then
        failure = 'native netifd state is unavailable'
        uloop.cancel()
        return
    end
    local selected
    for _, interface in ipairs(snapshot.interface) do
        if interface.interface == logical then
            if selected then
                failure = 'native interface identity is ambiguous'
                uloop.cancel()
                return
            end
            selected = interface
        end
    end
    complete = not selected or (selected.up == false and selected.pending == false)
    if complete then uloop.cancel() end
end

local function changed(message)
    if type(message) == 'table' and message.interface == logical then inspect() end
end

bus:listen({['network.interface'] = changed})
bus:subscribe('network.interface', {notify = changed})
inspect()
if not complete and not failure and seconds > 0 then
    deadline = uloop.timer(function()
        failure = 'native interface teardown has not completed'
        uloop.cancel()
    end, seconds * 1000)
    uloop.run()
end
if deadline then deadline:cancel() end
bus:close()
if not complete or failure then
    io.stderr:write((failure or 'native interface is still active') .. '\n')
    os.exit(1)
end
