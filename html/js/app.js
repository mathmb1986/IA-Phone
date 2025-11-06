const phone    = document.getElementById('phone');
const info     = document.getElementById('info');
const btnClose = document.getElementById('btnClose');
const appNotes = document.getElementById('appNotes');
const view     = document.getElementById('view');

function show(open){ phone.classList.toggle('hidden', !open); }

function nui(name, payload){
  return fetch(`https://${GetParentResourceName()}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload || {})
  });
}

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

btnClose.addEventListener('click', () => nui('close', {}).catch(()=>{}));

// Déclarer l'UI prête une fois le DOM prêt (same-origin fetch => OK CSP)
document.addEventListener('DOMContentLoaded', () => {
  nui('ready', { ts: Date.now() }).catch(()=>{});
});
