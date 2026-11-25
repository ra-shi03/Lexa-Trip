import { busProvider } from '../../services/providers/bus/index.js';
import { flightProvider } from '../../services/providers/flight/index.js';
import { getSettings } from '../../services/settings.service.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

async function ensureEnabled(feature) {
  const s = await getSettings();
  if (!s.features[feature]) throw ApiError.forbidden(`${feature === 'buses' ? 'Bus' : 'Flight'} booking is currently unavailable`);
}

export async function busSearch(req, res) {
  await ensureEnabled('buses');
  const { from, to, date } = req.query;
  if (!from || !to || !date) throw ApiError.badRequest('from, to and date are required');
  const trips = await busProvider().search({ from, to, date });
  ok(res, trips, { count: trips.length, provider: busProvider().name });
}

export async function busSeats(req, res) {
  await ensureEnabled('buses');
  ok(res, await busProvider().seatLayout(req.params.tripId));
}

export async function flightSearch(req, res) {
  await ensureEnabled('flights');
  const { from, to, date, returnDate, adults = 1, children = 0, infants = 0, cabin = 'economy' } = req.query;
  if (!from || !to || !date) throw ApiError.badRequest('from, to and date are required');
  const p = flightProvider();
  const pax = { adults: +adults, children: +children, infants: +infants, cabin };
  const [outbound, inbound] = await Promise.all([
    p.search({ from, to, date, ...pax }),
    returnDate ? p.search({ from: to, to: from, date: returnDate, ...pax }) : Promise.resolve(null),
  ]);
  ok(res, { outbound, inbound }, { provider: p.name });
}
