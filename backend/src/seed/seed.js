/* eslint-disable no-console */
/**
 * Development seed — DROPS the database and loads demo data + the SEO pilot:
 *   Rajasthan → Udaipur → Bamboo Saa Resort & Spa
 * Run: npm run seed      (refuses to run when NODE_ENV=production)
 *
 * NOTE: Demo properties are fictional. The Bamboo Saa pilot profile uses generic,
 * clearly-marked placeholder copy and stock photos — replace with verified hotel
 * details before switching the page to "index".
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Admin from '../models/Admin.js';
import Vendor from '../models/Vendor.js';
import User from '../models/User.js';
import Setting from '../models/Setting.js';
import Property from '../models/Property.js';
import RoomType from '../models/RoomType.js';
import { PricingRule } from '../models/Inventory.js';
import { State, City } from '../models/Location.js';
import { Category, Amenity, Coupon, Banner, Page, Faq, CommissionRule } from '../models/Catalog.js';
import { Review } from '../models/Misc.js';
import HotelCategory from '../models/seo/HotelCategory.js';
import SeoHotel from '../models/seo/SeoHotel.js';
import Itinerary from '../models/seo/Itinerary.js';
import SeoArticle from '../models/seo/SeoArticle.js';
import { Revision } from '../models/seo/Revision.js';
import { DEFAULT_SETTINGS } from '../constants/defaultSettings.js';
import { slugify, addDays } from '../utils/helpers.js';

if (env.isProd) {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

const U = (id, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;
const IMG = {
  pool: U('photo-1566073771259-6a8506099945'),
  resort: U('photo-1571896349842-33c89424de2d'),
  resortPool: U('photo-1520250497591-112f2f40a3f4'),
  hotel: U('photo-1542314831-068cd1dbfeeb'),
  lobby: U('photo-1551882547-ff40c63fe5fa'),
  room1: U('photo-1582719478250-c89cae4dc85b', 900),
  room2: U('photo-1618773928121-c32242e63f39', 900),
  room3: U('photo-1590490360182-c33d57733427', 900),
  room4: U('photo-1611892440504-42a792e24d32', 900),
  room5: U('photo-1578683010236-d716f9a3f461', 900),
  villa: U('photo-1613490493576-7fde63acd811'),
  villa2: U('photo-1596394516093-501ba68a0ba6'),
  hostel: U('photo-1555854877-bab0e564b8d5'),
  bedroom: U('photo-1505693416388-ac5ce068fe85', 900),
  spa: U('photo-1544161515-4ab6ce6db874', 900),
  dining: U('photo-1414235077428-338989a2e8c0', 900),
  udaipur: U('photo-1615836245337-f5b9b2303f10'),
  jaipur: U('photo-1477587458883-47145ed94245'),
  goa: U('photo-1512343879784-a960bf40e7f2'),
  manali: U('photo-1626621341517-bbf3d9990a23'),
  kerala: U('photo-1602216056096-3b40cc0c9944'),
  mumbai: U('photo-1570168007204-dfb528c6958f'),
  delhi: U('photo-1587474260584-136574528ed5'),
};

async function run() {
  await mongoose.connect(env.mongoUri);
  console.log(`Seeding ${mongoose.connection.name} … (dropping existing data)`);
  try {
    await mongoose.connection.dropDatabase();
  } catch {
    // Some hosted users (e.g. Atlas readWrite) cannot drop databases → drop collections one by one
    for (const c of await mongoose.connection.db.listCollections().toArray()) await mongoose.connection.db.dropCollection(c.name);
  }
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).syncIndexes()));

  // ── Settings ──
  await Setting.create({ key: 'global', ...DEFAULT_SETTINGS });

  // ── Staff ──
  const master = await Admin.create({ name: 'Master Admin', email: env.seed.adminEmail, password: env.seed.adminPassword, role: 'master' });
  await Admin.create({
    name: 'Operations Sub-admin',
    email: 'subadmin@lexatrip.com',
    password: 'Subadmin@123',
    role: 'subadmin',
    permissions: ['dashboard', 'users', 'vendors', 'properties', 'catalog', 'inventory', 'bookings', 'reviews', 'support', 'seo', 'media', 'content', 'coupons'],
    createdBy: master._id,
  });

  // ── Catalogue ──
  const cats = await Category.insertMany([
    { name: 'Hotels', slug: 'hotels', icon: 'building-2', sortOrder: 1 },
    { name: 'Villas', slug: 'villas', icon: 'home', sortOrder: 2 },
    { name: 'Resorts', slug: 'resorts', icon: 'palmtree', sortOrder: 3 },
    { name: 'Hostels', slug: 'hostels', icon: 'bed-double', sortOrder: 4 },
    { name: 'Guest Houses', slug: 'guest-houses', icon: 'house', sortOrder: 5 },
    { name: 'Homestays', slug: 'homestays', icon: 'heart-handshake', sortOrder: 6 },
    { name: 'Serviced Apartments', slug: 'serviced-apartments', icon: 'building', sortOrder: 7 },
  ]);
  const cat = Object.fromEntries(cats.map((c) => [c.slug, c._id]));

  const amenityList = [
    ['Free WiFi', 'wifi', 'general'], ['Swimming pool', 'waves', 'wellness'], ['Spa', 'flower-2', 'wellness'], ['Breakfast', 'coffee', 'food'],
    ['Parking', 'car', 'general'], ['Gym', 'dumbbell', 'wellness'], ['Restaurant', 'utensils', 'food'], ['Air conditioning', 'snowflake', 'room'],
    ['Room service', 'bell', 'room'], ['Pet friendly', 'paw-print', 'family'], ['Airport shuttle', 'plane', 'general'], ['Bar', 'wine', 'food'],
    ['Lake view', 'mountain', 'general'], ['Beach access', 'umbrella', 'general'], ['Kids play area', 'baby', 'family'], ['Power backup', 'zap', 'safety'],
    ['24x7 front desk', 'clock', 'general'], ['Wheelchair accessible', 'accessibility', 'accessibility'], ['CCTV', 'cctv', 'safety'], ['Kitchen', 'chef-hat', 'room'],
  ];
  const ams = await Amenity.insertMany(amenityList.map(([name, icon, group]) => ({ name, slug: slugify(name), icon, group })));
  const am = (...names) => names.map((n) => ams.find((a) => a.name === n)._id);

  // ── Destinations ──
  const stateDefs = [
    ['Rajasthan', 'RJ', IMG.udaipur], ['Goa', 'GA', IMG.goa], ['Himachal Pradesh', 'HP', IMG.manali],
    ['Kerala', 'KL', IMG.kerala], ['Delhi', 'DL', IMG.delhi], ['Maharashtra', 'MH', IMG.mumbai],
  ];
  const states = {};
  for (const [i, [name, code, image]] of stateDefs.entries()) {
    states[name] = await State.create({ name, slug: slugify(name), code, image, sortOrder: i, status: 'published' });
  }
  const cityDefs = [
    ['Udaipur', 'Rajasthan', IMG.udaipur, ['Lake City', 'City of Lakes'], { lat: 24.5854, lng: 73.7125 }],
    ['Jaipur', 'Rajasthan', IMG.jaipur, ['Pink City'], { lat: 26.9124, lng: 75.7873 }],
    ['Jodhpur', 'Rajasthan', undefined, ['Blue City'], { lat: 26.2389, lng: 73.0243 }],
    ['Goa', 'Goa', IMG.goa, ['North Goa', 'Calangute', 'Baga', 'Panaji'], { lat: 15.4909, lng: 73.8278 }],
    ['Manali', 'Himachal Pradesh', IMG.manali, ['Kullu Manali'], { lat: 32.2432, lng: 77.1892 }],
    ['Kochi', 'Kerala', IMG.kerala, ['Cochin'], { lat: 9.9312, lng: 76.2673 }],
    ['New Delhi', 'Delhi', IMG.delhi, ['Delhi'], { lat: 28.6139, lng: 77.209 }],
    ['Mumbai', 'Maharashtra', IMG.mumbai, ['Bombay'], { lat: 19.076, lng: 72.8777 }],
  ];
  const cities = {};
  for (const [i, [name, st, image, aliases, geo]] of cityDefs.entries()) {
    cities[name] = await City.create({ name, slug: slugify(name), state: states[st]._id, image, aliases, geo, isPopular: true, sortOrder: i, status: 'published' });
  }

  // ── Vendor & properties (fictional demo data) ──
  const vendor = await Vendor.create({
    name: 'Demo Partner', email: 'vendor@lexatrip.com', phone: '9812345678', password: 'Vendor@123', businessName: 'Demo Hospitality Pvt Ltd',
    businessType: 'company', status: 'approved', bank: { accountHolder: 'Demo Hospitality Pvt Ltd', accountNumber: '000123456789', ifsc: 'HDFC0000001', bankName: 'HDFC Bank' },
  });
  await Vendor.create({ name: 'Pending Partner', email: 'pending@lexatrip.com', phone: '9812345679', password: 'Vendor@123', businessName: 'Sunrise Stays', status: 'pending' });

  const rate = (refundableDelta = 0, breakfast = 600) => [
    { name: 'Room only · Free cancellation', code: 'EP-FLEX', mealPlan: 'EP', refundable: true, priceAdjustment: refundableDelta },
    { name: 'Breakfast included · Free cancellation', code: 'CP-FLEX', mealPlan: 'CP', refundable: true, priceAdjustment: refundableDelta + breakfast },
    { name: 'Room only · Non-refundable (save 10%)', code: 'EP-NR', mealPlan: 'EP', refundable: false, priceAdjustment: -Math.round(breakfast * 0.8) },
  ];

  const propertyDefs = [
    {
      name: 'Lakeside Haveli Retreat', city: 'Udaipur', category: 'hotels', star: 4, area: 'Lal Ghat', images: [IMG.hotel, IMG.lobby, IMG.room1, IMG.room2],
      short: 'Heritage-style haveli steps from the lake ghats with rooftop dining and sunset views.', featured: true,
      amenities: am('Free WiFi', 'Breakfast', 'Restaurant', 'Air conditioning', 'Room service', 'Lake view', '24x7 front desk'),
      rooms: [
        { name: 'Deluxe Room', basePrice: 4200, weekendPrice: 4800, totalRooms: 10, maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedType: 'King', sizeSqft: 260, images: [IMG.room1] },
        { name: 'Lake View Suite', basePrice: 7600, weekendPrice: 8600, totalRooms: 4, maxAdults: 3, maxChildren: 2, maxOccupancy: 4, bedType: 'King', sizeSqft: 420, view: 'Lake', images: [IMG.room2] },
      ],
    },
    {
      name: 'Aravalli Hills Resort & Spa', city: 'Udaipur', category: 'resorts', star: 5, area: 'Badi Road', images: [IMG.resort, IMG.resortPool, IMG.spa, IMG.room3],
      short: 'Hillside luxury resort with infinity pool, Ayurvedic spa and private-pool villas.', featured: true,
      amenities: am('Free WiFi', 'Swimming pool', 'Spa', 'Breakfast', 'Parking', 'Gym', 'Restaurant', 'Bar', 'Airport shuttle', 'Kids play area'),
      rooms: [
        { name: 'Premier Room', basePrice: 9800, weekendPrice: 11500, totalRooms: 18, maxAdults: 2, maxChildren: 2, maxOccupancy: 3, bedType: 'King', sizeSqft: 380, images: [IMG.room3] },
        { name: 'Pool Villa', basePrice: 21000, weekendPrice: 24500, totalRooms: 5, maxAdults: 3, maxChildren: 2, maxOccupancy: 5, bedType: 'King', sizeSqft: 1100, view: 'Hills', images: [IMG.villa] },
      ],
    },
    {
      name: 'Pink City Courtyard Hotel', city: 'Jaipur', category: 'hotels', star: 3, area: 'C-Scheme', images: [IMG.lobby, IMG.room4, IMG.dining],
      short: 'Smart, central hotel near MI Road — ideal for sightseeing and business trips.', featured: true,
      amenities: am('Free WiFi', 'Breakfast', 'Parking', 'Restaurant', 'Air conditioning', 'Power backup'),
      rooms: [
        { name: 'Standard Room', basePrice: 2400, weekendPrice: 2800, totalRooms: 20, maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedType: 'Queen', sizeSqft: 200, images: [IMG.room4] },
        { name: 'Family Room', basePrice: 3900, weekendPrice: 4400, totalRooms: 6, maxAdults: 4, maxChildren: 2, maxOccupancy: 5, bedType: '2 Queens', sizeSqft: 320, images: [IMG.room5] },
      ],
    },
    {
      name: 'Palm Grove Beach Villa', city: 'Goa', category: 'villas', star: 0, area: 'Candolim', images: [IMG.villa, IMG.villa2, IMG.pool, IMG.bedroom],
      short: 'Private 3-bedroom villa with pool, 5 minutes from Candolim beach.', featured: true,
      amenities: am('Free WiFi', 'Swimming pool', 'Parking', 'Kitchen', 'Air conditioning', 'Pet friendly'),
      rooms: [{ name: 'Entire Villa (3 BHK)', basePrice: 18500, weekendPrice: 22000, totalRooms: 1, maxAdults: 6, maxChildren: 3, maxOccupancy: 8, baseOccupancy: 6, bedType: '3 Kings', sizeSqft: 2400, images: [IMG.villa2] }],
    },
    {
      name: 'Coastline Backpackers Hostel', city: 'Goa', category: 'hostels', star: 0, area: 'Anjuna', images: [IMG.hostel, IMG.bedroom],
      short: 'Social hostel with dorms and privates, café and weekly beach events.',
      amenities: am('Free WiFi', 'Breakfast', 'Bar', 'CCTV'),
      rooms: [
        { name: 'Bed in 6-bed Mixed Dorm', basePrice: 650, weekendPrice: 850, totalRooms: 24, maxAdults: 1, maxChildren: 0, maxOccupancy: 1, baseOccupancy: 1, bedType: 'Bunk', images: [IMG.hostel] },
        { name: 'Private Double', basePrice: 2100, weekendPrice: 2600, totalRooms: 4, maxAdults: 2, maxChildren: 0, maxOccupancy: 2, bedType: 'Double', images: [IMG.bedroom] },
      ],
    },
    {
      name: 'Pine Valley Homestay', city: 'Manali', category: 'homestays', star: 0, area: 'Old Manali', images: [IMG.bedroom, IMG.room5],
      short: 'Family-run homestay with mountain views, home-cooked Himachali meals and bonfire evenings.', featured: true,
      amenities: am('Free WiFi', 'Breakfast', 'Parking', 'Power backup'),
      rooms: [{ name: 'Mountain View Room', basePrice: 2200, weekendPrice: 2700, totalRooms: 5, maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedType: 'Queen', images: [IMG.room5] }],
    },
    {
      name: 'Backwater Serviced Apartments', city: 'Kochi', category: 'serviced-apartments', star: 0, area: 'Marine Drive', images: [IMG.room4, IMG.lobby],
      short: 'Fully-furnished 1BHK and 2BHK apartments with kitchen — perfect for long stays.',
      amenities: am('Free WiFi', 'Kitchen', 'Parking', 'Air conditioning', 'Gym'),
      rooms: [{ name: '1 BHK Apartment', basePrice: 3600, weekendPrice: 3900, totalRooms: 8, maxAdults: 3, maxChildren: 1, maxOccupancy: 4, bedType: 'King', sizeSqft: 650, images: [IMG.room4] }],
    },
    {
      name: 'Marine Drive Business Hotel', city: 'Mumbai', category: 'hotels', star: 4, area: 'Churchgate', images: [IMG.hotel, IMG.room1, IMG.dining],
      short: 'Business hotel with sea-facing rooms, co-working lounge and all-day dining.',
      amenities: am('Free WiFi', 'Breakfast', 'Gym', 'Restaurant', 'Air conditioning', 'Room service', 'Airport shuttle'),
      rooms: [{ name: 'Executive Room', basePrice: 8200, weekendPrice: 7600, totalRooms: 25, maxAdults: 2, maxChildren: 1, maxOccupancy: 3, bedType: 'King', sizeSqft: 300, images: [IMG.room1] }],
    },
  ];

  const properties = {};
  for (const d of propertyDefs) {
    const c = cities[d.city];
    const p = await Property.create({
      vendor: vendor._id,
      name: d.name,
      slug: slugify(`${d.name} ${d.city}`),
      category: cat[d.category],
      starRating: d.star,
      shortDescription: d.short,
      description: `<p>${d.short}</p><p>This is a <b>demo listing</b> created by the seed script to showcase the LexaTrip booking flow.</p>`,
      address: { line1: `${d.area}`, area: d.area, city: c._id, state: c.state, pincode: '' },
      geo: c.geo,
      images: d.images.map((url, i) => ({ url, alt: `${d.name}, ${d.city} — photo ${i + 1}` })),
      amenities: d.amenities,
      houseRules: ['Valid government photo ID required at check-in', 'No smoking inside rooms', 'Visitors allowed in common areas only'],
      childPolicy: 'Children up to 5 years stay free using existing bedding.',
      cancellationPolicy: { type: 'free', freeCancellationHours: 48, text: 'Free cancellation up to 48 hours before check-in. After that, the first night is charged.' },
      contact: { phone: '', email: 'stay@example.com' },
      status: 'approved',
      isFeatured: Boolean(d.featured),
      minPrice: Math.min(...d.rooms.map((r) => r.basePrice)),
      rating: { avg: 0, count: 0 },
    });
    for (const r of d.rooms) {
      await RoomType.create({
        property: p._id,
        ...r,
        description: `${r.name} at ${d.name}.`,
        images: r.images.map((url) => ({ url, alt: `${r.name} — ${d.name}` })),
        baseOccupancy: r.baseOccupancy ?? 2,
        extraAdultCharge: 900,
        extraChildCharge: 500,
        ratePlans: d.category === 'hostels' ? [rate(0, 250)[0], rate(0, 250)[1]] : rate(0, Math.round(r.basePrice * 0.12)),
      });
    }
    properties[d.name] = p;
  }

  // Seasonal pricing: Udaipur peak season (Christmas–New Year)
  const y = new Date().getUTCFullYear();
  await PricingRule.create({ property: properties['Aravalli Hills Resort & Spa']._id, name: 'Peak season (Christmas–New Year)', type: 'seasonal', startDate: new Date(Date.UTC(y, 11, 20)), endDate: new Date(Date.UTC(y + 1, 0, 5)), adjustmentType: 'percent', value: 25, priority: 10 });
  await PricingRule.create({ property: properties['Lakeside Haveli Retreat']._id, name: 'Monsoon offer', type: 'seasonal', startDate: new Date(Date.UTC(y + 1, 6, 1)), endDate: new Date(Date.UTC(y + 1, 8, 15)), adjustmentType: 'percent', value: -15, priority: 5 });

  // ── Guests & reviews ──
  const users = await User.insertMany([
    { name: 'Rohit Sharma', phone: '9876543210', email: 'rohit@example.com' },
    { name: 'Ananya Iyer', phone: '9876543211', email: 'ananya@example.com' },
    { name: 'Kabir Mehta', phone: '9876543212', email: 'kabir@example.com' },
  ]);
  const reviewTexts = [
    [5, 'Stunning stay', 'Beautiful property, very helpful staff and spotless rooms. Breakfast spread was excellent.'],
    [4, 'Great location', 'Loved the location and views. Check-in took a little long but the team was polite.'],
    [5, 'Perfect for families', 'Kids loved the pool. Rooms were spacious and quiet. Would come back.'],
  ];
  for (const p of Object.values(properties).slice(0, 4)) {
    for (const [i, u] of users.entries()) {
      const [rating, title, comment] = reviewTexts[i];
      await Review.create({ property: p._id, user: u._id, rating, title, comment, status: 'approved' });
    }
    await Property.updateOne({ _id: p._id }, { rating: { avg: 4.7, count: 3 } });
  }

  // ── Commerce & content ──
  await CommissionRule.create({ name: 'Default platform commission', scope: 'global', type: 'percent', value: 15 });
  await CommissionRule.create({ name: 'Bus convenience share', scope: 'service', service: 'bus', type: 'percent', value: 8 });
  await CommissionRule.create({ name: 'Flight convenience share', scope: 'service', service: 'flight', type: 'flat', value: 250 });
  await Coupon.insertMany([
    { code: 'LEXA10', title: '10% off stays', description: 'Get 10% off on hotels & villas (max ₹1,500).', discountType: 'percent', value: 10, maxDiscount: 1500, minAmount: 2000, services: ['hotel'], perUserLimit: 3 },
    { code: 'FIRSTTRIP', title: '₹500 off your first trip', description: 'Flat ₹500 off on bookings above ₹3,000.', discountType: 'flat', value: 500, minAmount: 3000, services: ['hotel', 'bus', 'flight'], perUserLimit: 1 },
    { code: 'BUS100', title: '₹100 off bus tickets', description: 'Flat ₹100 off on bus bookings above ₹800.', discountType: 'flat', value: 100, minAmount: 800, services: ['bus'] },
  ]);
  await Banner.insertMany([
    { title: 'Monsoon in the Lake City', subtitle: 'Up to 25% off Udaipur stays', image: IMG.udaipur, link: '/search?city=Udaipur', ctaLabel: 'Explore Udaipur', placement: 'home_offers', sortOrder: 1 },
    { title: 'Beach villas for the gang', subtitle: 'Private pools in North Goa', image: IMG.goa, link: '/search?city=Goa&category=villas', ctaLabel: 'View villas', placement: 'home_offers', sortOrder: 2 },
    { title: 'Mountains are calling', subtitle: 'Cosy homestays in Manali', image: IMG.manali, link: '/search?city=Manali', ctaLabel: 'Find stays', placement: 'home_offers', sortOrder: 3 },
  ]);
  const legal = (t) => `<p>This is placeholder text for the <b>${t}</b> page. Replace it from Admin → Content → Pages with text reviewed by your legal advisor.</p>`;
  await Page.insertMany([
    { title: 'About us', slug: 'about-us', content: '<p>LexaTrip helps travellers book hotels, villas, resorts, buses and flights across India. <b>Book. Explore. Repeat.</b></p>' },
    { title: 'Contact us', slug: 'contact-us', content: '<p>Email: support@lexatrip.com</p><p>We usually respond within 24 hours.</p>' },
    { title: 'Terms & conditions', slug: 'terms-and-conditions', content: legal('Terms & conditions') },
    { title: 'Privacy policy', slug: 'privacy-policy', content: legal('Privacy policy') },
    { title: 'Cancellation & refund policy', slug: 'cancellation-policy', content: legal('Cancellation & refund policy') },
  ]);
  await Faq.insertMany([
    { category: 'booking', question: 'How do I know my booking is confirmed?', answer: 'You will see a confirmation screen with your booking ID, and receive an email and in-app notification with your voucher.', sortOrder: 1 },
    { category: 'booking', question: 'Can I book for someone else?', answer: 'Yes. Enter the guest’s name and contact details as the primary guest during checkout.', sortOrder: 2 },
    { category: 'payment', question: 'Which payment methods are accepted?', answer: 'Cards, UPI, net banking and wallets, depending on the payment gateway configured.', sortOrder: 1 },
    { category: 'cancellation', question: 'How do refunds work?', answer: 'Refunds follow the property’s cancellation policy shown before payment and are credited to the original payment method in 5–7 working days.', sortOrder: 1 },
    { category: 'bus', question: 'Do I need to print my bus ticket?', answer: 'Most operators accept the m-ticket shown in the app along with a valid photo ID.', sortOrder: 1 },
    { category: 'flight', question: 'When will I get my PNR?', answer: 'Your PNR is shown immediately after the airline confirms the ticket.', sortOrder: 1 },
  ]);

  // ══════════════ SEO CMS PILOT: Rajasthan → Udaipur → Bamboo Saa Resort & Spa ══════════════
  const raj = states.Rajasthan;
  const udr = cities.Udaipur;
  await State.updateOne({ _id: raj._id }, {
    content: { h1: 'Rajasthan Travel Guide', intro: '<p>Palaces, lakes, desert forts and vibrant bazaars — plan your Rajasthan holiday with LexaTrip city guides, itineraries and handpicked stays.</p>', sections: [] },
    seo: { title: 'Rajasthan Travel Guide — Cities, Stays & Itineraries', metaDescription: 'Plan a Rajasthan trip: Udaipur, Jaipur and Jodhpur guides, the best hotels and resorts, and day-wise itineraries. Book with LexaTrip.', primaryKeyword: 'rajasthan travel guide', robots: { index: true, follow: true } },
  });
  await City.updateOne({ _id: udr._id }, {
    description: 'The City of Lakes — palaces, ghats and Aravalli sunsets.',
    content: {
      h1: 'Hotels & Resorts in Udaipur, Rajasthan',
      intro: '<p>Udaipur, the City of Lakes, is known for Lake Pichola, the City Palace and its hillside resorts in the Aravallis. Compare handpicked hotels, heritage havelis and luxury resorts below.</p>',
      sections: [{ heading: 'Best areas to stay in Udaipur', level: 'h2', body: '<p><b>Lake Pichola &amp; Lal Ghat</b> for walkable old-city charm; <b>Fateh Sagar</b> for quieter lakeside stays; and the <b>Aravalli foothills</b> for spacious resorts with pools and spas.</p>' }],
    },
    seo: { title: 'Hotels in Udaipur — Lakeside Stays & Luxury Resorts', metaDescription: 'Find the best hotels and resorts in Udaipur, Rajasthan: lake-view havelis, luxury spa resorts and family stays. Photos, rooms and itineraries on LexaTrip.', primaryKeyword: 'hotels in udaipur', secondaryKeywords: ['resorts in udaipur', 'luxury hotels udaipur', 'lake view hotels udaipur'], robots: { index: true, follow: true } },
  });

  const templates = DEFAULT_SETTINGS.seo.hotelCategoryTemplates;
  const hc = {};
  for (const [i, t] of templates.entries()) {
    hc[t.slug] = await HotelCategory.create({
      city: udr._id, state: raj._id, name: t.name, slug: t.slug, starRating: t.starRating, sortOrder: i, status: 'published', publishedAt: new Date(),
      content: { h1: `${t.name} in Udaipur`, intro: `<p>Our pick of ${t.name.toLowerCase()} in Udaipur, Rajasthan — compare rooms, amenities and itineraries.</p>`, sections: [] },
      seo: { title: `${t.name} in Udaipur | Compare & Book`, metaDescription: `Browse ${t.name.toLowerCase()} in Udaipur with photos, room details, amenities and curated itineraries. Book securely on LexaTrip.`, primaryKeyword: `${t.name.toLowerCase()} in udaipur`, robots: { index: true, follow: true } },
      createdBy: master._id,
    });
  }

  const PILOT_NOTE = 'PILOT PLACEHOLDER: replace generic copy, rooms and stock photos with verified Bamboo Saa details, then switch Robots → index.';
  const bamboo = await SeoHotel.create({
    name: 'Bamboo Saa Resort & Spa',
    slug: 'bamboo-saa-resort-spa',
    state: raj._id,
    city: udr._id,
    categories: [hc['luxury-resorts']._id],
    propertyType: 'Resort',
    starRating: undefined,
    shortDescription: 'A resort and spa retreat in Udaipur, Rajasthan — rooms, dining, wellness, curated itineraries and guest information. (Pilot profile — details to be verified.)',
    description: '<p>Bamboo Saa Resort &amp; Spa is the pilot hotel profile for the LexaTrip SEO CMS. This description is placeholder text: replace it with verified information about the property, its setting and what makes it special.</p>',
    address: { line1: '', area: '', pincode: '', full: 'Udaipur, Rajasthan, India' },
    contact: { phone: '', email: '', website: '' },
    checkInTime: '14:00',
    checkOutTime: '11:00',
    priceRange: '₹₹₹',
    rooms: [
      { name: 'Deluxe Room (placeholder)', description: 'Replace with verified room description.', occupancy: '2 adults + 1 child', amenities: ['Air conditioning', 'Free WiFi'], images: [{ url: IMG.room3, alt: 'Deluxe room — placeholder photo' }] },
      { name: 'Suite (placeholder)', description: 'Replace with verified suite description.', occupancy: '2 adults + 2 children', amenities: ['Air conditioning', 'Free WiFi', 'Sitting area'], images: [{ url: IMG.room2, alt: 'Suite — placeholder photo' }] },
    ],
    facilities: ['Restaurant', 'Spa', 'Swimming pool', 'Parking'],
    amenities: ['Free WiFi', 'Air conditioning', 'Room service'],
    policies: [
      { title: 'Check-in / check-out', text: 'Check-in from 14:00, check-out until 11:00 (verify with property).' },
      { title: 'ID proof', text: 'Valid government-issued photo ID required for all adult guests.' },
    ],
    heroImage: { url: IMG.resortPool, alt: 'Resort pool in Udaipur — placeholder photo for Bamboo Saa Resort & Spa' },
    gallery: [
      { url: IMG.resort, alt: 'Resort exterior — placeholder photo' },
      { url: IMG.spa, alt: 'Spa treatment room — placeholder photo' },
      { url: IMG.dining, alt: 'Restaurant — placeholder photo' },
      { url: IMG.room3, alt: 'Guest room — placeholder photo' },
    ],
    content: {
      h1: 'Bamboo Saa Resort & Spa, Udaipur',
      intro: '<p>Plan your stay at Bamboo Saa Resort &amp; Spa in Udaipur with room details, dining, spa and wellness information, and ready-made itineraries to explore the City of Lakes.</p>',
      sections: [
        { heading: 'Overview', level: 'h2', body: '<p>[Add a verified overview of the resort: setting, style, and ideal guests.]</p>' },
        { heading: 'Dining', level: 'h2', body: '<p>[Add verified restaurant names, cuisines and timings.]</p>' },
        { heading: 'Spa & wellness', level: 'h2', body: '<p>[Add verified spa therapies, pool and fitness facilities.]</p>' },
        { heading: 'Location & how to reach', level: 'h2', body: '<p>Udaipur is served by Maharana Pratap Airport (UDR) and Udaipur City railway station. [Add verified distances from the resort.]</p>' },
      ],
    },
    faqs: [
      { question: 'What are the check-in and check-out times at Bamboo Saa Resort & Spa?', answer: '<p>Standard check-in is from 2 PM and check-out until 11 AM. Please confirm with the property for early check-in.</p>' },
      { question: 'Which airport is closest to Bamboo Saa Resort & Spa, Udaipur?', answer: '<p>The nearest airport is Maharana Pratap Airport (UDR), Udaipur.</p>' },
      { question: 'Is there a spa at the resort?', answer: '<p>Yes — the resort offers spa and wellness facilities. [Verify treatments and timings.]</p>' },
    ],
    seo: {
      title: 'Bamboo Saa Resort & Spa Udaipur — Rooms, Spa & Itineraries',
      metaDescription: 'Explore Bamboo Saa Resort & Spa in Udaipur: rooms, dining, spa, nearby attractions and day-wise itineraries. Check prices and book your stay with LexaTrip.',
      primaryKeyword: 'bamboo saa resort udaipur',
      secondaryKeywords: ['bamboo saa resort and spa', 'resort in udaipur with spa', 'luxury resorts in udaipur'],
      longTailKeywords: ['bamboo saa resort udaipur room price', 'bamboo saa resort udaipur itinerary', 'best spa resort near udaipur for couples'],
      robots: { index: false, follow: true },
      sitemap: { include: true, priority: 0.8, changefreq: 'weekly' },
    },
    internalLinks: [{ label: 'Rajasthan travel guide', url: '/blog/rajasthan/' }],
    status: 'published',
    publishedAt: new Date(),
    reviewNotes: PILOT_NOTE,
    createdBy: master._id,
  });

  const itin = await Itinerary.create({
    hotel: bamboo._id,
    title: '3-Day Udaipur Escape from Bamboo Saa Resort & Spa',
    slug: '3-day-udaipur-escape',
    durationDays: 3,
    durationNights: 2,
    travellerType: 'Couples',
    summary: 'A relaxed three-day plan combining resort downtime with Udaipur’s lakes, palaces and old-city lanes.',
    heroImage: { url: IMG.udaipur, alt: 'Lake Pichola, Udaipur' },
    days: [
      { day: 1, title: 'Arrive, unwind & spa evening', description: '<p>Check in, settle into your room and enjoy a slow lunch. Book a spa therapy for the late afternoon and finish with dinner at the resort.</p>', activities: [{ time: '14:00', title: 'Check-in' }, { time: '17:00', title: 'Spa session', description: 'Pre-book at reception.' }, { time: '20:00', title: 'Dinner at the resort' }], meals: ['Dinner'] },
      { day: 2, title: 'Palaces, lakes & old city', description: '<p>Spend the day in the old city: the City Palace complex, Jagdish Temple and a boat ride on Lake Pichola. In the evening, watch the Dharohar folk-dance show at Bagore ki Haveli.</p>', activities: [{ time: '09:30', title: 'City Palace' }, { time: '12:30', title: 'Jagdish Temple & old-city lanes' }, { time: '16:30', title: 'Boat ride on Lake Pichola' }, { time: '19:00', title: 'Bagore ki Haveli cultural show' }], meals: ['Breakfast'] },
      { day: 3, title: 'Gardens, sunset point & departure', description: '<p>Visit Saheliyon ki Bari and the Fateh Sagar lakefront, then head up to Sajjangarh (Monsoon Palace) for views before departure.</p>', activities: [{ time: '09:00', title: 'Saheliyon ki Bari' }, { time: '11:00', title: 'Fateh Sagar Lake' }, { time: '16:30', title: 'Sajjangarh (Monsoon Palace) viewpoint' }], meals: ['Breakfast'] },
    ],
    experiences: [
      { title: 'Spa & wellness', description: 'Unwind with a massage or wellness therapy at the resort spa. [Verify treatments.]' },
      { title: 'Lake Pichola boat ride', description: 'See the City Palace and lake islands from the water, ideally at sunset.' },
      { title: 'Folk performance at Bagore ki Haveli', description: 'Evening Rajasthani dance and music show in a restored haveli.' },
    ],
    dining: [{ name: 'Resort restaurant (verify name)', cuisine: 'Indian & Continental', timings: '07:00 – 23:00', description: '[Add verified dining details.]' }],
    facilities: ['Spa', 'Swimming pool', 'Restaurant', 'Parking'],
    nearbyAttractions: [
      { name: 'City Palace', description: 'Sprawling palace complex overlooking Lake Pichola.' },
      { name: 'Lake Pichola', description: 'Udaipur’s iconic lake with boat rides and island palaces.' },
      { name: 'Jagdish Temple', description: '17th-century Indo-Aryan temple in the old city.' },
      { name: 'Fateh Sagar Lake', description: 'Lakefront promenade popular at sunset.' },
      { name: 'Sajjangarh (Monsoon Palace)', description: 'Hilltop palace with panoramic views of the city and lakes.' },
      { name: 'Saheliyon ki Bari', description: 'Garden of fountains, lotus pools and marble pavilions.' },
    ],
    guestInfo: {
      bestTimeToVisit: 'October to March for pleasant weather; July–September for monsoon greenery.',
      howToReach: 'Fly into Maharana Pratap Airport (UDR) or take a train to Udaipur City station; taxis are available to the resort.',
      checkInOut: 'Check-in 14:00 · Check-out 11:00 (verify with property)',
      whatToPack: 'Light cottons, a light jacket for winter evenings, comfortable walking shoes, and modest clothing for temples.',
      tips: ['Book the Lake Pichola boat ride for sunset', 'Carry cash for old-city markets', 'Start palace visits early to avoid crowds'],
      importantNotes: 'Itinerary timings are suggestions; check attraction opening hours before you go.',
    },
    content: { h1: '3-Day Udaipur Itinerary from Bamboo Saa Resort & Spa', intro: '', sections: [] },
    faqs: [
      { question: 'Is 3 days enough for Udaipur?', answer: '<p>Three days cover the main palaces, lakes and old city at a relaxed pace, with time to enjoy the resort.</p>' },
      { question: 'What is the best time to visit Udaipur?', answer: '<p>October to March offers the most comfortable weather for sightseeing.</p>' },
    ],
    seo: {
      title: '3-Day Udaipur Itinerary from Bamboo Saa Resort & Spa',
      metaDescription: 'A day-wise 3-day Udaipur itinerary from Bamboo Saa Resort & Spa: City Palace, Lake Pichola, spa time, dining and travel tips for couples.',
      primaryKeyword: '3 day udaipur itinerary',
      secondaryKeywords: ['udaipur itinerary for couples', 'udaipur 2 nights 3 days plan'],
      longTailKeywords: ['3 day udaipur itinerary with spa resort stay'],
      robots: { index: false, follow: true },
    },
    status: 'published',
    publishedAt: new Date(),
    reviewNotes: PILOT_NOTE,
    createdBy: master._id,
  });

  const article = await SeoArticle.create({
    title: 'Where to Stay in Udaipur: Lakeside Havelis vs Hillside Resorts',
    slug: 'where-to-stay-in-udaipur',
    state: raj._id,
    city: udr._id,
    hotels: [bamboo._id],
    excerpt: 'Old-city havelis or hillside spa resorts? A practical guide to choosing the right area and stay in Udaipur.',
    coverImage: { url: IMG.udaipur, alt: 'Lake Pichola and the old city of Udaipur' },
    content: {
      h1: 'Where to Stay in Udaipur: Lakeside Havelis vs Hillside Resorts',
      intro: '<p>Udaipur rewards slow travel. Where you stay shapes the trip — walkable lakeside lanes or quiet Aravalli hills with a pool and spa.</p>',
      sections: [
        { heading: 'Stay by Lake Pichola for old-city charm', level: 'h2', body: '<p>The ghats around Lake Pichola put you within walking distance of the City Palace, Jagdish Temple and rooftop cafés. Expect heritage havelis with character, and narrower lanes.</p>' },
        { heading: 'Choose Fateh Sagar for quieter lake views', level: 'h2', body: '<p>Fateh Sagar is calmer and greener, with a lakefront promenade that comes alive at sunset.</p>' },
        { heading: 'Pick a hillside resort for space and wellness', level: 'h2', body: '<p>Resorts in the Aravalli foothills trade walkability for space, pools and spas — ideal for couples and families who want downtime between sightseeing.</p>' },
        { heading: 'Quick tips', level: 'h3', body: '<ul><li>Visit October–March for the best weather.</li><li>Book sunset boat rides early in peak season.</li><li>Budget time for traffic if staying outside the city.</li></ul>' },
      ],
    },
    faqs: [{ question: 'Which area is best to stay in Udaipur for first-timers?', answer: '<p>The Lake Pichola area is the most convenient for first-time visitors because the main sights are walkable.</p>' }],
    seo: {
      title: 'Where to Stay in Udaipur — Best Areas & Resorts (Guide)',
      metaDescription: 'Lake Pichola, Fateh Sagar or the Aravalli hills? Our guide to the best areas to stay in Udaipur, with tips for couples and families.',
      primaryKeyword: 'where to stay in udaipur',
      secondaryKeywords: ['best area to stay in udaipur', 'udaipur resorts vs hotels'],
      robots: { index: true, follow: true },
    },
    internalLinks: [{ label: 'Hotels in Udaipur', url: '/hotels/rajasthan/udaipur/' }],
    status: 'published',
    publishedAt: new Date(),
    createdBy: master._id,
  });

  for (const [type, doc] of [['SeoHotel', bamboo], ['Itinerary', itin], ['SeoArticle', article]]) {
    await Revision.create({ entityType: type, entityId: doc._id, version: 1, status: doc.status, snapshot: doc.toObject(), note: 'Seeded pilot content', author: master._id, authorName: master.name });
  }

  console.log('\n✔ Seed complete\n');
  console.log('  Master admin   :', env.seed.adminEmail, '/', env.seed.adminPassword);
  console.log('  Sub-admin      : subadmin@lexatrip.com / Subadmin@123  (no revenue access)');
  console.log('  Vendor         : vendor@lexatrip.com / Vendor@123');
  console.log('  Guest login    : any 10-digit mobile (e.g. 9876543210) + OTP', env.devOtp);
  console.log('  SEO pilot      : /hotels/rajasthan/udaipur/bamboo-saa-resort-spa/');
  console.log('                   /hotels/rajasthan/udaipur/bamboo-saa-resort-spa/itinerary/3-day-udaipur-escape/');
  console.log('                   /blog/rajasthan/udaipur/where-to-stay-in-udaipur/');
  console.log(`  Coupons        : LEXA10, FIRSTTRIP, BUS100   (date ref ${addDays(new Date(), 0).toISOString().slice(0, 10)})\n`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
