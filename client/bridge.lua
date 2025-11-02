Bridge = { name = "standalone" }

local function debug(msg)
  if Config.Debug then print(("[IA-Phone] %s"):format(msg)) end
end

CreateThread(function()
  if Config.Framework == "ESX" then
    Bridge.name = "ESX"
    local ESX = rawget(_G, "ESX") or (exports["es_extended"] and exports["es_extended"]:getSharedObject())
    Bridge.GetPlayerData = function() return ESX and ESX.GetPlayerData() or {} end

  elseif Config.Framework == "QBCore" then
    Bridge.name = "QBCore"
    local QBCore = exports['qb-core'] and exports['qb-core']:GetCoreObject()
    Bridge.GetPlayerData = function() return QBCore and QBCore.Functions.GetPlayerData() or {} end

  else
    Bridge.name = "standalone"
    Bridge.GetPlayerData = function() return {} end
  end

  debug(("Client Framework: %s"):format(Bridge.name))
end)
