/**
 * Admin permission catalogue.
 *
 * Master admin implicitly has every permission.
 * Sub-admins get an explicit subset chosen by the master admin — EXCEPT the
 * revenue group, which can never be granted to a sub-admin (enforced in the
 * Admin model, the sub-admin controller AND the `can()` middleware).
 */
export const PERMISSIONS = {
  dashboard: 'Dashboard (operational stats)',
  users: 'Customers',
  vendors: 'Vendors & verification',
  properties: 'Properties & listing approval',
  catalog: 'Categories, amenities, destinations & vendor requests',
  inventory: 'Inventory & channel manager',
  bookings: 'Bookings (hotel / bus / flight)',
  coupons: 'Coupons & offers',
  content: 'Banners, static pages & FAQs',
  reviews: 'Reviews moderation',
  support: 'Support tickets',
  seo: 'SEO CMS (hotels, itineraries, articles, sitemap)',
  media: 'Media library',
  appearance: 'Theme & app features',
  integrations: 'API integrations & providers',
  // ── Revenue group (master only) ──
  finance: 'Revenue, transactions & refunds amounts',
  payouts: 'Vendor payouts',
  commission: 'Commission rules',
  revenue_reports: 'Financial reports',
};

export const REVENUE_PERMISSIONS = ['finance', 'payouts', 'commission', 'revenue_reports'];

export const SUBADMIN_ASSIGNABLE = Object.keys(PERMISSIONS).filter(
  (p) => !REVENUE_PERMISSIONS.includes(p),
);

/** Fields removed from any payload served to a sub-admin. */
export const REVENUE_FIELDS = ['commission', 'vendorPayoutAmount', 'platformEarning', 'payout'];
