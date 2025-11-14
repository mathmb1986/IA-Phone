-- Server

-- Debug Print 
local function debug(msg)
  if Config.Debug then print(("[IA-Phone][SV] %s"):format(msg)) end
end


-- 100% fonctionnel
-- Connection Principale
-- Client demande son profil (nom/num�ro, etc.) � version "par nom"
RegisterNetEvent('ia-phone:request-user',function(name)
  local src = source
  local id  = SvBridge.GetIdentifier(src)          -- citizenid (cl� unique)

  Repo.GetUserByNameForCitizen(id,name, function(user)                -- lecture PAR NOM
    if not user then
      debug(("User introuvable pour le nom '%s', EnsureUser avec citizenid=%s"):format(name, id))
      Repo.EnsureUser(id, name, function()         -- cr�e si absent (associe ce nom)
        Repo.GetUserByNameForCitizen(id,name, function(user2)         -- relit PAR NOM
          TriggerClientEvent('ia-phone:set-user', src, user2 or {})
        end)
      end)
      return
    end

    TriggerClientEvent('ia-phone:set-user', src, user)
  end)
end)


-- Fonctionnel pour l'instant.
-- A revoir certains points
------------------------------------------------------------
--  MESSAGES : �v�nements serveur
--  Ces events servent de pont entre ton client Lua et Repo.*
------------------------------------------------------------
-- payload contien user.phone_number et user.name 
-- Client veut toutes ses conversations (threads)
-- client demande ses threads (on utilise phone_number comme key)
RegisterNetEvent('ia-phone:get-threads-by-phone', function(payload)
  local src = source
  payload = payload or {}
  local phone = payload.phone_number or ''  -- attendu depuis client: le phone_number du joueur
  debug(("ia-phone:get-threads-by-phone depuis %s (phone=%s)"):format(src, tostring(phone)))

  -- si le phone_number est manquant
  --TODO: voir faire la meme methode que au boot du Phone.. chercher le # par nom de joueur.
  -- Cherche le threads par phone_number <= sauf qui prend le premier qui trouver et c'est pas forcement le bon'

  -- ou supprimer cette methode car pas senser avoir de numeros nul ou inexistant ici.
  if phone == '' then
    -- si manque, essaye de r�cup�rer via la table iaPhone_users en fonction du citizenid
    local citizenid = SvBridge.GetIdentifier(src)
    -- on peut SELECT phone_number from iaPhone_users where citizenid = ?
    exports.oxmysql:scalar('SELECT phone_number FROM iaPhone_users WHERE citizenid = ? LIMIT 1', { citizenid }, function(phoneNumber)
      phoneNumber = phoneNumber or ''
      Repo.GetThreadsForPhoneNumber(phoneNumber, function(threads)
        TriggerClientEvent('ia-phone:set-threads', src, threads or {})
      end)
    end)
    return
  end

  Repo.GetThreadsForPhoneNumber(phone, function(threads)
    TriggerClientEvent('ia-phone:set-threads', src, threads or {})
  end)
end)


-- Envoi d'un message bas� sur les num�ros de t�l�phone
-- payload = { ownerPhone = "111-2358", contactPhone = "211-6889", contactName = "Trixy", text = "Yo", direction = "me" }
-- Envoi d'un message basé sur les numéros de téléphone
-- payload = {
--   ownerPhone   = "111-2358",
--   contactPhone = "571-8760",
--   contactName  = "Trixy",   -- optionnel
--   text         = "Yo",
--   direction    = "me"       -- par défaut
-- }
RegisterNetEvent('ia-phone:send-message-by-phone', function(payload)
  local src = source
  payload = payload or {}

  local ownerPhone   = tostring(payload.ownerPhone or '')
  local contactPhone = tostring(payload.contactPhone or '')
  local contactName  = payload.contactName
  local text         = (payload.text or ''):gsub('^%s+', ''):gsub('%s+$', '')
  local direction    = payload.direction or 'me'

  if ownerPhone == '' or contactPhone == '' or text == '' then
    debug(("[SV] send-message-by-phone: données invalides owner=%s contact=%s text='%s'"):format(
      ownerPhone, contactPhone, text
    ))
    return
  end

  debug(("[SV] ia-phone:send-message-by-phone depuis %d (owner=%s, contact=%s)"):format(
    src, ownerPhone, contactPhone
  ))

  -- 1) Insert du message dans iaPhone_messages
  Repo.AddMessageByPhoneNumber(ownerPhone, contactPhone, contactName, direction, text, function(ok)
    if not ok then
      debug("[SV] AddMessageByPhoneNumber a échoué")
      return
    end

    -- 2) S'assurer que le contact existe pour ce téléphone
    Repo.EnsureContactForOwnerNumber(ownerPhone, contactPhone, contactName, function(_)
      -- 3) Rafraîchir la liste des threads pour ce joueur
      Repo.GetThreadsForPhoneNumber(ownerPhone, function(threads)
        TriggerClientEvent('ia-phone:set-threads', src, threads or {})
      end)
    end)
  end)
end)


-- Récupération des contacts pour un téléphone (par numéro)
-- payload = { phone = "111-2358" }
RegisterNetEvent('ia-phone:get-contacts-by-phone', function(payload)
  local src = source
  payload = payload or {}

  local phone = tostring(payload.phone or '')
  if phone == '' then
    debug(("[SV] ia-phone:get-contacts-by-phone: phone manquant (src=%d)"):format(src))
    TriggerClientEvent('ia-phone:set-contacts', src, {})
    return
  end

  debug(("[SV] ia-phone:get-contacts-by-phone depuis %d (phone=%s)"):format(src, phone))

  Repo.GetContactsForOwnerNumber(phone, function(contacts)
    TriggerClientEvent('ia-phone:set-contacts', src, contacts or {})
  end)
end)


