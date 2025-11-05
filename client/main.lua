-- Client

-- Framework
local ESX = nil


local gotUser = false
local userRetryTimer = nil
local phoneBooted = false 

local function debug(msg)
  if Config.Debug then print(("[IA-Phone] %s"):format(msg)) end
end

-- RegisterKey Function
RegisterKeyMapping('iap_toggle_phone', 'IA-Phone: Ouvrir/Fermer', 'keyboard', Config.DefaultOpenKey)-- or 'F1'

-- Reponse du server donne les info telephone.
RegisterNetEvent('ia-phone:set-user', function(user)
  gotUser = true
  if userRetryTimer then
    if ClearTimeout then ClearTimeout(userRetryTimer) end
    userRetryTimer = nil
  end
  SendNUIMessage({ action = 'set-user', user = user or {} })
end)

-- Commande pour ouvrir/fermer le telephone
RegisterCommand('iap_toggle_phone', function()
  PhoneNui.Toggle()
end, false)

-- Force la fermeture du telephone (utilisé par d'autres scripts si besoin) 
RegisterNetEvent('ia-phone:force-close', function()
  if PhoneNui.IsOpen() then PhoneNui.Toggle() end
end)



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



