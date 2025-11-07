fx_version 'cerulean'
game 'gta5'

name 'IA-Phone'
author 'mathmb1986'
version '0.1.1'

ui_page 'html/index.html'

files { 
	'html/index.html',
 	'html/img/*.svg',
  	'html/js/*.js', 
	'html/css/*.css',
    'html/scripts/*.js',
    'html/scripts/mustache.min.js',	
}

shared_scripts { 'config.lua' }

client_scripts {
  'client/bridge.lua',
  'client/nui.lua',
  'client/main.lua',  
  'client/locale.lua',
  'locales/*.lua'
}

server_scripts {
  '@oxmysql/lib/MySQL.lua',   -- <=== OBLIGATOIRE
  'server/bridge.lua',
  'server/repo.lua',          -- <=== AJOUT
  'server/main.lua'
}
