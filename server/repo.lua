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
  local prefix = math.random(100, 777)     -- 3 chiffres aléatoires entre 100 et 777
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


-- Repo.GetThreadsForPhoneNumber(ownerPhone, cb)
-- Retourne une table "threads" attendue par le NUI :
-- { { id = contact_phone, name = contact_name, initials = 'X', lastTime = 'HH:MM', lastText = '...', unread = n, messages = { { from='me'/'them', text='', time='HH:MM' } } }, ... }
function Repo.GetThreadsForPhoneNumber(ownerPhone, cb)
  if not ownerPhone or ownerPhone == '' then
    cb({})
    return
  end

  -- On récupère tous les messages où owner_phone = ownerPhone
  exports.oxmysql:query(
    'SELECT id, owner_phone, contact_phone, contact_name, direction, text, created_at, seen FROM iaPhone_messages WHERE owner_phone = ? ORDER BY created_at ASC',
    { ownerPhone },
    function(rows)
      rows = rows or {}
      local threadsByContact = {}

      for _, row in ipairs(rows) do
        local contact = row.contact_phone or 'unknown'
        local contactName = row.contact_name or contact

        if not threadsByContact[contact] then
          local firstChar = tostring(contactName):sub(1,1):upper()
          threadsByContact[contact] = {
            id = contact,
            name = contactName,
            initials = (firstChar ~= '' and firstChar) or '?',
            lastTime = '',
            lastText = '',
            unread = 0,
            messages = {}
          }
        end

        local thread = threadsByContact[contact]
        local dir = (row.direction == 'me') and 'me' or 'them'
        local txt = row.text or ''
        local ctime = row.created_at or ''

        -- conversion "YYYY-MM-DD HH:MM:SS" -> "HH:MM"
        local hhmm = ''
        if type(ctime) == 'string' and #ctime >= 16 then
          hhmm = ctime:sub(12,16)
        end

        table.insert(thread.messages, {
          from = dir,
          text = txt,
          time = hhmm
        })

        thread.lastText = txt
        thread.lastTime = hhmm

        if dir == 'them' and (row.seen == 0 or row.seen == false or row.seen == nil) then
          thread.unread = (thread.unread or 0) + 1
        end
      end

      local threads = {}
      for _, t in pairs(threadsByContact) do
        table.insert(threads, t)
      end

      -- trier par lastTime (string compare ok si HH:MM), sinon trier par created_at réel
      table.sort(threads, function(a,b)
        return (a.lastTime or '') > (b.lastTime or '')
      end)

      debug(("GetThreadsForPhoneNumber(%s) -> %d threads"):format(tostring(ownerPhone), #threads))
      cb(threads)
    end
  )
end



------------------------------------------------------------
--  MESSAGES PAR NUMÉRO
--  Table: iaPhone_messages
--  Colonnes attendues:
--    id INT PK AI
--    owner_phone   VARCHAR(32)
--    contact_phone VARCHAR(32)
--    contact_name  VARCHAR(100)
--    direction     ENUM('me','them')
--    text          TEXT
--    created_at    DATETIME
--    seen          TINYINT(1)
------------------------------------------------------------

--- Insère un message pour un téléphone donné
---@param ownerPhone string   -- numéro du téléphone du joueur ("111-2358")
---@param contactPhone string -- numéro du contact ("211-6889" ou label système)
---@param contactName string|nil
---@param direction string    -- 'me' ou 'them'
---@param text string
---@param cb fun(ok:boolean)|nil
function Repo.AddMessageByPhoneNumber(ownerPhone, contactPhone, contactName, direction, text, cb)
  cb = cb or function() end

  if not ownerPhone or ownerPhone == '' then
    debug("[Repo] AddMessageByPhoneNumber: ownerPhone manquant")
    return cb(false)
  end

  if not contactPhone or contactPhone == '' then
    debug("[Repo] AddMessageByPhoneNumber: contactPhone manquant")
    return cb(false)
  end

  if not text or text == '' then
    debug("[Repo] AddMessageByPhoneNumber: text vide")
    return cb(false)
  end

  local dir = (direction == 'them') and 'them' or 'me'
  local seen = (dir == 'me') and 1 or 0

  exports.oxmysql:insert(
    [[
      INSERT INTO iaPhone_messages (owner_phone, contact_phone, contact_name, direction, text, created_at, seen)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    ]],
    {
      ownerPhone,
      contactPhone,
      contactName or contactPhone,
      dir,
      text,
      seen
    },
    function(insertId)
      local ok = insertId and insertId > 0
      debug(("[Repo] AddMessageByPhoneNumber(%s -> %s, dir=%s) ok=%s, insertId=%s"):format(
        tostring(ownerPhone),
        tostring(contactPhone),
        dir,
        tostring(ok),
        tostring(insertId)
      ))
      cb(ok)
    end
  )
end






















--- pu utile !!!


------------------------------------------------------------
--  MESSAGES (DB) 
--
--  Table recommandée : iaPhone_messages
--  Cols suggérées (adapte aux tiens si besoin) :
--    id            INT AUTO_INCREMENT PRIMARY KEY
--    owner         VARCHAR(64)  -- citizenid propriétaire du téléphone
--    contact       VARCHAR(64)  -- identifiant du contact (numéro ou “clé”)
--    contact_name  VARCHAR(64)  -- label affiché (Alex, Dispatch, etc.)
--    direction     ENUM('me','them')   -- qui a envoyé
--    text          TEXT
--    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
--    seen          TINYINT(1) DEFAULT 0
--
--  Le JS attend des "threads" sous la forme:
--    {
--      id, name, initials, lastTime, lastText, unread, messages = {
--        { from='me'/'them', text='', time='HH:MM' }, ...
--      }
--    }
------------------------------------------------------------

--- Retourne toutes les conversations d’un joueur sous forme de threads
---@param citizenid string
---@param cb fun(threads: table)
function Repo.GetThreadsForCitizen(citizenid, cb)
  if not citizenid then
    cb({})
    return
  end

  exports.oxmysql:query(
    'SELECT * FROM iaPhone_messages WHERE owner = ? ORDER BY created_at ASC',
    { citizenid },
    function(rows)
      rows = rows or {}
      local threadsByContact = {}

      for _, row in ipairs(rows) do
        -- essaie différents noms de colonnes possibles
        local contact = row.contact or row.contact_number or row.other or 'unknown'
        local contactName = row.contact_name or contact

        if not threadsByContact[contact] then
          local firstChar = tostring(contactName):sub(1, 1):upper()
          threadsByContact[contact] = {
            id        = contact,
            name      = contactName,
            initials  = firstChar ~= '' and firstChar or '?',
            lastTime  = '',
            lastText  = '',
            unread    = 0,
            messages  = {}
          }
        end

        local thread = threadsByContact[contact]

        local dir   = row.direction == 'me' and 'me' or 'them'
        local txt   = row.text or row.message or ''
        local ctime = row.created_at

        -- Simple conversion "YYYY-MM-DD HH:MM:SS" -> "HH:MM"
        local hhmm = ''
        if type(ctime) == 'string' then
          hhmm = ctime:sub(12, 16)  -- caractères 12-16 = HH:MM
        end

        table.insert(thread.messages, {
          from = dir,
          text = txt,
          time = hhmm
        })

        thread.lastText = txt
        thread.lastTime = hhmm

        if dir == 'them' and (row.seen == 0 or row.seen == false or row.seen == nil) then
          thread.unread = (thread.unread or 0) + 1
        end
      end

      local threads = {}
      for _, t in pairs(threadsByContact) do
        table.insert(threads, t)
      end

      -- Threads les plus récents en premier
      table.sort(threads, function(a,b)
        return (a.lastTime or '') > (b.lastTime or '')
      end)

      debug(("GetThreadsForCitizen(%s) -> %d threads"):format(citizenid, #threads))
      cb(threads)
    end
  )
end


--- Ajoute un message dans la table iaPhone_messages pour un owner
---@param ownerCitizenId string
---@param contact string
---@param contactName string|nil
---@param direction string 'me' ou 'them'
---@param text string
---@param cb fun(ok:boolean)|nil
function Repo.AddMessage(ownerCitizenId, contact, contactName, direction, text, cb)
  cb = cb or function() end
  if not ownerCitizenId or ownerCitizenId == '' then
    debug("AddMessage: ownerCitizenId manquant")
    return cb(false)
  end
  if not contact or contact == '' then
    contact = 'unknown'
  end

  local dir = (direction == 'me') and 'me' or 'them'
  local seen = (dir == 'me') and 1 or 0

  exports.oxmysql:insert(
    [[
      INSERT INTO iaPhone_messages (owner, contact, contact_name, direction, text, created_at, seen)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    ]],
    {
      ownerCitizenId,
      contact,
      contactName or contact,
      dir,
      text,
      seen
    },
    function(insertId)
      local ok = insertId and insertId > 0
      debug(("AddMessage(%s -> %s, dir=%s) ok=%s"):format(ownerCitizenId, contact, dir, tostring(ok)))
      cb(ok)
    end
  )
end
