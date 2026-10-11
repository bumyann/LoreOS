// ═══════════════════════════════════════════════════════
// HEADER FIT — keeps the editor toolbar on ONE row.
// Buttons marked .hdr-sec (the less-used ones) move into a "More" menu, last
// one first, only as far as needed to fit. Moving the real elements (not
// copies) keeps their click handlers. Re-runs on resize and on mode switch.
// ═══════════════════════════════════════════════════════
import { g } from './util.js';

function fitOne(box) {
  const more = box.querySelector('.hdr-more');
  if (!more) return;
  const menu = more.querySelector('.dd-menu');
  const secs = [...box.querySelectorAll('.hdr-sec')];
  // Start from the full row, then take items away until it fits
  secs.forEach(b => box.insertBefore(b, more));
  more.style.display = 'none';
  if (box.offsetParent === null) return; // hidden (other mode, or phone layout)

  const right = g('editor-header-right');
  const help = g('helpBtn');
  const helpW = help && help.offsetParent !== null ? help.offsetWidth + 8 : 0;
  const room = () => right.clientWidth - helpW;
  const fits = () => box.offsetWidth <= room();

  for (let i = secs.length - 1; i >= 0 && !fits(); i--) {
    menu.insertBefore(secs[i], menu.firstChild);
    more.style.display = '';
  }
}

let queued = false;
export function fitHeader() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    document.querySelectorAll('#editor-header .hdr-actions').forEach(fitOne);
  });
}

export function wireHeaderFit() {
  window.addEventListener('resize', fitHeader);
  // Fires when the Workshop view is first shown (its size goes from 0 to real) and on any layout change
  const right = g('editor-header-right');
  if (right && window.ResizeObserver) new ResizeObserver(fitHeader).observe(right);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeader);
  fitHeader();
}
