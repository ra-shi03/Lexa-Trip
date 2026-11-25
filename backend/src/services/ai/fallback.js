import { addDays, isoDay, toDay } from '../../utils/helpers.js';

/**
 * Rule-based natural-language parser used when no AI key is configured
 * (and as a safety net if the AI call fails). Handles common Indian travel phrasing.
 */
const CATEGORY_WORDS = {
  villas: ['villa', 'villas', 'private pool'],
  resorts: ['resort', 'resorts'],
  hostels: ['hostel', 'hostels', 'backpacker', 'dorm'],
  'guest-houses': ['guest house', 'guesthouse'],
  homestays: ['homestay', 'home stay'],
  'serviced-apartments': ['apartment', 'serviced'],
  hotels: ['hotel', 'hotels'],
};
const AMENITY_WORDS = {
  'swimming-pool': ['pool', 'swimming'],
  spa: ['spa', 'massage', 'ayurveda'],
  'free-wifi': ['wifi', 'wi-fi', 'internet'],
  breakfast: ['breakfast'],
  parking: ['parking'],
  gym: ['gym', 'fitness'],
  'pet-friendly': ['pet', 'dog'],
  restaurant: ['restaurant'],
  'airport-shuttle': ['airport'],
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseDates(t) {
  const today = toDay(new Date());
  let checkIn;
  let nights;
  const m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*(?:to|-|till|until)\s*(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?)?/);
  if (m) {
    const mon = MONTHS.indexOf(m[2]);
    let y = today.getUTCFullYear();
    let d = new Date(Date.UTC(y, mon, +m[1]));
    if (d < today) d = new Date(Date.UTC(++y, mon, +m[1]));
    checkIn = d;
    if (m[3]) {
      const mon2 = m[4] ? MONTHS.indexOf(m[4]) : mon;
      let out = new Date(Date.UTC(y, mon2, +m[3]));
      if (out <= d) out = new Date(Date.UTC(y + 1, mon2, +m[3]));
      nights = Math.round((out - d) / 86400000);
    }
  } else if (/tomorrow/.test(t)) checkIn = addDays(today, 1);
  else if (/today|tonight/.test(t)) checkIn = today;
  else if (/this weekend|weekend/.test(t)) {
    const day = today.getUTCDay();
    const add = day === 5 || day === 6 ? 0 : (5 - day + 7) % 7; // Fri/Sat → tonight
    checkIn = addDays(today, add);
    nights = nights || (day === 6 ? 1 : 2);
  } else if (/next week/.test(t)) checkIn = addDays(today, 7);

  const n = t.match(/(\d+)\s*(?:nights?|n\b)/) || t.match(/(\d+)\s*days?/);
  if (n) nights = Math.max(1, +n[1] - (/days?/.test(n[0]) ? 1 : 0));
  return checkIn ? { checkIn: isoDay(checkIn), checkOut: isoDay(addDays(checkIn, nights || 1)) } : {};
}

export function parseQueryFallback(text, cities = []) {
  const t = ` ${String(text).toLowerCase()} `;
  const out = { intent: 'hotel' };
  if (/\b(bus|buses|volvo|sleeper)\b/.test(t)) out.intent = 'bus';
  if (/\b(flight|flights|fly|airline|plane)\b/.test(t)) out.intent = 'flight';

  const found = cities
    .map((c) => ({ c, idx: Math.min(...[c.name, ...(c.aliases || [])].map((n) => { const i = t.indexOf(n.toLowerCase()); return i < 0 ? Infinity : i; })) }))
    .filter((x) => x.idx !== Infinity)
    .sort((a, b) => a.idx - b.idx);
  if (out.intent === 'hotel') out.city = found[found.length - 1]?.c.name || found[0]?.c.name;
  else {
    const fm = t.match(/from\s+([a-z ]+?)\s+to\s+([a-z ]+?)(?:\s|$|,|on|this|next|tomorrow)/);
    out.from = fm?.[1]?.trim() || found[0]?.c.name;
    out.to = fm?.[2]?.trim() || found[1]?.c.name;
  }

  Object.assign(out, parseDates(t));
  if (out.intent !== 'hotel' && out.checkIn) out.date = out.checkIn;

  const adults = t.match(/(\d+)\s*(?:adults?|people|persons?|pax|guests?)/);
  if (adults) out.adults = +adults[1];
  else if (/couple|honeymoon|wife|husband|partner/.test(t)) out.adults = 2;
  else if (/solo|alone|myself/.test(t)) out.adults = 1;
  const fam = t.match(/family of (\d+)/);
  if (fam) { out.adults = Math.min(+fam[1], 2); out.children = Math.max(0, +fam[1] - 2); }
  const kids = t.match(/(\d+)\s*(?:kids?|children|child)/);
  if (kids) out.children = +kids[1];
  const rooms = t.match(/(\d+)\s*rooms?/);
  if (rooms) out.rooms = +rooms[1];

  const budget = t.match(/(?:under|below|less than|within|budget(?: of)?|max|upto|up to)\s*(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(k)?/);
  if (budget) out.maxPrice = Math.round(+budget[1] * (budget[2] ? 1000 : 1));
  if (/cheap|budget|affordable|low cost/.test(t) && !out.maxPrice) out.sort = 'price_asc';
  if (/luxury|premium|5[ -]?star|five star/.test(t)) { out.stars = '5'; out.sort = 'rating'; }

  for (const [slug, words] of Object.entries(CATEGORY_WORDS)) if (words.some((w) => t.includes(w))) { out.category = slug; break; }
  if (out.category === 'hotels') delete out.category;
  out.amenities = Object.entries(AMENITY_WORDS).filter(([, w]) => w.some((x) => t.includes(x))).map(([s]) => s);
  if (!out.amenities.length) delete out.amenities;
  return out;
}

export function planTripFallback({ destination, days = 3, interests = [] }) {
  const ideas = [
    ['Arrival & local orientation', 'Check in, relax, and take an evening walk through the old town. Try a local dinner.'],
    ['Heritage & culture', 'Visit the main palace/fort and museum in the morning; explore local markets in the afternoon.'],
    ['Nature & viewpoints', 'Head out early to a lake, beach or viewpoint; enjoy a sunset cruise or hike.'],
    ['Food & experiences', 'Join a cooking class or food walk; book a spa session in the evening.'],
    ['Day trip', 'Take a guided day trip to a nearby attraction; return for a relaxed dinner.'],
    ['Leisure & departure', 'Slow breakfast, last-minute shopping and check-out.'],
  ];
  return {
    title: `${days}-day ${destination} trip`,
    summary: `A balanced ${days}-day plan for ${destination}${interests.length ? ` focused on ${interests.join(', ')}` : ''}. Connect an AI key in Admin → Integrations for a fully personalised plan.`,
    days: Array.from({ length: Math.min(days, 10) }, (_, i) => {
      const [title, description] = i === days - 1 && days > 1 ? ideas[5] : ideas[i % 5];
      return { day: i + 1, title, description, activities: [] };
    }),
    tips: ['Book stays early for weekends and festivals', 'Carry a valid photo ID for hotel check-in', 'Keep some cash for local markets'],
  };
}

export function seoMetaFallback({ name, city, state, type = 'hotel', keyword }) {
  const kw = keyword || `${name} ${city}`;
  return {
    title: `${name}, ${city} — Rooms, Photos & Best Price`.slice(0, 60),
    metaDescription: `Explore ${name} in ${city}, ${state}: room types, amenities, photos, itineraries and guest info. Book your stay with LexaTrip at the best price.`.slice(0, 158),
    primaryKeyword: kw.toLowerCase(),
    secondaryKeywords: [`${type} in ${city}`, `${city} ${type} booking`, `best ${type}s in ${city}`].map((s) => s.toLowerCase()),
    longTailKeywords: [`${name} ${city} room price`, `${name} ${city} reviews and photos`, `luxury stay near ${city} lake`].map((s) => s.toLowerCase()),
    h1: `${name}, ${city}`,
    outline: ['Overview', 'Rooms & suites', 'Dining', 'Facilities & amenities', 'Nearby attractions', 'How to reach', 'FAQs'],
    faqs: [
      { question: `What is the check-in time at ${name}?`, answer: 'Please refer to the hotel policies section above.' },
      { question: `How far is ${name} from ${city} city centre?`, answer: 'See the location section for distance and directions.' },
    ],
  };
}
