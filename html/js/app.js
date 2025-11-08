(()=> {
  // Détection NUI (FiveM) vs navigateur (démo)
  const isNUI = typeof GetParentResourceName === 'function' && typeof window.invokeNative === 'function';

  const phone    = document.getElementById('phone');
  const info     = document.getElementById('info');
  const btnClose = document.getElementById('btnClose');
  const view     = document.getElementById('view');

  function show(open){
    phone.classList.toggle('hidden', !open);
    phone.setAttribute('aria-hidden', String(!open));
  }

  function nui(name, payload){
    if (!isNUI) return Promise.resolve(); // no-op en mode démo
    return fetch(`https://${GetParentResourceName()}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload || {})
    });
  }

  // Réception des messages NUI
  window.addEventListener('message', (e) => {
    const d = e.data || {};
    switch (d.action) {
      case 'phone:state':
        show(!!d.open);
        if (d.open) view.innerHTML = '';
        break;

      case 'boot':
        info.textContent = 'Chargement du profil…';
        break;

      case 'set-user': {
        const u = d.user || {};
        info.textContent = `Nom: ${u.name || ''} — Numéro: ${u.phone_number || '???'}`;
        break;
      }
    }
  });

  // Bouton fermer (renvoie l’événement au script côté client)
  btnClose.addEventListener('click', () => nui('close', {}).catch(()=>{}));

  // Démarrage
  document.addEventListener('DOMContentLoaded', () => {
    if (isNUI) {
      // Signal au script que l’UI est prête
      nui('ready', { ts: Date.now() }).catch(()=>{});
    } else {
      // Mode démo navigateur : on montre juste le nouveau téléphone
      show(true);
      info.textContent = 'Mode démo — interface du téléphone prête.';
    }
  });

  // Helpers de debug (facultatifs)
  window.PhoneUI = {
    open : () => show(true),
    close: () => show(false),
    setUser: (user) => window.postMessage({ action:'set-user', user }, '*')
  };

  // En démo: Échap pour fermer
  window.addEventListener('keydown', (ev) => {
    if (!isNUI && ev.key === 'Escape') show(false);
  });
})();
