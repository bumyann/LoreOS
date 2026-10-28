// Small helpers shared by the format adapters. Pure: no DOM, no storage.

export const str = v => (typeof v === 'string' ? v : '');

// Several text fields that a format only has one box for: with more than one filled in, each gets a [Header]
export function foldSections(pairs) {
  const parts = pairs.map(([h, t]) => [h, str(t)]).filter(p => p[1].trim());
  if (parts.length <= 1) return parts.length ? parts[0][1] : '';
  return parts.map(([h, t]) => '[' + h + ']\n' + t).join('\n\n');
}

export const countFilled = (d, keys) => keys.filter(k => str(d[k]).trim()).length;

// A file-system and archive-path safe name
export const slug = s => String(s || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
