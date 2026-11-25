import { Router } from 'express';
import { aiLimiter } from '../middlewares/security.js';
import * as pub from '../controllers/public/public.controller.js';
import * as travel from '../controllers/public/travel.controller.js';
import * as ai from '../controllers/public/ai.controller.js';
import { optionalUser } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

import { brandIcon, webManifest } from '../services/brand.service.js';

const r = Router();
// Dynamic PWA manifest + app icons from Admin → Theme & branding (logo mark)
r.get('/manifest', async (_req, res) => { res.type('application/manifest+json').set('Cache-Control', 'public, max-age=300').send(JSON.stringify(await webManifest())); });
r.get('/brand/icon/:size.png', async (req, res) => {
  const size = [48, 96, 144, 180, 192, 256, 512].includes(Number(req.params.size)) ? Number(req.params.size) : 192;
  res.type('image/png').set('Cache-Control', 'public, max-age=3600').send(await brandIcon(size));
});
r.get('/settings', pub.settings);
r.get('/home', pub.home);
r.get('/categories', pub.categories);
r.get('/amenities', pub.amenities);
r.get('/states', pub.states);
r.get('/cities', pub.cities);
r.get('/suggest', pub.suggest);
r.get('/offers', pub.offers);
r.get('/pages', pub.footerPages);
r.get('/pages/:slug', pub.page);
r.get('/faqs', pub.faqs);

// Stays
r.get('/properties', pub.search);
r.get('/properties/:idOrSlug', pub.propertyDetail);
r.get('/properties/:id/rates', pub.propertyRates);
r.get('/properties/:id/reviews', pub.propertyReviews);
r.post('/quote', optionalUser, pub.quote);
r.post('/coupons/validate', optionalUser, pub.checkCoupon);

// Bus & flight (provider-backed)
r.get('/bus/search', travel.busSearch);
r.get('/bus/trips/:tripId/seats', travel.busSeats);
r.get('/flights/airports', pub.airports);
r.get('/flights/search', travel.flightSearch);

// Lexa AI
r.get('/ai/status', ai.status);
r.post('/ai/parse', aiLimiter, validate(ai.schemas.parse), ai.parse);
r.post('/ai/chat', aiLimiter, optionalUser, validate(ai.schemas.chat), ai.chat);
r.post('/ai/plan', aiLimiter, validate(ai.schemas.plan), ai.plan);
r.get('/ai/review-summary/:propertyId', aiLimiter, ai.reviewSummary);

export default r;
