import { suggestCities, cityDetails, suggestPincodes, reverseGeocode } from '../../services/places.service.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

const text = (value, max = 80) => String(value || '').trim().slice(0, max);

export async function cities(req, res) {
  const q = text(req.query.q);
  ok(res, q.length < 2 ? [] : await suggestCities(q, text(req.query.session, 64)));
}

export async function city(req, res) {
  const placeId = text(req.query.placeId, 300);
  if (!/^[\w-]+$/.test(placeId)) throw ApiError.badRequest('Invalid place');
  ok(res, await cityDetails(placeId, text(req.query.session, 64)));
}

export async function pincodes(req, res) {
  const q = text(req.query.q, 6);
  ok(res, /^\d{3,6}$/.test(q) ? await suggestPincodes(q, text(req.query.city)) : []);
}

export async function reverse(req, res) {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw ApiError.badRequest('Invalid location');
  ok(res, await reverseGeocode(lat, lng));
}
