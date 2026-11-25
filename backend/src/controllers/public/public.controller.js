import Property from '../../models/Property.js';
import RoomType from '../../models/RoomType.js';
import { State, City } from '../../models/Location.js';
import { Category, Amenity, Banner, Coupon, Page, Faq } from '../../models/Catalog.js';
import { Review } from '../../models/Misc.js';
import { getPublicSettings } from '../../services/settings.service.js';
import { searchProperties } from '../../services/search.service.js';
import { quoteHotel } from '../../services/pricing.service.js';
import { validateCoupon } from '../../services/pricing.service.js';
import { AIRPORTS } from '../../services/providers/flight/index.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, addDays } from '../../utils/helpers.js';
import { MEAL_PLANS } from '../../constants/enums.js';

const activeWindow = () => {
  const now = new Date();
  return {
    isActive: true,
    $and: [
      { $or: [{ validFrom: null }, { validFrom: { $exists: false } }, { validFrom: { $lte: now } }] },
      { $or: [{ validTo: null }, { validTo: { $exists: false } }, { validTo: { $gte: now } }] },
    ],
  };
};

/** Theme + feature flags + home layout for web and app (drives the dynamic UI) */
export async function settings(_req, res) {
  ok(res, await getPublicSettings());
}

/** Everything the home screen needs in one round-trip (fast first paint on mobile) */
export async function home(_req, res) {
  const [categories, cities, featured, heroBanners, offerBanners, offers] = await Promise.all([
    Category.find({ isActive: true, showOnHome: true }).sort({ sortOrder: 1 }).lean(),
    City.find({ isActive: true, isPopular: true }).sort({ sortOrder: 1 }).limit(12).populate('state', 'name slug').lean(),
    searchProperties({ featured: true, limit: 8 }),
    Banner.find({ ...activeWindow(), placement: 'home_hero' }).sort({ sortOrder: 1 }).lean(),
    Banner.find({ ...activeWindow(), placement: { $in: ['home_offers', 'app_home'] } }).sort({ sortOrder: 1 }).lean(),
    Coupon.find({ ...activeWindow(), isPublic: true }).select('code title description discountType value maxDiscount minAmount services validTo').limit(8).lean(),
  ]);
  const counts = await Property.aggregate([
    { $match: { status: 'approved', isVisible: true } },
    { $group: { _id: '$address.city', count: { $sum: 1 }, minPrice: { $min: '$minPrice' } } },
  ]);
  const byCity = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  ok(res, {
    categories,
    destinations: cities.map((c) => ({ ...c, propertyCount: byCity[String(c._id)]?.count || 0, priceFrom: byCity[String(c._id)]?.minPrice || null })),
    featured: featured.items,
    heroBanners,
    offerBanners,
    offers,
  });
}

export async function categories(_req, res) {
  ok(res, await Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean());
}

export async function amenities(_req, res) {
  ok(res, await Amenity.find({ isActive: true, isFilterable: true }).sort({ name: 1 }).lean());
}

/** Destination autocomplete: cities + properties */
export async function suggest(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return ok(res, { cities: [], properties: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const [cities, properties] = await Promise.all([
    City.find({ isActive: true, $or: [{ name: rx }, { aliases: rx }] }).limit(6).populate('state', 'name').lean(),
    Property.find({ status: 'approved', isVisible: true, name: rx }).limit(5).select('name slug address.area').populate('address.city', 'name').lean(),
  ]);
  ok(res, {
    cities: cities.map((c) => ({ _id: c._id, name: c.name, slug: c.slug, state: c.state?.name })),
    properties: properties.map((p) => ({ _id: p._id, name: p.name, slug: p.slug, city: p.address?.city?.name, area: p.address?.area })),
  });
}

export async function states(_req, res) {
  ok(res, await State.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select('name slug code image').lean());
}

export async function cities(req, res) {
  const filter = { isActive: true };
  if (req.query.state) filter.state = req.query.state;
  if (req.query.popular) filter.isPopular = true;
  ok(res, await City.find(filter).sort({ sortOrder: 1, name: 1 }).populate('state', 'name slug').lean());
}

export async function search(req, res) {
  const { items, meta } = await searchProperties(req.query);
  ok(res, items, meta);
}

export async function propertyDetail(req, res) {
  const key = req.params.idOrSlug;
  const property = await Property.findOne({ ...(key.match(/^[a-f0-9]{24}$/) ? { _id: key } : { slug: key }), status: 'approved', isVisible: true })
    .populate('category', 'name slug icon')
    .populate('amenities', 'name slug icon group')
    .populate({ path: 'address.city', select: 'name slug', populate: { path: 'state', select: 'name slug' } })
    .lean();
  if (!property) throw ApiError.notFound('Property not found');
  const [rooms, reviews, similar] = await Promise.all([
    RoomType.find({ property: property._id, isActive: true }).populate('amenities', 'name icon').lean(),
    Review.find({ property: property._id, status: 'approved' }).sort({ createdAt: -1 }).limit(10).populate('user', 'name').lean(),
    Property.find({ _id: { $ne: property._id }, 'address.city': property.address.city?._id, status: 'approved', isVisible: true }).limit(4).select('name slug images minPrice rating starRating').lean(),
  ]);
  ok(res, { property, rooms, reviews, similar, mealPlans: MEAL_PLANS });
}

/**
 * Room-wise live availability & price for the property page.
 * Returns every room type × active rate plan with the server-computed total.
 */
export async function propertyRates(req, res) {
  const { checkIn, checkOut, rooms = 1, adults = 2, children = 0 } = req.query;
  const ci = checkIn || addDays(new Date(), 1);
  const co = checkOut || addDays(ci, 1);
  const roomTypes = await RoomType.find({ property: req.params.id, isActive: true }).lean();
  const out = [];
  for (const rt of roomTypes) {
    const plans = rt.ratePlans?.filter((p) => p.isActive).length ? rt.ratePlans.filter((p) => p.isActive) : [{ code: 'EP' }];
    for (const plan of plans) {
      try {
        const q = await quoteHotel({ propertyId: req.params.id, roomTypeId: rt._id, ratePlanCode: plan.code, checkIn: ci, checkOut: co, rooms: +rooms, adults: +adults, children: +children });
        out.push({ roomTypeId: rt._id, ratePlan: q.ratePlan, available: q.available, reason: q.reason, roomsLeft: q.roomsLeft, nights: q.nights, pricing: q.pricing });
      } catch (e) {
        out.push({ roomTypeId: rt._id, ratePlan: { code: plan.code, name: plan.name }, available: false, reason: e.message });
      }
    }
  }
  ok(res, out);
}

export async function quote(req, res) {
  ok(res, await quoteHotel({ ...req.body, userId: req.user?._id }));
}

export async function checkCoupon(req, res) {
  const { code, service = 'hotel', amount = 0 } = req.body;
  const r = await validateCoupon(code, { service, amount: Number(amount), userId: req.user?._id });
  ok(res, { code: r.coupon.code, discount: r.discount, title: r.coupon.title });
}

export async function offers(_req, res) {
  ok(res, await Coupon.find({ ...activeWindow(), isPublic: true }).select('-usedCount -usageLimit').lean());
}

export async function page(req, res) {
  const p = await Page.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!p) throw ApiError.notFound('Page not found');
  ok(res, p);
}

export async function footerPages(_req, res) {
  ok(res, await Page.find({ isActive: true, showInFooter: true }).select('title slug').lean());
}

export async function faqs(req, res) {
  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;
  ok(res, await Faq.find(filter).sort({ category: 1, sortOrder: 1 }).lean());
}

export async function propertyReviews(req, res) {
  ok(res, await Review.find({ property: req.params.id, status: 'approved' }).sort({ createdAt: -1 }).populate('user', 'name').lean());
}

export async function airports(req, res) {
  const q = String(req.query.q || '').toLowerCase();
  ok(res, q ? AIRPORTS.filter((a) => a.code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)) : AIRPORTS);
}
