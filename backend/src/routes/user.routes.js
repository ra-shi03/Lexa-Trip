import { Router } from 'express';
import { pushHandlers } from '../services/push.service.js';
import { validateObjectIdParams } from '../middlewares/security.js';
import * as acc from '../controllers/user/account.controller.js';
import * as bk from '../controllers/user/booking.controller.js';
import * as pay from '../controllers/user/payment.controller.js';
import { requireUser } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { avatarUpload } from '../middlewares/upload.js';
import { uploadLimiter } from '../middlewares/security.js';

const r = Router();
validateObjectIdParams(r);
r.use(requireUser);

// Profile
r.delete('/account', acc.deleteAccount);
r.put('/profile', validate(acc.schemas.profile), acc.updateProfile);
r.post('/profile/avatar', uploadLimiter, avatarUpload.single('avatar'), acc.uploadAvatar);
r.get('/travellers', acc.listTravellers);
r.post('/travellers', validate(acc.schemas.traveller), acc.addTraveller);
r.put('/travellers/:id', validate(acc.schemas.traveller), acc.updateTraveller);
r.delete('/travellers/:id', acc.removeTraveller);
r.get('/wishlist', acc.wishlist);
r.post('/wishlist/:propertyId', acc.toggleWishlist);
// Devices that receive push notifications
const push = pushHandlers('user', (req) => req.user);
r.post('/push-token', push.register);
r.delete('/push-token', push.remove);
r.get('/notifications', acc.notifications);
r.post('/notifications/read', acc.markNotificationsRead);
r.post('/reviews', validate(acc.schemas.review), acc.createReview);
r.get('/support', acc.tickets);
r.post('/support', validate(acc.schemas.ticket), acc.createTicket);
r.post('/support/:id/reply', acc.replyTicket);

// Bookings
r.post('/bookings/hotel', validate(bk.schemas.hotel), bk.createHotel);
r.post('/bookings/bus', validate(bk.schemas.bus), bk.createBus);
r.post('/bookings/flight', validate(bk.schemas.flight), bk.createFlight);
r.get('/bookings', bk.myBookings);
r.get('/bookings/:id', bk.bookingDetail);
r.get('/bookings/:id/cancellation-preview', bk.cancellationPreview);
r.post('/bookings/:id/cancel', validate(bk.schemas.cancel), bk.cancel);

// Payments
r.post('/payments/order', pay.createOrder);
r.post('/payments/verify', pay.verify);
r.post('/payments/mock', pay.mockPay);
r.get('/payments/status/:bookingId', pay.status);

export default r;
