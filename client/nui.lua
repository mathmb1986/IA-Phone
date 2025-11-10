local isOpen = false
local lastToggle = 0

local function now() return GetGameTimer() end
local function setFocus(state)
  SetNuiFocus(state, state)
  SetNuiFocusKeepInput(state)
end

RegisterNUICallback('nui:ready', function(_, cb)
  cb({ ok = true })
end)

RegisterNUICallback('nui:close', function(_, cb)
  if isOpen then
    isOpen = false
    setFocus(false)
    SendNUIMessage({ action = 'phone:state', open = false })
  end
  cb({ ok = true })
end)

local function togglePhone()
  local t = now()
  if (t - lastToggle) < (Config.ToggleDebounce or 250) then return end
  lastToggle = t

  isOpen = not isOpen
  setFocus(isOpen)
  SendNUIMessage({ action = 'phone:state', open = isOpen })
end

PhoneNui = {
  Toggle = togglePhone,
  IsOpen = function() return isOpen end
}

