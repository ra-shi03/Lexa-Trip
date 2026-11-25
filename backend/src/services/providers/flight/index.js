import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/ApiError.js';
import { seeded, encodeId, decodeId } from '../seeded.js';

/** Major Indian airports for autocomplete (extend or replace with the provider's airport API) */
export const AIRPORTS = [
  ['DEL', 'New Delhi', 'Indira Gandhi International'], ['BOM', 'Mumbai', 'Chhatrapati Shivaji Maharaj International'],
  ['BLR', 'Bengaluru', 'Kempegowda International'], ['MAA', 'Chennai', 'Chennai International'],
  ['HYD', 'Hyderabad', 'Rajiv Gandhi International'], ['CCU', 'Kolkata', 'Netaji Subhas Chandra Bose International'],
  ['GOI', 'Goa (Dabolim)', 'Dabolim'], ['GOX', 'Goa (Mopa)', 'Manohar International'],
  ['JAI', 'Jaipur', 'Jaipur International'], ['UDR', 'Udaipur', 'Maharana Pratap'], ['JDH', 'Jodhpur', 'Jodhpur'],
  ['AMD', 'Ahmedabad', 'Sardar Vallabhbhai Patel International'], ['PNQ', 'Pune', 'Pune'], ['COK', 'Kochi', 'Cochin International'],
  ['TRV', 'Thiruvananthapuram', 'Trivandrum International'], ['IXC', 'Chandigarh', 'Chandigarh'], ['KUU', 'Kullu–Manali', 'Bhuntar'],
  ['SXR', 'Srinagar', 'Sheikh ul-Alam International'], ['IXB', 'Bagdogra', 'Bagdogra'], ['VNS', 'Varanasi', 'Lal Bahadur Shastri International'],
  ['LKO', 'Lucknow', 'Chaudhary Charan Singh International'], ['IXZ', 'Port Blair', 'Veer Savarkar International'],
].map(([code, city, name]) => ({ code, city, name }));

const AIRLINES = [
  { code: '6E', name: 'IndiGo' }, { code: 'AI', name: 'Air India' }, { code: 'IX', name: 'Air India Express' },
  { code: 'QP', name: 'Akasa Air' }, { code: 'SG', name: 'SpiceJet' },
];

/**
 * Flight provider adapter (subject to API approval — e.g. TBO Air, Amadeus, Tripjack).
 * Contract:
 *   search({ from, to, date, adults, children, infants, cabin }) → Flight[]
 *   fareQuote(flightId, fareCode)                                 → { flight, fare }
 *   book({ flightId, fareCode, passengers })                      → { pnr, ticketNo, providerRef }
 *   cancel({ pnr, total, departure })                              → { refundAmount, cancellationCharge }
 */
function buildFlight(from, to, date, idx, pax, cabin) {
  const r = seeded(`${from}|${to}|${date}|${idx}|${cabin}`);
  const al = AIRLINES[Math.floor(r() * AIRLINES.length)];
  const stops = r() > 0.75 ? 1 : 0;
  const dep = new Date(`${date}T00:00:00+05:30`);
  dep.setMinutes(dep.getMinutes() + 5 * 60 + Math.floor(r() * 17 * 60));
  const dur = 70 + Math.floor(r() * 120) + stops * 95;
  const arr = new Date(dep.getTime() + dur * 60000);
  const base = Math.round((cabin === 'business' ? 14000 : 3200) + r() * (cabin === 'business' ? 16000 : 6500));
  const fares = [
    { code: 'SAVER', name: 'Saver', perPax: base, cabinBaggage: '7 kg', checkInBaggage: '15 kg', refundable: false, changeFee: 3000, cancellationFee: 'Non-refundable (taxes refunded)' },
    { code: 'FLEXI', name: 'Flexi', perPax: Math.round(base * 1.18), cabinBaggage: '7 kg', checkInBaggage: '15 kg', refundable: true, changeFee: 0, cancellationFee: '₹1,500 per passenger' },
    { code: 'PLUS', name: 'Super / Plus', perPax: Math.round(base * 1.32), cabinBaggage: '7 kg', checkInBaggage: '25 kg', refundable: true, changeFee: 0, cancellationFee: 'Free up to 72h' },
  ];
  const count = pax.adults + pax.children;
  const flightNo = `${al.code} ${100 + Math.floor(r() * 899)}`;
  return {
    id: encodeId({ p: 'mock', from, to, date, idx, cabin }),
    airline: al.name,
    airlineCode: al.code,
    flightNo,
    from,
    to,
    departure: dep.toISOString(),
    arrival: arr.toISOString(),
    durationMin: dur,
    stops,
    stopover: stops ? 'via ' + ['BOM', 'DEL', 'BLR', 'HYD'][Math.floor(r() * 4)] : null,
    cabin,
    seatsLeft: 2 + Math.floor(r() * 9),
    fares: fares.map((f) => ({ ...f, total: f.perPax * count + Math.round(pax.infants * 1500) })),
  };
}

const mock = {
  name: 'mock',
  async search({ from, to, date, adults = 1, children = 0, infants = 0, cabin = 'economy' }) {
    if (from === to) throw ApiError.badRequest('Origin and destination must be different');
    const pax = { adults: +adults, children: +children, infants: +infants };
    const count = 8 + Math.floor(seeded(`${from}${to}${date}`)() * 6);
    return Array.from({ length: count }, (_, i) => buildFlight(from, to, date, i, pax, cabin));
  },
  async fareQuote(flightId, fareCode, pax) {
    const f = decodeId(flightId);
    if (!f) throw ApiError.badRequest('Invalid flight');
    const flight = buildFlight(f.from, f.to, f.date, f.idx, pax, f.cabin);
    const fare = flight.fares.find((x) => x.code === fareCode);
    if (!fare) throw ApiError.badRequest('Selected fare is no longer available');
    return { flight, fare };
  },
  async book() {
    return { pnr: crypto.randomBytes(3).toString('hex').toUpperCase(), ticketNo: `098${Date.now().toString().slice(-10)}`, providerRef: crypto.randomUUID() };
  },
  async cancel({ total, refundable, departure }) {
    const hours = (new Date(departure) - Date.now()) / 3600000;
    if (hours <= 2) return { refundAmount: 0, cancellationCharge: total };
    const charge = refundable ? Math.min(total, 1500) : Math.round(total * 0.85);
    return { refundAmount: total - charge, cancellationCharge: charge };
  },
};

const PROVIDERS = { mock };
export const flightProvider = () => PROVIDERS[env.flightProvider] || mock;
