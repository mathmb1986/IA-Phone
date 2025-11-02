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
  TriggerServerEvent('ia-phone:request-user')
end)

RegisterNetEvent('ia-phone:set-user', function(user)
  -- On pousse à l’UI : name, phone_number, avatar...
  SendNUIMessage({ action = 'set-user', user = user or {} })
end)

RegisterNetEvent('ia-phone:force-close', function()
  if PhoneNui.IsOpen() then PhoneNui.Toggle() end
end)
