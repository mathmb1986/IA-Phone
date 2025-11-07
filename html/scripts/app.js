(function () {
  const RES = 'IA-Phone'; // doit matcher fxmanifest name
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const INFO = $('#info');
  const VIEW = $('#view');

  const Store = {
    key: 'iap_notes',
    load() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; } },
    save(list) { localStorage.setItem(this.key, JSON.stringify(list || [])); },
    uid() { return Math.random().toString(36).slice(2, 10); }
  };

  const UI = {
    setInfo(msg) { if (INFO) INFO.textContent = msg || ''; },
    render(tplId, data) {
      const tpl = document.getElementById(tplId);
      if (!tpl) return '';
      const html = Mustache.render(tpl.innerHTML, data || {});
      VIEW.innerHTML = html;
      return VIEW;
    }
  };

  // NUI bridge
  function postNUI(callbackName, payload) {
    return fetch(`https://${RES}/${callbackName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload || {})
    }).then((r) => r.json());
  }

  function openPhoneUI() { $('#phone').classList.remove('hidden'); }
  function closePhoneUI() { $('#phone').classList.add('hidden'); }

  // Notes app
  const Notes = {
    list: [],
    init() {
      this.list = Store.load();
      this.viewList();
    },
    viewList() {
      UI.render('tpl-notes-list', {
        hasNotes: this.list.length > 0,
        notes: this.list.map(n => ({
          id: n.id,
          title: n.title || '(Sans titre)',
          date: new Date(n.updatedAt || n.createdAt).toLocaleString()
        }))
      });
      // Bind actions
      $('#btnNewNote')?.addEventListener('click', () => this.editNote());
      $$('.btnEdit').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.target.closest('li')?.dataset?.id;
        const note = this.list.find(n => n.id === id);
        this.editNote(note || null);
      }));
      $$('.btnDelete').forEach(btn => btn.addEventListener('click', (e) => {
        const id = e.target.closest('li')?.dataset?.id;
        this.deleteNote(id);
      }));
      UI.setInfo('Prêt.');
    },
    editNote(note = null) {
      const data = note || { id: null, title: '', body: '' };
      UI.render('tpl-note-editor', { header: note ? 'Modifier' : 'Nouvelle note', ...data });
      $('#btnBack')?.addEventListener('click', () => this.viewList());
      $('#btnCancel')?.addEventListener('click', () => this.viewList());
      $('#btnSave')?.addEventListener('click', () => {
        const title = $('#noteTitle').value.trim();
        const body  = $('#noteBody').value.trim();
        if (!data.id) {
          const now = Date.now();
          const n = { id: Store.uid(), title, body, createdAt: now, updatedAt: now };
          this.list.unshift(n);
        } else {
          const idx = this.list.findIndex(x => x.id === data.id);
          if (idx >= 0) {
            this.list[idx].title = title;
            this.list[idx].body  = body;
            this.list[idx].updatedAt = Date.now();
          }
        }
        Store.save(this.list);
        this.viewList();
      });
    },
    deleteNote(id) {
      if (!id) return;
      this.list = this.list.filter(n => n.id !== id);
      Store.save(this.list);
      this.viewList();
    }
  };

  // NUI open/close + ready ping
  window.addEventListener('message', (e) => {
    const data = e.data || {};
    if (data.action === 'open') {
      openPhoneUI();
      UI.setInfo('Ouverture…');
      postNUI('ready', { boot: true }).catch(() => {});
      // Lazy init Notes (au premier open)
      Notes.init();
    } else if (data.action === 'close') {
      closePhoneUI();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    // bouton ✕ ferme la NUI
    $('#btnClose')?.addEventListener('click', () => {
      postNUI('close', {}).catch(() => {});
    });
  });
})();
