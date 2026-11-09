// ═══════════════════════════════════════════════════════
// JOURNAL EDITOR PARTS — what makes the page editor feel like a document editor: a formatting toolbar, pictures,
// a handle on every block to drag it to another place (or Alt+Up / Alt+Down), and a + to add a block below.
// The editor itself is TipTap (js/tiptap-bundle.js); these are extensions and helpers for journal.js.
// ═══════════════════════════════════════════════════════
import { addPicture, getFull } from './gallery.js';
import { readFileAsDataUrl } from './avatar.js';
import { px } from './pixel_icons.js';
import { askInput, esc, toast } from './util.js';

const IMG_PREFIX = 'loreos://image/';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// ── Pictures in a page: kept in the Gallery and linked, so the page text stays small ──
export function imageNode() {
  const X = TiptapExt;
  const resolve = src => {
    if (src.startsWith(IMG_PREFIX)) { try { return getFull(decodeURIComponent(src.slice(IMG_PREFIX.length))) || BLANK; } catch (e) { return BLANK; } }
    return /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(src) ? src : BLANK;   // nothing is fetched from other sites
  };
  return X.Node.create({
    name: 'image', group: 'block', atom: true, draggable: true, selectable: true,
    addAttributes() { return { src: { default: '' }, alt: { default: '' } }; },
    parseHTML() { return [{ tag: 'img[data-src^="loreos://image/"], img[src^="loreos://image/"]', getAttrs: el => ({ src: el.getAttribute('data-src') || el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' }) }]; },
    renderHTML({ node }) { return ['img', { src: resolve(String(node.attrs.src || '')), 'data-src': node.attrs.src, alt: node.attrs.alt || '', class: 'nb-img' }]; },
    addStorage() { return { markdown: { serialize(state, node) { state.write('![' + state.esc(node.attrs.alt || '') + '](' + node.attrs.src + ')'); state.closeBlock(node); }, parse: {} } }; },
  });
}
// Add pictures from files to the Gallery and put them in the page at the cursor
export async function insertPictures(editor, files) {
  const imgs = [...files].filter(f => /^image\//.test(f.type)); let n = 0;
  for (const f of imgs) {
    const id = await addPicture({ dataUrl: await readFileAsDataUrl(f), name: f.name.replace(/\.[^.]+$/, '') || 'Picture', source: 'upload' });
    if (!id) { toast('Could not keep that picture (is the storage full?).', 'err'); continue; }
    editor.chain().focus().insertContent({ type: 'image', attrs: { src: IMG_PREFIX + encodeURIComponent(id), alt: f.name.replace(/\.[^.]+$/, '') } }).run(); n++;
  }
  return n;
}
export function pasteDropExt() {
  const X = TiptapExt, PM = TiptapPM;
  return X.Extension.create({
    name: 'nbPictures',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [new PM.Plugin({ key: new PM.PluginKey('nbPictures'), props: {
        handlePaste: (view, e) => { const f = e.clipboardData && [...e.clipboardData.files].filter(x => /^image\//.test(x.type)); if (!f || !f.length) return false; e.preventDefault(); insertPictures(editor, f); return true; },
        handleDrop: (view, e) => { if (view.dragging) return false; const f = e.dataTransfer && [...e.dataTransfer.files].filter(x => /^image\//.test(x.type)); if (!f || !f.length) return false; e.preventDefault(); insertPictures(editor, f); return true; },
      } })];
    },
  });
}

// ── A handle on every block: drag it somewhere else, or press + to add a block under it ──
export function blockHandlesExt() {
  const X = TiptapExt, PM = TiptapPM;
  return X.Extension.create({
    name: 'nbHandles',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [new PM.Plugin({
        key: new PM.PluginKey('nbHandles'),
        props: {
          decorations(state) {
            const decos = [];
            state.doc.forEach((node, pos) => {
              decos.push(PM.Decoration.widget(pos, (view, getPos) => {
                const box = document.createElement('div'); box.className = 'nb-blk-tools'; box.contentEditable = 'false';
                const add = document.createElement('button'); add.type = 'button'; add.className = 'nb-blk-add'; add.title = 'Add a block below'; add.setAttribute('aria-label', 'Add a block below'); add.innerHTML = px('plus');
                const grip = document.createElement('div'); grip.className = 'nb-blk-grip'; grip.draggable = true; grip.title = 'Drag to move this block'; grip.setAttribute('aria-label', 'Drag to move this block'); grip.innerHTML = px('menu');
                add.addEventListener('mousedown', e => e.preventDefault());
                add.addEventListener('click', () => {
                  const at = getPos(), n = view.state.doc.nodeAt(at); if (!n) return; const end = at + n.nodeSize;
                  editor.chain().focus().insertContentAt(end, { type: 'paragraph', content: [{ type: 'text', text: '/' }] }).setTextSelection(end + 2).run();
                });
                grip.addEventListener('dragstart', e => {
                  const at = getPos(), n = view.state.doc.nodeAt(at); if (!n) return;
                  const sel = PM.NodeSelection.create(view.state.doc, at); view.dispatch(view.state.tr.setSelection(sel));
                  view.dragging = { slice: sel.content(), move: true };
                  const dom = view.nodeDOM(at); if (dom && e.dataTransfer) { e.dataTransfer.setDragImage(dom, 0, 0); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ' '); }
                });
                box.append(add, grip);
                return box;
              }, { side: -1, ignoreSelection: true }));
            });
            return PM.DecorationSet.create(state.doc, decos);
          },
        },
      })];
    },
  });
}
// Alt+Up / Alt+Down move the block you are in
export function blockMoveExt() {
  const X = TiptapExt;
  const move = (editor, dir) => {
    const { state } = editor, $from = state.selection.$from; if ($from.depth < 1) return false;
    const idx = $from.index(0), doc = state.doc, j = idx + dir; if (j < 0 || j >= doc.childCount) return true;
    let start = 0; for (let i = 0; i < idx; i++) start += doc.child(i).nodeSize;
    const node = doc.child(idx), other = doc.child(j);
    const tr = state.tr; const from = start, to = start + node.nodeSize;
    if (dir < 0) { tr.delete(from, to); tr.insert(from - other.nodeSize, node); tr.setSelection(state.selection.constructor.near(tr.doc.resolve(from - other.nodeSize + 1))); }
    else { tr.delete(from, to); tr.insert(from + other.nodeSize, node); tr.setSelection(state.selection.constructor.near(tr.doc.resolve(from + other.nodeSize + 1))); }
    editor.view.dispatch(tr.scrollIntoView()); return true;
  };
  return X.Extension.create({ name: 'nbBlockMove', addKeyboardShortcuts() { return { 'Alt-ArrowUp': () => move(this.editor, -1), 'Alt-ArrowDown': () => move(this.editor, 1) }; } });
}

// ── The toolbar ──
export function toolbarHtml() {
  const b = (cmd, label, title) => `<button type="button" class="nb-tb" data-tb="${cmd}" title="${esc(title)}" aria-label="${esc(title)}">${label}</button>`;
  const sep = '<span class="nb-tb-sep" aria-hidden="true"></span>';
  return `<div class="nb-toolbar" role="toolbar" aria-label="Formatting">
    <select class="nb-tb-block" data-tb="block" aria-label="Block type"><option value="p">Text</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
    ${sep}${b('bold', '<b>B</b>', 'Bold (Ctrl+B)')}${b('italic', '<i>I</i>', 'Italic (Ctrl+I)')}${b('underline', '<u>U</u>', 'Underline (Ctrl+U)')}${b('strike', '<s>S</s>', 'Strikethrough')}${b('code', px('code'), 'Code')}${b('link', px('link'), 'Link')}
    ${sep}${b('bullet', px('list-ul'), 'Bulleted list')}${b('ordered', px('list-ol'), 'Numbered list')}${b('todo', px('todo'), 'To-do list')}${b('quote', px('quote'), 'Quote')}${b('rule', px('minus'), 'Divider')}
    ${sep}${b('image', px('image'), 'Add a picture')}${b('sticky', px('sticky'), 'Add a sticky note')}
    ${sep}${b('undo', px('undo'), 'Undo (Ctrl+Z)')}${b('redo', px('redo'), 'Redo (Ctrl+Shift+Z)')}
  </div>`;
}
export function wireToolbar(root, editor, { onSticky } = {}) {
  const run = fn => { fn(editor.chain().focus()).run(); };
  const acts = {
    bold: c => c.toggleBold(), italic: c => c.toggleItalic(), underline: c => c.toggleUnderline(), strike: c => c.toggleStrike(), code: c => c.toggleCode(),
    bullet: c => c.toggleBulletList(), ordered: c => c.toggleOrderedList(), todo: c => c.toggleTaskList(), quote: c => c.toggleBlockquote(), rule: c => c.setHorizontalRule(),
    undo: c => c.undo(), redo: c => c.redo(),
  };
  const sel = root.querySelector('[data-tb="block"]');
  sel.addEventListener('change', () => { const v = sel.value; run(c => v === 'p' ? c.setParagraph() : c.setHeading({ level: Number(v) })); });
  root.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });   // keep the selection in the page
  root.addEventListener('click', async e => {
    const btn = e.target.closest('[data-tb]'); if (!btn || btn.tagName === 'SELECT') return;
    const k = btn.dataset.tb;
    if (acts[k]) { run(acts[k]); return; }
    if (k === 'link') {
      const cur = editor.getAttributes('link').href || '';
      const v = await askInput('Link address (https://...)', cur); if (v === null) return;
      const url = v.trim();
      if (!url) { run(c => c.extendMarkRange('link').unsetLink()); return; }
      const href = /^(https?:|mailto:|loreos:)/i.test(url) ? url : 'https://' + url;
      run(c => c.extendMarkRange('link').setLink({ href }));
    } else if (k === 'image') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.onchange = async () => { const n = await insertPictures(editor, inp.files || []); if (n) toast(n === 1 ? 'Picture added.' : `${n} pictures added.`, 'ok'); };
      inp.click();
    } else if (k === 'sticky' && onSticky) onSticky();
  });
  const refresh = () => {
    root.querySelectorAll('[data-tb]').forEach(b => {
      const k = b.dataset.tb, on = k === 'bold' ? editor.isActive('bold') : k === 'italic' ? editor.isActive('italic') : k === 'underline' ? editor.isActive('underline') : k === 'strike' ? editor.isActive('strike') : k === 'code' ? editor.isActive('code')
        : k === 'link' ? editor.isActive('link') : k === 'bullet' ? editor.isActive('bulletList') : k === 'ordered' ? editor.isActive('orderedList') : k === 'todo' ? editor.isActive('taskList') : k === 'quote' ? editor.isActive('blockquote') : false;
      if (b.tagName === 'BUTTON') { b.classList.toggle('on', !!on); if (k === 'undo') b.disabled = !editor.can().undo(); if (k === 'redo') b.disabled = !editor.can().redo(); }
    });
    sel.value = editor.isActive('heading', { level: 1 }) ? '1' : editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : 'p';
  };
  editor.on('transaction', refresh); refresh();
}
