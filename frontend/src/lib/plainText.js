/** Vendors write plain text; guest pages render HTML. These two helpers convert between the two safely. */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Stored HTML → friendly plain text (paragraphs separated by a blank line, list items as "• …"). */
export function htmlToText(html = '') {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return html; // already plain
  const doc = new DOMParser().parseFromString(
    html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, '\n\n').replace(/<li[^>]*>/gi, '• ').replace(/<\/li>/gi, '\n'),
    'text/html',
  );
  return (doc.body.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Plain text → safe HTML: blank line = new paragraph, single line break kept, "• " / "- " lines become a list. */
export function textToHtml(text = '') {
  return text.trim().split(/\n{2,}/).map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    if (lines.every((l) => /^([•\-*])\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^([•\-*])\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}
