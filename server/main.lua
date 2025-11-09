-- Server

-- Debug Print 
local function debug(msg)
  if Config.Debug then print(("[IA-Phone][SV] %s"):format(msg)) end
end


-- Client demande son profil (nom/numéro, etc.) — version "par nom"
RegisterNetEvent('ia-phone:request-user',function(name)
  local src = source
  local id  = SvBridge.GetIdentifier(src)          -- citizenid (clé unique)

  Repo.GetUserByNameForCitizen(id,name, function(user)                -- lecture PAR NOM
    if not user then
      debug(("User introuvable pour le nom '%s', EnsureUser avec citizenid=%s"):format(name, id))
      Repo.EnsureUser(id, name, function()         -- crée si absent (associe ce nom)
        Repo.GetUserByNameForCitizen(id,name, function(user2)         -- relit PAR NOM
          TriggerClientEvent('ia-phone:set-user', src, user2 or {})
        end)
      end)
      return
    end

    TriggerClientEvent('ia-phone:set-user', src, user)
  end)
end)



------------------------------------------------------------
--  MESSAGES : événements serveur
--  Ces events servent de pont entre ton client Lua et Repo.*
------------------------------------------------------------

-- Client veut toutes ses conversations (threads)
-- client demande ses threads (on utilise phone_number comme key)
RegisterNetEvent('ia-phone:get-threads-by-phone', function(payload)
  local src = source
  payload = payload or {}
  local phone = payload.phone or ''  -- attendu depuis client: le phone_number du joueur
  debug(("ia-phone:get-threads-by-phone depuis %s (phone=%s)"):format(src, tostring(phone)))

  if phone == '' then
    -- si manque, essaye de récupérer via la table iaPhone_users en fonction du citizenid
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


-- client envoie un message (par numéro)
-- payload = { ownerPhone = "...", contactPhone = "...", contactName = "...", text = "...", direction = "me" }
RegisterNetEvent('ia-phone:send-message-by-phone', function(payload)
  local src = source
  payload = payload or {}
  local ownerPhone   = payload.ownerPhone or ''
  local contactPhone = payload.contactPhone or ''
  local contactName  = payload.contactName or nil
  local text         = payload.text or ''
  local direction    = payload.direction or 'me'

  if ownerPhone == '' or contactPhone == '' or text == '' then
    debug("[send-message-by-phone] données invalides")
    return
  end

  Repo.AddMessageByPhoneNumber(ownerPhone, contactPhone, contactName, direction, text, function(ok)
    debug(("[send-message-by-phone] %s -> %s ok=%s"):format(tostring(ownerPhone), tostring(contactPhone), tostring(ok)))
    -- Optionnel : on renvoie la liste mise à jour
    Repo.GetThreadsForPhoneNumber(ownerPhone, function(threads)
      TriggerClientEvent('ia-phone:set-threads', src, threads or {})
    end)
  end)
end)



