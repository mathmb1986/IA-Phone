-- Client

local gotUser = false
local userRetryTimer = nil
local ESX = nil
local phoneBooted = false
local playerX = nil   

local function debug(msg)
  if Config.Debug then print(("[IA-Phone] %s"):format(msg)) end
end

RegisterCommand('iap_toggle_phone', function()
  PhoneNui.Toggle()
end, false)

RegisterKeyMapping('iap_toggle_phone', 'IA-Phone: Ouvrir/Fermer', 'keyboard', Config.DefaultOpenKey or 'F1')

-- Boucle de demarage pas important coté performance pour le moment.
-- Au boot client, demande le profil au serveur (numéro, etc.)
CreateThread(function()

  local pdata = Bridge.GetPlayerData()
  debug(("Client Ready, Framework=%s"):format(Bridge.name))
  SendNUIMessage({ action = 'boot', player = { id = pdata.source, job = pdata.job and pdata.job.name } })

  -- Boucle de retry côté client, sans timers
  local attempts = 0
  while not gotUser and attempts < 10 do
    TriggerServerEvent('ia-phone:request-user',Bridge.playerName)
    Citizen.Wait(500)   -- attends 500 ms entre chaque tentative (évite le spam)
    attempts = attempts + 1
  end

  if not gotUser then
    debug("Aucune réponse user après 10 tentatives — l'UI restera en 'Chargement…'")
  end

end)


-- Reponse du server donne les info telephone.
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


