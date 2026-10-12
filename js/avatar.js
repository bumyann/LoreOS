// ═══════════════════════════════════════════════════════
// AVATAR — sizing of character avatars before they are stored (see Settings -> Storage).
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// AVATAR SIZING
// Avatars are stored as text (a base64 data URL) inside the same
// JSON blob as everything else, which inflates them ~33% over the
// real file size. A single 1.8MB import was eating a third of the
// entire ~5MB browser storage budget. Character cards are displayed
// small everywhere (SillyTavern, JanitorAI, Saucepan), so we resize
// on the way in and re-encode as WebP.
//
// Users who genuinely want full-resolution avatars can turn this off
// in Settings; the trade-off is storage.
// ═══════════════════════════════════════════════════════

export const AVATAR_MAX = 512;        // px, longest edge
export const AVATAR_QUALITY = 0.88;   // WebP quality

export function keepFullAvatars() {
  try { return !!(JSON.parse(localStorage.getItem('aet_settings') || '{}').keepFullAvatars); }
  catch(e) { return false; }
}

// Takes a data URL, returns a smaller data URL (or the original if
// it's already small enough / the user opted out / anything fails).
export function downscaleAvatar(dataUrl, force = false) {
  return new Promise(resolve => {
    if (!dataUrl) { resolve(dataUrl); return; }
    if (!force && keepFullAvatars()) { resolve(dataUrl); return; }

    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { resolve(dataUrl); return; }

        const scale = Math.min(1, AVATAR_MAX / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = tw; canvas.height = th;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, tw, th);

        // WebP is dramatically smaller than PNG for photographic
        // avatars. Fall back to PNG if the browser won't encode it.
        let out = canvas.toDataURL('image/webp', AVATAR_QUALITY);
        if (!out || out.indexOf('data:image/webp') !== 0) {
          out = canvas.toDataURL('image/png');
        }
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch(e) {
        console.error('[LoreOS] avatar downscale failed:', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Shrinks any picture to fit a box (always, unlike avatars) and returns a WebP data URL. Used for the
// small pictures on Library items and the wide banners on worlds. Resolves '' when the file is not an image.
export function resizeImage(dataUrl, maxW, maxH = maxW, quality = 0.82) {
  return new Promise(resolve => {
    if (!dataUrl) { resolve(''); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { resolve(''); return; }
        const scale = Math.min(1, maxW / w, maxH / h);
        const tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = tw; canvas.height = th;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, tw, th);
        let out = canvas.toDataURL('image/webp', quality);
        if (!out || out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      } catch (e) { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}
export const readFileAsDataUrl = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
