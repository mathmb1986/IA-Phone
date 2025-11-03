Bridge = { name = "standalone" }

local function debug(msg)
  if Config.Debug then print(("[IA-Phone] %s"):format(msg)) end
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

    debug(("[IA-Phone] Client Framework détecté : %s"):format(Bridge.name))
end)
