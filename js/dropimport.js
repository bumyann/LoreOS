// ═══════════════════════════════════════════════════════
// DROP IMPORT — drop a file anywhere on the page to import it.
// The file is sniffed (PNG / .charx / JSON content) and handed to the SAME file
// input the Import menus use, so every check and confirmation still applies.
// ═══════════════════════════════════════════════════════
import { looksLikeRegexJson } from './regex_model.js';
import { switchMode } from './workshop.js';
import { g, toast } from './util.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

// Where should this file go? Returns { input, mode } or null.
export async function classifyDrop(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.png')) return { input: 'fileCharInput', mode: 'char' };
  if (name.endsWith('.charx')) return { input: 'fileCharxInput', mode: 'char' };
  if (name.endsWith('.md') || name.endsWith('.markdown')) return { input: 'filePromptInput', mode: 'prompt' }; // a prompt page
  if (!name.endsWith('.json')) return null;
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { return null; }
  if (looksLikeRegexJson(data)) return { input: 'fileRegexInput', mode: 'regex' };      // SillyTavern regex script(s)
  if (Array.isArray(data)) return { input: 'fileJanitorInput', mode: 'lore' };          // JanitorAI lorebook
  if (!isObj(data)) return null;
  if (data._version) return { input: 'syncImportFile', mode: null };                     // LoreOS backup
  if (data.format === 'loreos-prompt-pack') return { input: 'filePromptInput', mode: 'prompt' };
  if (data.spec && String(data.spec).startsWith('chara_card')) return { input: 'fileCharInput', mode: 'char' };
  if (isObj(data.data) && ('first_mes' in data.data || 'description' in data.data)) return { input: 'fileCharInput', mode: 'char' };
  if ('first_mes' in data && 'name' in data) return { input: 'fileCharInput', mode: 'char' }; // V1 card
  if (Array.isArray(data.starting_scenarios) || ('persona' in data && 'name' in data)) return { input: 'fileCharCompanionInput', mode: 'char' };
  if (Array.isArray(data.content)) return { input: 'fileSaucepanInput', mode: 'lore' };  // SaucepanAI lorebook
  if (data.entries !== undefined) return { input: 'fileInput', mode: 'lore' };           // SillyTavern lorebook
  if (Array.isArray(data.prompts) || 'openai_max_context' in data || 'temperature' in data) return { input: 'filePresetInput', mode: 'preset' };
  return null;
}

export async function handleDrop(files) {
  const list = [...files];
  if (!list.length) return;
  if (list.length > 1) toast('Drop one file at a time. Using the first.', 'info');
  const file = list[0];
  const target = await classifyDrop(file);
  const input = target && g(target.input);
  if (!input) { toast("Couldn't tell what \"" + file.name + '" is. Use the Import menus instead.', 'warn'); return; }
  if (target.mode) switchMode(target.mode);
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');

export function wireDropImport() {
  const hint = document.createElement('div');
  hint.id = 'dropHint';
  hint.textContent = 'Drop to import';
  document.body.append(hint);
  let depth = 0;
  const show = on => hint.classList.toggle('on', on);
  window.addEventListener('dragenter', e => { if (hasFiles(e)) { depth++; show(true); } });
  window.addEventListener('dragleave', e => { if (hasFiles(e)) { depth = Math.max(0, depth - 1); if (!depth) show(false); } });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; show(false);
    // Dropping onto a text box or a file picker keeps its normal behaviour
    if (e.target.closest && e.target.closest('input[type=file]')) return;
    handleDrop(e.dataTransfer.files);
  });
}
