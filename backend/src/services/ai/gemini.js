import { env } from '../../config/env.js';
import { getSettings } from '../settings.service.js';

/**
 * Minimal Gemini REST client (no SDK). Returns parsed JSON when `json: true`.
 * Model and enablement are configurable in Admin → Integrations → AI; the key stays in .env.
 */
export async function isAiConfigured() {
  const s = await getSettings();
  return Boolean(env.ai.geminiKey) && (s.integrations.ai?.provider || env.ai.provider) === 'gemini';
}

export async function geminiGenerate({ system, messages, json = false, temperature = 0.6, maxTokens = 2048 }) {
  const s = await getSettings();
  const model = s.integrations.ai?.model || env.ai.geminiModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { temperature, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.ai.geminiKey },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Gemini error ${res.status}`);
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (!json) return text;
    try {
      return JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : {};
    }
  } finally {
    clearTimeout(timer);
  }
}
