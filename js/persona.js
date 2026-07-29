// ═══════════════════════════════════════════════════════
// PERSONA.JS — freeform named-slot persona editor
// Storage: localStorage 'loreos_personas' → { id: PersonaObj }
// PersonaObj: { id, name, slots: [{id, label, content}], savedAt }
// ═══════════════════════════════════════════════════════

let personaLibrary = {};
let activePersonaId = null;

function personaStorageKey() { return 'loreos_personas'; }
function personaGet() {
  try { return JSON.parse(localStorage.getItem(personaStorageKey()) || '{}'); } catch(e) { return {}; }
}
function personaSet(d) { try { localStorage.setItem(personaStorageKey(), JSON.stringify(d)); } catch(e) {} }
function personaId() { return 'ps_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function slotId()    { return 'sl_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

function loadPersonas() {
  personaLibrary = personaGet();
}

function savePersonas() {
  personaSet(personaLibrary);
}

// ── Sidebar ──────────────────────────────────────────
function renderPersonaSidebar() {
  const list = g('entryList');
  const sbTitle = g('sbTitle');
  if (sbTitle) sbTitle.textContent = 'Personas';
  list.innerHTML = '';

  const personas = Object.values(personaLibrary).sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
  if (!personas.length) {
    list.innerHTML = '<li style="font-family:var(--fx);font-size:.72rem;color:var(--txm);padding:.75rem;letter-spacing:.5px">no personas yet</li>';
    return;
  }
  personas.forEach(p => {
    const li = document.createElement('li');
    li.className = 'ei' + (p.id === activePersonaId ? ' active' : '');
    li.innerHTML = `<div class="ei-name">${esc(p.name || 'Unnamed Persona')}</div><div class="ei-meta">${p.slots?.length || 0} slots</div>`;
    li.addEventListener('click', () => openPersona(p.id));
    list.appendChild(li);
  });
}

// ── Editor ───────────────────────────────────────────
function renderPersonaEditor() {
  const ec = g('editorContent');
  if (!activePersonaId || !personaLibrary[activePersonaId]) {
    ec.innerHTML = `
      <div class="empty-state">
        <div>select a persona or create one</div>
        <button class="btn btn-ok" onclick="createPersona()">+ New Persona</button>
      </div>`;
    return;
  }
  const p = personaLibrary[activePersonaId];
  ec.className = '';
  ec.innerHTML = `
    <div class="entry-editor">
      <div class="fg">
        <label class="flabel">Persona Name</label>
        <input id="psName" class="finput" value="${esc(p.name||'')}" placeholder="My Persona">
      </div>

      <div class="fg" style="margin-top:.5rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem">
          <label class="flabel">Slots</label>
          <button class="btn btn-s btn-sm" id="psAddSlot">+ Add Slot</button>
        </div>
        <div id="psSlotList" class="ps-slot-list"></div>
      </div>

      <div style="display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap">
        <button class="btn btn-p" id="psSaveBtn">Save Persona</button>
        <button class="btn btn-s" id="psExportBtn">Export JSON</button>
        <button class="btn btn-err btn-sm" id="psDeleteBtn">Delete</button>
      </div>
    </div>`;

  renderSlots(p);
  wirePersonaEditor(p);
}

function renderSlots(p) {
  const container = g('psSlotList');
  if (!container) return;
  const slots = p.slots || [];
  if (!slots.length) {
    container.innerHTML = '<div style="font-family:var(--fx);font-size:.72rem;color:var(--txm);padding:.5rem 0;letter-spacing:.4px">no slots yet — add one above</div>';
    return;
  }
  container.innerHTML = slots.map((slot, i) => `
    <div class="ps-slot" data-slot-id="${slot.id}">
      <div class="ps-slot-head">
        <input class="ps-slot-label finput" data-slot-idx="${i}" value="${esc(slot.label||'')}" placeholder="Slot name (e.g. Appearance)">
        <button class="btn btn-err btn-sm ps-slot-del" data-slot-idx="${i}" title="Remove slot">✕</button>
      </div>
      <textarea class="ps-slot-ta ftextarea" data-slot-idx="${i}" placeholder="Write anything...">${esc(slot.content||'')}</textarea>
      <div class="ps-slot-count">${(slot.content||'').length} chars</div>
    </div>
  `).join('');

  // Wire slot inputs
  container.querySelectorAll('.ps-slot-label').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = +inp.dataset.slotIdx;
      personaLibrary[activePersonaId].slots[idx].label = inp.value;
    });
  });
  container.querySelectorAll('.ps-slot-ta').forEach(ta => {
    ta.addEventListener('input', () => {
      const idx = +ta.dataset.slotIdx;
      personaLibrary[activePersonaId].slots[idx].content = ta.value;
      const countEl = ta.nextElementSibling;
      if (countEl) countEl.textContent = ta.value.length + ' chars';
    });
    // expand button
    const btn = document.createElement('button');
    btn.className = 'expand-btn';
    btn.textContent = '⛶ expand';
    btn.addEventListener('click', e => {
      e.preventDefault();
      openFullscreen(ta.id || ('ps_ta_' + ta.dataset.slotIdx), personaLibrary[activePersonaId]?.slots[+ta.dataset.slotIdx]?.label || 'Slot');
      if (!ta.id) ta.id = 'ps_ta_' + ta.dataset.slotIdx;
    });
    ta.parentElement.insertBefore(btn, ta.nextElementSibling);
  });
  container.querySelectorAll('.ps-slot-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.slotIdx;
      personaLibrary[activePersonaId].slots.splice(idx, 1);
      renderSlots(personaLibrary[activePersonaId]);
    });
  });
}

function wirePersonaEditor(p) {
  g('psAddSlot').addEventListener('click', () => {
    if (!personaLibrary[activePersonaId]) return;
    personaLibrary[activePersonaId].slots = personaLibrary[activePersonaId].slots || [];
    personaLibrary[activePersonaId].slots.push({ id: slotId(), label: '', content: '' });
    renderSlots(personaLibrary[activePersonaId]);
  });

  g('psSaveBtn').addEventListener('click', () => {
    const p2 = personaLibrary[activePersonaId];
    if (!p2) return;
    p2.name = g('psName').value.trim() || 'Unnamed Persona';
    p2.savedAt = new Date().toISOString();
    savePersonas();
    renderPersonaSidebar();
    toast('Persona saved.', 'ok');
  });

  g('psExportBtn').addEventListener('click', () => {
    const p2 = personaLibrary[activePersonaId];
    if (!p2) return;
    const fn = (p2.name || 'persona').replace(/[^a-z0-9_\- ]/gi,'_') + '_persona.json';
    dlFile(JSON.stringify(p2, null, 2), fn, 'application/json');
    toast('Persona exported.', 'ok');
  });

  g('psDeleteBtn').addEventListener('click', async () => {
    if (!await askConfirm('Delete this persona?')) return;
    delete personaLibrary[activePersonaId];
    savePersonas();
    activePersonaId = null;
    renderPersonaSidebar();
    renderPersonaEditor();
  });
}

function openPersona(id) {
  activePersonaId = id;
  renderPersonaSidebar();
  renderPersonaEditor();
}

function createPersona() {
  const id = personaId();
  personaLibrary[id] = {
    id, name: 'New Persona',
    slots: [
      { id: slotId(), label: 'Name', content: '' },
      { id: slotId(), label: 'Appearance', content: '' },
      { id: slotId(), label: 'Personality', content: '' },
    ],
    savedAt: new Date().toISOString(),
  };
  savePersonas();
  openPersona(id);
  renderPersonaSidebar();
}

function importPersonaJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const p = JSON.parse(ev.target.result);
      if (!p.slots) { toast('Not a valid persona file.', 'err'); return; }
      p.id = p.id || personaId();
      personaLibrary[p.id] = p;
      savePersonas();
      openPersona(p.id);
      renderPersonaSidebar();
      toast('Persona imported.', 'ok');
    } catch(e2) { toast('Failed to parse JSON.', 'err'); }
  };
  r.readAsText(file);
  e.target.value = '';
}
