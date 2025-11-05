Bridge = { name = "standalone",playerName = "notset" }


-- ## ESX BRIDGE
-- Méthode pour obtenir le nom et prénom du joueur compatible avec ESX
local function getPlayerFullName(playerData)
  if playerData and playerData.firstName and playerData.lastName then
    return ("%s %s"):format(playerData.firstName, playerData.lastName)
  end
  return "Inconnu"
end


CreateThread(function()
    local player = nil

    if Config.Framework == "ESX" then
        Bridge.name = "ESX"
        local ESX = rawget(_G, "ESX") or (exports["es_extended"] and exports["es_extended"]:getSharedObject())

        Bridge.GetPlayerData = function()
            local attempts = 0
            while (not player or not player.job) do
                player = ESX.GetPlayerData()
		        Bridge.playerName = getPlayerFullName(player)
                Citizen.Wait(100) -- attend 100ms entre chaque tentative
            end

            if not player or not player.job then
                print("[IA-Phone] ?? Impossible d'obtenir les données ESX du joueur après plusieurs tentatives.")
                return {}
            end

            return player
        end
	
    elseif Config.Framework == "QBCore" then
        Bridge.name = "QBCore"
        local QBCore = exports['qb-core'] and exports['qb-core']:GetCoreObject()

        local p   = QBCore.Functions.GetPlayer(src)
        local ci  = p and p.PlayerData and p.PlayerData.charinfo
        local display = (ci and ci.firstname and ci.lastname) and (ci.firstname .. ' ' .. ci.lastname) or GetPlayerName(src)
        local uid     = p and p.PlayerData and p.PlayerData.citizenid


        Bridge.GetPlayerData = function()
            if not QBCore then
                print("[IA-Phone] ?? QBCore non trouvé.")
                return {}
            end
            return QBCore.Functions.GetPlayerData()
        end

    else
        Bridge.name = "standalone"
        Bridge.GetPlayerData = function()
            return {}
        end
    end

end)


-- Debug Print
local function debug(msg)
  if Config.Debug then print(("[IA-Phone] %s"):format(msg)) end
end
