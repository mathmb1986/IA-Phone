(function () {
  // Détection NUI (FiveM) vs mode démo navigateur
  var isNUI = (typeof GetParentResourceName === 'function' && typeof window.invokeNative === 'function');

  // Raccourcis DOM
  var phone            = document.getElementById('phone');
  var btnClose         = document.getElementById('btnClose');
  var hsTime           = document.getElementById('hsTime');
  var hsDate           = document.getElementById('hsDate');
  var appsGrid         = document.getElementById('appsGrid');
  var homescreen       = document.getElementById('homescreen');

  // Messages
  var screenMsgs       = document.getElementById('screenMessages');
  var btnBackHome      = document.getElementById('btnBackHome');
  var msgThreads       = document.getElementById('msgThreads');
  var msgThread        = document.getElementById('msgThread');
  var msgThreadMsgs    = document.getElementById('msgThreadMessages');
  var msgEmpty         = document.getElementById('msgEmpty');
  var msgForm          = document.getElementById('msgForm');
  var msgInput         = document.getElementById('msgInput');
  var msgSubtitle      = document.getElementById('msgSubtitle');
  var threadAvatar     = document.getElementById('threadAvatar');
  var threadNameEl     = document.getElementById('threadName');
  var threadStatus     = document.getElementById('threadStatus');

  // Contacts
  var screenContacts   = document.getElementById('screenContacts');
  var btnBackContacts  = document.getElementById('btnBackContacts');
  var contactsList     = document.getElementById('contactsList');
  var contactsEmpty    = document.getElementById('contactsEmpty');
  var contactsSubtitle = document.getElementById('contactsSubtitle');


    var btnAddContact = document.getElementById('btnAddContact');
    var contactEditor = document.getElementById('contactEditor');
    var contactNameInput = document.getElementById('contactNameInput');
    var contactNumberInput = document.getElementById('contactNumberInput');
    var btnContactSave = document.getElementById('btnContactSave');
    var btnContactCancel = document.getElementById('btnContactCancel');

  // Debug & info
  var debugPanel       = document.getElementById('debugPanel');
  var info             = document.getElementById('info');

  /* ============================================================
   *                     DEBUG / LOG
   * ============================================================
   */

  var Debug = {
    enabled: !isNUI, // en démo, debug ON; en NUI, OFF par défaut
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
      var d    = new Date();
      var time = d.toISOString().substr(11, 8);
      var text = msg;
      if (typeof data !== 'undefined') {
        text += ' ' + safeJSON(data);
      }

      if (data === void 0) {
        console.log('[IA-Phone][' + time + '] ' + msg);
      } else {
        console.log('[IA-Phone][' + time + '] ' + msg, data);
      }

      if (!Debug.enabled || !debugPanel) return;

      var line = document.createElement('div');
      line.className = 'line' + (kind ? (' ' + kind) : '');
      line.textContent = '[' + time + '] ' + text;
      debugPanel.appendChild(line);
      Debug.lines++;

      if (Debug.lines > Debug.maxLines) {
        var over = Debug.lines - Debug.maxLines;
        var i;
        for (i = 0; i < over; i++) {
          if (debugPanel.firstChild) {
            debugPanel.removeChild(debugPanel.firstChild);
          }
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

      /* ============================================================
       *                          UTILS
       * ============================================================
       */

      function $all(sel, root) {
        if (!root) root = document;
        return Array.prototype.slice.call(root.querySelectorAll(sel));
      }

      function prefersReduced() {
        return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }

      function playOnce(element, className, fallbackMs) {
        try {
          element.classList.remove(className);
          // reset anim
          void element.offsetWidth;
          element.classList.add(className);

          var cleared = false;

          function clear() {
            if (cleared) return;
            cleared = true;
            element.classList.remove(className);
          }

          var to = setTimeout(clear, fallbackMs);

          var handler = function () {
            clearTimeout(to);
            clear();
            element.removeEventListener('animationend', handler);
          };

          element.addEventListener('animationend', handler, { once: true });
        } catch (e) {
          dbg('playOnce error', e, 'err');
        }
      }

      function callNui(name, payload) {
        if (!isNUI) {
          dbg('callNui en mode démo (ignoré)', { name: name, payload: payload }, 'warn');
          return Promise.resolve(null);
        }

        var resource = GetParentResourceName();
        dbg('NUI POST', { name: name, payload: payload, resource: resource });

        return fetch('https://' + resource + '/' + name, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify(payload || {})
        })
          .then(function (res) {
            if (!res.ok) {
              dbg('NUI POST HTTP ERROR', { name: name, status: res.status }, 'err');
              return {};
            }
            return res.json().catch(function () { return {}; });
          })
          .catch(function (err) {
            dbg('NUI POST EXCEPTION', { name: name, err: String(err) }, 'err');
            return {};
          });
      }

      /* ============================================================
       *                       HORLOGE
       * ============================================================
       */

      function updateClock() {
        if (!hsTime || !hsDate) return;

        var d  = new Date();
        var hh = d.getHours().toString();
        var mm = d.getMinutes().toString();
        if (hh.length < 2) hh = '0' + hh;
        if (mm.length < 2) mm = '0' + mm;
        hsTime.textContent = hh + ':' + mm;

        try {
          var fmt   = new Intl.DateTimeFormat('fr-CA', { weekday:'short', day:'2-digit', month:'long' });
          var parts = fmt.formatToParts(d);
          var wd    = '';
          var day   = '';
          var mo    = '';
          var i;

          for (i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (p.type === 'weekday') wd = p.value;
            else if (p.type === 'day') day = p.value.replace(/^0/, '');
            else if (p.type === 'month') mo = p.value;
          }
          hsDate.textContent = wd + ' ' + day + ' ' + mo;
        } catch (e) {
          hsDate.textContent = '';
        }
      }

      var clockTimer = null;
      function startClock() {
        updateClock();
        if (clockTimer) clearInterval(clockTimer);
        clockTimer = setInterval(updateClock, 15000);
      }

      /* ============================================================
       *                    PHONE OPEN / CLOSE
       * ============================================================
       */

      var isOpen = false;
      var closingTimer = null;

      function showPhone(open) {
        if (!phone) return;
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

      /* ============================================================
       *                    APPS ICONS / ANIM
       * ============================================================
       */

      function indexApps() {
        if (!appsGrid) return;
        var apps = $all('.app', appsGrid);
        var i;
        for (i = 0; i < apps.length; i++) {
          apps[i].style.setProperty('--i', String(i));
        }
        dbg('INDEX APPS', { count: apps.length }, 'ok');
      }

      function restartCascade() {
        if (!appsGrid) return;
        if (prefersReduced()) return;

        var icons = $all('.app .app-icon', appsGrid);
        var i;
        for (i = 0; i < icons.length; i++) {
          icons[i].style.animation = 'none';
          void icons[i].offsetWidth;
          icons[i].style.animation = '';
        }
        dbg('CASCADE RESTART', {}, 'ok');
      }

      function handleAppClick(appId) {
        if (appId === 'messages') {
          openMessagesApp();
        } else if (appId === 'contacts') {
          openContactsApp();
        } else {
          dbg('APP OPEN (stub)', { appId: appId }, 'warn');
        }
      }

      function attachAppHandlers() {
        if (!appsGrid) return;

        var apps = $all('.app', appsGrid);
        dbg('ATTACH APP HANDLERS', { count: apps.length, supportsPointer: !!window.PointerEvent }, 'ok');

        function makeHandlers(btn, id, icon) {
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
                setTimeout(function () {
                  icon.style.boxShadow = '';
                }, 140);
              }
            }
          };

          var pressCancel = function () {
            btn.__pressing = false;
            btn.classList.remove('is-pressing');
          };

          // Pointer
          btn.addEventListener('pointerdown', pressStart);
          btn.addEventListener('pointerup', pressEnd);
          btn.addEventListener('pointercancel', pressCancel);
          btn.addEventListener('mouseleave', pressCancel);

          // Mouse
          btn.addEventListener('mousedown', pressStart);
          btn.addEventListener('mouseup', pressEnd);
          btn.addEventListener('mouseout', pressCancel);

          // Touch
          btn.addEventListener('touchstart', function () { pressStart(); }, { passive: true });
          btn.addEventListener('touchend',   function () { pressEnd();   }, { passive: true });
          btn.addEventListener('touchcancel',function () { pressCancel();}, { passive: true });

          // Click = open app
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
        }

        var i;
        for (i = 0; i < apps.length; i++) {
          var btn = apps[i];
          var id  = btn.getAttribute('data-app') || '(no-app)';
          var icon = btn.querySelector('.app-icon');
          makeHandlers(btn, id, icon);
        }
      }

      /* ============================================================
       *                        MESSAGES
       * ============================================================
       */

      var demoConversations = [
        {
          id: 'alex',
          name: 'Alex',
          initials: 'A',
          lastTime: '13:37',
          lastText: 'Yo t’es où ?',
          unread: 2,
          messages: [
            { from: 'them', text: 'Yo t’es où ?',                time: '13:37' },
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
        }
      ];

      var conversations   = [];
      var currentThreadId = null;

      function openMessagesApp() {
        dbg('OPEN MESSAGES APP');

        if (homescreen) homescreen.classList.add('hidden');

        if (screenContacts) {
          screenContacts.hidden = true;
          screenContacts.classList.remove('active');
        }
        if (screenMsgs) {
          screenMsgs.hidden = false;
          screenMsgs.classList.add('active');
        }

        currentThreadId = null;

        if (msgThread) msgThread.hidden = true;
        if (msgEmpty) {
          msgEmpty.hidden = false;
          msgEmpty.textContent = 'Chargement des conversations…';
        }

        if (!isNUI) {
          conversations = demoConversations.slice();
          applyThreadsToUI();
          return;
        }

        callNui('messages:getThreads', {}).then(function (res) {
          if (res && res.threads && res.threads.length) {
            conversations = res.threads;
          } else {
            conversations = [];
          }
          dbg('RECV THREADS', { count: conversations.length }, 'ok');
          applyThreadsToUI();
        }).catch(function (err) {
          dbg('ERROR THREADS', { err: String(err) }, 'err');
          conversations = [];
          applyThreadsToUI();
        });
      }

      function backToHomeFromMessages() {
        dbg('BACK HOME FROM MESSAGES');
        if (screenMsgs) {
          screenMsgs.hidden = true;
          screenMsgs.classList.remove('active');
        }
        if (homescreen) homescreen.classList.remove('hidden');
      }

      function applyThreadsToUI() {
        var count = conversations.length;

        if (msgSubtitle) {
          msgSubtitle.textContent = (count === 1)
            ? '1 conversation'
            : (count + ' conversations');
        }

        renderThreadsList();

        if (!currentThreadId) {
          if (msgThread) msgThread.hidden = true;
          if (msgEmpty) {
            msgEmpty.hidden = false;
            msgEmpty.textContent = (count > 0)
              ? 'Sélectionne une conversation pour voir les messages.'
              : 'Aucune conversation.';
          }
        }
      }

      function renderThreadsList() {
        if (!msgThreads) return;

        var html = '';
        var i;
        for (i = 0; i < conversations.length; i++) {
          var conv = conversations[i];
          var unread  = (conv.unread && conv.unread > 0)
            ? '<div class="thread-unread">' + conv.unread + '</div>'
            : '';
          var initials = conv.initials || ((conv.name && conv.name[0]) || '?');
          var name = conv.name || 'Inconnu';
          var lastText = conv.lastText || '';
          var lastTime = conv.lastTime || '';

          html += '' +
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
            '</button>';
        }

        msgThreads.innerHTML = html;

        var items = $all('.thread-item', msgThreads);
        var j;
        for (j = 0; j < items.length; j++) {
          (function (btn) {
            btn.addEventListener('click', function () {
              var id = btn.getAttribute('data-id');
              openThread(id);
            });
          })(items[j]);
        }

        updateActiveThreadItem();
      }

      function updateActiveThreadItem() {
        if (!msgThreads) return;
        var items = $all('.thread-item', msgThreads);
        var i;
        for (i = 0; i < items.length; i++) {
          var btn = items[i];
          var id  = btn.getAttribute('data-id');
          if (id === currentThreadId) btn.classList.add('active');
          else                        btn.classList.remove('active');
        }
      }

      function openThread(id) {
        var conv = null;
        var i;
        for (i = 0; i < conversations.length; i++) {
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

        if (threadAvatar) {
          var initial = conv.initials || (conv.name && conv.name[0]) || '?';
          threadAvatar.textContent = initial;
        }
        if (threadNameEl) threadNameEl.textContent = conv.name || 'Contact';
        if (threadStatus) threadStatus.textContent = conv.status || 'En ligne';

        renderThreadMessages(conv);

        if (msgThread) msgThread.hidden = false;
        if (msgEmpty)  msgEmpty.hidden  = true;
      }

      function renderThreadMessages(conv) {
        if (!msgThreadMsgs) return;

        var msgs = (conv && conv.messages && conv.messages.length)
          ? conv.messages
          : [];
        var html = '';
        var i;
        for (i = 0; i < msgs.length; i++) {
          var m    = msgs[i];
          var who  = (m.from === 'me') ? 'me' : 'them';
          var text = m.text || '';
          var time = m.time || '';

          html += '' +
            '<div class="msg-bubble ' + who + '">' +
              '<div>' + text + '</div>' +
              (time ? '<div class="msg-time">' + time + '</div>' : '') +
            '</div>';
        }

        msgThreadMsgs.innerHTML = html;
        msgThreadMsgs.scrollTop = msgThreadMsgs.scrollHeight;
      }

      function handleSendMessage(ev) {
        ev.preventDefault();

        var text = msgInput ? msgInput.value.trim() : '';
        if (!text || !currentThreadId) {
          dbg('SEND MESSAGE: invalid (no text or no thread)', {
            text: text,
            currentThreadId: currentThreadId
          }, 'warn');
          return;
        }

        var conv = null;
        var i;
        for (i = 0; i < conversations.length; i++) {
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
        var hh   = now.getHours().toString();
        var mm   = now.getMinutes().toString();
        if (hh.length < 2) hh = '0' + hh;
        if (mm.length < 2) mm = '0' + mm;
        var time = hh + ':' + mm;

        // 1) mise à jour locale (UI)
        if (!conv.messages) conv.messages = [];
        conv.messages.push({
          from: 'me',
          text: text,
          time: time
        });
        conv.lastText = text;
        conv.lastTime = time;
        conv.unread   = 0;

        dbg('SEND MESSAGE (UI local)', { to: conv.name, text: text, time: time }, 'ok');

        if (msgInput) msgInput.value = '';
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

          callNui('messages:send', payload)
            .then(function (res) {
              dbg('NUI messages:send response', res || {}, 'ok');
            })
            .catch(function (err) {
              dbg('NUI messages:send ERROR', { err: String(err) }, 'err');
            });
        }
      }

      /* ============================================================
       *                        CONTACTS
       * ============================================================
       */

    var contacts = [];

      function openContactsApp() {
          dbg('OPEN CONTACTS APP');

        contactsList = document.getElementById('contactsList') || document.getElementById('msgThreads');

        if (homescreen) homescreen.classList.add('hidden');
        if (screenMsgs) {
          screenMsgs.hidden = true;
          screenMsgs.classList.remove('active');
        }
        if (screenContacts) {
          screenContacts.hidden = false;
          screenContacts.classList.add('active');
        }

        if (contactsEmpty) {
          contactsEmpty.hidden = false;
          contactsEmpty.textContent = 'Chargement des contacts…';
        }
        if (contactsList) contactsList.innerHTML = '';

        contacts = [];

        if (!isNUI) {
          // Mode démo
          contacts = [
            { id: 1, owner_number: '111-2358', contact_number: '571-8760', contact_name: 'Trixy Lee' },
            { id: 2, owner_number: '111-2358', contact_number: '211-6889', contact_name: 'Dispatch' }
          ];
          renderContactsList();
          return;
        }

        callNui('contacts:getContacts', {}).then(function (res) {
          if (res && res.contacts && res.contacts.length) {
            contacts = res.contacts;
          } else {
            contacts = [];
          }
          dbg('RECV CONTACTS', { count: contacts.length }, 'ok');
          renderContactsList();
        }).catch(function (err) {
          dbg('ERROR CONTACTS', { err: String(err) }, 'err');
          contacts = [];
          renderContactsList();
        });
      }
        function showContactEditor(show) {
            if (!contactEditor) return;
            if (show) {
                contactEditor.classList.remove('hidden');
                if (contactNameInput) contactNameInput.focus();
            } else {
                contactEditor.classList.add('hidden');
            }
        }

      function backFromContacts() {
        dbg('BACK FROM CONTACTS');

        if (screenContacts) {
          screenContacts.hidden = true;
          screenContacts.classList.remove('active');
        }
        if (homescreen) {
          homescreen.classList.remove('hidden');
        }
      }

      function renderContactsList() {
        if (!contactsList || !contactsEmpty) return;

        if (!contacts || contacts.length === 0) {
          contactsList.innerHTML = '';
          contactsEmpty.hidden   = false;
          contactsEmpty.textContent = 'Aucun contact.';
          if (contactsSubtitle) contactsSubtitle.textContent = 'Aucun contact';
          return;
        }

        contactsEmpty.hidden = true;
        if (contactsSubtitle) {
          contactsSubtitle.textContent = contacts.length + ' contact' + (contacts.length > 1 ? 's' : '');
        }

        var html = '';
        var i;
        for (i = 0; i < contacts.length; i++) {
          var c      = contacts[i];
          var name   = c.contact_name || c.contact_number || 'Contact';
          var number = c.contact_number || '';

          html += '' +
            '<button class="contact-item" data-number="' + number + '">' +
              '<div class="contact-avatar">' + ((name[0] || '?')) + '</div>' +
              '<div class="contact-main">' +
                '<div class="contact-name">' + name + '</div>' +
                '<div class="contact-number">' + number + '</div>' +
              '</div>' +
            '</button>';
        }

        contactsList.innerHTML = html;

        var items = $all('.contact-item', contactsList);
        var j;
        for (j = 0; j < items.length; j++) {
          (function (btn) {
            btn.addEventListener('click', function () {
              var num = btn.getAttribute('data-number');
              handleContactClick(num);
            });
          })(items[j]);
        }
      }

    function handleContactClick(contactNumber) {
        dbg('CONTACT CLICK', { contactNumber });

        if (!contactNumber) return;

        // Trouver le contact
        var contact = contacts.find(c => c.contact_number === contactNumber);
        if (!contact) return;

        // Stocker temporairement dans l'interface
        const nameEl = document.getElementById('detailContactName');
        const numberEl = document.getElementById('detailContactNumber');
        nameEl.textContent = contact.contact_name || contact.contact_number;
        numberEl.textContent = contact.contact_number;

        // Afficher le panneau de détails
        if (screenContacts) {
            screenContacts.hidden = true;
            screenContacts.classList.remove('active');
        }

        const detailsScreen = document.getElementById('contactDetails');
        if (detailsScreen) {
            detailsScreen.hidden = false;
            detailsScreen.classList.add('active');
        }

        // Bouton Message
        const btnMsg = document.getElementById('btnMessageContact');
        if (btnMsg) {
            btnMsg.onclick = function () {
                openThread(contact.contact_number);
                detailsScreen.hidden = true;
                detailsScreen.classList.remove('active');
                screenMsgs.hidden = false;
                screenMsgs.classList.add('active');
            };
        }

        // Bouton Appel
        const btnCall = document.getElementById('btnCallContact');
        if (btnCall) {
            btnCall.onclick = function () {
                dbg('CALL CONTACT', { contactNumber });
                if (isNUI) {
                    callNui('contacts:callContact', {
                        number: contact.contact_number
                    });
                } else {
                    alert('Appel vers : ' + contact.contact_number);
                }
            };
        }
    }


  /* ============================================================
   *                NUI MESSAGES (SendNUIMessage)
   * ============================================================
   */

  window.addEventListener('message', function (e) {
    var d = e.data || {};
    dbg('WINDOW MESSAGE', d);

    if (d.action === 'phone:state') {
      showPhone(!!d.open);
    } else if (d.action === 'boot') {
      if (info) info.textContent = 'Profil en chargement…';
    } else if (d.action === 'set-user') {
      var u = d.user || {};
      if (info) {
        info.textContent = 'Nom: ' + (u.name || '') + ' — Numéro: ' + (u.phone_number || '???');
      }
    } else if (d.action === 'messages:setThreads') {
      // fallback si le client envoie directement un push
      if (d.threads && d.threads.length) {
        conversations = d.threads;
        applyThreadsToUI();
      }
    } else if (d.action === 'contacts:setContacts') {
      if (d.contacts && d.contacts.length) {
        contacts = d.contacts;
        renderContactsList();
      }
    }
  });

    /* ============================================================
    *                     UI BUTTONS / EVENTS
    * ============================================================
    */

    if (btnClose) {
    btnClose.addEventListener('click', function () {
        callNui('close', {}).then(function () {
        dbg('CLOSE SENT', {}, 'ok');
        });
    });
    }

    if (btnBackHome) {
    btnBackHome.addEventListener('click', backToHomeFromMessages);
    }

    if (msgForm) {
    msgForm.addEventListener('submit', handleSendMessage);
    }

    if (btnBackContacts) {
    btnBackContacts.addEventListener('click', backFromContacts);
    }

	if (btnAddContact) {
	  btnAddContact.addEventListener('click', function () {
		if (contactNameInput)   contactNameInput.value = '';
		if (contactNumberInput) contactNumberInput.value = '';
		showContactEditor(true);
	  });
	}

	if (btnContactCancel) {
	  btnContactCancel.addEventListener('click', function () {
		showContactEditor(false);
	  });
	}

    if (contactEditor) {
        contactEditor.addEventListener('submit', function (ev) {
            ev.preventDefault();

            var name = contactNameInput ? contactNameInput.value.trim() : '';
            var number = contactNumberInput ? contactNumberInput.value.trim() : '';

            if (!name || !number) {
                dbg('ADD CONTACT invalid', { name: name, number: number }, 'warn');
                return;
            }

            if (!isNUI) {
                // Démo: ajoute localement
                contacts.push({ id: Date.now(), owner_number: 'demo', contact_number: number, contact_name: name });
                renderContactsList();
                showContactEditor(false);
                return;
            }

            // Appel NUI -> client.lua -> serveur -> DB
            callNui('contacts:addContact', { name: name, number: number })
                .then(function (res) {
                    dbg('contacts:addContact RESULT', res || {}, 'ok');

                    // ⚠️ Mise à jour immédiate si le callback renvoie la liste
                    if (res && res.ok && Array.isArray(res.contacts)) {
                        contacts = res.contacts;
                        renderContactsList();
                    }

                    // Ferme le panneau (le push 'contacts:setContacts' reste supporté en fallback)
                    showContactEditor(false);
                })
                .catch(function (err) {
                    dbg('contacts:addContact ERROR', { err: String(err) }, 'err');
                });
        });
    }



   /* ============================================================
   *                           Contacts
   * ============================================================
   */

    if (btnAddContact) {
        btnAddContact.addEventListener('click', function () {
            // reset des champs
            if (contactNameInput) contactNameInput.value = '';
            if (contactNumberInput) contactNumberInput.value = '';
            showContactEditor(true);
        });
    }

    if (btnContactCancel) {
        btnContactCancel.addEventListener('click', function () {
            showContactEditor(false);
        });
    }

    if (contactEditor && btnContactSave) {
        contactEditor.addEventListener('submit', function (ev) {
            ev.preventDefault();
            // pour l'instant, on ne fait que fermer, on branchera le NUI plus tard
            showContactEditor(false);

            // TODO : callNui('contacts:addContact', { name, number })
            dbg("TODO : callNui('contacts: addContact", {  }, 'o');
        });
    }

	const btnBackToContacts = document.getElementById('btnBackToContacts');
	if (btnBackToContacts) {
	btnBackToContacts.addEventListener('click', function () {
		const detailsScreen = document.getElementById('contactDetails');
		if (detailsScreen) {
		detailsScreen.hidden = true;
		detailsScreen.classList.remove('active');
		}
		if (screenContacts) {
		screenContacts.hidden = false;
		screenContacts.classList.add('active');
		}
	});
    }



  /* ============================================================
   *                           INIT
   * ============================================================
   */

    document.addEventListener('DOMContentLoaded', function () {
    dbg('DOM READY', { isNUI: isNUI });

    indexApps();
    attachAppHandlers();
    startClock();

    if (isNUI) {
      if (phone) phone.setAttribute('aria-hidden', 'true');
      callNui('phone:ready', { ts: Date.now() });
    } else {
      showPhone(true);
      if (info) info.textContent = 'Mode démo — écran d’accueil prêt.';
    }
  });

  // ESC en démo pour fermer
  window.addEventListener('keydown', function (ev) {
    if (!isNUI && ev.key === 'Escape') {
      showPhone(false);
    }
  });

})();


function showContactEditor(show) {
  if (!contactEditor) return;
  if (show) {
    contactEditor.classList.remove('hidden');
    if (contactNameInput) contactNameInput.focus();
  } else {
    contactEditor.classList.add('hidden');
  }
}


