// ═══════════════════════════════════════════════════════
// CHARACTER EXPORT TARGETS — the one list every character export menu is built from (the editor's Export menu, the header's,
// and the phone's). To add a format: write its adapter in js/adapters/, then add ONE entry to CHARACTER_EXPORTS below.
// The entry becomes a menu item everywhere, with its tooltip, and is wired up for you. See "Adding a format" in the README.
//
//   key      the end of the button id (so ids stay put: chExport<key>, charHdrExport<key>, mobCharExport<key>)
//   group    optional: items with the same group sit together under a collapsible heading (PNG, JSON)
//   label    what the menu says
//   title    optional tooltip: say who the format is for and what it does with fields
//   primary  optional: the phone menu highlights it
//   untested optional: true when no real app has been tried with it. The label says so
//   run(id)  does the export for the character with that id
// ═══════════════════════════════════════════════════════
import { exportCharCharx, exportCharJson, exportCharJsonV2, openCharPngExport } from './character_io.js';
import { esc, g } from './util.js';

const TIP_V2 = 'Works in most apps. JanitorAI shows a V2 card\'s description as its public Bio. For JanitorAI use V3 PNG, or the JanitorAI option.';
const TIP_V3 = 'Same layout SillyTavern writes. Works in SillyTavern, JanitorAI and most apps, and keeps your description as the description.';
const TIP_JAI = 'For JanitorAI: puts the character definition in Personality (where a V2 card keeps it) and your Creator Notes in the Bio.';

export const CHARACTER_EXPORTS = [
  { key: 'V3PngBtn', group: 'PNG', label: 'V3 PNG', title: TIP_V3, primary: true, run: id => openCharPngExport(id, false) },
  { key: 'PngBtn', group: 'PNG', label: 'V2 PNG', title: TIP_V2, run: id => openCharPngExport(id, true) },
  { key: 'JanitorPngBtn', group: 'PNG', label: 'JanitorAI PNG', title: TIP_JAI, run: id => openCharPngExport(id, true, { janitor: true }) },
  { key: 'JsonBtn', group: 'JSON', label: 'V3 JSON', run: id => exportCharJson(id) },
  { key: 'V2JsonBtn', group: 'JSON', label: 'V2 JSON', title: TIP_V2, run: id => exportCharJsonV2(id) },
  { key: 'JanitorBtn', group: 'JSON', label: 'JanitorAI JSON', title: TIP_JAI, run: id => exportCharJsonV2(id, { janitor: true }) },
  { key: 'CharxBtn', label: '.CHARX', run: id => exportCharCharx(id) },
];

const labelOf = t => esc(t.label) + (t.untested ? ' (untested)' : '');
const tipOf = t => (t.title || t.untested ? ' title="' + esc((t.title ? t.title + ' ' : '') + (t.untested ? 'Not yet tried in the real app.' : '')) .trim() + '"' : '');

// The menu's inside. `mobile` makes big stacked buttons for the phone's dialog; otherwise it is the usual dropdown.
export function charExportItemsHtml(prefix, { mobile = false } = {}) {
  const item = t => mobile
    ? '<button class="btn ' + (t.primary ? 'btn-p' : 'btn-s') + '" id="' + prefix + 'Export' + t.key + '" style="width:100%;justify-content:center;padding:.65rem"' + tipOf(t) + '>' + labelOf(t) + '</button>'
    : '<button class="dd-item" id="' + prefix + 'Export' + t.key + '"' + tipOf(t) + '>' + labelOf(t) + '</button>';
  const seen = new Set(); const out = [];
  CHARACTER_EXPORTS.forEach(t => {
    if (!t.group) { out.push(item(t)); return; }
    if (seen.has(t.group)) return; seen.add(t.group);
    const inner = CHARACTER_EXPORTS.filter(x => x.group === t.group).map(item).join(mobile ? '' : '\n');
    out.push(mobile
      ? '<details class="dd-group mob-group"><summary>' + esc(t.group) + '</summary><div style="display:flex;flex-direction:column;gap:.65rem;margin-top:.65rem">' + inner + '</div></details>'
      : '<details class="dd-group"><summary>' + esc(t.group) + '</summary>' + inner + '</details>');
  });
  return out.join('\n');
}

// Fill a menu container and attach its handlers. `getId` says which character; `after` runs first (the phone closes its dialog).
export function mountCharExportMenu(containerId, prefix, getId, { mobile = false, after = null } = {}) {
  const box = g(containerId); if (!box) return;
  box.innerHTML = charExportItemsHtml(prefix, { mobile });
  CHARACTER_EXPORTS.forEach(t => { const b = g(prefix + 'Export' + t.key); if (b) b.addEventListener('click', () => { if (after) after(); t.run(getId()); }); });
}
