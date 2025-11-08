(()=> {
  const isNUI = typeof GetParentResourceName === 'function' && typeof window.invokeNative === 'function';

  const phone        = document.getElementById('phone');
  const btnClose     = document.getElementById('btnClose');
  const hsTime       = document.getElementById('hsTime');
  const hsDate       = document.getElementById('hsDate');
  const appsGrid     = document.getElementById('appsGrid');
  const homescreen   = document.getElementById('homescreen');
  const screenMsgs   = document.getElementById('screenMessages');
  const btnBackHome  = document.getElementById('btnBackHome');
  const msgThreads   = document.getElementById('msgThreads');
  const msgThread    = document.getElementById('msgThread');
  const msgThreadMsgs= document.getElementById('msgThreadMessages');
  const msgEmpty     = document.getElementById('msgEmpty');
  const msgForm      = document.getElementById('msgForm');
  const msgInput     = document.getElementById('msgInput');
  const msgSubtitle  = document.getElementById('msgSubtitle');
  const threadAvatar = document.getElementById('threadAvatar');
  const threadNameEl = document.getElementById('threadName');
  const threadStatus = document.getElementById('threadStatus');
  const debugPanel   = document.getElementById('debugPanel');
  const info         = document.getElementById('info');

  /* ========== DEBUG ========== */
  const Debug = {
    enabled: !isNUI, // en démo ON, en NUI OFF
    lines: 0,
    maxLines: 150,
  };

  function safeJSON(x){
    try { return JSON.stringify(x); } catch { return String(x); }
  }

  function dbg(msg, data, kind=''){
    try{
      const time = new Date().toISOString().substr(11,8);
      const text = typeof data !== 'undefined' ? `${msg} ${safeJSON(data)}` : msg;
      const kls  = kind ? ` ${kind}` : '';
      console.log(`[IA-Phone][${time}] ${msg}`, data ?? '');
      if (!Debug.enabled || !debugPanel) return;

      const line = document.createElement('div');
      line.className = `line${kls}`;
      line.textContent = `[${time}] ${text}`;
      debugPanel.appendChild(line);
      Debug.lines++;
      if (Debug.lines > Debug.maxLines){
        const over = Debug.lines - Debug.maxLines;
        for (let i=0;i<over;i++) debugPanel.firstChild?.remove();
        Debug.lines -= over;
      }
      debugPanel.scrollTop = debugPanel.scrollHeight;
    }catch(e){
      console.warn('dbg error', e);
    }
  }

  function setDebugVisible(v){
    if (!debugPanel) return;
    if (v) debugPanel.classList.add('show');
    else   debugPanel.classList.remove('show');
  }
  setDebugVisible(Debug.enabled);

  // Toggle debug: F4 (tu peux changer ici si besoin)
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'F4'){
      Debug.enabled = !Debug.enabled;
      setDebugVisible(Debug.enabled);
      dbg('DEBUG TOGGLE', { enabled: Debug.enabled }, Debug.enabled ? 'ok' : 'warn');
    }
  });

  /* ========== Utils ========== */
  const $all = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function playOnce(element, className, fallbackMs){
    try{
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
      const clear = ()=> element.classList.remove(className);
      const to = setTimeout(clear, fallbackMs);
      element.addEventListener('animationend', function handler(){
        clearTimeout(to);
        clear();
        element.removeEventListener('animationend', handler);
      }, { once:true });
    }catch(e){
      dbg('playOnce error', e, 'err');
    }
  }

  /* ========== Horloge ========== */
  function updateClock(){
    const d  = new Date();
    const hh = d.getHours().toString().padStart(2,'0');
    const mm = d.getMinutes().toString().padStart(2,'0');
    hsTime.textContent = `${hh}:${mm}`;

    const fmt   = new Intl.DateTimeFormat('fr-CA', { weekday:'short', day:'2-digit', month:'long' });
    const parts = fmt.formatToParts(d);
    const wd    = parts.find(p=>p.type==='weekday')?.value || '';
    const day   = (parts.find(p=>p.type==='day')?.value || '').replace(/^0/,'');
    const mo    = parts.find(p=>p.type==='month')?.value || '';
    hsDate.textContent = `${wd} ${day} ${mo}`;
  }

  let clockTimer = null;
  function startClock(){
    updateClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 15_000);
  }

  /* ========== Phone open/close ========== */
  let isOpen = false;
  let closingTimer = null;

  function showPhone(open){
    if (open === isOpen) return;
    dbg('PHONE SHOW', { open });

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
      const onDone = ()=>{
        phone.classList.remove('is-open');
        phone.removeEventListener('transitionend', onDone);
        dbg('PHONE CLOSED', {}, 'warn');
      };
      closingTimer = setTimeout(onDone, 250);
      phone.addEventListener('transitionend', onDone, { once:true });
    }
  }

  function nui(name, payload){
    if (!isNUI) return Promise.resolve();
    dbg('NUI CALL', { name, payload });
    return fetch(`https://${GetParentResourceName()}/${name}`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body   : JSON.stringify(payload || {})
    }).catch(err=>{
      dbg('NUI ERROR', { name, err: String(err) }, 'err');
    });
  }

  /* ========== Apps: cascade & tap feedback ========== */
  function indexApps(){
    const apps = $all('.app', appsGrid);
    apps.forEach((btn, i)=> btn.style.setProperty('--i', String(i)));
    dbg('INDEX APPS', { count: apps.length }, 'ok');
  }

  function restartCascade(){
    if (prefersReduced()) return;
    $all('.app .app-icon', appsGrid).forEach(icon=>{
      icon.style.animation = 'none';
      void icon.offsetWidth;
      icon.style.animation = '';
    });
    dbg('CASCADE RESTART', {}, 'ok');
  }

  function attachAppHandlers(){
    const apps = $all('.app', appsGrid);
    dbg('ATTACH APP HANDLERS', { count: apps.length, supportsPointer: !!window.PointerEvent }, 'ok');

    apps.forEach(btn=>{
      const id = btn.dataset.app || '(no-app)';
      const icon = btn.querySelector('.app-icon');
      btn.__pressing = false;

      const pressStart = (ev)=>{
        btn.__pressing = true;
        btn.classList.add('is-pressing');
      };
      const pressEnd = (ev)=>{
        const fired = btn.__pressing;
        btn.__pressing = false;
        btn.classList.remove('is-pressing');
        if (fired){
          playOnce(btn, 'play-pop', 220);
          playOnce(btn, 'play-halo', 280);
          if (icon){
            icon.style.boxShadow = '0 0 0 2px rgba(80,220,120,.9), inset 0 0 0 1px rgba(255,255,255,.06), 0 8px 24px rgba(0,0,0,.35)';
            setTimeout(()=> icon.style.boxShadow = '', 140);
          }
        }
      };
      const pressCancel = ()=>{
        btn.__pressing = false;
        btn.classList.remove('is-pressing');
      };

      // Pointer / souris / touch
      btn.addEventListener('pointerdown', pressStart);
      btn.addEventListener('pointerup',   pressEnd);
      btn.addEventListener('pointercancel', pressCancel);
      btn.addEventListener('mouseleave',  pressCancel);
      btn.addEventListener('mousedown',   pressStart);
      btn.addEventListener('mouseup',     pressEnd);
      btn.addEventListener('mouseout',    pressCancel);
      btn.addEventListener('touchstart', (e)=> pressStart(e), { passive:true });
      btn.addEventListener('touchend',   (e)=> pressEnd(e),   { passive:true });
      btn.addEventListener('touchcancel',(e)=> pressCancel(e),{ passive:true });

      // Click = action de l’app
      btn.addEventListener('click', (e)=>{
        dbg('APP CLICK', { app: id });
        handleAppClick(id);
      });

      // Clavier
      btn.addEventListener('keyup', (e)=>{
        if (e.key === 'Enter' || e.key === ' '){
          dbg('APP KEY ACTIVATE', { app: id, key: e.key });
          handleAppClick(id);
        }
      });
    });
  }

  function handleAppClick(appId){
    switch(appId){
      case 'messages':
        openMessagesApp();
        break;
      default:
        dbg('APP OPEN (stub)', { appId }, 'warn');
        break;
    }
  }

  /* ========== App Messages (données démo) ========== */

  const demoConversations = [
    {
      id: 'alex',
      name: 'Alex',
      initials: 'A',
      lastTime: '13:37',
      lastText: 'Yo t’es où ?',
      unread: 2,
      messages: [
        { from: 'them', text: 'Yo t’es où ?', time: '13:37' },
        { from: 'me',   text: 'J’arrive à la ville, 2 min.', time: '13:38' },
      ]
    },
    {
      id: 'dispatch',
      name: 'Dispatch',
      initials: 'D',
      lastTime: '12:05',
      lastText: 'Appelle-moi quand tu peux.',
      unread: 0,
      messages: [
        { from: 'them', text: 'Appelle-moi quand tu peux.', time: '12:05' }
      ]
    },
    {
      id: 'garage',
      name: 'Garage',
      initials: 'G',
      lastTime: '08:21',
      lastText: 'Ton véhicule est prêt.',
      unread: 1,
      messages: [
        { from: 'them', text: 'Ton véhicule est prêt.', time: '08:21' },
        { from: 'me',   text: 'Parfait, j’arrive.', time: '08:24' },
      ]
    }
  ];

  let currentThreadId = null;

  function openMessagesApp(){
    dbg('OPEN MESSAGES APP');

    // Bascule écrans
    homescreen.classList.add('hidden');
    screenMsgs.hidden = false;
    screenMsgs.classList.add('active');

    // Remplit sous-titre
    const count = demoConversations.length;
    msgSubtitle.textContent = count === 1
      ? '1 conversation'
      : `${count} conversations`;

    // Liste de conversations
    renderThreadsList();

    // Fil vide au départ
    currentThreadId = null;
    msgThread.hidden = true;
    msgEmpty.hidden = false;
  }

  function backToHome(){
    dbg('BACK HOME FROM MESSAGES');
    screenMsgs.hidden = true;
    screenMsgs.classList.remove('active');
    homescreen.classList.remove('hidden');
  }

  function renderThreadsList(){
    const parts = demoConversations.map(conv=>{
      const unread = conv.unread && conv.unread > 0
        ? `<div class="thread-unread">${conv.unread}</div>`
        : '';
      return `
        <button class="thread-item" data-id="${conv.id}">
          <div class="thread-avatar">${conv.initials}</div>
          <div class="thread-main">
            <div class="thread-name">${conv.name}</div>
            <div class="thread-preview">${conv.lastText}</div>
          </div>
          <div class="thread-meta">
            <div>${conv.lastTime}</div>
            ${unread}
          </div>
        </button>
      `;
    });
    msgThreads.innerHTML = parts.join('');

    // Active/handlers
    const items = $all('.thread-item', msgThreads);
    items.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        openThread(id);
      });
    });

    // Met à jour l'état actif
    updateActiveThreadItem();
  }

  function updateActiveThreadItem(){
    const items = $all('.thread-item', msgThreads);
    items.forEach(btn=>{
      const id = btn.getAttribute('data-id');
      if (id === currentThreadId) btn.classList.add('active');
      else                        btn.classList.remove('active');
    });
  }

  function openThread(id){
    const conv = demoConversations.find(c => c.id === id);
    if (!conv){
      dbg('OPEN THREAD: NOT FOUND', { id }, 'err');
      return;
    }
    dbg('OPEN THREAD', { id, name: conv.name }, 'ok');

    currentThreadId = id;
    updateActiveThreadItem();

    // En-tête fil
    threadAvatar.textContent = conv.initials;
    threadNameEl.textContent = conv.name;
    threadStatus.textContent = 'En ligne';

    // Messages
    renderThreadMessages(conv);

    msgThread.hidden = false;
    msgEmpty.hidden  = false;
    msgEmpty.textContent = ''; // on l’utilise plus ici
  }

  function renderThreadMessages(conv){
    const parts = conv.messages.map(m=>{
      const who = m.from === 'me' ? 'me' : 'them';
      const safeText = m.text;
      const time = m.time || '';
      return `
        <div class="msg-bubble ${who}">
          <div>${safeText}</div>
          ${time ? `<div class="msg-time">${time}</div>` : ''}
        </div>
      `;
    });
    msgThreadMsgs.innerHTML = parts.join('');
    // scroll en bas
    msgThreadMsgs.scrollTop = msgThreadMsgs.scrollHeight;
  }

  function handleSendMessage(ev){
    ev.preventDefault();
    const text = msgInput.value.trim();
    if (!text || !currentThreadId) return;

    const conv = demoConversations.find(c => c.id === currentThreadId);
    if (!conv) return;

    const now = new Date();
    const hh  = now.getHours().toString().padStart(2,'0');
    const mm  = now.getMinutes().toString().padStart(2,'0');
    const time = `${hh}:${mm}`;

    conv.messages.push({ from: 'me', text, time });
    conv.lastText = text;
    conv.lastTime = time;
    conv.unread   = 0;

    dbg('SEND MESSAGE', { to: conv.name, text }, 'ok');

    msgInput.value = '';
    renderThreadMessages(conv);
    renderThreadsList(); // met à jour preview + heure
    updateActiveThreadItem();
  }

  /* ========== NUI messages ========== */
  window.addEventListener('message', (e) => {
    const d = e.data || {};
    dbg('WINDOW MESSAGE', d);

    switch (d.action) {
      case 'phone:state':
        showPhone(!!d.open);
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

  /* ========== UI events ========== */
  btnClose.addEventListener('click', () => nui('close', {}).catch(()=>{}));
  btnBackHome.addEventListener('click', backToHome);
  msgForm.addEventListener('submit', handleSendMessage);

  /* ========== Init ========== */
  document.addEventListener('DOMContentLoaded', () => {
    dbg('DOM READY', { isNUI });

    indexApps();
    attachAppHandlers();
    startClock();

    if (isNUI){
      phone.setAttribute('aria-hidden', 'true');
      nui('ready', { ts: Date.now() }).catch(()=>{});
    } else {
      showPhone(true);                 // mode démo ouvert
      info.textContent = 'Mode démo — écran d’accueil prêt.';
    }
  });

  // Échap pour fermer en démo uniquement
  window.addEventListener('keydown', (ev) => {
    if (!isNUI && ev.key === 'Escape') showPhone(false);
  });
})();
