# My Perfume Wardrobe

A pop, playful, installable fragrance playground. Collect your perfumes, spin for today's pick (wheel or slot machine), mix experiments in the Layer Lab, discover by mood and weather, and get AI help that shows where its facts came from.

- **Mobile-first PWA**: installable, works offline, five-tab bottom navigation.
- **Local-first**: your collection lives in IndexedDB on your device. There's no account and no public profile.
- **AI with receipts**: Claude researches perfumes with live web search. The server keeps only sources that were actually retrieved, and removes facts that no retrieved source supports.
- **Real weather**: Open-Meteo (no key needed). You can use your location (only when you tap the button), pick a city, or set conditions by hand.
- **Honest everywhere**: the local engine is labelled "Local match · not AI", the test provider is labelled "TEST FIXTURE · not real AI", performance figures are estimates, and the layering score is described as subjective.

---

## Quick start

```bash
npm install
cp .env.example .env        # add ANTHROPIC_API_KEY to enable AI (optional)
npm run dev                 # http://localhost:5173  (UI + API in one process)
```

Production:

```bash
npm run build               # typecheck + Vite build + service worker
npm start                   # serves dist/ and /api on PORT (default 8787)
```

Without an API key the app still works fully: collection, roulette, slots, layering, discovery and weather all use the offline local engine. The UI says plainly that AI isn't connected.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables AI. **Server-side only**, never sent to the browser. |
| `AI_PROVIDER` | `anthropic` | `anthropic`, `none`, or `mock` (deterministic **test** fixture, labelled as such in the UI). |
| `AI_MODEL` | `claude-opus-5-5` | Claude model id. |
| `AI_RATE_LIMIT` | `40` | AI requests per client IP per 10 minutes. |
| `PORT` | `8787` | Production server port. |

No `VITE_*` variables are defined, so nothing from `.env` reaches client code.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with the Hono API mounted as middleware |
| `npm run build` | `tsc --noEmit` + production build + Workbox service worker |
| `npm start` | Production Node server (static + SPA fallback + API + security headers) |
| `npm test` | Unit/integration tests (Vitest, fake IndexedDB) |
| `npm run test:e2e` | Playwright end-to-end tests against the production build |
| `npm run icons` | Re-generate every app icon (PWA, maskable, Apple, favicon) from `design/icon/icon-master.png` |

## Architecture

```
my-perfume-wardrobe/
├─ server/                  Node (Hono) — the only place credentials exist
│  ├─ app.ts                /api routes, validation (zod), rate limit, body limits
│  ├─ ai/provider.ts        AIProvider interface (swap vendors here)
│  ├─ ai/anthropic.ts       Claude adapter: structured outputs + web search
│  ├─ ai/verify.ts          source/fact verification (pure, unit-tested)
│  ├─ ai/mock.ts            deterministic TEST provider (AI_PROVIDER=mock)
│  ├─ net.ts                SSRF-safe fetch + og:image extraction
│  └─ start.ts              production server
├─ src/
│  ├─ domain/               pure logic: types, families, recommend, roulette,
│  │                        layering, weather tendencies, stats, achievements
│  ├─ db/                   IndexedDB schema v2 + migrations, repo, backup/restore
│  ├─ services/             API client, weather provider, images, sfx, share card
│  ├─ state/                React store (in-memory mirror of IndexedDB), UI context
│  ├─ i18n/                 English + Italian (type-checked for completeness)
│  ├─ components/ screens/  UI
│  └─ shared/api.ts         request/response contract shared by client and server
└─ tests/unit, tests/e2e
```

### API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Server, AI and weather status |
| `POST /api/ai/identify` | Identify from a name and/or bottle photo; asks a clarifying question when it isn't sure |
| `POST /api/ai/research` | Two-phase research: (1) live web search, (2) a structured profile that cites retrieved sources by index only. Then server-side verification and og:image lookup on official/retailer pages |
| `POST /api/ai/recommend` | Picks from the user's collection; the server drops any id outside it unless `external: true` |
| `POST /api/ai/layer` | Layering partners from the user's own shelf |
| `POST /api/ai/ask` | Consultant questions answered against the actual collection |
| `GET /api/image/proxy?url=` | Fetches a remote bottle image (images only, size-capped, private networks blocked) so it can be cached locally |

### How research stays honest

1. Claude searches the web (`web_search_20260209`). The server records every URL that was actually retrieved.
2. A second, schema-constrained call builds the profile. It can reference sources **only by index** into that retrieved list.
3. `verify.ts` then:
   - drops references to sources that weren't retrieved;
   - marks a source as "official" only when its domain matches the brand (otherwise it's downgraded to "database");
   - sets release year, perfumer and country to null unless a surviving source supports them, and lists what was removed;
   - downgrades the notes' provenance (official → reported → AI interpretation) to what the sources can back up;
   - computes the status: **Verified** (official source, or two or more sources for the notes), **Partly verified** (one source), or **Unverified**.
4. Bottle images are offered only from og:image tags on official or retailer pages that were retrieved. Every image keeps a label: Official, Retailer, Web, Your photo, or Illustration. When there's no image, the app shows an abstract monogram graphic, never a realistic fake bottle.

The Claude calls use `claude-opus-5-5` with server-side refusal fallbacks enabled (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). If a request is declined, the API retries it on a fallback model. Remove the `fallbacks` and `betas` fields in `server/ai/anthropic.ts` if you don't want this.

### Data and privacy

- IndexedDB stores: `fragrances`, `images` (blobs), `wears`, `combinations`, `spins`, `recommendations`, `achievements`, `kv` (preferences, cached weather). The schema is versioned with step-by-step migrations (`src/db/db.ts`).
- What goes to the AI (shown to the user before the first AI call): brand, name, family, accords, seasons/occasions, rating, the favourite flag, how recently each perfume was worn, the weather context and the question. Personal notes, photos (except when identifying a bottle), and the user's name are never sent. The server stores nothing.
- Weather: only coordinates or a city search term go to Open-Meteo.
- Backup: one JSON file containing everything, including images. Restore can merge or replace. Settings has a full erase.

### Randomness

The wheel and the slot machine draw the result first, uniformly, with `crypto.getRandomValues` (no modulo bias). The animation is then computed to stop exactly on that result. Tests check every landing angle and run chi-square uniformity tests.

- **Wheel:** if more than 16 perfumes are eligible, the winner is drawn from all of them, and the wheel shows the winner plus a random sample. The UI says so.
- **Slots:** each reel draws independently. Two or three matching reels win; with no match, one reel is drawn at random. The rule is symmetric, so every perfume keeps the same chance.

## Deploying

The app needs a Node host (not static or serverless-only): AI research can take 30–60 s, which exceeds typical serverless function limits. Ready-made configs:

**Render** (Blueprint: `render.yaml`)
1. Render dashboard → **New → Blueprint** → pick this repository and branch.
2. When asked, paste `ANTHROPIC_API_KEY` (it's never committed).
3. Deploy. Render builds with `npm ci --include=dev && npm run build`, starts with `npm start`, and health-checks `/api/health`.

**Railway** (`railway.json`)
1. New project → Deploy from GitHub repo → pick this repository.
2. Add the variable `ANTHROPIC_API_KEY` (optionally `AI_MODEL`, `AI_RATE_LIMIT`).
3. Generate a public domain.

**Anywhere else:** `npm ci --include=dev && npm run build && npm start` on Node 20+. Both hosts provide `PORT` and HTTPS automatically. HTTPS is required for the service worker and geolocation. The per-IP rate limit reads `x-forwarded-for`.

See [docs/TEST_REPORT.md](docs/TEST_REPORT.md) for what was tested and the known limitations.
