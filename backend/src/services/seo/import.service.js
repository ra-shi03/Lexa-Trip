import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { State, City } from '../../models/Location.js';
import HotelCategory from '../../models/seo/HotelCategory.js';
import SeoHotel from '../../models/seo/SeoHotel.js';
import { slugify } from '../../utils/helpers.js';
import { saveEntity } from './content.service.js';

/**
 * Bulk hotel import (CSV / XLSX). Multi-value cells use "|" as separator.
 * Upserts by (city, slug). `dryRun` validates every row without writing.
 */
export const IMPORT_COLUMNS = [
  'name', 'slug', 'state', 'city', 'categories', 'propertyType', 'starRating', 'shortDescription', 'description',
  'addressLine1', 'area', 'pincode', 'lat', 'lng', 'phone', 'email', 'website', 'checkInTime', 'checkOutTime',
  'priceFrom', 'amenities', 'facilities', 'heroImage', 'heroImageAlt', 'gallery',
  'seoTitle', 'metaDescription', 'h1', 'primaryKeyword', 'secondaryKeywords', 'longTailKeywords', 'canonicalUrl', 'index', 'status',
];

export function templateCsv() {
  const sample = {
    name: 'Bamboo Saa Resort & Spa', slug: 'bamboo-saa-resort-spa', state: 'Rajasthan', city: 'Udaipur',
    categories: 'luxury-resorts|5-star-hotels', propertyType: 'Resort', starRating: '5', shortDescription: 'Short summary (max 400 chars)',
    description: '<p>Long description (HTML allowed)</p>', addressLine1: '', area: '', pincode: '', lat: '', lng: '', phone: '', email: '', website: '',
    checkInTime: '14:00', checkOutTime: '11:00', priceFrom: '', amenities: 'Swimming pool|Spa|Free WiFi', facilities: 'Restaurant|Parking',
    heroImage: 'https://…/hero.jpg', heroImageAlt: 'Pool view at Bamboo Saa Resort & Spa, Udaipur', gallery: 'https://…/1.jpg|https://…/2.jpg',
    seoTitle: '', metaDescription: '', h1: '', primaryKeyword: 'bamboo saa resort udaipur', secondaryKeywords: 'resort in udaipur|luxury resort udaipur',
    longTailKeywords: '', canonicalUrl: '', index: 'true', status: 'draft',
  };
  const esc = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  return `${IMPORT_COLUMNS.join(',')}\n${IMPORT_COLUMNS.map((c) => esc(sample[c] ?? '')).join(',')}\n`;
}

async function readRows(file) {
  if (/\.csv$/i.test(file.originalname)) {
    return parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file.buffer);
  const ws = wb.worksheets[0];
  const header = ws.getRow(1).values.slice(1).map((h) => String(h || '').trim());
  const rows = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const obj = {};
    header.forEach((h, idx) => {
      const v = row.getCell(idx + 1).value;
      obj[h] = v && typeof v === 'object' ? v.text || v.result || v.hyperlink || '' : v ?? '';
    });
    rows.push(obj);
  });
  return rows;
}

const list = (v) => String(v || '').split('|').map((s) => s.trim()).filter(Boolean);

export async function importHotels(file, { dryRun = true, createMissingLocations = false, admin }) {
  const rows = await readRows(file);
  const report = { total: rows.length, created: 0, updated: 0, failed: 0, rows: [] };

  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    try {
      if (!r.name || !r.state || !r.city) throw new Error('name, state and city are required');
      let state = await State.findOne({ $or: [{ slug: slugify(r.state) }, { name: new RegExp(`^${r.state}$`, 'i') }] });
      if (!state && createMissingLocations && !dryRun) state = await State.create({ name: r.state, slug: slugify(r.state), status: 'published' });
      if (!state && !createMissingLocations) throw new Error(`State "${r.state}" not found`);
      let city = state && (await City.findOne({ state: state._id, $or: [{ slug: slugify(r.city) }, { name: new RegExp(`^${r.city}$`, 'i') }] }));
      if (!city && createMissingLocations && !dryRun && state) city = await City.create({ name: r.city, slug: slugify(r.city), state: state._id, status: 'published' });
      if (!city && !createMissingLocations) throw new Error(`City "${r.city}" not found in ${r.state}`);

      const slug = slugify(r.slug || r.name);
      const catSlugs = list(r.categories);
      const cats = city ? await HotelCategory.find({ city: city._id, slug: { $in: catSlugs } }).select('_id slug').lean() : [];
      const missingCats = catSlugs.filter((c) => !cats.find((x) => x.slug === c));

      const body = {
        name: r.name,
        slug,
        state: state?._id,
        city: city?._id,
        categories: cats.map((c) => c._id),
        propertyType: r.propertyType || 'Hotel',
        starRating: r.starRating ? Number(r.starRating) : undefined,
        shortDescription: r.shortDescription,
        description: r.description,
        address: { line1: r.addressLine1, area: r.area, pincode: r.pincode },
        geo: r.lat ? { lat: Number(r.lat), lng: Number(r.lng) } : undefined,
        contact: { phone: r.phone, email: r.email, website: r.website },
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        priceFrom: r.priceFrom ? Number(r.priceFrom) : undefined,
        amenities: list(r.amenities),
        facilities: list(r.facilities),
        heroImage: r.heroImage ? { url: r.heroImage, alt: r.heroImageAlt || r.name } : undefined,
        gallery: list(r.gallery).map((url, k) => ({ url, alt: `${r.name} ${r.city} photo ${k + 1}` })),
        content: { h1: r.h1 || r.name, intro: '', sections: [] },
        seo: {
          title: r.seoTitle,
          metaDescription: r.metaDescription,
          primaryKeyword: r.primaryKeyword,
          secondaryKeywords: list(r.secondaryKeywords),
          longTailKeywords: list(r.longTailKeywords),
          canonicalUrl: r.canonicalUrl,
          robots: { index: String(r.index ?? 'true').toLowerCase() !== 'false', follow: true },
        },
        status: ['draft', 'review', 'published'].includes(r.status) ? r.status : 'draft',
      };
      const existing = city ? await SeoHotel.findOne({ city: city._id, slug }) : null;
      if (!dryRun) {
        if (existing) {
          delete body.content; // keep editorial content on re-import
          await saveEntity('SeoHotel', existing._id, body, admin, 'Bulk import update');
        } else {
          await saveEntity('SeoHotel', null, body, admin, 'Bulk import');
        }
      }
      existing ? report.updated++ : report.created++;
      report.rows.push({ line, name: r.name, action: existing ? 'update' : 'create', warnings: missingCats.length ? [`Unknown categories: ${missingCats.join(', ')}`] : [] });
    } catch (e) {
      report.failed++;
      report.rows.push({ line, name: r.name, action: 'error', error: e.message });
    }
  }
  return { ...report, dryRun };
}
