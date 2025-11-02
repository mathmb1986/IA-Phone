Repo = {}

local function debug(msg)
  if Config.Debug then print(("[IA-Phone][SV][Repo] %s"):format(msg)) end
end

local function generateNumber()
  -- Format simple 555-XXXX ; adapte si tu veux autre chose
  return ("555-%04d"):format(math.random(0, 9999))
end

-- Retourne table user {citizenid,name,phone_number,avatar,wallpaper,...} ou nil
function Repo.GetUser(citizenid, cb)
  exports.oxmysql:single('SELECT * FROM ia_users WHERE citizenid = ?', { citizenid }, function(row)
    cb(row or nil)
  end)
end

-- Crée un user s’il n’existe pas + assigne un numéro unique
function Repo.EnsureUser(citizenid, defaultName, cb)
  -- Upsert basique: essaie d’insérer le citizen si absent
  exports.oxmysql:execute(
    'INSERT IGNORE INTO ia_users (citizenid, name, phone_number) VALUES (?, ?, ?)',
    { citizenid, defaultName or '', 'PENDING' },
    function()
      -- Si phone_number == 'PENDING' -> générer un unique
      local function assignUnique(attempt)
        attempt = attempt or 1
        if attempt > 8 then
          debug(("Échec assignUnique après 8 tentatives pour %s"):format(citizenid))
          return cb(false)
        end
        local num = generateNumber()
        exports.oxmysql:execute(
          'UPDATE ia_users SET phone_number = ? WHERE citizenid = ? AND (phone_number = ? OR phone_number = "")',
          { num, citizenid, 'PENDING' },
          function(affected)
            if (affected or 0) > 0 then
              -- OK, mais on valide l’unicité (au cas où conflit UNIQUE)
              exports.oxmysql:scalar('SELECT COUNT(*) FROM ia_users WHERE phone_number = ?', { num }, function(cnt)
                if cnt and cnt == 1 then
                  cb(true); return
                else
                  assignUnique(attempt + 1)
                end
              end)
            else
              -- Déjà existant ou autre cas : juste ok
              cb(true)
            end
          end
        )
      end
      assignUnique(1)
    end
  )
end
