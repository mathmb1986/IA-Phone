(()=> {
  const isNUI = typeof GetParentResourceName === 'function' && typeof window.invokeNative === 'function';

  const phone    = document.getElementById('phone');
  const btnClose = document.getElementById('btnClose');
  const hsTime   = document.getElementById('hsTime');
  const hsDate   = document.getElementById('hsDate');
  const appsGrid = document.getElementById('appsGrid');
  const info     = document.getElementById('info'); // sr-only

  /* ====== Horloge / Date (locale FR) ====== */
  function updateClock(){
    const d = new Date();
    const hh = d.getHours().toString().padStart(2,'0');
    const mm = d.getMinutes().toString().padStart(2,'0');
    hsTime.textContent = `${hh}:${mm}`;

    const fmt = new Intl.DateTimeFormat('fr-CA', { weekday:'short', day:'2-digit', month:'long' });
    const parts = fmt.formatToParts(d);
    const wd = parts.find(p=>p.type==='weekday')?.value || '';
    const day = (parts.find(p=>p.type==='day')?.value || '').replace(/^0/,'');
    const mo = parts.find(p=>p.type==='month')?.value || '';
    hsDate.textContent = `${wd} ${day} ${mo}`;
  }
  let clockTimer = null;
  function startClock(){
    updateClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 1000 * 15);
  }

  /* ====== Animation: open/close propre ======
     - Ajoute .is-open pour afficher (fade/slide).
     - Lors d’une fermeture, ajoute .is-closing puis retire .is-open
       quand la transition est terminée (évite les "sauts" d'état).
  */
  let isOpen = false;
  let closingTimer = null;

  function show(open){
    if (open === isOpen) return;

    if (open){
      // Cancel fermeture en cours
      clearTimeout(closingTimer);
      phone.classList.remove('is-closing');

      // Ouvrir
      phone.classList.add('is-open');
      phone.setAttribute('aria-hidden', 'false');
      isOpen = true;
    } else {
      // Lancer la fermeture animée
      phone.classList.add('is-closing');
      phone.setAttribute('aria-hidden', 'true');
      isOpen = false;

      // Une fois la transition terminée, retirer .is-open
      const onDone = () => {
        phone.classList.remove('is-open');
        phone.removeEventListener('transitionend', onDone);
      };

      // Sécurité: timeout en cas d'absence d'event (ex: prefers-reduced-motion)
      closingTimer = setTimeout(onDone, 250);
      phone.addEventListener('transitionend', onDone, { once:true });
    }
  }

  function nui(name, payload){
    if (!isNUI) return Promise.resolve();
    return fetch(`https://${GetParentResourceName()}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload || {})
    });
  }

  /* ====== Icônes (feedback visuel) ====== */
  appsGrid.addEventListener('click', (ev)=>{
    const target = ev.target.closest('.app');
    if (!target) return;
    flashIcon(target);
    // plus tard: SendNUIMessage({ action:'open-app', name: target.dataset.app })
  });
  function flashIcon(btn){
    const icon = btn.querySelector('.app-icon');
    if (!icon) return;
    icon.style.filter = 'brightness(1.25)';
    setTimeout(()=> icon.style.filter = '', 120);
  }

  /* ====== Réception de messages NUI ====== */
  window.addEventListener('message', (e) => {
    const d = e.data || {};
    switch (d.action) {
      case 'phone:state':
        show(!!d.open);
        break;
      case 'boot':
        info.textContent = 'Profil en chargement…';
        break;
      case 'set-user': {
        const u = d.user || {};
        info.textContent = `Nom: ${u.name || ''} — Numéro: ${u.phone_number || '???'}`;
        break;
      }
    }
  });

  /* ====== Bouton fermer ====== */
  btnClose.addEventListener('click', () => nui('close', {}).catch(()=>{}));

  /* ====== Démarrage ====== */
  document.addEventListener('DOMContentLoaded', () => {
    startClock();
    if (isNUI) {
      // en NUI: fermé par défaut, le script ouvrira via 'phone:state'
      phone.setAttribute('aria-hidden', 'true');
      nui('ready', { ts: Date.now() }).catch(()=>{});
    } else {
      // Mode démo navigateur : ouvert par défaut pour voir l’anim
      show(true);
      info.textContent = 'Mode démo — écran d’accueil prêt.';
    }
  });

  // Esc pour fermer en démo
  window.addEventListener('keydown', (ev) => {
    if (!isNUI && ev.key === 'Escape') show(false);
  });
})();
