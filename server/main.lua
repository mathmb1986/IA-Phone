-- Server

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


-- Client demande son profil (nom/numéro, etc.) — version "par nom"
RegisterNetEvent('ia-phone:request-user', function()
  local src = source
  local id  = SvBridge.GetIdentifier(src)          -- citizenid (clé unique)
  local name = GetPlayerName(src) or ''            -- nom affiché / RP (remplace si tu as mieux)

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
