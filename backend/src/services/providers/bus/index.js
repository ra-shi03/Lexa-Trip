import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/ApiError.js';
import { seeded, encodeId, decodeId } from '../seeded.js';

/**
 * Bus booking provider adapter (subject to API approval — e.g. Seatseller, Travelyaari, TBO Bus).
 * Contract every real adapter must implement:
 *   search({ from, to, date })           → Trip[]
 *   seatLayout(tripId)                   → { trip, decks:[{ name, rows:[[Seat|null]] }] }
 *   block({ tripId, seats, passengers }) → { blockKey, fare, trip }
 *   confirm(blockKey)                    → { pnr, ticketNo, providerRef }
 *   cancel({ pnr, ticketNo, seats })     → { refundAmount, cancellationCharge }
 */

const OPERATORS = ['VRL Travels', 'SRS Travels', 'Orange Tours', 'Zingbus', 'IntrCity SmartBus', 'Neeta Travels', 'RSRTC Volvo', 'Shrinath Travels'];
const TYPES = [
  { name: 'AC Sleeper (2+1)', sleeper: true, ac: true },
  { name: 'Volvo Multi-Axle AC Semi Sleeper (2+2)', sleeper: false, ac: true },
  { name: 'Non-AC Seater (2+2)', sleeper: false, ac: false },
  { name: 'Bharat Benz AC Sleeper (2+1)', sleeper: true, ac: true },
];
const AMENITIES = ['Water bottle', 'Charging point', 'Blanket', 'Reading light', 'CCTV', 'GPS tracking', 'Emergency exit'];

function buildTrip(from, to, date, idx) {
  const r = seeded(`${from}|${to}|${date}|${idx}`);
  const type = TYPES[Math.floor(r() * TYPES.length)];
  const depMin = 17 * 60 + Math.floor(r() * 7 * 60); // evening departures
  const durMin = 6 * 60 + Math.floor(r() * 8 * 60);
  const dep = new Date(`${date}T00:00:00+05:30`);
  dep.setMinutes(dep.getMinutes() + depMin);
  const arr = new Date(dep.getTime() + durMin * 60000);
  const baseFare = Math.round((type.ac ? 700 : 450) + r() * 900);
  const id = encodeId({ p: 'mock', from, to, date, idx });
  return {
    id,
    operator: OPERATORS[Math.floor(r() * OPERATORS.length)],
    busType: type.name,
    isSleeper: type.sleeper,
    isAc: type.ac,
    from,
    to,
    departure: dep.toISOString(),
    arrival: arr.toISOString(),
    durationMin: durMin,
    fare: baseFare,
    seatsAvailable: 8 + Math.floor(r() * 25),
    rating: Math.round((3.4 + r() * 1.5) * 10) / 10,
    amenities: AMENITIES.filter(() => r() > 0.45),
    boardingPoints: [`${from} Central Bus Stand`, `${from} Bypass`, `${from} Railway Station`].map((n, i) => ({ id: `bp${i}`, name: n, time: new Date(dep.getTime() + i * 20 * 60000).toISOString() })),
    droppingPoints: [`${to} Bus Stand`, `${to} City Centre`].map((n, i) => ({ id: `dp${i}`, name: n, time: new Date(arr.getTime() + i * 15 * 60000).toISOString() })),
    cancellationPolicy: 'Free cancellation up to 24h before departure; 25% charge 24h–6h; 50% within 6h; no refund after departure.',
  };
}

function buildLayout(trip, idx) {
  const r = seeded(`layout|${trip.id}|${idx}`);
  const decks = trip.isSleeper ? ['Lower deck', 'Upper deck'] : ['Seats'];
  return decks.map((name, d) => {
    const rows = [];
    const cols = trip.isSleeper ? 3 : 4;
    const rowCount = trip.isSleeper ? 6 : 10;
    let n = 0;
    for (let row = 0; row < rowCount; row++) {
      const line = [];
      for (let c = 0; c < cols + 1; c++) {
        const aisle = trip.isSleeper ? c === 1 : c === 2;
        if (aisle) { line.push(null); continue; }
        n += 1;
        const no = `${trip.isSleeper ? (d ? 'U' : 'L') : 'S'}${n}`;
        line.push({
          no,
          type: trip.isSleeper ? 'sleeper' : 'seater',
          price: trip.fare + (trip.isSleeper && d === 0 ? 100 : 0),
          available: r() > 0.32,
          ladiesOnly: r() > 0.93,
        });
      }
      rows.push(line);
    }
    return { name, rows };
  });
}

const mock = {
  name: 'mock',
  async search({ from, to, date }) {
    const count = 6 + (seeded(`${from}${to}${date}`)() * 6 | 0);
    return Array.from({ length: count }, (_, i) => buildTrip(from, to, date, i)).sort((a, b) => a.departure.localeCompare(b.departure));
  },
  async seatLayout(tripId) {
    const t = decodeId(tripId);
    if (!t) throw ApiError.badRequest('Invalid trip');
    const trip = buildTrip(t.from, t.to, t.date, t.idx);
    return { trip, decks: buildLayout(trip, t.idx) };
  },
  async block({ tripId, seats }) {
    const { trip, decks } = await this.seatLayout(tripId);
    const all = decks.flatMap((d) => d.rows.flat()).filter(Boolean);
    const chosen = seats.map((no) => all.find((s) => s.no === no));
    if (chosen.some((s) => !s || !s.available)) throw ApiError.conflict('One or more selected seats are no longer available');
    const fare = chosen.reduce((s, x) => s + x.price, 0);
    return { blockKey: `BLK${crypto.randomBytes(5).toString('hex').toUpperCase()}`, fare, trip };
  },
  async confirm() {
    return { pnr: `LTB${crypto.randomBytes(4).toString('hex').toUpperCase()}`, ticketNo: `TKT${Date.now().toString().slice(-8)}`, providerRef: crypto.randomUUID() };
  },
  async cancel({ fare, departure }) {
    const hours = (new Date(departure) - Date.now()) / 3600000;
    const pct = hours > 24 ? 0 : hours > 6 ? 25 : hours > 0 ? 50 : 100;
    const charge = Math.round((fare * pct) / 100);
    return { refundAmount: fare - charge, cancellationCharge: charge };
  },
};

const PROVIDERS = { mock };
export const busProvider = () => PROVIDERS[env.busProvider] || mock;
