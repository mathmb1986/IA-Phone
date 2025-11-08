(()=> {
  const isNUI = typeof GetParentResourceName === 'function' && typeof window.invokeNative === 'function';

  const phone       = document.getElementById('phone');
  const btnClose    = document.getElementById('btnClose');
  const hsTime      = document.getElementById('hsTime');
  const hsDate      = document.getElementById('hsDate');
  const appsGrid    = document.getElementById('appsGrid');
  const info        = document.getElementById('info');
  const debugPanel  = document.getElementById('debugPanel');

  /* ========== DEBUG ==========
     - F2 pour toggle
     - En démo: activé par défaut; en NUI: désactivé par défaut
     - dbg('message', data?) imprime dans le panneau + console
  */
  const Debug = {
    enabled: !isNUI, // démo ON, NUI OFF
    lines: 0,
    maxLines: 150,
  };

  function dbg(msg, data, kind='') {
    try {
      const time = new Date().toISOString().substr(11,8);
      const kls = kind ? ` ${kind}` : '';
      const text = typeof data !== 'undefined' ? `${msg} ${safeJSON(data)}` : msg;
      console.log(`[IA-Phone][${time}] ${msg}`, data ?? '');
      if (!Debug.enabled || !debugPanel) return;

      const line = document.createElement('div');
      line.className = `line${kls}`;
      line.textContent = `[${time}] ${text}`;
      debugPanel.appendChild(line);
      Debug.lines++;
      // prune
      if (Debug.lines > Debug.maxLines) {
        const over = Debug.lines - Debug.maxLines;
        for (let i=0; i<over; i++) debugPanel.firstChild?.remove();
        Debug.lines -= over;
      }
      // scroll à la fin
      debugPanel.scrollTop = debugPanel.scrollHeight;
    } catch(e) {
      console.warn('dbg error', e);
    }
  }

  function safeJSON(x){
    try { return JSON.stringify(x); } catch { return String(x); }
  }

  function setDebugVisible(v){
    if (!debugPanel) return;
    if (v){ debugPanel.classList.add('show'); }
    else  { debugPanel.classList.remove('show'); }
  }

  // Toggle F4
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'F4'){
      Debug.enabled = !Debug.enabled;
      setDebugVisible(Debug.enabled);
      dbg('DEBUG TOGGLE', { enabled: Debug.enabled }, Debug.enabled ? 'ok' : 'warn');
    }
  });

  // init état visible
  setDebugVisible(Debug.enabled);

  /* ===== Utilitaires DOM ===== */
  const $all = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function playOnce(element, className, fallbackMs){
    try {
      element.classList.remove(className);
      void element.offsetWidth; // reset animation
      element.classList.add(className);

      const clear = ()=> element.classList.remove(className);
      const to = setTimeout(clear, fallbackMs);
      element.addEventListener('animationend', function handler(){
        clearTimeout(to);
        clear();
        element.removeEventListener('animationend', handler);
      }, { once:true });
    } catch(e){
      dbg('playOnce error', e, 'err');
    }
  }

  /* ===== Horloge ===== */
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
    clockTimer = setInterval(updateClock, 15_000);
  }

  /* ===== Open/Close animé ===== */
  let isOpen = false;
  let closingTimer = null;
  function show(open){
    if (open === isOpen) return;

    dbg('SHOW', { open });

    if (open){
      clearTimeout(closingTimer);
      phone.classList.remove('is-closing');
      phone.classList.add('is-open');
      phone.setAttribute('aria-hidden', 'false');
      isOpen = true;
      restartCascade();
    } else {
      phone.classList.add('is-closing');
      phone.setAttribute('aria-hidden', 'true');
      isOpen = false;
      const onDone = () => {
        phone.classList.remove('is-open');
        phone.removeEventListener('transitionend', onDone);
        dbg('CLOSED', {}, 'warn');
      };
      closingTimer = setTimeout(onDone, 250);
      phone.addEventListener('transitionend', onDone, { once:true });
    }
  }

  function nui(name, payload){
    if (!isNUI) return Promise.resolve();
    dbg('NUI CALL', { name, payload });
    return fetch(`https://${GetParentResourceName()}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload || {})
    }).catch(err=>{
      dbg('NUI CALL ERROR', { name, err: String(err) }, 'err');
    });
  }

  /* ===== Cascade index ===== */
  function indexApps(){
    const apps = $all('.app', appsGrid);
    apps.forEach((btn, i)=> btn.style.setProperty('--i', i.toString()));
    dbg('INDEX APPS', { count: apps.length, hasGrid: !!appsGrid }, 'ok');
  }
  function restartCascade(){
    if (prefersReduced()) return;
    $all('.app .app-icon', appsGrid).forEach(icon=>{
      icon.style.animation = 'none';
      void icon.offsetWidth; // reflow
      icon.style.animation = '';
    });
    dbg('CASCADE RESTART', {}, 'ok');
  }

  /* ===== Tap Pop + Halo — Handlers directs par bouton ===== */
  function attachAppHandlers(){
    const apps = $all('.app', appsGrid);
    dbg('ATTACH HANDLERS', { count: apps.length, supportsPointer: !!window.PointerEvent }, 'ok');

    apps.forEach(btn=>{
      btn.__pressing = false;

      const id = btn.dataset.app || '(no-app)';
      const icon = btn.querySelector('.app-icon');

      const pressStart = (ev)=>{
        btn.__pressing = true;
        btn.classList.add('is-pressing');
        dbg('PRESS START', { type: ev.type, app: id });
      };

      const pressEnd = (ev)=>{
        const fired = btn.__pressing;
        btn.__pressing = false;
        btn.classList.remove('is-pressing');

        dbg('PRESS END', { type: ev.type, app: id, fired });

        if (fired){
          // Animations
          playOnce(btn, 'play-pop', 220);
          playOnce(btn, 'play-halo', 280);

          // Flash vert (bordure) pour bien voir l’activation
          if (icon){
            icon.style.boxShadow = '0 0 0 2px rgba(80,220,120,.9), inset 0 0 0 1px rgba(255,255,255,.06), 0 8px 24px rgba(0,0,0,.35)';
            setTimeout(()=> icon.style.boxShadow = '', 160);
          }
        }
      };

      const pressCancel = (ev)=>{
        btn.__pressing = false;
        btn.classList.remove('is-pressing');
        dbg('PRESS CANCEL', { type: ev.type, app: id });
      };

      // Pointer (si supporté)
      btn.addEventListener('pointerdown', pressStart);
      btn.addEventListener('pointerup',   pressEnd);
      btn.addEventListener('pointercancel', pressCancel);
      btn.addEventListener('mouseleave',  pressCancel);

      // Souris
      btn.addEventListener('mousedown', pressStart);
      btn.addEventListener('mouseup',   pressEnd);
      btn.addEventListener('mouseout',  pressCancel);

      // Tactile
      btn.addEventListener('touchstart', (e)=>{ pressStart(e); }, { passive:true });
      btn.addEventListener('touchend',   (e)=>{ pressEnd(e); },   { passive:true });
      btn.addEventListener('touchcancel',(e)=>{ pressCancel(e); },{ passive:true });

      // Clavier
      btn.addEventListener('keyup', (e)=>{
        if (e.key === 'Enter' || e.key === ' '){
          dbg('KEY ACTIVATE', { key: e.key, app: id });
          playOnce(btn, 'play-pop', 220);
          playOnce(btn, 'play-halo', 280);
        }
      });

      // Filet de sécurité: certains environnements ne remontent que “click”
      btn.addEventListener('click', (e)=>{
        dbg('CLICK', { type: e.type, app: id });
        playOnce(btn, 'play-pop', 220);
        playOnce(btn, 'play-halo', 280);
      });
    });
  }

  /* ===== NUI messages ===== */
  window.addEventListener('message', (e) => {
    const d = e.data || {};
    dbg('WINDOW MESSAGE', d);

    switch (d.action) {
      case 'phone:state': show(!!d.open); break;
      case 'boot': info.textContent = 'Profil en chargement…'; break;
      case 'set-user': {
        const u = d.user || {};
        info.textContent = `Nom: ${u.name || ''} — Numéro: ${u.phone_number || '???'}`;
        break;
      }
    }
  });

  /* ===== UI ===== */
  btnClose.addEventListener('click', () => nui('close', {}).catch(()=>{}));

  document.addEventListener('DOMContentLoaded', () => {
    dbg('DOM READY', { isNUI });

    indexApps();
    startClock();
    attachAppHandlers();

    if (isNUI){
      phone.setAttribute('aria-hidden', 'true'); // fermé
      nui('ready', { ts: Date.now() }).catch(()=>{});
    } else {
      show(true); // démo
      info.textContent = 'Mode démo — écran d’accueil prêt.';
    }
  });

  window.addEventListener('keydown', (ev) => {
    if (!isNUI && ev.key === 'Escape') show(false);
  });
})();
