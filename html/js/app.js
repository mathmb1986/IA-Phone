(function () {
  // Détection NUI (FiveM) vs Mode démo navigateur
  var isNUI = typeof GetParentResourceName === 'function' && typeof window.invokeNative === 'function';

  // Raccourcis DOM
  var phone        = document.getElementById('phone');
  var btnClose     = document.getElementById('btnClose');
  var hsTime       = document.getElementById('hsTime');
  var hsDate       = document.getElementById('hsDate');
  var appsGrid     = document.getElementById('appsGrid');
  var homescreen   = document.getElementById('homescreen');
  var screenMsgs   = document.getElementById('screenMessages');
  var btnBackHome  = document.getElementById('btnBackHome');
  var msgThreads   = document.getElementById('msgThreads');
  var msgThread    = document.getElementById('msgThread');
  var msgThreadMsgs= document.getElementById('msgThreadMessages');
  var msgEmpty     = document.getElementById('msgEmpty');
  var msgForm      = document.getElementById('msgForm');
  var msgInput     = document.getElementById('msgInput');
  var msgSubtitle  = document.getElementById('msgSubtitle');
  var threadAvatar = document.getElementById('threadAvatar');
  var threadNameEl = document.getElementById('threadName');
  var threadStatus = document.getElementById('threadStatus');
  var debugPanel   = document.getElementById('debugPanel');
  var info         = document.getElementById('info');

  /* ========== DEBUG ========== */

  var Debug = {
    enabled: !isNUI,   // démo : ON, NUI : OFF
    lines: 0,
    maxLines: 150
  };

  function safeJSON(x) {
    try {
      return JSON.stringify(x);
    } catch (e) {
      return String(x);
    }
  }

  function dbg(msg, data, kind) {
    if (kind === void 0) kind = '';

    try {
      var time = new Date().toISOString().substr(11, 8);
      var text = (typeof data !== 'undefined') ? (msg + ' ' + safeJSON(data)) : msg;
      var kls  = kind ? (' ' + kind) : '';

      console.log('[IA-Phone][' + time + '] ' + msg, (data === void 0 ? '' : data));

      if (!Debug.enabled || !debugPanel) return;

      var line = document.createElement('div');
      line.className = 'line' + kls;
      line.textContent = '[' + time + '] ' + text;
      debugPanel.appendChild(line);
      Debug.lines++;

      if (Debug.lines > Debug.maxLines) {
        var over = Debug.lines - Debug.maxLines;
        for (var i = 0; i < over; i++) {
          if (debugPanel.firstChild) debugPanel.removeChild(debugPanel.firstChild);
        }
        Debug.lines -= over;
      }
      debugPanel.scrollTop = debugPanel.scrollHeight;
    } catch (e) {
      console.warn('dbg error', e);
    }
  }

  function setDebugVisible(v) {
    if (!debugPanel) return;
    if (v) debugPanel.classList.add('show');
    else   debugPanel.classList.remove('show');
  }

  setDebugVisible(Debug.enabled);

  // Toggle debug : F4
  window.addEventListener('keydown', function (e) {
    if (e.key === 'F4') {
      Debug.enabled = !Debug.enabled;
      setDebugVisible(Debug.enabled);
      dbg('DEBUG TOGGLE', { enabled: Debug.enabled }, Debug.enabled ? 'ok' : 'warn');
    }
  });

  /* ========== Utils ========== */

  function $all(sel, root) {
    if (!root) root = document;
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  function prefersReduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function playOnce(element, className, fallbackMs) {
    try {
      element.classList.remove(className);
      // reset animation
      void element.offsetWidth;
      element.classList.add(className);

      var cleared = false;

      function clear() {
        if (cleared) return;
        cleared = true;
        element.classList.remove(className);
      }

      var to = setTimeout(clear, fallbackMs);
      element.addEventListener('animationend', function handler() {
        clearTimeout(to);
        clear();
        element.removeEventListener('animationend', handler);
      }, { once: true });
    } catch (e) {
      dbg('playOnce error', e, 'err');
    }
  }

  // Appel NUI générique
  function callNui(name, payload) {
    if (!isNUI) {
      dbg('callNui en mode démo (ignoré)', { name: name, payload: payload }, 'warn');
      return Promise.resolve(null);
    }
    var resName = GetParentResourceName();
    dbg('NUI POST', { name: name, payload: payload, resName: resName });

    return fetch('https://' + resName + '/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      if (!res.ok) {
        dbg('NUI POST HTTP ERROR', { name: name, status: res.status }, 'err');
        return {};
      }
      return res.json().catch(function () { return {}; });
    }).catch(function (err) {
      dbg('NUI POST EXCEPTION', { name: name, err: String(err) }, 'err');
      return {};
    });
  }

  /* ========== Horloge ========== */

  function updateClock() {
    var d  = new Date();
    var hh = d.getHours().toString().padStart(2, '0');
    var mm = d.getMinutes().toString().padStart(2, '0');
    hsTime.textContent = hh + ':' + mm;

    var fmt   = new Intl.DateTimeFormat('fr-CA', { weekday:'short', day:'2-digit', month:'long' });
    var parts = fmt.formatToParts(d);
    var wd    = '';
    var day   = '';
    var mo    = '';

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.type === 'weekday') wd = p.value;
      else if (p.type === 'day') day = p.value.replace(/^0/, '');
      else if (p.type === 'month') mo = p.value;
    }
    hsDate.textContent = wd + ' ' + day + ' ' + mo;
  }

  var clockTimer = null;
  function startClock() {
    updateClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 15000);
  }

  /* ========== Phone open/close ========== */

  var isOpen = false;
  var closingTimer = null;

  function showPhone(open) {
    if (open === isOpen) return;
    dbg('PHONE SHOW', { open: open });

    if (open) {
      if (closingTimer) clearTimeout(closingTimer);
      phone.classList.remove('is-closing');
      phone.classList.add('is-open');
      phone.setAttribute('aria-hidden', 'false');
      isOpen = true;
      restartCascade();
    } else {
      phone.classList.add('is-closing');
      phone.setAttribute('aria-hidden', 'true');
      isOpen = false;

      var onDone = function () {
        phone.classList.remove('is-open');
        phone.removeEventListener('transitionend', onDone);
        dbg('PHONE CLOSED', {}, 'warn');
      };

      closingTimer = setTimeout(onDone, 250);
      phone.addEventListener('transitionend', onDone, { once: true });
    }
  }

  /* ========== Apps: cascade & tap feedback ========== */

  function indexApps() {
    var apps = $all('.app', appsGrid);
    apps.forEach(function (btn, i) {
      btn.style.setProperty('--i', String(i));
    });
    dbg('INDEX APPS', { count: apps.length }, 'ok');
  }

  function restartCascade() {
    if (prefersReduced()) return;
    var icons = $all('.app .app-icon', appsGrid);
    icons.forEach(function (icon) {
      icon.style.animation = 'none';
      void icon.offsetWidth;
      icon.style.animation = '';
    });
    dbg('CASCADE RESTART', {}, 'ok');
  }

  function attachAppHandlers() {
    var apps = $all('.app', appsGrid);
    dbg('ATTACH APP HANDLERS', { count: apps.length, supportsPointer: !!window.PointerEvent }, 'ok');

    apps.forEach(function (btn) {
      var id   = btn.getAttribute('data-app') || '(no-app)';
      var icon = btn.querySelector('.app-icon');
      btn.__pressing = false;

      var pressStart = function () {
        btn.__pressing = true;
        btn.classList.add('is-pressing');
      };
      var pressEnd = function () {
        var fired = btn.__pressing;
        btn.__pressing = false;
        btn.classList.remove('is-pressing');

        if (fired) {
          playOnce(btn, 'play-pop', 220);
          playOnce(btn, 'play-halo', 280);
          if (icon) {
            icon.style.boxShadow = '0 0 0 2px rgba(80,220,120,.9), inset 0 0 0 1px rgba(255,255,255,.06), 0 8px 24px rgba(0,0,0,.35)';
            setTimeout(function () { icon.style.boxShadow = ''; }, 140);
          }
        }
      };
      var pressCancel = function () {
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

      btn.addEventListener('touchstart', function (e) { pressStart(e); }, { passive: true });
      btn.addEventListener('touchend',   function (e) { pressEnd(e);   }, { passive: true });
      btn.addEventListener('touchcancel',function (e) { pressCancel(e);}, { passive: true });

      // Click = ouverture de l’app
      btn.addEventListener('click', function () {
        dbg('APP CLICK', { app: id });
        handleAppClick(id);
      });

      // Clavier
      btn.addEventListener('keyup', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          dbg('APP KEY ACTIVATE', { app: id, key: e.key });
          handleAppClick(id);
        }
      });
    });
  }

  function handleAppClick(appId) {
    if (appId === 'messages') {
      openMessagesApp();
    } else {
      dbg('APP OPEN (stub)', { appId: appId }, 'warn');
    }
  }

  /* ========== App Messages ========== */

  // Démo locale si pas en NUI
  var demoConversations = [
    {
      id: 'alex',
      name: 'Alex',
      initials: 'A',
      lastTime: '13:37',
      lastText: 'Yo t’es où ?',
      unread: 2,
      messages: [
        { from: 'them', text: 'Yo t’es où ?',               time: '13:37' },
        { from: 'me',   text: 'J’arrive à la ville, 2 min.', time: '13:38' }
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
        { from: 'me',   text: 'Parfait, j’arrive.',     time: '08:24' }
      ]
    }
  ];

  // Conversations courantes (demo ou venant du serveur)
  var conversations = [];
  var currentThreadId = null;

  function openMessagesApp() {
    dbg('OPEN MESSAGES APP');

    homescreen.classList.add('hidden');
    screenMsgs.hidden = false;
    screenMsgs.classList.add('active');

    currentThreadId = null;
    msgThread.hidden = true;
    msgEmpty.hidden  = false;
    msgEmpty.textContent = 'Chargement des conversations…';

    if (!isNUI) {
      // mode démo : juste les données locales
      conversations = demoConversations.slice();
      applyThreadsToUI();
      return;
    }

    // mode FiveM : on demande au client Lua via callback NUI
    callNui('messages:getThreads', {}).then(function (res) {
      var threads = (res && Array.isArray(res.threads)) ? res.threads : [];
      conversations = threads;
      dbg('RECV THREADS', { count: conversations.length }, 'ok');
      applyThreadsToUI();
    }).catch(function (err) {
      dbg('ERROR THREADS', { err: String(err) }, 'err');
      conversations = [];
      applyThreadsToUI();
    });
  }

  function backToHome() {
    dbg('BACK HOME FROM MESSAGES');
    screenMsgs.hidden = true;
    screenMsgs.classList.remove('active');
    homescreen.classList.remove('hidden');
  }

  function applyThreadsToUI() {
    var count = conversations.length;
    msgSubtitle.textContent = (count === 1) ? '1 conversation' : (count + ' conversations');

    renderThreadsList();

    if (!currentThreadId) {
      msgThread.hidden = true;
      msgEmpty.hidden  = false;
      msgEmpty.textContent = (count > 0)
        ? 'Sélectionne une conversation pour voir les messages.'
        : 'Aucune conversation.';
    }
  }

  function renderThreadsList() {
    var html = conversations.map(function (conv) {
      var unread = conv.unread && conv.unread > 0
        ? '<div class="thread-unread">' + conv.unread + '</div>'
        : '';
      var initials = conv.initials || ((conv.name && conv.name[0]) || '?');
      var name = conv.name || 'Inconnu';
      var lastText = conv.lastText || '';
      var lastTime = conv.lastTime || '';

      return (
        '<button class="thread-item" data-id="' + conv.id + '">' +
          '<div class="thread-avatar">' + initials + '</div>' +
          '<div class="thread-main">' +
            '<div class="thread-name">' + name + '</div>' +
            '<div class="thread-preview">' + lastText + '</div>' +
          '</div>' +
          '<div class="thread-meta">' +
            '<div>' + lastTime + '</div>' +
            unread +
          '</div>' +
        '</button>'
      );
    }).join('');

    msgThreads.innerHTML = html;

    var items = $all('.thread-item', msgThreads);
    items.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        openThread(id);
      });
    });

    updateActiveThreadItem();
  }

  function updateActiveThreadItem() {
    var items = $all('.thread-item', msgThreads);
    items.forEach(function (btn) {
      var id = btn.getAttribute('data-id');
      if (id === currentThreadId) btn.classList.add('active');
      else                        btn.classList.remove('active');
    });
  }

  function openThread(id) {
    var conv = null;
    for (var i = 0; i < conversations.length; i++) {
      if (String(conversations[i].id) === String(id)) {
        conv = conversations[i];
        break;
      }
    }
    if (!conv) {
      dbg('OPEN THREAD: NOT FOUND', { id: id }, 'err');
      return;
    }
    dbg('OPEN THREAD', { id: id, name: conv.name }, 'ok');

    currentThreadId = id;
    updateActiveThreadItem();

    threadAvatar.textContent = conv.initials || (conv.name && conv.name[0]) || '?';
    threadNameEl.textContent = conv.name || 'Contact';
    threadStatus.textContent = conv.status || 'En ligne';

    renderThreadMessages(conv);

    msgThread.hidden = false;
    msgEmpty.hidden  = true;
  }

  function renderThreadMessages(conv) {
    var msgs = Array.isArray(conv.messages) ? conv.messages : [];
    var parts = msgs.map(function (m) {
      var who  = (m.from === 'me') ? 'me' : 'them';
      var text = m.text || '';
      var time = m.time || '';
      return (
        '<div class="msg-bubble ' + who + '">' +
          '<div>' + text + '</div>' +
          (time ? '<div class="msg-time">' + time + '</div>' : '') +
        '</div>'
      );
    }).join('');

    msgThreadMsgs.innerHTML = parts;
    msgThreadMsgs.scrollTop = msgThreadMsgs.scrollHeight;
  }

  // Envoi message (optimiste + NUI)
  function handleSendMessage(ev) {
    ev.preventDefault();

    var text = msgInput.value.trim();
    if (!text || !currentThreadId) {
      dbg('SEND MESSAGE: invalid (no text or no thread)', { text: text, currentThreadId: currentThreadId }, 'warn');
      return;
    }

    var conv = null;
    for (var i = 0; i < conversations.length; i++) {
      if (String(conversations[i].id) === String(currentThreadId)) {
        conv = conversations[i];
        break;
      }
    }
    if (!conv) {
      dbg('SEND MESSAGE: conversation introuvable', { currentThreadId: currentThreadId }, 'err');
      return;
    }

    var now  = new Date();
    var hh   = now.getHours().toString().padStart(2, '0');
    var mm   = now.getMinutes().toString().padStart(2, '0');
    var time = hh + ':' + mm;

    // 1) update UI local
    if (!Array.isArray(conv.messages)) conv.messages = [];
    conv.messages.push({ from: 'me', text: text, time: time });
    conv.lastText = text;
    conv.lastTime = time;
    conv.unread   = 0;

    dbg('SEND MESSAGE (UI local)', { to: conv.name, text: text, time: time }, 'ok');

    msgInput.value = '';
    renderThreadMessages(conv);
    renderThreadsList();
    updateActiveThreadItem();

    // 2) envoi NUI (non bloquant)
    if (isNUI) {
      var payload = {
        threadId:    conv.id,
        text:        text,
        contactName: conv.name || null
      };

      dbg('SEND MESSAGE NUI (fire & forget)', payload);

      callNui('messages:send', payload).then(function (res) {
        dbg('NUI messages:send response', res || {}, 'ok');
      }).catch(function (err) {
        dbg('NUI messages:send ERROR', { err: String(err) }, 'err');
      });
    }
  }

  /* ========== NUI messages (SendNUIMessage côté client) ========== */

  window.addEventListener('message', function (e) {
    var d = e.data || {};
    dbg('WINDOW MESSAGE', d);

    switch (d.action) {
      case 'phone:state':
        showPhone(!!d.open);
        break;
      case 'boot':
        info.textContent = 'Profil en chargement…';
        break;
      case 'set-user':
        var u = d.user || {};
        info.textContent = 'Nom: ' + (u.name || '') + ' — Numéro: ' + (u.phone_number || '???');
        break;
    }
  });

  /* ========== UI events ========== */

  btnClose.addEventListener('click', function () {
    // bouton X : on passe par le callback NUI "close"
    callNui('close', {}).then(function () {
      dbg('CLOSE SENT', {}, 'ok');
    });
  });

  btnBackHome.addEventListener('click', backToHome);
  msgForm.addEventListener('submit', handleSendMessage);

  /* ========== Init ========== */

  document.addEventListener('DOMContentLoaded', function () {
    dbg('DOM READY', { isNUI: isNUI });

    indexApps();
    attachAppHandlers();
    startClock();

    if (isNUI) {
      phone.setAttribute('aria-hidden', 'true');
      callNui('phone:ready', { ts: Date.now() });
    } else {
      showPhone(true);
      info.textContent = 'Mode démo — écran d’accueil prêt.';
    }
  });

  // ESC pour fermer en démo seulement
  window.addEventListener('keydown', function (ev) {
    if (!isNUI && ev.key === 'Escape') {
      showPhone(false);
    }
  });
})();
