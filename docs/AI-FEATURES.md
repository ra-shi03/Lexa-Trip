# Lexa AI

Provider: **Google Gemini** via REST (`backend/src/services/ai/gemini.js`, no SDK). Set `GEMINI_API_KEY` (and optionally
`GEMINI_MODEL`, default `gemini-2.5-flash`) in `backend/.env`; model and assistant name are editable in Admin → Integrations.
Without a key every feature still works using the rule-based engine in `services/ai/fallback.js`.

| Feature | Where | Endpoint |
|---|---|---|
| Chat assistant (floating button + full page) — answers & shows real LexaTrip stays inline | Guest web/app | `POST /public/ai/chat` |
| Smart search: “resort in Udaipur this weekend under ₹12k with pool” → filters | Home hero | `POST /public/ai/parse` |
| Trip planner: day-wise itinerary by destination, days, interests, budget | `/ai` | `POST /public/ai/plan` |
| Review summary (pros/cons) | Property page | `GET /public/ai/review-summary/:id` |
| SEO writer: title, meta, keywords, H2 outline, FAQ ideas, alt-text ideas | Admin SEO editor | `POST /admin/seo/ai/assist` |
| Conversation log for quality review | Admin → AI conversations | `GET /admin/ai/conversations` |

## Safety & cost controls
- The model never returns listings itself — it returns *filters*; the server runs the real search, so no invented hotels or prices.
- Prompts instruct the model not to fabricate facts; SEO suggestions require an editor to click *Apply*.
- JSON-mode responses, 25-second timeout, graceful fallback on any error.
- Rate limit 20 AI requests/min/IP; last 12 messages of context only.
- Each feature can be switched off in Admin → App features.
