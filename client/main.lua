-- client/main.lua

local gotUser        = false
local userInfo           = {}
local pendingThreadsCb = nil

local function debug(msg)
  if Config.Debug then
    print(("[IA-Phone][CL] %s"):format(msg))
  end
end

--------------------------------------------------
--  OUVERTURE / FERMETURE TÉLÉPHONE
--  (On passe TOUJOURS par PhoneNui.Toggle)
--------------------------------------------------

-- Commande clé pour la KeyMapping (F1 par défaut)
RegisterCommand('iap_toggle_phone', function()
  if PhoneNui and PhoneNui.Toggle then
    PhoneNui.Toggle()
  else
    debug("PhoneNui.Toggle inexistant (nui.lua chargé ?)")
  end
end, false)

-- Keymapping (F1 ou Config.DefaultOpenKey si défini)
RegisterKeyMapping(
  'iap_toggle_phone',
  'IA-Phone: Ouvrir/Fermer',
  'keyboard',
  Config.DefaultOpenKey or 'F1'
)

-- Alias /phone pour debug / tests
RegisterCommand('phone', function()
  if PhoneNui and PhoneNui.Toggle then
    PhoneNui.Toggle()
  else
    debug("PhoneNui.Toggle inexistant (nui.lua chargé ?)")
  end
end, false)

-- Force-close depuis d’autres scripts
RegisterNetEvent('ia-phone:force-close', function()
  if PhoneNui and PhoneNui.IsOpen and PhoneNui.IsOpen() then
    PhoneNui.Toggle()
  end
end)

--------------------------------------------------
--  CALLBACKS NUI GLOBAUX
--------------------------------------------------

-- App.js appelle callNui('phone:ready', ...)
RegisterNUICallback('phone:ready', function(data, cb)
  debug("NUI phone:ready")
  cb({ ok = true })
end)

-- App.js appelle callNui('close', ...)
RegisterNUICallback('close', function(data, cb)
  debug("NUI close demandé")
  if PhoneNui and PhoneNui.IsOpen and PhoneNui.IsOpen() then
    PhoneNui.Toggle()
  end
  cb({ ok = true })
end)

--------------------------------------------------
--  MESSAGES : NUI <-> CLIENT <-> SERVEUR
--------------------------------------------------

-- 1) NUI demande la liste des conversations
RegisterNUICallback('messages:getThreads', function(data, cb)
  debug("NUI messages:getThreads")
  pendingThreadsCb = cb
  TriggerServerEvent('ia-phone:get-threads-by-phone',userInfo.user)
end)

-- 2) Serveur renvoie la liste des threads (DB → Lua → NUI)
RegisterNetEvent('ia-phone:set-threads', function(threads)
  threads = threads or {}
  debug(("ia-phone:set-threads -> %d threads"):format(#threads))

  if pendingThreadsCb then
    pendingThreadsCb({
      ok      = true,
      threads = threads
    })
    pendingThreadsCb = nil
  else
    -- fallback si un jour tu pousses des updates live
    SendNUIMessage({
      action  = 'messages:setThreads',
      threads = threads
    })
  end
end)


-- 3) NUI envoie un message
-- Envoi d'un message depuis le NUI
RegisterNUICallback('messages:send', function(data, cb)
  local threadId    = tostring(data.threadId or "")
  local text        = tostring(data.text or ""):gsub("^%s+", ""):gsub("%s+$", "")
  local contactName = data.contactName

  if not userInfo.user.phone_number or userInfo.user.phone_number == '' then
    debug("[CL] messages:send sans PhoneNumber")
    cb({ ok = false, error = "no_phone" })
    return
  end

  if text == "" or threadId == "" then
    debug(("[CL] messages:send invalid_data (threadId=%s, text='%s')"):format(threadId, text))
    cb({ ok = false, error = "invalid_data" })
    return
  end

  debug(("[CL] messages:send -> ownerPhone=%s, contactPhone=%s, text=%s"):format(
    userInfo.user.phone_number, threadId, text
  ))

  -- L’UI gère déjà le message localement (optimiste).
  -- Ici on délègue juste à la DB.
  TriggerServerEvent('ia-phone:send-message-by-phone', {
    ownerPhone   = userInfo.user.phone_number,
    contactPhone = threadId,
    contactName  = contactName,
    text         = text,
    direction    = 'me'
  })

  cb({ ok = true })
end)








--  Boucle Principale.
--------------------------------------------------
--  PROFIL USER (numéro, nom, etc.)
--------------------------------------------------
-- Thread de boot : envoie "boot" au NUI + demande le profil au serveur
CreateThread(function()
    -- Récupère les infos via ton Bridge (ESX/QBCORE/standalone…)
    local pdata = Bridge.GetPlayerData() or {}
    local playerId  = PlayerId()
    local serverId  = GetPlayerServerId(playerId)

    -- Nom “logique” du joueur :
    -- 1) Bridge.playerName (si défini dans ton bridge)
    -- 2) pdata.name (si ton framework le fournit)
    -- 3) GetPlayerName() en dernier recours
    local name = Bridge.playerName
    if not name or name == '' then
        name = pdata.name or GetPlayerName(playerId) or ("ID " .. tostring(serverId))
    end

    debug(("Client Ready, Framework=%s, name=%s, serverId=%s, playerId=%s"):format(
        Bridge.name or "unknown",
        name,
        tostring(serverId),
        tostring(playerId)
    ))

    -- Debug Information
    -- Info “boot” envoyée au NUI (pour ton panneau debug / info en bas)
    SendNUIMessage({
        action = 'boot',
        player = {
            id   = playerId, -- playerId est fix - server ID un chiffre qui est unique sur le serveur mais changer a chaque connection 
            name = name,
            job  = pdata.job and pdata.job.name or nil
        }
    })

    userInfo.job  = pdata.job and pdata.job.name or nil

    -- On demande le profil au serveur (numéro, etc.) en passant
    -- BIEN le même “name” que l’event côté serveur attend.
    local attempts = 0
    while not gotUser and attempts < 10 do
        TriggerServerEvent('ia-phone:request-user', name)
        Wait(500)
        attempts = attempts + 1
    end

    if not gotUser then
        debug("Aucun user après 10 tentatives, l'UI restera en mode 'chargement' pour le profil.")
    end
end)


-- Le serveur renvoie les infos phone (ia-phone:set-user)
RegisterNetEvent('ia-phone:set-user', function(user)
  gotUser = true
  user = user or {}

  -- Debug Information
  -- Info “set-user” envoyée au NUI (pour ton panneau debug / info en bas)
  SendNUIMessage({
    action = 'set-user',
    user   = user
  })

  userInfo.user = user
  debug(("Réception user: phone_number=%s, name=%s,userInfo=%s"):format(user.phone_number or "?", user.name or "?",userInfo))

end)