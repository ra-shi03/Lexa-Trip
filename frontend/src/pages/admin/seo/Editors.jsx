import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Plus, ExternalLink, Route } from 'lucide-react';
import { WorkflowBar } from '../../../components/editor/WorkflowBar';
import { SeoPanel } from '../../../components/editor/SeoPanel';
import { ContentEditor, FaqEditor, LinksEditor, StringList } from '../../../components/editor/ContentEditors';
import { Repeater } from '../../../components/editor/Repeater';
import { RichText } from '../../../components/editor/RichText';
import { useDoc } from '../../../components/editor/useDoc';
import { ImageUploader, SingleImage } from '../../../components/panel/ImageUploader';
import { Tabs, Input, Textarea, Select, TagInput, PageLoader, ErrorState, Button, StatusBadge, Alert, Checkbox, Badge } from '../../../components/ui';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { useLocations } from './SeoHome';
import { slugify, timeAgo } from '../../../lib/format';

const UPLOAD = '/admin/uploads/images';
const idOf = (x) => (x && typeof x === 'object' ? x._id : x);

function EditorHeader({ back, title, subtitle }) {
  return (
    <div className="mb-2">
      <Link to={back} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={15} />Back</Link>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

function LocationPicker({ doc, set, withCity = true, required }) {
  const { states, cities } = useLocations(idOf(doc.state));
  return (
    <>
      <Select label="State" required={required} placeholder="Select state" value={idOf(doc.state) || ''} onChange={(e) => set({ state: e.target.value, city: withCity ? '' : doc.city })} options={states.map((s) => ({ value: s._id, label: s.name }))} />
      {withCity && <Select label="City" required={required} placeholder={required ? 'Select city' : 'State-level (no city)'} value={idOf(doc.city) || ''} onChange={(e) => set({ city: e.target.value || null })} options={cities.map((c) => ({ value: c._id, label: c.name }))} />}
    </>
  );
}

// ═══════════════════════════ HOTEL ═══════════════════════════
const HOTEL_DEFAULTS = { name: '', slug: '', propertyType: 'Hotel', starRating: '', state: '', city: '', categories: [], shortDescription: '', description: '', address: {}, geo: {}, contact: {}, checkInTime: '14:00', checkOutTime: '11:00', priceFrom: '', priceRange: '', rooms: [], facilities: [], amenities: [], policies: [], heroImage: null, gallery: [], content: { h1: '', intro: '', sections: [] }, faqs: [], seo: { robots: { index: true, follow: true }, autoSchema: true, secondaryKeywords: [], longTailKeywords: [] }, internalLinks: [], status: 'draft' };

export function HotelEditor() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const defaults = { ...HOTEL_DEFAULTS, state: sp.get('state') || '', city: sp.get('city') || '', categories: sp.get('category') ? [sp.get('category')] : [] };
  const { doc, set, save, saving, dirty, reload, error, isNew } = useDoc('/admin/seo/hotels', id, defaults, { onCreated: (d) => navigate(`/admin/seo/hotels/${d._id}`, { replace: true }) });
  const [tab, setTab] = useState('details');
  const { data: cats } = useApi(() => api.get('/admin/seo/hotel-categories', { city: idOf(doc?.city), limit: 50 }), [idOf(doc?.city)], { enabled: Boolean(idOf(doc?.city)) });
  const { data: properties } = useApi(() => api.get('/admin/properties', { city: idOf(doc?.city), limit: 100, status: 'approved' }), [idOf(doc?.city)], { enabled: Boolean(idOf(doc?.city)) });
  if (error) return <ErrorState error={error} />;
  if (!doc) return <PageLoader />;
  const setIn = (k, patch) => set({ [k]: { ...(doc[k] || {}), ...patch } });
  const catIds = (doc.categories || []).map(idOf);

  return (
    <div>
      <EditorHeader back={`/admin/seo/explorer${idOf(doc.state) ? `?state=${idOf(doc.state)}&city=${idOf(doc.city)}` : ''}`} title={isNew ? 'New hotel profile' : doc.name} subtitle={doc.publicUrl} />
      <WorkflowBar doc={doc} endpoint="/admin/seo/hotels" type="SeoHotel" onSave={save} saving={saving} dirty={dirty} onReload={reload} />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'details', label: 'Details' }, { value: 'rooms', label: `Rooms (${doc.rooms?.length || 0})` }, { value: 'amenities', label: 'Facilities' }, { value: 'gallery', label: `Images (${(doc.gallery?.length || 0) + (doc.heroImage?.url ? 1 : 0)})` }, { value: 'content', label: 'Content' }, { value: 'faqs', label: `FAQs (${doc.faqs?.length || 0})` }, ...(!isNew ? [{ value: 'itineraries', label: `Itineraries (${doc.itineraries?.length || 0})` }] : []), { value: 'seo', label: 'SEO' }, { value: 'links', label: 'Internal links' }]} />

      {tab === 'details' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <h3 className="font-extrabold sm:col-span-2">Hotel</h3>
            <Input label="Hotel name" required className="sm:col-span-2" value={doc.name} onChange={(e) => set({ name: e.target.value, ...(isNew ? { slug: slugify(e.target.value) } : {}) })} />
            <LocationPicker doc={doc} set={set} required />
            <Select label="Property type (schema)" value={doc.propertyType} onChange={(e) => set({ propertyType: e.target.value })} options={['Hotel', 'Resort', 'Villa', 'Hostel', 'Guest House', 'Homestay']} />
            <Select label="Star rating" value={doc.starRating ?? ''} onChange={(e) => set({ starRating: e.target.value ? Number(e.target.value) : undefined })} placeholder="Not rated" options={[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} star` }))} />
            <div className="sm:col-span-2"><p className="field-label">Hotel categories (city listing pages)</p><div className="flex flex-wrap gap-3">{(cats || []).map((c) => <Checkbox key={c._id} label={c.name} checked={catIds.includes(c._id)} onChange={(on) => set({ categories: on ? [...catIds, c._id] : catIds.filter((x) => x !== c._id) })} />)}{!cats?.length && <p className="text-xs text-muted">Select a city with categories (Explorer → city → Categories → Generate).</p>}</div></div>
            <Select label="Linked bookable property (optional)" className="sm:col-span-2" placeholder="Not linked — 'Book now' opens city search" value={idOf(doc.property) || ''} onChange={(e) => set({ property: e.target.value || null })} options={(properties || []).map((p) => ({ value: p._id, label: p.name }))} hint="Shows live price & a direct booking button on the SEO page" />
            <Textarea label="Short description" rows={2} className="sm:col-span-2" maxLength={400} value={doc.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} />
          </section>
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <h3 className="font-extrabold sm:col-span-2">Address, location & contact</h3>
            <Input label="Address line" className="sm:col-span-2" value={doc.address?.line1 || ''} onChange={(e) => setIn('address', { line1: e.target.value })} />
            <Input label="Area" value={doc.address?.area || ''} onChange={(e) => setIn('address', { area: e.target.value })} />
            <Input label="Pincode" value={doc.address?.pincode || ''} onChange={(e) => setIn('address', { pincode: e.target.value })} />
            <Input label="Full address (display)" className="sm:col-span-2" value={doc.address?.full || ''} onChange={(e) => setIn('address', { full: e.target.value })} />
            <Input label="Latitude" type="number" value={doc.geo?.lat ?? ''} onChange={(e) => setIn('geo', { lat: e.target.value ? Number(e.target.value) : undefined })} />
            <Input label="Longitude" type="number" value={doc.geo?.lng ?? ''} onChange={(e) => setIn('geo', { lng: e.target.value ? Number(e.target.value) : undefined })} />
            <Input label="Phone" value={doc.contact?.phone || ''} onChange={(e) => setIn('contact', { phone: e.target.value })} />
            <Input label="Email" value={doc.contact?.email || ''} onChange={(e) => setIn('contact', { email: e.target.value })} />
            <Input label="Website" className="sm:col-span-2" value={doc.contact?.website || ''} onChange={(e) => setIn('contact', { website: e.target.value })} />
            <Input label="Check-in" value={doc.checkInTime || ''} onChange={(e) => set({ checkInTime: e.target.value })} />
            <Input label="Check-out" value={doc.checkOutTime || ''} onChange={(e) => set({ checkOutTime: e.target.value })} />
            <Input label="Price from (₹/night)" type="number" value={doc.priceFrom ?? ''} onChange={(e) => set({ priceFrom: e.target.value ? Number(e.target.value) : undefined })} />
            <Input label="Price range (schema)" placeholder="₹₹₹" value={doc.priceRange || ''} onChange={(e) => set({ priceRange: e.target.value })} />
          </section>
          <section className="card card-pad xl:col-span-2"><h3 className="mb-3 font-extrabold">Property description</h3><RichText value={doc.description} onChange={(v) => set({ description: v })} /></section>
          <section className="card card-pad xl:col-span-2"><h3 className="mb-3 font-extrabold">Policies</h3><Repeater items={doc.policies || []} onChange={(v) => set({ policies: v })} newItem={() => ({ title: '', text: '' })} addLabel="Add policy" render={(p, u) => <div className="grid gap-3 sm:grid-cols-[200px_1fr]"><Input placeholder="Title" value={p.title} onChange={(e) => u({ title: e.target.value })} /><Input placeholder="Policy text" value={p.text} onChange={(e) => u({ text: e.target.value })} /></div>} /></section>
        </div>
      )}

      {tab === 'rooms' && (
        <div className="card card-pad">
          <Repeater items={doc.rooms || []} onChange={(v) => set({ rooms: v })} newItem={() => ({ name: '', description: '', occupancy: '', bedType: '', sizeSqft: '', view: '', priceFrom: '', amenities: [], images: [] })} addLabel="Add room type" render={(r, u) => (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Room name" className="sm:col-span-2" value={r.name} onChange={(e) => u({ name: e.target.value })} />
              <Input label="Price from" type="number" value={r.priceFrom ?? ''} onChange={(e) => u({ priceFrom: e.target.value ? Number(e.target.value) : undefined })} />
              <Input label="Occupancy" placeholder="2 adults + 1 child" value={r.occupancy || ''} onChange={(e) => u({ occupancy: e.target.value })} />
              <Input label="Bed" value={r.bedType || ''} onChange={(e) => u({ bedType: e.target.value })} />
              <Input label="Size (sq ft)" type="number" value={r.sizeSqft ?? ''} onChange={(e) => u({ sizeSqft: e.target.value ? Number(e.target.value) : undefined })} />
              <Input label="View" value={r.view || ''} onChange={(e) => u({ view: e.target.value })} />
              <Textarea label="Description" rows={2} className="sm:col-span-3" value={r.description || ''} onChange={(e) => u({ description: e.target.value })} />
              <TagInput label="Room amenities" className="sm:col-span-3" value={r.amenities || []} onChange={(v) => u({ amenities: v })} />
              <div className="sm:col-span-3"><ImageUploader value={r.images || []} onChange={(v) => u({ images: v })} uploadUrl={UPLOAD} max={8} /></div>
            </div>
          )} />
        </div>
      )}

      {tab === 'amenities' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card card-pad"><h3 className="mb-3 font-extrabold">Facilities</h3><StringList value={doc.facilities} onChange={(v) => set({ facilities: v })} placeholder="e.g. Infinity pool" addLabel="Add facility" /></section>
          <section className="card card-pad"><h3 className="mb-3 font-extrabold">Amenities</h3><StringList value={doc.amenities} onChange={(v) => set({ amenities: v })} placeholder="e.g. Free WiFi" addLabel="Add amenity" /></section>
        </div>
      )}

      {tab === 'gallery' && (
        <div className="space-y-6">
          <section className="card card-pad"><SingleImage label="Hero image (shown first & used for social sharing)" value={doc.heroImage} onChange={(v) => set({ heroImage: v })} uploadUrl={UPLOAD} /></section>
          <section className="card card-pad"><p className="field-label">Gallery</p><p className="mb-3 text-sm text-muted">Every image needs descriptive alt text (e.g. “Infinity pool at sunset, Bamboo Saa Resort Udaipur”).</p><ImageUploader value={doc.gallery || []} onChange={(v) => set({ gallery: v })} uploadUrl={UPLOAD} /></section>
        </div>
      )}

      {tab === 'content' && <div className="card card-pad"><ContentEditor value={doc.content} onChange={(v) => set({ content: v })} h1Placeholder={doc.name} /></div>}
      {tab === 'faqs' && <div className="card card-pad"><FaqEditor value={doc.faqs} onChange={(v) => set({ faqs: v })} /></div>}
      {tab === 'itineraries' && (
        <div className="card card-pad">
          <div className="mb-4 flex items-center justify-between"><p className="text-sm text-muted">Each hotel supports multiple itineraries, each with its own public URL &amp; SEO.</p><Button size="sm" icon={Plus} to={`/admin/seo/itineraries/new?hotel=${doc._id}`}>New itinerary</Button></div>
          <div className="divide-y divide-line rounded-brand border border-line">
            {doc.itineraries?.map((it) => <Link key={it._id} to={`/admin/seo/itineraries/${it._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface"><Route size={17} className="text-primary" /><span className="flex-1"><b className="text-sm">{it.title}</b><span className="block text-xs text-muted">{it.durationDays} days · updated {timeAgo(it.updatedAt)}</span></span><StatusBadge status={it.status} /></Link>)}
            {!doc.itineraries?.length && <p className="p-4 text-sm text-muted">No itineraries yet.</p>}
          </div>
        </div>
      )}
      {tab === 'seo' && <SeoPanel doc={doc} onChange={(seo) => set({ seo })} onSlug={(slug) => set({ slug })} publicUrl={doc.absoluteUrl} aiContext={{ entityType: 'hotel', name: doc.name, city: doc.city?.name, state: doc.state?.name, context: `${doc.shortDescription || ''}\nFacilities: ${(doc.facilities || []).join(', ')}\nAmenities: ${(doc.amenities || []).join(', ')}\nRooms: ${(doc.rooms || []).map((r) => r.name).join(', ')}` }} />}
      {tab === 'links' && <div className="card card-pad"><Alert className="mb-4">Breadcrumbs, category links, sibling hotels, itineraries and related articles are linked automatically. Add extra contextual links here.</Alert><LinksEditor value={doc.internalLinks} onChange={(v) => set({ internalLinks: v })} /></div>}
    </div>
  );
}

// ═══════════════════════════ ITINERARY ═══════════════════════════
const IT_DEFAULTS = { hotel: '', title: '', slug: '', durationDays: 3, durationNights: 2, travellerType: '', summary: '', heroImage: null, priceFrom: '', days: [], experiences: [], dining: [], facilities: [], nearbyAttractions: [], guestInfo: { tips: [] }, content: { h1: '', intro: '', sections: [] }, faqs: [], seo: { robots: { index: true, follow: true }, autoSchema: true }, internalLinks: [], status: 'draft' };

export function ItineraryEditor() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { doc, set, save, saving, dirty, reload, error, isNew } = useDoc('/admin/seo/itineraries', id, { ...IT_DEFAULTS, hotel: sp.get('hotel') || '' }, { onCreated: (d) => navigate(`/admin/seo/itineraries/${d._id}`, { replace: true }) });
  const [tab, setTab] = useState('overview');
  const { data: hotels } = useApi(() => api.get('/admin/seo/hotels', { limit: 200 }), [], { enabled: isNew });
  if (error) return <ErrorState error={error} />;
  if (!doc) return <PageLoader />;
  const hotelId = idOf(doc.hotel);
  const g = doc.guestInfo || {};
  return (
    <div>
      <EditorHeader back={hotelId ? `/admin/seo/hotels/${hotelId}` : '/admin/seo/explorer'} title={isNew ? 'New itinerary' : doc.title} subtitle={doc.hotel?.name ? `Itinerary for ${doc.hotel.name}` : ''} />
      <WorkflowBar doc={doc} endpoint="/admin/seo/itineraries" type="Itinerary" onSave={save} saving={saving} dirty={dirty} onReload={reload} />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'days', label: `Day-wise (${doc.days?.length || 0})` }, { value: 'experiences', label: 'Experiences & dining' }, { value: 'attractions', label: 'Nearby attractions' }, { value: 'guest', label: 'Guest info' }, { value: 'content', label: 'Content' }, { value: 'faqs', label: 'FAQs' }, { value: 'seo', label: 'SEO' }, { value: 'links', label: 'Links' }]} />

      {tab === 'overview' && (
        <div className="card card-pad grid gap-4 sm:grid-cols-2">
          {isNew && <Select label="Hotel" required className="sm:col-span-2" placeholder="Select hotel" value={hotelId || ''} onChange={(e) => set({ hotel: e.target.value })} options={(hotels || []).map((h) => ({ value: h._id, label: `${h.name} · ${h.city?.name}` }))} />}
          <Input label="Itinerary title" required className="sm:col-span-2" value={doc.title} onChange={(e) => set({ title: e.target.value, ...(isNew ? { slug: slugify(e.target.value) } : {}) })} />
          <Input label="Days" type="number" min={1} value={doc.durationDays} onChange={(e) => set({ durationDays: Number(e.target.value) })} />
          <Input label="Nights" type="number" min={0} value={doc.durationNights} onChange={(e) => set({ durationNights: Number(e.target.value) })} />
          <Select label="Ideal for" placeholder="Anyone" value={doc.travellerType} onChange={(e) => set({ travellerType: e.target.value })} options={['Couples', 'Families', 'Friends', 'Solo travellers', 'Business', 'Seniors']} />
          <Input label="Price from (₹, optional)" type="number" value={doc.priceFrom ?? ''} onChange={(e) => set({ priceFrom: e.target.value ? Number(e.target.value) : undefined })} />
          <Textarea label="Summary" rows={3} className="sm:col-span-2" value={doc.summary} onChange={(e) => set({ summary: e.target.value })} />
          <div className="sm:col-span-2"><SingleImage label="Hero image" value={doc.heroImage} onChange={(v) => set({ heroImage: v })} uploadUrl={UPLOAD} /></div>
          <div className="sm:col-span-2"><p className="field-label">Facilities & amenities used</p><StringList value={doc.facilities} onChange={(v) => set({ facilities: v })} addLabel="Add facility" /></div>
        </div>
      )}
      {tab === 'days' && (
        <div className="card card-pad">
          <Repeater items={doc.days || []} onChange={(v) => set({ days: v.map((d, i) => ({ ...d, day: i + 1 })) })} newItem={() => ({ day: (doc.days?.length || 0) + 1, title: '', description: '', activities: [], meals: [] })} addLabel="Add day" render={(d, u) => (
            <div className="space-y-3">
              <div className="flex items-center gap-3"><Badge tone="navy" className="h-8 px-3">Day {d.day}</Badge><input className="input flex-1" placeholder="Day title" value={d.title} onChange={(e) => u({ title: e.target.value })} /></div>
              <RichText minimal value={d.description} onChange={(v) => u({ description: v })} />
              <Repeater compact title="Activities" items={d.activities || []} onChange={(v) => u({ activities: v })} newItem={() => ({ time: '', title: '', description: '' })} addLabel="Add activity" render={(a, ua) => <div className="grid gap-2 sm:grid-cols-[90px_1fr_1.5fr]"><input className="input input-sm" placeholder="09:00" value={a.time} onChange={(e) => ua({ time: e.target.value })} /><input className="input input-sm" placeholder="Activity" value={a.title} onChange={(e) => ua({ title: e.target.value })} /><input className="input input-sm" placeholder="Details" value={a.description} onChange={(e) => ua({ description: e.target.value })} /></div>} />
              <div className="flex flex-wrap gap-3">{['Breakfast', 'Lunch', 'Dinner'].map((m) => <Checkbox key={m} label={m} checked={(d.meals || []).includes(m)} onChange={(on) => u({ meals: on ? [...(d.meals || []), m] : d.meals.filter((x) => x !== m) })} />)}</div>
            </div>
          )} />
        </div>
      )}
      {tab === 'experiences' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="card card-pad"><h3 className="mb-3 font-extrabold">Hotel experiences & activities</h3><Repeater items={doc.experiences || []} onChange={(v) => set({ experiences: v })} newItem={() => ({ title: '', description: '' })} addLabel="Add experience" render={(x, u) => <div className="space-y-2"><Input placeholder="Title" value={x.title} onChange={(e) => u({ title: e.target.value })} /><Textarea rows={2} placeholder="Description" value={x.description} onChange={(e) => u({ description: e.target.value })} /></div>} /></section>
          <section className="card card-pad"><h3 className="mb-3 font-extrabold">Dining</h3><Repeater items={doc.dining || []} onChange={(v) => set({ dining: v })} newItem={() => ({ name: '', cuisine: '', timings: '', description: '' })} addLabel="Add restaurant" render={(x, u) => <div className="grid gap-2 sm:grid-cols-3"><Input placeholder="Name" value={x.name} onChange={(e) => u({ name: e.target.value })} /><Input placeholder="Cuisine" value={x.cuisine} onChange={(e) => u({ cuisine: e.target.value })} /><Input placeholder="Timings" value={x.timings} onChange={(e) => u({ timings: e.target.value })} /><Textarea rows={2} className="sm:col-span-3" placeholder="Description" value={x.description} onChange={(e) => u({ description: e.target.value })} /></div>} /></section>
        </div>
      )}
      {tab === 'attractions' && <div className="card card-pad"><Repeater items={doc.nearbyAttractions || []} onChange={(v) => set({ nearbyAttractions: v })} newItem={() => ({ name: '', distanceKm: '', travelTime: '', description: '' })} addLabel="Add attraction" render={(x, u) => <div className="grid gap-2 sm:grid-cols-4"><Input label="Name" className="sm:col-span-2" value={x.name} onChange={(e) => u({ name: e.target.value })} /><Input label="Distance (km)" type="number" value={x.distanceKm ?? ''} onChange={(e) => u({ distanceKm: e.target.value ? Number(e.target.value) : undefined })} /><Input label="Travel time" value={x.travelTime || ''} onChange={(e) => u({ travelTime: e.target.value })} /><Textarea rows={2} className="sm:col-span-4" placeholder="Description" value={x.description || ''} onChange={(e) => u({ description: e.target.value })} /></div>} /></div>}
      {tab === 'guest' && (
        <div className="card card-pad grid gap-4 sm:grid-cols-2">
          {[['bestTimeToVisit', 'Best time to visit'], ['howToReach', 'How to reach'], ['checkInOut', 'Check-in / check-out'], ['whatToPack', 'What to pack'], ['importantNotes', 'Important notes']].map(([k, l]) => <Textarea key={k} label={l} rows={2} value={g[k] || ''} onChange={(e) => set({ guestInfo: { ...g, [k]: e.target.value } })} />)}
          <div><p className="field-label">Travel tips</p><StringList value={g.tips || []} onChange={(v) => set({ guestInfo: { ...g, tips: v } })} addLabel="Add tip" /></div>
        </div>
      )}
      {tab === 'content' && <div className="card card-pad"><ContentEditor value={doc.content} onChange={(v) => set({ content: v })} h1Placeholder={doc.title} /></div>}
      {tab === 'faqs' && <div className="card card-pad"><FaqEditor value={doc.faqs} onChange={(v) => set({ faqs: v })} /></div>}
      {tab === 'seo' && <SeoPanel doc={doc} onChange={(seo) => set({ seo })} onSlug={(slug) => set({ slug })} publicUrl={doc.absoluteUrl} aiContext={{ entityType: 'itinerary', name: doc.title, city: doc.hotel?.city?.name, state: doc.hotel?.state?.name, context: `${doc.summary || ''}\nDays: ${(doc.days || []).map((d) => d.title).join('; ')}` }} />}
      {tab === 'links' && <div className="card card-pad"><LinksEditor value={doc.internalLinks} onChange={(v) => set({ internalLinks: v })} /></div>}
    </div>
  );
}

// ═══════════════════════════ ARTICLE ═══════════════════════════
const ART_DEFAULTS = { title: '', slug: '', state: '', city: null, hotels: [], excerpt: '', coverImage: null, authorName: 'LexaTrip Editorial', tags: [], content: { h1: '', intro: '', sections: [] }, faqs: [], seo: { robots: { index: true, follow: true }, autoSchema: true }, internalLinks: [], status: 'draft' };

export function ArticleEditor() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { doc, set, save, saving, dirty, reload, error, isNew } = useDoc('/admin/seo/articles', id, { ...ART_DEFAULTS, state: sp.get('state') || '', city: sp.get('city') || null }, { onCreated: (d) => navigate(`/admin/seo/articles/${d._id}`, { replace: true }) });
  const [tab, setTab] = useState('overview');
  const { data: hotels } = useApi(() => api.get('/admin/seo/hotels', { state: idOf(doc?.state), limit: 200 }), [idOf(doc?.state)], { enabled: Boolean(idOf(doc?.state)) });
  if (error) return <ErrorState error={error} />;
  if (!doc) return <PageLoader />;
  const hotelIds = (doc.hotels || []).map(idOf);
  return (
    <div>
      <EditorHeader back="/admin/seo/explorer" title={isNew ? 'New article' : doc.title} subtitle={doc.publicUrl} />
      <WorkflowBar doc={doc} endpoint="/admin/seo/articles" type="SeoArticle" onSave={save} saving={saving} dirty={dirty} onReload={reload} />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'content', label: 'Content' }, { value: 'faqs', label: 'FAQs' }, { value: 'seo', label: 'SEO' }, { value: 'links', label: 'Links' }]} />
      {tab === 'overview' && (
        <div className="card card-pad grid gap-4 sm:grid-cols-2">
          <Input label="Title" required className="sm:col-span-2" value={doc.title} onChange={(e) => set({ title: e.target.value, ...(isNew ? { slug: slugify(e.target.value) } : {}) })} />
          <LocationPicker doc={doc} set={set} />
          <Textarea label="Excerpt" rows={2} className="sm:col-span-2" value={doc.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
          <Input label="Author" value={doc.authorName} onChange={(e) => set({ authorName: e.target.value })} />
          <TagInput label="Tags" value={doc.tags || []} onChange={(v) => set({ tags: v })} />
          <div className="sm:col-span-2"><p className="field-label">Hotels featured in this article</p><div className="flex flex-wrap gap-3">{(hotels || []).map((h) => <Checkbox key={h._id} label={`${h.name} (${h.city?.name})`} checked={hotelIds.includes(h._id)} onChange={(on) => set({ hotels: on ? [...hotelIds, h._id] : hotelIds.filter((x) => x !== h._id) })} />)}</div></div>
          <div className="sm:col-span-2"><SingleImage label="Cover image" value={doc.coverImage} onChange={(v) => set({ coverImage: v })} uploadUrl={UPLOAD} /></div>
        </div>
      )}
      {tab === 'content' && <div className="card card-pad"><ContentEditor value={doc.content} onChange={(v) => set({ content: v })} h1Placeholder={doc.title} /></div>}
      {tab === 'faqs' && <div className="card card-pad"><FaqEditor value={doc.faqs} onChange={(v) => set({ faqs: v })} /></div>}
      {tab === 'seo' && <SeoPanel doc={doc} onChange={(seo) => set({ seo })} onSlug={(slug) => set({ slug })} publicUrl={doc.absoluteUrl} aiContext={{ entityType: 'article', name: doc.title, city: doc.city?.name, state: doc.state?.name, context: doc.excerpt }} />}
      {tab === 'links' && <div className="card card-pad"><LinksEditor value={doc.internalLinks} onChange={(v) => set({ internalLinks: v })} /></div>}
    </div>
  );
}

// ═══════════════════════════ STATE / CITY / HOTEL CATEGORY ═══════════════════════════
const NODE = {
  State: { endpoint: '/admin/seo/states', label: 'State', defaults: { name: '', slug: '', code: '', country: 'India', isActive: true, content: { h1: '', intro: '', sections: [] }, seo: { robots: { index: true, follow: true } }, status: 'published' } },
  City: { endpoint: '/admin/seo/cities', label: 'City', defaults: { name: '', slug: '', state: '', aliases: [], isPopular: false, isActive: true, content: { h1: '', intro: '', sections: [] }, seo: { robots: { index: true, follow: true } }, status: 'published' } },
  HotelCategory: { endpoint: '/admin/seo/hotel-categories', label: 'Hotel category', defaults: { name: '', slug: '', state: '', city: '', starRating: '', content: { h1: '', intro: '', sections: [] }, faqs: [], seo: { robots: { index: true, follow: true }, autoSchema: true }, status: 'draft' } },
};

export function NodeEditor() {
  const { type, id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const cfg = NODE[type];
  const { doc, set, save, saving, dirty, reload, error, isNew } = useDoc(cfg.endpoint, id, { ...cfg.defaults, state: sp.get('state') || cfg.defaults.state, city: sp.get('city') || cfg.defaults.city }, { onCreated: (d) => navigate(`/admin/seo/locations/${type}/${d._id}`, { replace: true }) });
  const [tab, setTab] = useState('details');
  if (error) return <ErrorState error={error} />;
  if (!doc) return <PageLoader />;
  const workflow = type === 'HotelCategory';
  return (
    <div>
      <EditorHeader back="/admin/seo/explorer" title={isNew ? `New ${cfg.label.toLowerCase()}` : doc.name} subtitle={doc.publicUrl} />
      {workflow ? <WorkflowBar doc={doc} endpoint={cfg.endpoint} type={type} onSave={save} saving={saving} dirty={dirty} onReload={reload} /> : <div className="mb-6 flex items-center gap-3"><Button loading={saving} onClick={() => save()}>{isNew ? 'Create' : 'Save'}</Button>{dirty && <Badge tone="warning">Unsaved changes</Badge>}{doc.absoluteUrl && <a href={doc.publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-primary"><ExternalLink size={14} />View public hub</a>}</div>}
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'details', label: 'Details' }, { value: 'content', label: 'Landing content' }, ...(type === 'HotelCategory' ? [{ value: 'faqs', label: 'FAQs' }] : []), { value: 'seo', label: 'SEO' }]} />
      {tab === 'details' && (
        <div className="card card-pad grid gap-4 sm:grid-cols-2">
          <Input label="Name" required value={doc.name} onChange={(e) => set({ name: e.target.value, ...(isNew ? { slug: slugify(e.target.value) } : {}) })} />
          <Input label="Slug" value={doc.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
          {type !== 'State' && <LocationPicker doc={doc} set={set} withCity={type === 'HotelCategory'} required />}
          {type === 'State' && <Input label="State code" value={doc.code || ''} onChange={(e) => set({ code: e.target.value.toUpperCase() })} />}
          {type === 'City' && <TagInput label="Aliases (search & AI)" value={doc.aliases || []} onChange={(v) => set({ aliases: v })} hint="e.g. Lake City" />}
          {type === 'City' && <Input label="Short description" value={doc.description || ''} onChange={(e) => set({ description: e.target.value })} />}
          {type === 'HotelCategory' && <Select label="Star rating (optional rule)" placeholder="None" value={doc.starRating ?? ''} onChange={(e) => set({ starRating: e.target.value ? Number(e.target.value) : undefined })} options={[5, 4, 3, 2].map((n) => ({ value: n, label: `${n} star` }))} />}
          {type !== 'HotelCategory' && <div className="sm:col-span-2"><SingleImage label="Image" value={doc.image ? { url: doc.image } : null} onChange={(v) => set({ image: v?.url || '' })} uploadUrl={UPLOAD} /></div>}
          {type === 'City' && <div className="flex flex-col gap-3 sm:col-span-2"><Checkbox label="Popular destination (home screen)" checked={doc.isPopular} onChange={(v) => set({ isPopular: v })} /><Checkbox label="Active" checked={doc.isActive} onChange={(v) => set({ isActive: v })} /></div>}
        </div>
      )}
      {tab === 'content' && <div className="card card-pad"><ContentEditor value={doc.content} onChange={(v) => set({ content: v })} h1Placeholder={type === 'City' ? `Hotels in ${doc.name}` : doc.name} /></div>}
      {tab === 'faqs' && <div className="card card-pad"><FaqEditor value={doc.faqs} onChange={(v) => set({ faqs: v })} /></div>}
      {tab === 'seo' && <SeoPanel doc={doc} onChange={(seo) => set({ seo })} publicUrl={doc.absoluteUrl} aiContext={{ entityType: type === 'HotelCategory' ? 'hotel category page' : `${type.toLowerCase()} travel guide`, name: doc.name, city: doc.city?.name || doc.name, state: doc.state?.name || doc.name }} />}
    </div>
  );
}
