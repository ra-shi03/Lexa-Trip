export const BOOKING_TYPES = ['hotel', 'bus', 'flight'];

export const BOOKING_STATUS = [
  'pending_payment',
  'pending_approval', // request-to-book model
  'confirmed',
  'checked_in',
  'checked_out',
  'completed',
  'cancelled',
  'failed',
  'expired',
];

export const PAYMENT_STATUS = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'];

export const PROPERTY_STATUS = ['draft', 'pending', 'approved', 'rejected', 'suspended'];
export const VENDOR_STATUS = ['pending', 'approved', 'rejected', 'suspended'];

export const MEAL_PLANS = {
  EP: 'Room only',
  CP: 'Breakfast included',
  MAP: 'Breakfast + lunch/dinner',
  AP: 'All meals included',
};

/** Editorial workflow for SEO content */
export const CONTENT_STATUS = ['draft', 'review', 'published', 'archived'];
