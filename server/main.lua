local function debug(msg)
  if Config.Debug then print(("[IA-Phone][SV] %s"):format(msg)) end
end

-- Assure le user quand il joint
AddEventHandler('playerJoining', function()
  local src = source
  local id  = SvBridge.GetIdentifier(src)  -- depuis server/bridge.lua
  Repo.EnsureUser(id, GetPlayerName(src) or '', function(ok)
    if ok then debug(("EnsureUser OK pour %s"):format(id))
    else debug(("EnsureUser ÉCHEC pour %s"):format(id)) end
  end)
end)

-- Client demande son profil (nom/numéro, etc.)
RegisterNetEvent('ia-phone:request-user', function()
  local src = source
  local id  = SvBridge.GetIdentifier(src)
  Repo.GetUser(id, function(user)
    if not user then
      debug(("User introuvable, re-EnsureUser %s"):format(id))
      Repo.EnsureUser(id, GetPlayerName(src) or '', function()
        Repo.GetUser(id, function(user2)
          TriggerClientEvent('ia-phone:set-user', src, user2 or {})
        end)
      end)
      return
    end
    TriggerClientEvent('ia-phone:set-user', src, user)
  end)
end)
