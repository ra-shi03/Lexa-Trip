import crypto from 'node:crypto';
import { z } from 'zod';
import * as ai from '../../services/ai/ai.service.js';
import { AiConversation } from '../../models/Misc.js';
import { ok } from '../../utils/response.js';
import { isAiConfigured } from '../../services/ai/gemini.js';
import { getSettings } from '../../services/settings.service.js';

export const schemas = {
  parse: z.object({ text: z.string().trim().min(2).max(500) }),
  chat: z.object({
    sessionId: z.string().max(64).optional(),
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).min(1).max(30),
  }),
  plan: z.object({
    destination: z.string().trim().min(2).max(80),
    days: z.coerce.number().int().min(1).max(10).default(3),
    travellers: z.string().max(40).optional(),
    interests: z.array(z.string().max(40)).max(8).optional(),
    budget: z.string().max(40).optional(),
  }),
};

export async function status(_req, res) {
  const s = await getSettings();
  ok(res, { configured: await isAiConfigured(), assistantName: s.integrations.ai?.assistantName || 'Lexa AI', features: { assistant: s.features.aiAssistant, smartSearch: s.features.aiSmartSearch, tripPlanner: s.features.aiTripPlanner } });
}

export async function parse(req, res) {
  ok(res, await ai.parseSearch(req.body.text));
}

export async function chat(req, res) {
  const out = await ai.chat({ messages: req.body.messages });
  const sessionId = req.body.sessionId || crypto.randomUUID();
  const last = req.body.messages[req.body.messages.length - 1];
  AiConversation.findOneAndUpdate(
    { sessionId },
    { $setOnInsert: { user: req.user?._id }, $push: { messages: { $each: [last, { role: 'assistant', content: out.reply }] } } },
    { upsert: true },
  ).catch(() => {});
  ok(res, { ...out, sessionId });
}

export async function plan(req, res) {
  ok(res, await ai.planTrip(req.body));
}

export async function reviewSummary(req, res) {
  ok(res, await ai.summarizeReviews(req.params.propertyId));
}
