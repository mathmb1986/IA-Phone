fx_version 'cerulean'
game 'gta5'

name 'IA-Phone'
author 'mathmb1986'
version '0.1.0'

ui_page 'html/index.html'

files { 
	'html/index.html',
 	'html/app.js', 
	'html/app.css' 
}

shared_scripts { 'config.lua' }

client_scripts {
  'client/bridge.lua',
  'client/nui.lua',
  'client/main.lua'
}

server_scripts {
  '@oxmysql/lib/MySQL.lua',   -- <=== OBLIGATOIRE
  'server/bridge.lua',
  'server/repo.lua',          -- <=== AJOUT
  'server/main.lua'
}
