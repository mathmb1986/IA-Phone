
-- Fonction pour générer un numéro de téléphone aléatoire au format XXX-XXXX

local function generateNumber()
  local prefix = math.random(100, 777)     -- 3 chiffres al?atoires entre 100 et 777
  local suffix = math.random(0, 9999)      -- 4 chiffres al?atoires entre 0000 et 9999
  return ("%03d-%04d"):format(prefix, suffix)
end


-- Exporte la fonction pour qu'elle soit accessible depuis d'autres scripts serveur	
exports('GeneratePhoneNumber', function()
  return generateNumber()
end)

-- Exemple d'utilisation dans un autre script serveur :
-- Usage : local number = exports['ia-phone']:GeneratePhoneNumber()	


-- Rajouter tes méthode pour géré les numéros de téléphone ici si besoin

-- Par exemple, vérifier l'unicité d'un numéro dans la base de données	

-- function isNumberUnique(number, cb)

-- Requête SQL pour vérifier si le numéro existe déjà