import { Router } from 'express';
import { pushHandlers } from '../services/push.service.js';
import { validateObjectIdParams } from '../middlewares/security.js';
import * as v from '../controllers/vendor/vendor.controller.js';
import { propertyManager } from '../controllers/shared/propertyManager.js';
import { requireVendor, requireApprovedVendor, requireEditableProfile, requireDocumentSlot } from '../middlewares/auth.js';
import { imageUpload, documentUpload } from '../middlewares/upload.js';
import * as places from '../controllers/vendor/places.controller.js';
import { uploadLimiter, placesLimiter } from '../middlewares/security.js';

const r = Router();
validateObjectIdParams(r);
const pm = propertyManager('vendor');
r.use(requireVendor);

// Account — the only routes open before approval, so the vendor can complete onboarding
r.put('/profile', requireEditableProfile, v.updateProfile);
r.put('/bank', requireEditableProfile, v.updateBank);
// checked before the upload, so a refused request never stores anything
r.post('/documents', requireDocumentSlot, uploadLimiter, documentUpload.single('file'), v.uploadDocument);
r.get('/documents/:docId/file', v.documentFile);
r.post('/profile/submit', v.submitProfile);
// Address lookups for the profile form (paid Google API → rate limited)
r.get('/places/cities', placesLimiter, places.cities);
r.get('/places/city', placesLimiter, places.city);
r.get('/places/pincodes', placesLimiter, places.pincodes);
r.post('/places/reverse', placesLimiter, places.reverse);
// Devices that receive push notifications
const push = pushHandlers('vendor', (req) => req.vendor);
r.post('/push-token', push.register);
r.delete('/push-token', push.remove);
r.get('/notifications', v.notifications);
r.post('/notifications/read', v.markRead);

// Everything below needs an approved account
r.use(requireApprovedVendor);
r.get('/dashboard', v.dashboard);

// Properties
r.get('/options', pm.options);
r.get('/requests', pm.requests);
r.post('/requests', pm.createRequest);
r.get('/properties', pm.list);
r.post('/properties', pm.create);
r.post('/uploads/images', uploadLimiter, imageUpload.array('images', 20), pm.uploadImages);
r.get('/properties/:id', pm.get);
r.put('/properties/:id', pm.update);
r.delete('/properties/:id', pm.remove);
r.post('/properties/:id/submit', pm.submit);
r.get('/properties/:id/rooms', pm.rooms);
r.post('/properties/:id/rooms', pm.createRoom);
r.put('/properties/:id/rooms/:roomId', pm.updateRoom);
r.delete('/properties/:id/rooms/:roomId', pm.removeRoom);
r.get('/properties/:id/pricing-rules', pm.pricingRules);
r.post('/properties/:id/pricing-rules', pm.createPricingRule);
r.put('/properties/:id/pricing-rules/:ruleId', pm.updatePricingRule);
r.delete('/properties/:id/pricing-rules/:ruleId', pm.removePricingRule);

// Live operations
r.get('/properties/:id/inventory', pm.inventory);
r.put('/properties/:id/inventory', pm.updateInventory);
r.get('/properties/:id/channel-manager', pm.channel);
r.put('/properties/:id/channel-manager', pm.updateChannel);
r.post('/properties/:id/channel-manager/test', pm.testChannel);
r.post('/properties/:id/channel-manager/sync', pm.syncChannel);
r.get('/deals', pm.deals);
r.post('/deals', pm.createDeal);
r.put('/deals/:dealId', pm.updateDeal);
r.delete('/deals/:dealId', pm.removeDeal);
r.get('/bookings', pm.bookings);
r.get('/bookings/:bookingId', pm.booking);
r.post('/bookings/:bookingId/action', pm.bookingAction);
r.get('/earnings', v.earnings);
r.get('/reports', pm.reports);

export default r;
