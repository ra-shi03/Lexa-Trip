import { Router } from 'express';
import { validateObjectIdParams } from '../middlewares/security.js';
import * as v from '../controllers/vendor/vendor.controller.js';
import { propertyManager } from '../controllers/shared/propertyManager.js';
import { requireVendor, requireApprovedVendor } from '../middlewares/auth.js';
import { imageUpload, documentUpload } from '../middlewares/upload.js';
import { uploadLimiter } from '../middlewares/security.js';

const r = Router();
validateObjectIdParams(r);
const pm = propertyManager('vendor');
r.use(requireVendor);

// Account (available while pending approval so the vendor can complete onboarding)
r.get('/dashboard', v.dashboard);
r.put('/profile', v.updateProfile);
r.put('/bank', v.updateBank);
r.post('/documents', documentUpload.single('file'), v.uploadDocument);
r.get('/notifications', v.notifications);
r.post('/notifications/read', v.markRead);

// Properties (draft editing allowed before approval; going live requires approval)
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

// Live operations — approved vendors only
r.get('/properties/:id/inventory', requireApprovedVendor, pm.inventory);
r.put('/properties/:id/inventory', requireApprovedVendor, pm.updateInventory);
r.get('/properties/:id/channel-manager', requireApprovedVendor, pm.channel);
r.put('/properties/:id/channel-manager', requireApprovedVendor, pm.updateChannel);
r.post('/properties/:id/channel-manager/test', requireApprovedVendor, pm.testChannel);
r.post('/properties/:id/channel-manager/sync', requireApprovedVendor, pm.syncChannel);
r.get('/bookings', requireApprovedVendor, pm.bookings);
r.get('/bookings/:bookingId', requireApprovedVendor, pm.booking);
r.post('/bookings/:bookingId/action', requireApprovedVendor, pm.bookingAction);
r.get('/earnings', requireApprovedVendor, v.earnings);
r.get('/reports', requireApprovedVendor, pm.reports);

export default r;
