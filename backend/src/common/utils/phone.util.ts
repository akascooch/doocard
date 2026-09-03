/**
 * Canonical Iranian mobile: 09xxxxxxxxx (11 digits).
 * Accepts Persian/Arabic digits, +98 / 98 prefixes, spaces and punctuation.
 */
export function normalizeIranMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let p = String(raw)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s\-()]/g, '')
    .trim();

  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);

  if (!/^09\d{9}$/.test(p)) return null;
  return p;
}
