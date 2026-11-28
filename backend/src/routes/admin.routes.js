import { Router } from 'express';
import { pushHandlers } from '../services/push.service.js';
import { validateObjectIdParams } from '../middlewares/security.js';
import { requireAdmin } from '../middlewares/auth.js';
import { can, masterOnly, stripRevenueForSubadmin } from '../middlewares/permission.js';
import { imageUpload } from '../middlewares/upload.js';
import { uploadLimiter } from '../middlewares/security.js';
import { crudFactory, mountCrud } from '../utils/crudFactory.js';
import { cleanHtml } from '../utils/sanitizeHtml.js';
import { Category, Amenity, Coupon, Banner, Page, Faq, CommissionRule } from '../models/Catalog.js';
import { propertyManager } from '../controllers/shared/propertyManager.js';
import * as dash from '../controllers/admin/dashboard.controller.js';
import * as people from '../controllers/admin/people.controller.js';
import * as fin from '../controllers/admin/finance.controller.js';
import * as sys from '../controllers/admin/system.controller.js';
import seoRoutes from './seo.routes.js';
import { publishAdminWrites } from '../services/live.service.js';

const r = Router();
validateObjectIdParams(r);
const pm = propertyManager('admin');
r.use(requireAdmin, stripRevenueForSubadmin, publishAdminWrites); // guest-visible changes → live update to open apps

r.get('/dashboard', can('dashboard'), dash.dashboard);

// ── Customers & vendors ──
r.get('/users', can('users'), people.users);
r.get('/users/:id', can('users'), people.user);
r.patch('/users/:id/status', can('users'), people.setUserStatus);
r.get('/vendors', can('vendors'), people.vendors);
r.get('/vendors/:id', can('vendors'), people.vendor);
r.post('/vendors/:id/status', can('vendors'), people.setVendorStatus);
r.put('/vendors/:id/permissions', can('vendors'), people.updateVendorPermissions);
r.get('/vendors/:id/documents/:docId/file', can('vendors'), people.vendorDocumentFile);
r.put('/vendors/:id/documents/:docId', can('vendors'), people.verifyVendorDocument);
r.put('/vendors/:id/commission', can('commission'), people.setVendorCommission);

// ── Properties (all vendors) ──
r.get('/properties', can('properties'), pm.list);
r.post('/properties', can('properties'), pm.create);
r.get('/properties/filters', can('properties'), pm.filterOptions); // before /properties/:id
r.post('/uploads/images', can('properties', 'content', 'appearance', 'catalog'), uploadLimiter, imageUpload.array('images', 20), pm.uploadImages);
r.get('/properties/:id', can('properties'), pm.get);
r.put('/properties/:id', can('properties'), pm.update);
r.delete('/properties/:id', can('properties'), pm.remove);
r.post('/properties/:id/action', can('properties'), people.propertyAction);
r.get('/properties/:id/rooms', can('properties'), pm.rooms);
r.post('/properties/:id/rooms', can('properties'), pm.createRoom);
r.put('/properties/:id/rooms/:roomId', can('properties'), pm.updateRoom);
r.delete('/properties/:id/rooms/:roomId', can('properties'), pm.removeRoom);
r.get('/properties/:id/pricing-rules', can('properties', 'inventory'), pm.pricingRules);
r.post('/properties/:id/pricing-rules', can('inventory'), pm.createPricingRule);
r.put('/properties/:id/pricing-rules/:ruleId', can('inventory'), pm.updatePricingRule);
r.delete('/properties/:id/pricing-rules/:ruleId', can('inventory'), pm.removePricingRule);
// Property editor options + vendor requests (sub-admins with `catalog` can approve / reject)
r.get('/options', can('properties', 'catalog'), pm.options);
r.get('/requests', can('catalog'), pm.requests);
r.patch('/requests/:id', can('catalog'), pm.decideRequest);

// Vendor deals ("Deals of the day") — admin sees and can manage every vendor's
r.get('/deals', can('properties', 'inventory'), pm.deals);
r.post('/deals', can('inventory'), pm.createDeal);
r.put('/deals/:dealId', can('inventory'), pm.updateDeal);
r.delete('/deals/:dealId', can('inventory'), pm.removeDeal);
r.get('/properties/:id/inventory', can('inventory'), pm.inventory);
r.put('/properties/:id/inventory', can('inventory'), pm.updateInventory);
r.get('/properties/:id/channel-manager', can('inventory'), pm.channel);
r.put('/properties/:id/channel-manager', can('inventory'), pm.updateChannel);
r.post('/properties/:id/channel-manager/test', can('inventory'), pm.testChannel);
r.post('/properties/:id/channel-manager/sync', can('inventory'), pm.syncChannel);

// ── Bookings (hotel / bus / flight) ──
r.get('/bookings', can('bookings'), pm.bookings);
r.get('/bookings/stats', can('bookings'), sys.bookingStats);
r.get('/bookings/:bookingId', can('bookings'), pm.booking);
r.post('/bookings/:bookingId/action', can('bookings'), pm.bookingAction);

// ── Finance (master only — revenue permissions are never grantable to sub-admins) ──
r.get('/finance/transactions', can('finance'), fin.transactions);
r.get('/finance/refunds', can('finance'), fin.refunds);
r.post('/finance/refunds/:bookingId', can('finance'), fin.processRefund);
r.get('/finance/payouts', can('payouts'), fin.payouts);
r.post('/finance/payouts/generate', can('payouts'), fin.generatePayouts);
r.put('/finance/payouts/:id', can('payouts'), fin.updatePayout);
r.get('/reports/revenue', can('revenue_reports'), fin.revenueReport);
r.get('/reports/operations', can('revenue_reports'), pm.reports);
mountCrud(r, '/commission-rules', crudFactory(CommissionRule, { searchFields: ['name'], populate: 'category vendor' }), can('commission'));

// ── Catalogue & content ──
mountCrud(r, '/categories', crudFactory(Category, { slugFrom: 'name', defaultSort: { sortOrder: 1 } }), can('catalog'));
mountCrud(r, '/amenities', crudFactory(Amenity, { slugFrom: 'name', filterFields: ['group'], defaultSort: { name: 1 } }), can('catalog'));
mountCrud(r, '/coupons', crudFactory(Coupon, { searchFields: ['code', 'title'] }), can('coupons'));
mountCrud(r, '/banners', crudFactory(Banner, { searchFields: ['title'], filterFields: ['placement'], defaultSort: { sortOrder: 1 } }), can('content'));
const sanitizePage = (req, _res, next) => {
  if (req.body?.content !== undefined) req.body.content = cleanHtml(req.body.content);
  next();
};
mountCrud(r, '/pages', crudFactory(Page, { searchFields: ['title', 'slug'], slugFrom: 'title' }), can('content'), sanitizePage);
mountCrud(r, '/faqs', crudFactory(Faq, { searchFields: ['question'], filterFields: ['category'], defaultSort: { category: 1, sortOrder: 1 } }), can('content'));

// ── Reviews, support ──
r.get('/reviews', can('reviews'), sys.reviews);
r.patch('/reviews/:id', can('reviews'), sys.moderateReview);
r.get('/support', can('support'), sys.tickets);
r.post('/support/:id', can('support'), sys.replyTicket);

// ── Settings (theme, features, integrations, SEO, tax, commission) ──
r.get('/settings', sys.getAllSettings);
r.put('/settings/:section', sys.updateSettings);
r.post('/settings/upload', can('appearance', 'content'), imageUpload.single('file'), sys.uploadAsset);

// ── Sub-admins (master only) ──
r.get('/permissions', masterOnly, people.permissionCatalog);
r.get('/subadmins', masterOnly, people.subadmins);
r.post('/subadmins', masterOnly, people.createSubadmin);
r.put('/subadmins/:id', masterOnly, people.updateSubadmin);
r.delete('/subadmins/:id', masterOnly, people.deleteSubadmin);

// ── System ──
r.get('/audit-logs', masterOnly, sys.auditLogs);
// Devices that receive push notifications
const push = pushHandlers('admin', (req) => req.admin);
r.post('/push-token', push.register);
r.delete('/push-token', push.remove);
r.get('/notifications', sys.notifications);
r.post('/notifications/read', sys.markNotificationsRead);
r.get('/ai/conversations', can('support'), sys.aiConversations);

// ── SEO CMS ──
r.use('/seo', seoRoutes);

export default r;
