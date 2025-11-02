const phone   = document.getElementById('phone');
const info    = document.getElementById('info');
const btnClose= document.getElementById('btnClose');
const appNotes= document.getElementById('appNotes');
const view    = document.getElementById('view');

function show(open){ phone.classList.toggle('hidden', !open); }
function nui(name, payload){ return fetch(`https://${GetParentResourceName()}/${name}`, {method:'POST', body: JSON.stringify(payload || {})}); }

window.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.action === 'phone:state') {
    show(!!d.open);
    if (d.open) view.innerHTML = '';
  } else if (d.action === 'boot') {
    info.textContent = `Chargement du profil…`;
  } else if (d.action === 'set-user') {
    const u = d.user || {};
    info.textContent = `Nom: ${u.name || ''} — Numéro: ${u.phone_number || '???'}`;
  }
});

btnClose.addEventListener('click', () => nui('nui:close', {}));
nui('nui:ready', {});
