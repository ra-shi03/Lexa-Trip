import { absolute } from './url.service.js';
import { stripHtml } from '../../utils/sanitizeHtml.js';

/** schema.org JSON-LD builders. Custom JSON from the editor is merged on top. */

export function breadcrumbSchema(crumbs, siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: absolute(c.url, siteUrl) })),
  };
}

export function faqSchema(faqs = []) {
  const valid = faqs.filter((f) => f.question && f.answer);
  if (!valid.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) } })),
  };
}

const HOTEL_TYPES = { Resort: 'Resort', Hotel: 'Hotel', Villa: 'LodgingBusiness', Hostel: 'Hostel', 'Guest House': 'BedAndBreakfast', Homestay: 'LodgingBusiness' };

export function hotelSchema(h, url, siteUrl) {
  const images = [h.heroImage?.url, ...(h.gallery || []).map((g) => g.url)].filter(Boolean).map((u) => absolute(u, siteUrl));
  return {
    '@context': 'https://schema.org',
    '@type': HOTEL_TYPES[h.propertyType] || 'Hotel',
    name: h.name,
    url,
    description: h.shortDescription || stripHtml(h.description).slice(0, 300),
    image: images.slice(0, 10),
    ...(h.starRating ? { starRating: { '@type': 'Rating', ratingValue: h.starRating } } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: [h.address?.line1, h.address?.area].filter(Boolean).join(', ') || undefined,
      addressLocality: h.city?.name,
      addressRegion: h.state?.name,
      postalCode: h.address?.pincode || undefined,
      addressCountry: 'IN',
    },
    ...(h.geo?.lat ? { geo: { '@type': 'GeoCoordinates', latitude: h.geo.lat, longitude: h.geo.lng } } : {}),
    ...(h.contact?.phone ? { telephone: h.contact.phone } : {}),
    ...(h.priceRange ? { priceRange: h.priceRange } : {}),
    ...(h.checkInTime ? { checkinTime: h.checkInTime } : {}),
    ...(h.checkOutTime ? { checkoutTime: h.checkOutTime } : {}),
    amenityFeature: [...new Set([...(h.amenities || []), ...(h.facilities || [])])].slice(0, 30).map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
  };
}

export function itinerarySchema(it, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: it.title,
    url,
    description: it.summary,
    ...(it.travellerType ? { touristType: it.travellerType } : {}),
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: it.days?.length || 0,
      itemListElement: (it.days || []).map((d, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'TouristAttraction', name: `Day ${d.day}: ${d.title || ''}`.trim(), description: stripHtml(d.description).slice(0, 300) },
      })),
    },
    ...(it.nearbyAttractions?.length
      ? { subjectOf: it.nearbyAttractions.map((a) => ({ '@type': 'TouristAttraction', name: a.name, description: a.description })) }
      : {}),
  };
}

export function articleSchema(a, url, siteUrl, siteName, logo) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.content?.h1 || a.title,
    description: a.excerpt || a.seo?.metaDescription,
    image: a.coverImage?.url ? [absolute(a.coverImage.url, siteUrl)] : undefined,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
    author: { '@type': 'Organization', name: a.authorName || siteName },
    publisher: { '@type': 'Organization', name: siteName, logo: { '@type': 'ImageObject', url: absolute(logo, siteUrl) } },
    mainEntityOfPage: url,
  };
}

export function itemListSchema(items, siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: absolute(x.url, siteUrl), name: x.name })),
  };
}

/** Combines auto-generated schema with the editor's custom JSON-LD (invalid JSON is ignored). */
export function finalSchemas(auto, seo) {
  const out = seo?.autoSchema === false ? [] : auto.filter(Boolean);
  if (seo?.customSchema?.trim()) {
    try {
      const custom = JSON.parse(seo.customSchema);
      out.push(...(Array.isArray(custom) ? custom : [custom]));
    } catch {
      /* invalid custom schema is flagged in the editor */
    }
  }
  return out;
}
