/**
 * The visitor's country (ISO code), from the headers your host adds:
 * Vercel, Cloudflare, Netlify or CloudFront. Null when unknown (e.g. locally).
 */
export function countryFromHeaders(h: Headers): string | null {
  const raw =
    h.get('x-vercel-ip-country') ??
    h.get('cf-ipcountry') ??
    h.get('x-nf-country') ??
    h.get('cloudfront-viewer-country') ??
    h.get('x-country-code') ??
    '';
  return /^[A-Z]{2}$/i.test(raw) && !['XX', 'T1'].includes(raw.toUpperCase()) ? raw.toUpperCase() : null;
}
