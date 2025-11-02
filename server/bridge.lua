SvBridge = { name = "standalone" }
SvBridge.GetIdentifier = function(src)
  return "license:"..(GetPlayerIdentifierByType(src, "license") or tostring(src))
end
