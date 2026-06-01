/**
 * Notes are stored as rich-text HTML (from the TipTap editor). When feeding
 * notes to Claude (triage, explain) we want clean plain text, not markup.
 * This is a server-safe stripper (no DOM) tuned for the small set of tags the
 * editor emits. Plain-text legacy notes pass through unchanged.
 */
export function notesToPlainText(html: string | null): string | null {
  if (!html) return null;
  const text = html
    .replace(/<li[^>]*data-checked="true"[^>]*>/gi, "\n[x] ")
    .replace(/<li[^>]*data-checked="false"[^>]*>/gi, "\n[ ] ")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}
