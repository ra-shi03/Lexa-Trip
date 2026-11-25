/**
 * On-page SEO analysis used by the CMS editor (live, as you type).
 * Returns a 0–100 score plus actionable checks — similar to Yoast/RankMath basics.
 */
const strip = (html = '') => String(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['a', 'an', 'the', 'in', 'at', 'of', 'for', 'and', 'to', 'with', 'near', 'on']);
/** Exact phrase OR every meaningful keyword word present (e.g. "bamboo saa resort udaipur" ⊂ "Bamboo Saa Resort & Spa Udaipur") */
const has = (text, kw) => {
  if (!kw) return false;
  const t = String(text || '').toLowerCase();
  const k = kw.toLowerCase().trim();
  if (t.includes(k)) return true;
  const words = k.split(/\s+/).filter((w) => w && !STOP.has(w));
  return words.length > 0 && words.every((w) => t.includes(w));
};

export function analyzeSeo(doc = {}, { url = '' } = {}) {
  const seo = doc.seo || {};
  const kw = (seo.primaryKeyword || '').trim();
  const title = seo.title || '';
  const desc = seo.metaDescription || '';
  const h1 = doc.content?.h1 || doc.name || doc.title || '';
  const sections = doc.content?.sections || [];
  const bodyHtml = [doc.description, doc.content?.intro, ...sections.map((s) => s.body), doc.summary].filter(Boolean).join(' ');
  const text = strip(bodyHtml);
  const words = text ? text.split(' ').length : 0;
  const images = [doc.heroImage, doc.coverImage, ...(doc.gallery || []), ...(doc.rooms || []).flatMap((r) => r.images || [])].filter((i) => i?.url);
  const missingAlt = images.filter((i) => !i.alt?.trim()).length;
  const internalLinks = (doc.internalLinks || []).length + (bodyHtml.match(/href="\/(?!\/)/g) || []).length;
  const h2Count = sections.filter((s) => s.heading && s.level !== 'h3').length;
  let schemaOk = true;
  if (seo.customSchema?.trim()) { try { JSON.parse(seo.customSchema); } catch { schemaOk = false; } }

  const checks = [
    { id: 'kw', label: 'Primary keyword set', ok: Boolean(kw), weight: 10 },
    { id: 'title-len', label: `SEO title length ${title.length}/60 (aim 45–60)`, ok: title.length >= 45 && title.length <= 60, warn: title.length > 0 && (title.length < 45 || title.length > 60), weight: 10 },
    { id: 'title-kw', label: 'Keyword in SEO title', ok: has(title, kw), weight: 10 },
    { id: 'desc-len', label: `Meta description ${desc.length}/160 (aim 120–160)`, ok: desc.length >= 120 && desc.length <= 160, warn: desc.length > 0 && (desc.length < 120 || desc.length > 160), weight: 10 },
    { id: 'desc-kw', label: 'Keyword in meta description', ok: has(desc, kw), weight: 6 },
    { id: 'h1', label: 'H1 heading set', ok: Boolean(h1), weight: 6 },
    { id: 'h1-kw', label: 'Keyword appears in H1', ok: has(h1, kw), weight: 6 },
    { id: 'slug-kw', label: 'URL slug is short & descriptive', ok: Boolean(doc.slug) && doc.slug.length <= 60 && doc.slug.split('-').length <= 8, weight: 5 },
    { id: 'h2', label: `${h2Count} H2 sections (aim 3+)`, ok: h2Count >= 3, warn: h2Count > 0 && h2Count < 3, weight: 6 },
    { id: 'words', label: `${words} words of content (aim 300+)`, ok: words >= 300, warn: words >= 120 && words < 300, weight: 10 },
    { id: 'kw-body', label: 'Keyword used in body content', ok: has(text, kw), weight: 5 },
    { id: 'alt', label: images.length ? `${images.length - missingAlt}/${images.length} images have alt text` : 'Add at least one image', ok: images.length > 0 && missingAlt === 0, warn: images.length > 0 && missingAlt > 0, weight: 6 },
    { id: 'links', label: `${internalLinks} internal links (aim 2+)`, ok: internalLinks >= 2, warn: internalLinks === 1, weight: 5 },
    { id: 'faq', label: `${(doc.faqs || []).length} FAQs (adds FAQ rich results)`, ok: (doc.faqs || []).length >= 2, weight: 3 },
    { id: 'schema', label: schemaOk ? 'Structured data valid' : 'Custom schema is not valid JSON', ok: schemaOk && seo.autoSchema !== false || Boolean(seo.customSchema?.trim() && schemaOk), weight: 2 },
  ];
  const max = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.reduce((s, c) => s + (c.ok ? c.weight : c.warn ? c.weight / 2 : 0), 0);
  const score = Math.round((got / max) * 100);
  return {
    score,
    grade: score >= 80 ? 'Good' : score >= 55 ? 'Needs work' : 'Poor',
    checks,
    serp: { title: title || h1, url, description: desc || text.slice(0, 155) },
    indexable: seo.robots?.index !== false,
  };
}
