import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * India address lookups with Google (Places API "New" + Geocoding API). The key stays on the server.
 * Any Google problem (no key, billing off, API not enabled, quota) becomes a 424 so the form can quietly
 * fall back to manual typing; the real reason is logged here.
 */
const UNAVAILABLE = 'Location suggestions aren’t available right now — please type it in';

function unavailable(reason) {
  console.warn(`[places] ${String(reason).replaceAll(env.googleMapsKey || '\0', '<key>')}`);
  return new ApiError(424, UNAVAILABLE);
}

async function google(url, { body, fieldMask } = {}) {
  if (!env.googleMapsKey) throw unavailable('GOOGLE_MAPS_API_KEY is not set');
  const places = url.startsWith('https://places.');
  const res = await fetch(places ? url : `${url}&key=${env.googleMapsKey}`, {
    method: body ? 'POST' : 'GET',
    headers: places ? { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.googleMapsKey, ...(fieldMask && { 'X-Goog-FieldMask': fieldMask }) } : undefined,
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  }).catch((e) => { throw unavailable(e.message); });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw unavailable(data.error?.message || res.status);
  if (!places && !['OK', 'ZERO_RESULTS'].includes(data.status)) throw unavailable(data.error_message || data.status);
  return data;
}

const autocomplete = (input, types, session) => google('https://places.googleapis.com/v1/places:autocomplete', {
  body: { input, includedRegionCodes: ['in'], includedPrimaryTypes: types, languageCode: 'en', ...(session && { sessionToken: session }) },
}).then((d) => (d.suggestions || []).map((s) => s.placePrediction).filter(Boolean));

const geocode = (query) => google(`https://maps.googleapis.com/maps/api/geocode/json?language=en&region=in&${new URLSearchParams(query)}`).then((d) => d.results || []);

/** First component of any of the types — works with both response shapes */
const pick = (components = [], ...types) => {
  for (const type of types) {
    const c = components.find((x) => x.types?.includes(type));
    if (c) return c.longText || c.long_name;
  }
  return '';
};
const unique = (list) => [...new Set(list.filter(Boolean))];
const pincodesOf = (results) => unique(results.map((r) => pick(r.address_components, 'postal_code'))).filter((p) => /^\d{6}$/.test(p));

export async function suggestCities(q, session) {
  const list = await autocomplete(q, ['(cities)'], session);
  return list.map((p) => ({ placeId: p.placeId, name: p.structuredFormat?.mainText?.text || p.text?.text, detail: p.structuredFormat?.secondaryText?.text || '' }));
}

/** The chosen city → its state and the pincodes around its centre */
export async function cityDetails(placeId, session) {
  const data = await google(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}${session ? `?sessionToken=${encodeURIComponent(session)}` : ''}`, { fieldMask: 'addressComponents,location' });
  const { latitude, longitude } = data.location || {};
  const near = latitude === undefined ? [] : await geocode({ latlng: `${latitude},${longitude}` }).catch(() => []);
  return {
    city: pick(data.addressComponents, 'locality', 'administrative_area_level_3', 'administrative_area_level_2'),
    state: pick(data.addressComponents, 'administrative_area_level_1'),
    pincodes: pincodesOf(near),
  };
}

export async function suggestPincodes(digits, city) {
  const list = await autocomplete(digits, ['postal_code']);
  const rows = list
    .map((p) => ({ pincode: (p.text?.text || '').match(/\b\d{6}\b/)?.[0], detail: p.structuredFormat?.secondaryText?.text || '' }))
    .filter((r) => r.pincode);
  // pincodes of the chosen city first
  const inCity = (r) => (city && r.detail.toLowerCase().includes(city.toLowerCase()) ? 0 : 1);
  return rows.sort((a, b) => inCity(a) - inCity(b));
}

/** "Use current location" */
export async function reverseGeocode(lat, lng) {
  const results = await geocode({ latlng: `${lat},${lng}` });
  if (!results.length) throw new ApiError(404, 'No address found for this location');
  const best = results.find((r) => !r.types?.includes('plus_code')) || results[0];
  const c = best.address_components || [];
  const line1 = unique(['subpremise', 'premise', 'street_number', 'route', 'neighborhood', 'sublocality_level_2', 'sublocality_level_1'].map((t) => pick(c, t))).join(', ');
  return {
    line1: line1 || (best.formatted_address || '').split(',').slice(0, 2).join(',').trim(),
    city: pick(c, 'locality', 'administrative_area_level_3', 'administrative_area_level_2'),
    state: pick(c, 'administrative_area_level_1'),
    pincode: pick(c, 'postal_code') || pincodesOf(results)[0] || '',
  };
}
