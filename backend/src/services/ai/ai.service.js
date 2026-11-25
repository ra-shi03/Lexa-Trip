import { City } from '../../models/Location.js';
import { Review } from '../../models/Misc.js';
import { geminiGenerate, isAiConfigured } from './gemini.js';
import { parseQueryFallback, planTripFallback, seoMetaFallback } from './fallback.js';
import { searchProperties } from '../search.service.js';
import { isoDay } from '../../utils/helpers.js';
import { getSettings } from '../settings.service.js';

/**
 * LexaTrip AI layer ("Lexa AI").
 * Guest features: smart NL search, conversational assistant, trip planner, review summaries.
 * Admin features: SEO writer (meta, keywords, FAQs, outlines).
 * Each function degrades gracefully to rule-based output when AI is not configured.
 */
async function cityList() {
  return City.find({ isActive: true }).select('name aliases').lean();
}

async function aiOn(feature) {
  const s = await getSettings();
  return s.features[feature] !== false && (await isAiConfigured());
}

const SEARCH_SCHEMA = `{"intent":"hotel|bus|flight","city":string?,"checkIn":"YYYY-MM-DD"?,"checkOut":"YYYY-MM-DD"?,"adults":number?,"children":number?,"rooms":number?,"maxPrice":number?,"category":"villas|resorts|hostels|guest-houses|homestays|serviced-apartments"?,"amenities":["swimming-pool","spa","free-wifi","breakfast","parking","gym","pet-friendly","restaurant","airport-shuttle"]?,"stars":"5|4|3"?,"sort":"recommended|price_asc|rating"?,"from":string?,"to":string?,"date":"YYYY-MM-DD"?}`;

/** Natural-language → structured search filters. */
export async function parseSearch(text) {
  const cities = await cityList();
  if (!(await aiOn('aiSmartSearch'))) return { ...parseQueryFallback(text, cities), engine: 'rules' };
  try {
    const out = await geminiGenerate({
      system: `You convert Indian travel search requests into JSON filters. Today is ${isoDay(new Date())}. Known cities: ${cities.map((c) => c.name).join(', ')}. Return ONLY JSON matching: ${SEARCH_SCHEMA}. Omit unknown fields. Budget is per night in INR.`,
      messages: [{ role: 'user', content: text }],
      json: true,
      temperature: 0.1,
    });
    return { ...out, engine: 'gemini' };
  } catch (e) {
    console.warn('[ai] parseSearch fallback:', e.message);
    return { ...parseQueryFallback(text, cities), engine: 'rules' };
  }
}

/**
 * Conversational assistant. Returns { reply, filters?, results? } so the UI can render
 * property cards inline and deep-link into the search page.
 */
export async function chat({ messages }) {
  const last = messages[messages.length - 1]?.content || '';
  const s = await getSettings();
  const name = s.integrations.ai?.assistantName || 'Lexa AI';

  let reply;
  let filters;
  let suggestions;
  if (await aiOn('aiAssistant')) {
    try {
      const cities = await cityList();
      const out = await geminiGenerate({
        system: `You are ${name}, the friendly travel assistant of LexaTrip (an Indian hotel, bus and flight booking platform). Today is ${isoDay(new Date())}.
Be concise (max 120 words), warm and practical. Only recommend stays that LexaTrip returns — never invent hotel names, prices or availability.
Cities on LexaTrip: ${cities.map((c) => c.name).join(', ')}.
If the user wants to find stays/buses/flights, fill "filters" (schema ${SEARCH_SCHEMA}); otherwise set "filters" to null.
Respond ONLY as JSON: {"reply": string, "filters": object|null, "suggestions": string[] (2-3 short follow-up prompts)}`,
        messages: messages.slice(-12),
        json: true,
        temperature: 0.5,
      });
      reply = out.reply;
      filters = out.filters || undefined;
      suggestions = out.suggestions;
    } catch (e) {
      console.warn('[ai] chat fallback:', e.message);
    }
  }
  if (!reply) {
    filters = parseQueryFallback(last, await cityList());
    const hasCity = filters.city || filters.to;
    reply = hasCity
      ? `Here are some options I found${filters.city ? ` in ${filters.city}` : ''}. Tell me your dates, budget or must-have amenities and I'll refine them.`
      : `I can help you find hotels, villas, resorts, buses and flights. Try something like "romantic resort in Udaipur this weekend under ₹8,000 with a pool".`;
    if (!hasCity) filters = undefined;
    suggestions = ['Resorts in Udaipur with a pool', 'Budget hotels in Goa this weekend', 'Plan a 3-day Jaipur trip'];
  }

  let results;
  if (filters && (filters.intent || 'hotel') === 'hotel' && filters.city) {
    const r = await searchProperties({ ...filters, limit: 4, onlyAvailable: false });
    results = r.items;
  }
  return { reply, filters, results, suggestions };
}

export async function planTrip(input) {
  const { destination, days = 3, travellers = 'couple', interests = [], budget } = input;
  if (!(await aiOn('aiTripPlanner'))) return { ...planTripFallback({ destination, days, interests }), engine: 'rules' };
  try {
    const out = await geminiGenerate({
      system: 'You are an expert Indian travel planner. Produce realistic, safe, practical day-wise itineraries. Do not invent specific prices or hotel names. Return ONLY JSON: {"title":string,"summary":string,"bestTimeToVisit":string,"days":[{"day":number,"title":string,"description":string,"activities":[{"time":string,"title":string,"description":string}]}],"tips":string[]}',
      messages: [{ role: 'user', content: `Plan a ${days}-day trip to ${destination} for ${travellers}. Interests: ${interests.join(', ') || 'general sightseeing'}. Budget: ${budget || 'moderate'}.` }],
      json: true,
      temperature: 0.7,
      maxTokens: 4096,
    });
    return { ...out, engine: 'gemini' };
  } catch (e) {
    console.warn('[ai] planTrip fallback:', e.message);
    return { ...planTripFallback({ destination, days, interests }), engine: 'rules' };
  }
}

export async function summarizeReviews(propertyId) {
  const reviews = await Review.find({ property: propertyId, status: 'approved' }).sort({ createdAt: -1 }).limit(40).lean();
  if (reviews.length < 3) return { summary: null, reason: 'Not enough reviews yet' };
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  if (!(await aiOn('aiReviewSummary'))) {
    return { summary: `Guests rate this stay ${avg.toFixed(1)}/5 on average across ${reviews.length} recent reviews.`, pros: [], cons: [], engine: 'rules' };
  }
  try {
    const out = await geminiGenerate({
      system: 'Summarise hotel guest reviews faithfully. Do not add facts not present in the reviews. Return ONLY JSON: {"summary":string (max 60 words),"pros":string[] (max 4),"cons":string[] (max 3)}',
      messages: [{ role: 'user', content: reviews.map((r) => `(${r.rating}/5) ${r.title || ''} ${r.comment || ''}`).join('\n') }],
      json: true,
      temperature: 0.2,
    });
    return { ...out, engine: 'gemini' };
  } catch {
    return { summary: `Guests rate this stay ${avg.toFixed(1)}/5 on average.`, pros: [], cons: [], engine: 'rules' };
  }
}

/** Admin SEO writer — suggestions only; the editor decides what to apply. */
export async function seoAssist({ entityType = 'hotel', name, city, state, keyword, context = '' }) {
  if (!(await isAiConfigured())) return { ...seoMetaFallback({ name, city, state, type: entityType === 'itinerary' ? 'itinerary' : 'hotel', keyword }), engine: 'rules' };
  try {
    const out = await geminiGenerate({
      system: `You are a senior travel SEO editor for LexaTrip (India). Write accurate, non-spammy SEO suggestions. Never invent facts (prices, awards, distances) that are not in the context. Return ONLY JSON:
{"title": string (50-60 chars, include primary keyword), "metaDescription": string (140-158 chars, include a call to action), "h1": string, "primaryKeyword": string, "secondaryKeywords": string[5], "longTailKeywords": string[6], "outline": string[] (H2 headings), "faqs": [{"question": string, "answer": string}] (4, answers grounded in context or generic guidance), "imageAltSuggestions": string[4]}`,
      messages: [{ role: 'user', content: `Entity: ${entityType}\nName: ${name}\nLocation: ${city}, ${state}, India\nTarget keyword: ${keyword || '(suggest one)'}\nContext:\n${String(context).slice(0, 6000)}` }],
      json: true,
      temperature: 0.4,
      maxTokens: 3000,
    });
    return { ...out, engine: 'gemini' };
  } catch (e) {
    return { ...seoMetaFallback({ name, city, state, keyword }), engine: 'rules', warning: e.message };
  }
}
