(function () {
    // Détection NUI (FiveM) vs Mode démo navigateur
    var isNUI = typeof GetParentResourceName === 'function' && typeof window.invokeNative === 'function';

    // Raccourcis DOM
    var phone = document.getElementById('phone');
    var btnClose = document.getElementById('btnClose');
    var hsTime = document.getElementById('hsTime');
    var hsDate = document.getElementById('hsDate');
    var appsGrid = document.getElementById('appsGrid');
    var homescreen = document.getElementById('homescreen');

    // Messages
    var screenMsgs = document.getElementById('screenMessages');
    var btnBackHome = document.getElementById('btnBackHome');
    var msgThreads = document.getElementById('msgThreads');
    var msgThread = document.getElementById('msgThread');
    var msgThreadMsgs = document.getElementById('msgThreadMessages');
    var msgEmpty = document.getElementById('msgEmpty');
    var msgForm = document.getElementById('msgForm');
    var msgInput = document.getElementById('msgInput');
    var msgSubtitle = document.getElementById('msgSubtitle');
    var threadAvatar = document.getElementById('threadAvatar');
    var threadNameEl = document.getElementById('threadName');
    var threadStatus = document.getElementById('threadStatus');

    // Debug / info
    var debugPanel = document.getElementById('debugPanel');
    var info = document.getElementById('info');

    // Contacts
    var screenContacts = document.getElementById('screenContacts');
    var contactsList = document.getElementById('contactsList');
    var contactsEmpty = document.getElementById('contactsEmpty');
    var contactsSubtitle = document.getElementById('contactsSubtitle');
    var btnBackHomeContacts = document.getElementById('btnBackHomeContacts');
    var btnAddContact = document.getElementById('btnAddContact');

    var contactModal = document.getElementById('contactModal');
    var contactModalTitle = document.getElementById('contactModalTitle');
    var contactForm = document.getElementById('contactForm');
    var contactNameInput = document.getElementById('contactNameInput');
    var contactNumberInput = document.getElementById('contactNumberInput');
    var contactCancel = document.getElementById('contactCancel');

    // Données Contacts
    var contacts = [];
    var editingContactId = null;

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
            var kls = kind ? (' ' + kind) : '';

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
        else debugPanel.classList.remove('show');
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
        var d = new Date();
        var hh = d.getHours().toString().padStart(2, '0');
        var mm = d.getMinutes().toString().padStart(2, '0');
        hsTime.textContent = hh + ':' + mm;

        var fmt = new Intl.DateTimeFormat('fr-CA', { weekday: 'short', day: '2-digit', month: 'long' });
        var parts = fmt.formatToParts(d);
        var wd = '';
        var day = '';
        var mo = '';

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
        var apps = $all('.app', appsGrid);
        dbg('ATTACH APP HANDLERS', { count: apps.length, supportsPointer: !!window.PointerEvent }, 'ok');

        apps.forEach(function (btn) {
            var id = btn.getAttribute('data-app') || '(no-app)';
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
            btn.addEventListener('pointerup', pressEnd);
            btn.addEventListener('pointercancel', pressCancel);
            btn.addEventListener('mouseleave', pressCancel);

            btn.addEventListener('mousedown', pressStart);
            btn.addEventListener('mouseup', pressEnd);
            btn.addEventListener('mouseout', pressCancel);

            btn.addEventListener('touchstart', function () { pressStart(); }, { passive: true });
            btn.addEventListener('touchend', function () { pressEnd(); }, { passive: true });
            btn.addEventListener('touchcancel', function () { pressCancel(); }, { passive: true });

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

    /* ========== App Messages ========== */

    var demoConversations = [
        {
            id: 'alex',
            name: 'Alex',
            initials: 'A',
            lastTime: '13:37',
            lastText: 'Yo t’es où ?',
            unread: 2,
            messages: [
                { from: 'them', text: 'Yo t’es où ?', time: '13:37' },
                { from: 'me', text: 'J’arrive à la ville, 2 min.', time: '13:38' }
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
                { from: 'me', text: 'Parfait, j’arrive.', time: '08:24' }
            ]
        }
    ];

    var conversations = [];
    var currentThreadId = null;

    function openMessagesApp() {
        dbg('OPEN MESSAGES APP');

        homescreen.classList.add('hidden');
        screenMsgs.hidden = false;
        screenMsgs.classList.add('active');

        currentThreadId = null;
        msgThread.hidden = true;
        msgEmpty.hidden = false;
        msgEmpty.textContent = 'Chargement des conversations…';

        if (!isNUI) {
            conversations = demoConversations.slice();
            applyThreadsToUI();
            return;
        }

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
            msgEmpty.hidden = false;
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
            else btn.classList.remove('active');
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
        msgEmpty.hidden = true;
    }

    function renderThreadMessages(conv) {
        var msgs = Array.isArray(conv.messages) ? conv.messages : [];
        var parts = msgs.map(function (m) {
            var who = (m.from === 'me') ? 'me' : 'them';
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

        var now = new Date();
        var hh = now.getHours().toString().padStart(2, '0');
        var mm = now.getMinutes().toString().padStart(2, '0');
        var time = hh + ':' + mm;

        if (!Array.isArray(conv.messages)) conv.messages = [];
        conv.messages.push({ from: 'me', text: text, time: time });
        conv.lastText = text;
        conv.lastTime = time;
        conv.unread = 0;

        dbg('SEND MESSAGE (UI local)', { to: conv.name, text: text, time: time }, 'ok');

        msgInput.value = '';
        renderThreadMessages(conv);
        renderThreadsList();
        updateActiveThreadItem();

        if (isNUI) {
            var payload = {
                threadId: conv.id,
                text: text,
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

    /* ========== App Contacts ========== */

    function openContactsApp() {
        dbg('OPEN CONTACTS APP');

        homescreen.classList.add('hidden');
        screenContacts.hidden = false;
        screenContacts.classList.add('active');

        contactsList.innerHTML = '';
        contactsEmpty.hidden = false;
        contactsEmpty.textContent = 'Chargement des contacts…';

        if (!isNUI) {
            contacts = [
                { id: 1, name: 'Alex Dupont', number: '555-0123' },
                { id: 2, name: 'Dispatch Central', number: '555-2000' },
                { id: 3, name: 'Garage Auto', number: '555-8765' }
            ];
            applyContactsToUI();
            return;
        }

        callNui('contacts:getAll', {}).then(function (res) {
            contacts = Array.isArray(res.contacts) ? res.contacts : [];
            dbg('RECV CONTACTS', { count: contacts.length }, 'ok');
            applyContactsToUI();
        }).catch(function (err) {
            dbg('ERROR CONTACTS', { err: String(err) }, 'err');
            contacts = [];
            applyContactsToUI();
        });
    }

    function backToHomeFromContacts() {
        dbg('BACK HOME FROM CONTACTS');
        screenContacts.hidden = true;
        screenContacts.classList.remove('active');
        homescreen.classList.remove('hidden');
    }

    function applyContactsToUI() {
        var count = contacts.length;
        contactsSubtitle.textContent = (count === 1) ? '1 contact' : (count + ' contacts');

        if (count === 0) {
            contactsList.innerHTML = '';
            contactsEmpty.hidden = false;
            contactsEmpty.textContent = 'Aucun contact enregistré.';
            return;
        }

        contactsEmpty.hidden = true;
        renderContactsList();
    }

    function renderContactsList() {
        var html = contacts.map(function (c) {
            var initials = c.name ? c.name.charAt(0).toUpperCase() : '?';
            var name = c.name || 'Contact';
            var number = c.number || '';

            return (
                '<div class="contact-item" data-id="' + c.id + '">' +
                '<div class="contact-avatar">' + initials + '</div>' +
                '<div class="contact-info">' +
                '<div class="contact-name">' + name + '</div>' +
                '<div class="contact-number">' + number + '</div>' +
                '</div>' +
                '<div class="contact-actions">' +
                '<button class="contact-call" title="Appeler" aria-label="Appeler">📞</button>' +
                '<button class="contact-delete" title="Supprimer" aria-label="Supprimer">✕</button>' +
                '</div>' +
                '</div>'
            );
        }).join('');

        contactsList.innerHTML = html;

        var rows = $all('.contact-item', contactsList);
        rows.forEach(function (row) {
            var idStr = row.getAttribute('data-id');
            var contact = contacts.find(function (c) { return String(c.id) === String(idStr); });
            if (!contact) return;

            row.addEventListener('click', function () {
                dbg('CONTACT CLICK', contact, 'ok');

                if (isNUI) {
                    callNui('contacts:openChat', { contactId: contact.id });
                } else {
                    alert('Contact: ' + contact.name + ' (' + contact.number + ')');
                }
            });

            var btnCall = row.querySelector('.contact-call');
            if (btnCall) {
                btnCall.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    dbg('CONTACT CALL', contact, 'ok');

                    if (isNUI) {
                        callNui('contacts:call', {
                            contactId: contact.id,
                            number: contact.number,
                            name: contact.name
                        });
                    } else {
                        alert('Appel (démo) -> ' + contact.number);
                    }
                });
            }

            var btnDel = row.querySelector('.contact-delete');
            if (btnDel) {
                btnDel.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    if (!confirm('Supprimer le contact "' + contact.name + '" ?')) return;
                    deleteContact(contact);
                });
            }
        });
    }

    function openContactModal(mode, contact) {
        editingContactId = null;

        if (mode === 'edit' && contact) {
            editingContactId = contact.id;
            contactModalTitle.textContent = 'Modifier le contact';
            contactNameInput.value = contact.name || '';
            contactNumberInput.value = contact.number || '';
        } else {
            contactModalTitle.textContent = 'Nouveau contact';
            contactNameInput.value = '';
            contactNumberInput.value = '';
        }

        contactModal.hidden = false;
        setTimeout(function () {
            try { contactNameInput.focus(); } catch (e) { }
        }, 10);

        dbg('OPEN CONTACT MODAL', { mode: mode, editingContactId: editingContactId }, 'ok');
    }

    function closeContactModal() {
        contactModal.hidden = true;
        editingContactId = null;
    }

    function handleContactFormSubmit(ev) {
        ev.preventDefault();

        var name = contactNameInput.value.trim();
        var number = contactNumberInput.value.trim();

        if (!name || !number) {
            dbg('CONTACT SAVE INVALID', { name: name, number: number }, 'warn');
            return;
        }

        if (!isNUI) {
            if (editingContactId != null) {
                for (var i = 0; i < contacts.length; i++) {
                    if (String(contacts[i].id) === String(editingContactId)) {
                        contacts[i].name = name;
                        contacts[i].number = number;
                        break;
                    }
                }
            } else {
                var newId = Date.now();
                contacts.push({ id: newId, name: name, number: number });
            }

            dbg('CONTACT SAVE (DEMO)', { name: name, number: number, editingContactId: editingContactId }, 'ok');
            closeContactModal();
            applyContactsToUI();
            return;
        }

        var payload = {
            id: editingContactId,
            name: name,
            number: number
        };

        var nuiName = editingContactId != null ? 'contacts:update' : 'contacts:add';
        dbg('CONTACT SAVE NUI', { nuiName: nuiName, payload: payload }, 'ok');

        callNui(nuiName, payload).then(function (res) {
            var c = res && res.contact ? res.contact : null;

            if (c) {
                var found = false;
                for (var i = 0; i < contacts.length; i++) {
                    if (String(contacts[i].id) === String(c.id)) {
                        contacts[i] = c;
                        found = true;
                        break;
                    }
                }
                if (!found) contacts.push(c);
            } else {
                if (editingContactId != null) {
                    for (var j = 0; j < contacts.length; j++) {
                        if (String(contacts[j].id) === String(editingContactId)) {
                            contacts[j].name = name;
                            contacts[j].number = number;
                            break;
                        }
                    }
                } else {
                    var tmpId = res && res.id ? res.id : Date.now();
                    contacts.push({ id: tmpId, name: name, number: number });
                }
            }

            dbg('CONTACT SAVE NUI OK', res || {}, 'ok');
            closeContactModal();
            applyContactsToUI();
        }).catch(function (err) {
            dbg('CONTACT SAVE NUI ERROR', { err: String(err) }, 'err');
        });
    }

    function deleteContact(contact) {
        if (!contact) return;

        if (!isNUI) {
            contacts = contacts.filter(function (c) { return String(c.id) !== String(contact.id); });
            dbg('CONTACT DELETE (DEMO)', contact, 'ok');
            applyContactsToUI();
            return;
        }

        var payload = { id: contact.id };
        dbg('CONTACT DELETE NUI', payload, 'ok');

        callNui('contacts:delete', payload).then(function (res) {
            contacts = contacts.filter(function (c) { return String(c.id) !== String(contact.id); });
            dbg('CONTACT DELETE NUI OK', res || {}, 'ok');
            applyContactsToUI();
        }).catch(function (err) {
            dbg('CONTACT DELETE NUI ERROR', { err: String(err) }, 'err');
        });
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
        callNui('close', {}).then(function () {
            dbg('CLOSE SENT', {}, 'ok');
        });
    });

    btnBackHome.addEventListener('click', backToHome);
    msgForm.addEventListener('submit', handleSendMessage);

    // Contacts UI
    btnBackHomeContacts.addEventListener('click', backToHomeFromContacts);
    btnAddContact.addEventListener('click', function () { openContactModal('create', null); });
    contactCancel.addEventListener('click', closeContactModal);
    contactForm.addEventListener('submit', handleContactFormSubmit);

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
