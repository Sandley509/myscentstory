/**
 * Minimal HTML sanitiser for staff-authored descriptions. Strips scripts,
 * embeds, inline event handlers and javascript: URLs; keeps formatting.
 */
export function sanitizeHtml(html: string): string {
  return (html ?? '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base)[\s\S]*?(<\s*\/\s*\1\s*>|\/?>)/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*(javascript|vbscript|data):[^"']*\2/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*expression[^"]*"|'[^']*expression[^']*')/gi, '')
    .trim()
    .slice(0, 100_000);
}
