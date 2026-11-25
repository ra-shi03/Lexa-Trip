import { ResourcePage } from '../../components/panel/ResourcePage';
import { StatusBadge, Badge, Img } from '../../components/ui';
import { DynIcon, ICONS } from '../../components/stay/StayComponents';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { money, dateLabel, titleCase } from '../../lib/format';

const ICON_OPTIONS = Object.keys(ICONS).map((k) => ({ value: k, label: k }));
const active = (r) => <StatusBadge status={r.isActive ? 'active' : 'closed'} />;

export const Categories = () => (
  <ResourcePage
    title="Accommodation categories"
    subtitle="Hotels, villas, resorts, hostels… shown in search filters and the home screen"
    endpoint="/admin/categories"
    defaults={{ isActive: true, showOnHome: true, sortOrder: 0, icon: 'building-2' }}
    columns={[
      { key: 'name', label: 'Category', render: (r) => <span className="flex items-center gap-2 font-semibold"><DynIcon name={r.icon} />{r.name}</span> },
      { key: 'slug', label: 'Slug' }, { key: 'sortOrder', label: 'Order' },
      { key: 'showOnHome', label: 'Home', render: (r) => (r.showOnHome ? 'Yes' : 'No') }, { key: 'isActive', label: 'Status', render: active },
    ]}
    fields={[
      { name: 'name', label: 'Name', required: true }, { name: 'slug', label: 'Slug', hint: 'Auto-generated if empty' },
      { name: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS }, { name: 'sortOrder', label: 'Sort order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea', full: true }, { name: 'image', label: 'Image', type: 'image', full: true },
      { name: 'showOnHome', label: 'Show on home', type: 'toggle' }, { name: 'isActive', label: 'Active', type: 'toggle' },
    ]}
  />
);

export const Amenities = () => (
  <ResourcePage
    title="Amenities"
    subtitle="Facilities vendors can assign to properties and rooms; filterable in search"
    endpoint="/admin/amenities"
    defaults={{ isActive: true, isFilterable: true, group: 'general', icon: 'check' }}
    columns={[
      { key: 'name', label: 'Amenity', render: (r) => <span className="flex items-center gap-2 font-semibold"><DynIcon name={r.icon} />{r.name}</span> },
      { key: 'group', label: 'Group', render: (r) => titleCase(r.group) }, { key: 'isFilterable', label: 'Filter', render: (r) => (r.isFilterable ? 'Yes' : 'No') }, { key: 'isActive', label: 'Status', render: active },
    ]}
    fields={[
      { name: 'name', label: 'Name', required: true }, { name: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS },
      { name: 'group', label: 'Group', type: 'select', options: ['general', 'room', 'food', 'wellness', 'business', 'family', 'accessibility', 'safety'] },
      { name: 'slug', label: 'Slug' }, { name: 'isFilterable', label: 'Show as search filter', type: 'toggle' }, { name: 'isActive', label: 'Active', type: 'toggle' },
    ]}
  />
);

const SERVICES = [{ value: 'hotel', label: 'Hotels' }, { value: 'bus', label: 'Bus' }, { value: 'flight', label: 'Flights' }];
export const Coupons = () => (
  <ResourcePage
    title="Coupons"
    subtitle="Discount codes and offer rules"
    endpoint="/admin/coupons"
    defaults={{ discountType: 'percent', value: 10, services: ['hotel'], perUserLimit: 1, minAmount: 0, isActive: true, isPublic: true }}
    columns={[
      { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-bold">{r.code}</span> }, { key: 'title', label: 'Title' },
      { key: 'value', label: 'Discount', render: (r) => (r.discountType === 'percent' ? `${r.value}%${r.maxDiscount ? ` (max ${money(r.maxDiscount)})` : ''}` : money(r.value)) },
      { key: 'services', label: 'Services', render: (r) => <div className="flex gap-1">{r.services.map((s) => <Badge key={s}>{s}</Badge>)}</div> },
      { key: 'used', label: 'Used', render: (r) => `${r.usedCount}${r.usageLimit ? ` / ${r.usageLimit}` : ''}` },
      { key: 'validTo', label: 'Valid till', render: (r) => (r.validTo ? dateLabel(r.validTo) : '—') }, { key: 'isActive', label: 'Status', render: active },
    ]}
    fields={[
      { name: 'code', label: 'Code', required: true, upper: true }, { name: 'title', label: 'Title' },
      { name: 'description', label: 'Description', type: 'textarea', full: true },
      { name: 'discountType', label: 'Type', type: 'select', options: [{ value: 'percent', label: 'Percent' }, { value: 'flat', label: 'Flat ₹' }] },
      { name: 'value', label: 'Value', type: 'number', required: true }, { name: 'maxDiscount', label: 'Max discount ₹', type: 'number' }, { name: 'minAmount', label: 'Min booking ₹', type: 'number' },
      { name: 'services', label: 'Valid for', type: 'multiselect', options: SERVICES, full: true },
      { name: 'validFrom', label: 'Valid from', type: 'date' }, { name: 'validTo', label: 'Valid to', type: 'date' },
      { name: 'usageLimit', label: 'Total usage limit', type: 'number' }, { name: 'perUserLimit', label: 'Per user limit', type: 'number' },
      { name: 'isPublic', label: 'Show on offers page', type: 'toggle' }, { name: 'isActive', label: 'Active', type: 'toggle' },
    ]}
  />
);

export const Banners = () => (
  <ResourcePage
    title="Banners"
    subtitle="Promotional content on the web home screen and app"
    endpoint="/admin/banners"
    defaults={{ placement: 'home_offers', isActive: true, sortOrder: 0 }}
    columns={[
      { key: 'image', label: '', render: (r) => <Img src={r.image} className="h-10 w-16 rounded-md" /> }, { key: 'title', label: 'Title' },
      { key: 'placement', label: 'Placement', render: (r) => titleCase(r.placement) }, { key: 'sortOrder', label: 'Order' }, { key: 'isActive', label: 'Status', render: active },
    ]}
    fields={[
      { name: 'title', label: 'Title', required: true }, { name: 'subtitle', label: 'Subtitle' }, { name: 'link', label: 'Link (e.g. /search?city=Goa)' }, { name: 'ctaLabel', label: 'Button label' },
      { name: 'placement', label: 'Placement', type: 'select', options: ['home_hero', 'home_offers', 'search_top', 'app_home'].map((v) => ({ value: v, label: titleCase(v) })) },
      { name: 'sortOrder', label: 'Order', type: 'number' }, { name: 'validFrom', label: 'Show from', type: 'date' }, { name: 'validTo', label: 'Show until', type: 'date' },
      { name: 'image', label: 'Image', type: 'image', full: true }, { name: 'isActive', label: 'Active', type: 'toggle' },
    ]}
  />
);

export const Pages = () => (
  <ResourcePage
    title="Static pages"
    subtitle="Terms, privacy, cancellation policy, about, contact… (available at /p/<slug>)"
    endpoint="/admin/pages"
    defaults={{ isActive: true, showInFooter: true, content: '' }}
    columns={[{ key: 'title', label: 'Title' }, { key: 'slug', label: 'URL', render: (r) => <a className="text-primary" href={`/p/${r.slug}`} target="_blank" rel="noreferrer">/p/{r.slug}</a> }, { key: 'isActive', label: 'Status', render: active }]}
    fields={[
      { name: 'title', label: 'Title', required: true }, { name: 'slug', label: 'Slug' }, { name: 'metaTitle', label: 'Meta title' }, { name: 'metaDescription', label: 'Meta description' },
      { name: 'content', label: 'Content', type: 'richtext' }, { name: 'showInFooter', label: 'Show in footer', type: 'toggle' }, { name: 'isActive', label: 'Published', type: 'toggle' },
    ]}
  />
);

export const Faqs = () => (
  <ResourcePage
    title="FAQs"
    subtitle="Help centre questions (shown at /p/faq)"
    endpoint="/admin/faqs"
    defaults={{ category: 'general', isActive: true, sortOrder: 0 }}
    columns={[{ key: 'question', label: 'Question', className: 'max-w-md' }, { key: 'category', label: 'Category', render: (r) => titleCase(r.category) }, { key: 'sortOrder', label: 'Order' }, { key: 'isActive', label: 'Status', render: active }]}
    fields={[
      { name: 'question', label: 'Question', required: true, full: true }, { name: 'answer', label: 'Answer', type: 'textarea', required: true, full: true, rows: 4 },
      { name: 'category', label: 'Category', type: 'select', options: ['general', 'booking', 'payment', 'cancellation', 'bus', 'flight'] }, { name: 'sortOrder', label: 'Order', type: 'number' }, { name: 'isActive', label: 'Active', type: 'toggle' },
    ]}
  />
);

export function CommissionRules() {
  const { data: cats } = useApi(() => api.get('/public/categories'), []);
  const { data: vendors } = useApi(() => api.get('/admin/vendors', { limit: 200 }), []);
  return (
    <ResourcePage
      title="Commission rules"
      subtitle="Precedence: vendor override → vendor rule → category rule → service rule → global rule"
      endpoint="/admin/commission-rules"
      searchable={false}
      defaults={{ scope: 'global', type: 'percent', value: 15, isActive: true }}
      transformIn={(r) => ({ ...r, category: r.category?._id || r.category || '', vendor: r.vendor?._id || r.vendor || '' })}
      transformOut={(r) => ({ ...r, category: r.category || undefined, vendor: r.vendor || undefined, service: r.service || undefined })}
      columns={[
        { key: 'name', label: 'Rule' }, { key: 'scope', label: 'Scope', render: (r) => `${titleCase(r.scope)}${r.category ? ` · ${r.category.name}` : ''}${r.vendor ? ` · ${r.vendor.businessName}` : ''}${r.service ? ` · ${r.service}` : ''}` },
        { key: 'value', label: 'Commission', render: (r) => (r.type === 'percent' ? `${r.value}%` : money(r.value)) }, { key: 'isActive', label: 'Status', render: active },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true, full: true },
        { name: 'scope', label: 'Scope', type: 'select', options: ['global', 'service', 'category', 'vendor'].map((v) => ({ value: v, label: titleCase(v) })) },
        { name: 'service', label: 'Service (scope = service)', type: 'select', placeholder: '—', options: SERVICES },
        { name: 'category', label: 'Category (scope = category)', type: 'select', placeholder: '—', options: (cats || []).map((c) => ({ value: c._id, label: c.name })) },
        { name: 'vendor', label: 'Vendor (scope = vendor)', type: 'select', placeholder: '—', options: (vendors || []).map((v) => ({ value: v._id, label: v.businessName })) },
        { name: 'type', label: 'Type', type: 'select', options: [{ value: 'percent', label: 'Percent' }, { value: 'flat', label: 'Flat ₹ per booking' }] },
        { name: 'value', label: 'Value', type: 'number', required: true }, { name: 'isActive', label: 'Active', type: 'toggle' },
      ]}
    />
  );
}
