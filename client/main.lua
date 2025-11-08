-- Client
-- pour le moment, on garde un “backend” local en mémoire (par joueur)
local Conversations = {
    {
        id        = "alex",
        name      = "Alex",
        initials  = "A",
        lastTime  = "13:37",
        lastText  = "Yo t’es où ?",
        unread    = 2,
        messages  = {
            { from = "them", text = "Yo t’es où ?",               time = "13:37" },
            { from = "me",   text = "J’arrive à la ville, 2 min.", time = "13:38" },
        }
    },
    {
        id        = "dispatch",
        name      = "Dispatch",
        initials  = "D",
        lastTime  = "12:05",
        lastText  = "Appelle-moi quand tu peux.",
        unread    = 0,
        messages  = {
            { from = "them", text = "Appelle-moi quand tu peux.", time = "12:05" },
        }
    },
    {
        id        = "garage",
        name      = "Garage",
        initials  = "G",
        lastTime  = "08:21",
        lastText  = "Ton véhicule est prêt.",
        unread    = 1,
        messages  = {
            { from = "them", text = "Ton véhicule est prêt.", time = "08:21" },
            { from = "me",   text = "Parfait, j’arrive.",     time = "08:24" },
        }
    }
}

local function togglePhone(state)
    if state == nil then state = not phoneOpen end
    phoneOpen = state

    SetNuiFocus(phoneOpen, phoneOpen)

    SendNUIMessage({
        action = "phone:state",
        open   = phoneOpen
    })
end


-- Commande de test /phone
RegisterCommand("phone", function()
    togglePhone()
end, false)

-- UI nous dit “je suis prête”
RegisterNUICallback("phone:ready", function(data, cb)
    print("[IA-Phone] NUI ready, ts = " .. tostring(data.ts))
    cb({ ok = true })

    -- optionnel : on peut choisir d’ouvrir le phone automatiquement ici
    -- togglePhone(true)
end)

-- Bouton croix dans l’UI
RegisterNUICallback("close", function(data, cb)
    togglePhone(false)
    cb({ ok = true })
end)

-- Demande de toutes les conversations
RegisterNUICallback("messages:getThreads", function(data, cb)
    -- plus tard, ici on ira chercher en BDD côté serveur
    cb({
        ok      = true,
        threads = Conversations
    })
end)

-- Envoi d’un message
RegisterNUICallback("messages:send", function(data, cb)
    local threadId = tostring(data.threadId or "")
    local text     = tostring(data.text or ""):gsub("^%s+", ""):gsub("%s+$", "")

    if text == "" or threadId == "" then
        cb({ ok = false, error = "invalid_data" })
        return
    end

    local now   = os.date("*t")
    local time  = string.format("%02d:%02d", now.hour, now.min)
    local found = nil

    for i, conv in ipairs(Conversations) do
        if tostring(conv.id) == threadId then
            found = conv
            -- ajoute le message dans la conversation
            conv.messages = conv.messages or {}
            table.insert(conv.messages, {
                from = "me",
                text = text,
                time = time
            })
            conv.lastText = text
            conv.lastTime = time
            conv.unread   = 0
            break
        end
    end

    -- si la conv n’existe pas encore => on en crée une “nouvelle”
    if not found then
        found = {
            id        = threadId,
            name      = "Contact "..threadId,
            initials  = string.sub(threadId, 1, 1):upper(),
            lastTime  = time,
            lastText  = text,
            unread    = 0,
            messages  = {
                { from = "me", text = text, time = time }
            }
        }
        table.insert(Conversations, 1, found)
    end

    print(string.format("[IA-Phone] message -> thread %s: %s", threadId, text))

    -- On renvoie la conversation mise à jour, comme attendu par JS
    cb({
        ok     = true,
        thread = found
    })
end)


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





