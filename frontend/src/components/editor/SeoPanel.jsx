import { useMemo, useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, XCircle, Globe } from 'lucide-react';
import { Input, Textarea, TagInput, Toggle, Select, Button, Badge, Alert } from '../ui';
import { analyzeSeo } from '../../lib/seoScore';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { cx, slugify } from '../../lib/format';

const Counter = ({ n, min, max }) => <span className={cx('text-xs font-semibold', n === 0 ? 'text-muted' : n < min || n > max ? 'text-warning' : 'text-success')}>{n}/{max}</span>;

/**
 * Independent SEO settings for every hotel / itinerary / article / category / location:
 * title, meta description, slug, keywords (primary / secondary / long-tail), canonical,
 * index/noindex, OG, sitemap, schema (auto + custom JSON-LD) — plus SERP preview,
 * live score and the AI SEO writer.
 */
export function SeoPanel({ doc, onChange, onSlug, publicUrl, aiContext }) {
  const seo = doc.seo || {};
  const set = (patch) => onChange({ ...seo, ...patch });
  const report = useMemo(() => analyzeSeo(doc, { url: publicUrl }), [doc, publicUrl]);
  const [ai, setAi] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const toast = useToast();

  const askAi = async () => {
    setAiBusy(true);
    try { const { data } = await api.post('/admin/seo/ai/assist', { ...aiContext, keyword: seo.primaryKeyword }); setAi(data); } catch (e) { toast.error(e); } finally { setAiBusy(false); }
  };
  const tone = report.score >= 80 ? 'success' : report.score >= 55 ? 'warning' : 'danger';

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="card card-pad space-y-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-extrabold">Search appearance</h3><Button size="sm" variant="soft" icon={Sparkles} loading={aiBusy} onClick={askAi}>AI suggest</Button></div>
          <div><div className="flex items-center justify-between"><label className="field-label">SEO title</label><Counter n={(seo.title || '').length} min={45} max={60} /></div><input className="input" value={seo.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Shown as the blue link in Google" /></div>
          <div><div className="flex items-center justify-between"><label className="field-label">Meta description</label><Counter n={(seo.metaDescription || '').length} min={120} max={160} /></div><textarea className="input" rows={3} value={seo.metaDescription || ''} onChange={(e) => set({ metaDescription: e.target.value })} placeholder="Compelling summary with a call to action" /></div>
          {onSlug && <Input label="URL slug" value={doc.slug || ''} onChange={(e) => onSlug(slugify(e.target.value))} hint={publicUrl ? `Public URL: ${publicUrl}` : 'Lowercase words separated by hyphens'} />}
        </section>

        <section className="card card-pad space-y-4">
          <h3 className="font-extrabold">Keywords</h3>
          <Input label="Primary keyword" value={seo.primaryKeyword || ''} onChange={(e) => set({ primaryKeyword: e.target.value })} placeholder="e.g. bamboo saa resort udaipur" />
          <TagInput label="Secondary keywords" value={seo.secondaryKeywords || []} onChange={(v) => set({ secondaryKeywords: v })} />
          <TagInput label="Long-tail keywords" value={seo.longTailKeywords || []} onChange={(v) => set({ longTailKeywords: v })} />
        </section>

        <section className="card card-pad space-y-4">
          <h3 className="font-extrabold">Indexing & canonical</h3>
          <Toggle label="Allow search engines to index this page" description="Off = noindex (page stays reachable but Google won’t list it)" checked={seo.robots?.index !== false} onChange={(v) => set({ robots: { ...(seo.robots || {}), index: v } })} />
          <Toggle label="Follow links on this page" checked={seo.robots?.follow !== false} onChange={(v) => set({ robots: { ...(seo.robots || {}), follow: v } })} />
          <Input label="Canonical URL" value={seo.canonicalUrl || ''} onChange={(e) => set({ canonicalUrl: e.target.value })} hint="Leave empty to use this page’s own URL (recommended)" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-end pb-2 sm:col-span-1"><Toggle label="Include in sitemap" checked={seo.sitemap?.include !== false} onChange={(v) => set({ sitemap: { ...(seo.sitemap || {}), include: v } })} /></div>
            <Select label="Priority" value={seo.sitemap?.priority ?? 0.7} onChange={(e) => set({ sitemap: { ...(seo.sitemap || {}), priority: Number(e.target.value) } })} options={[1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.3].map((v) => ({ value: v, label: v }))} />
            <Select label="Change frequency" value={seo.sitemap?.changefreq || 'weekly'} onChange={(e) => set({ sitemap: { ...(seo.sitemap || {}), changefreq: e.target.value } })} options={['daily', 'weekly', 'monthly', 'yearly']} />
          </div>
        </section>

        <section className="card card-pad space-y-4">
          <h3 className="font-extrabold">Social & structured data</h3>
          <div className="grid gap-3 sm:grid-cols-2"><Input label="OG title" value={seo.ogTitle || ''} onChange={(e) => set({ ogTitle: e.target.value })} /><Input label="OG image URL" value={seo.ogImage || ''} onChange={(e) => set({ ogImage: e.target.value })} /></div>
          <Textarea label="OG description" rows={2} value={seo.ogDescription || ''} onChange={(e) => set({ ogDescription: e.target.value })} />
          <Toggle label="Auto-generate schema markup" description="Hotel/Resort, TouristTrip, Article, BreadcrumbList and FAQPage JSON-LD from your content" checked={seo.autoSchema !== false} onChange={(v) => set({ autoSchema: v })} />
          <Textarea label="Custom schema (JSON-LD, optional)" rows={5} className="font-mono" value={seo.customSchema || ''} onChange={(e) => set({ customSchema: e.target.value })} hint='Added after the auto schema, e.g. {"@context":"https://schema.org","@type":"Offer", …}' />
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
        <div className="card card-pad">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted"><Globe size={14} />Google preview</p>
          <div className="rounded-brand bg-white p-3 font-[Arial,sans-serif]" style={{ color: '#202124' }}>
            <p className="truncate text-xs" style={{ color: '#4d5156' }}>{(publicUrl || '').replace(/^https?:\/\//, '')}</p>
            <p className="mt-0.5 line-clamp-2 text-lg leading-snug" style={{ color: '#1a0dab' }}>{report.serp.title || 'SEO title'}</p>
            <p className="mt-0.5 line-clamp-2 text-sm" style={{ color: '#4d5156' }}>{report.serp.description || 'Meta description'}</p>
          </div>
          {!report.indexable && <Badge tone="warning" className="mt-3">noindex — hidden from Google</Badge>}
        </div>
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between"><p className="font-extrabold">SEO score</p><Badge tone={tone} className="h-7 text-sm">{report.score}/100 · {report.grade}</Badge></div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface"><div className={cx('h-full rounded-full', tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-danger')} style={{ width: `${report.score}%` }} /></div>
          <ul className="space-y-2 text-sm">
            {report.checks.map((c) => <li key={c.id} className="flex items-start gap-2">{c.ok ? <CheckCircle2 size={16} className="mt-0.5 flex-none text-success" /> : c.warn ? <AlertTriangle size={16} className="mt-0.5 flex-none text-warning" /> : <XCircle size={16} className="mt-0.5 flex-none text-danger" />}<span className={c.ok ? 'text-muted' : ''}>{c.label}</span></li>)}
          </ul>
        </div>
        {ai && (
          <div className="card card-pad space-y-3 border-primary/40">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-extrabold"><Sparkles size={16} className="text-primary" />AI suggestions</p><Badge>{ai.engine}</Badge></div>
            {ai.warning && <Alert tone="warning">{ai.warning}</Alert>}
            {[['title', 'Title'], ['metaDescription', 'Meta description'], ['primaryKeyword', 'Primary keyword']].map(([k, l]) => ai[k] && (
              <div key={k} className="rounded-brand bg-surface p-3 text-sm"><p className="text-xs font-bold text-muted">{l}</p><p className="mt-1">{ai[k]}</p><Button size="xs" variant="soft" className="mt-2" onClick={() => set({ [k]: ai[k] })}>Apply</Button></div>
            ))}
            {ai.secondaryKeywords?.length > 0 && <div className="rounded-brand bg-surface p-3 text-sm"><p className="text-xs font-bold text-muted">Keywords</p><p className="mt-1">{[...ai.secondaryKeywords, ...(ai.longTailKeywords || [])].join(', ')}</p><Button size="xs" variant="soft" className="mt-2" onClick={() => set({ secondaryKeywords: ai.secondaryKeywords, longTailKeywords: ai.longTailKeywords || seo.longTailKeywords })}>Apply keywords</Button></div>}
            {ai.outline?.length > 0 && <div className="rounded-brand bg-surface p-3 text-sm"><p className="text-xs font-bold text-muted">Suggested H2 outline</p><ol className="mt-1 list-decimal pl-5">{ai.outline.map((o) => <li key={o}>{o}</li>)}</ol></div>}
            {ai.faqs?.length > 0 && <p className="text-xs text-muted">{ai.faqs.length} FAQ ideas generated — review facts before adding them in the FAQs tab.</p>}
            <p className="text-[11px] text-muted">Always verify AI suggestions for factual accuracy before publishing.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
