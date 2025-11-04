Repo = {}

local function debug(msg)
  if Config.Debug then print(("[IA-Phone][SV][Repo] %s"):format(msg)) end
end

local function rowsAffected(res)
  if type(res) == "number" then
    return res
  elseif type(res) == "table" then
    return res.affectedRows or res.changedRows or res.affected or 0
  end
  return 0
end

local function generateNumber()
  local prefix = math.random(100, 777)     -- 3 chiffres aléatoires entre 100 et 999
  local suffix = math.random(0, 9999)      -- 4 chiffres aléatoires entre 0000 et 9999
  return ("%03d-%04d"):format(prefix, suffix)
end


-- [RECO] Trouve l’entrée du perso exact: (citizenid + name)
function Repo.GetUserByNameForCitizen(citizenid, userName, cb)
  exports.oxmysql:single(
    'SELECT * FROM iaPhone_users WHERE citizenid = ? AND name = ? LIMIT 1',
    { citizenid, userName },
    function(row) cb(row or nil) end
  )
end

-- Fallback: prend le "premier" John (si doublons possibles)
function Repo.GetFirstUserByName(userName, cb)
  exports.oxmysql:single(
    'SELECT * FROM iaPhone_users WHERE name = ? ORDER BY updated_at DESC, id ASC LIMIT 1',
    { userName },
    function(row) cb(row or nil) end
  )
end

-- Si tu veux juste le numéro (pour “le phone à John”)
function Repo.GetPhoneNumberByNameForCitizen(citizenid, userName, cb)
  Repo.GetUserByNameForCitizen(citizenid, userName, function(row)
    cb(row and row.phone_number or nil)
  end)
end


-- Crée le user (si absent) + assigne un numéro unique à CE citizenid seulement
function Repo.EnsureUser(citizenid, defaultName, cb)
  if not citizenid then return cb(false) end

  exports.oxmysql:execute(
    'INSERT IGNORE INTO iaPhone_users (citizenid, name, phone_number) VALUES (?, ?, ?)',
    { citizenid, defaultName or '', 'PENDING' },
    function()
      local function assignUnique(attempt)
        attempt = attempt or 1
        if attempt > 8 then
          debug(("Échec assignUnique après 8 tentatives pour %s"):format(citizenid))
          return cb(false)
        end

        local num = generateNumber()

        -- CIBLE UN SEUL USER: citizenid
        exports.oxmysql:execute(
          [[
            UPDATE iaPhone_users
            SET phone_number = ?
            WHERE citizenid = ? AND (phone_number = 'PENDING' OR phone_number = '')
            LIMIT 1
          ]],
          { num, citizenid },
          function(res)
            if rowsAffected(res) > 0 then
              -- Valide unicité
              exports.oxmysql:scalar(
                'SELECT COUNT(*) FROM iaPhone_users WHERE phone_number = ?',
                { num },
                function(cnt)
                  if tonumber(cnt) == 1 then
                    cb(true)
                  else
                    assignUnique(attempt + 1)
                  end
                end
              )
            else
              -- Déjà existant (il a déjà un numéro) -> OK
              cb(true)
            end
          end
        )
      end

      assignUnique(1)
    end
  )
end
