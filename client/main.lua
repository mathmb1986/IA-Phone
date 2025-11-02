local gotUser = false
local userRetryTimer = nil

local function debug(msg)
  if Config.Debug then print(("[IA-Phone] %s"):format(msg)) end
end

RegisterCommand('iap_toggle_phone', function()
  PhoneNui.Toggle()
end, false)

RegisterKeyMapping('iap_toggle_phone', 'IA-Phone: Ouvrir/Fermer', 'keyboard', Config.DefaultOpenKey or 'F1')

-- Au boot client, demande le profil au serveur (numéro, etc.)
CreateThread(function()
  local pdata = Bridge.GetPlayerData()
  debug(("Client prêt, Framework=%s"):format(Bridge.name))
  SendNUIMessage({ action = 'boot', player = { id = pdata.source, job = pdata.job and pdata.job.name } })

  -- 1ère demande
  TriggerServerEvent('ia-phone:request-user')

  -- Retry en 2000 ms si aucune réponse
  if userRetryTimer then
    -- sécurité si relancé
    if ClearTimeout then ClearTimeout(userRetryTimer) end
    userRetryTimer = nil
  end

  local timeoutFn = function()
    if not gotUser then
      TriggerServerEvent('ia-phone:request-user')
    end
  end

  if SetTimeout then
    userRetryTimer = SetTimeout(2000, timeoutFn)
  else
    -- fallback FiveM
    userRetryTimer = Citizen.SetTimeout(2000, timeoutFn)
  end
end)

RegisterNetEvent('ia-phone:set-user', function(user)
  gotUser = true
  if userRetryTimer then
    if ClearTimeout then ClearTimeout(userRetryTimer) end
    userRetryTimer = nil
  end
  SendNUIMessage({ action = 'set-user', user = user or {} })
end)

RegisterNetEvent('ia-phone:force-close', function()
  if PhoneNui.IsOpen() then PhoneNui.Toggle() end
end)


