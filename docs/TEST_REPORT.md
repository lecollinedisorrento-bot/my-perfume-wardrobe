# Test report — My Perfume Wardrobe v1.0.0

Run on 2026-11-13 in a Linux container (Node 22, Chromium from Playwright 1.63).

| Suite | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ no errors |
| Unit + integration (Vitest) | `npm test` | ✅ 50 / 50 passed (5 files) |
| End-to-end (Playwright, Pixel 7 emulation, production build + service worker) | `npm run test:e2e` | ✅ 12 / 12 passed |

## Coverage against the brief (§21)

| Area | How it was tested | Result |
|---|---|---|
| First-time onboarding | e2e: language switch (EN↔IT), name, family prefs, city weather, sample import | ✅ |
| Add fragrance | e2e: name → identify → clarification → candidate → research → review → save → reveal | ✅ |
| AI identification | e2e (test provider) + contract test of the real Claude adapter with a fake HTTP transport | ✅ ⚠️ see limitations |
| AI research/verification | unit: invented sources dropped, unsupported year/perfumer removed, fake "official" domains downgraded, status computed; contract test of the two-phase web-search flow | ✅ |
| Image upload | e2e: file upload stored as "Your photo" and rendered on the profile | ✅ |
| Edit / delete fragrance | e2e; unit: delete cascades to image, wears, combos | ✅ |
| Persistent local data | e2e reload keeps rating/favourite/notes; unit: IndexedDB persistence across close/reopen | ✅ |
| Schema migrations | unit: a hand-built v1 database migrates to v2 and normalises old records | ✅ |
| Export / import | e2e: export → erase everything → onboard → restore (replace) → 16 perfumes back; unit: merge/replace, image bytes round-trip, invalid/newer backups rejected | ✅ |
| Roulette selection | unit: landing angle exact for every n ≤ 16, every index, several start angles; chi-square uniformity (20 items, 40k draws) | ✅ |
| Roulette animation | e2e: 3 spins; the segment under the pointer (computed from the final rotation) equals the displayed result | ✅ |
| Slot machine | unit: match rules, winner always on the reels, uniformity; e2e: three reels resolve, winning reels highlighted, history saved | ✅ |
| Spin filters | unit: favourites, season (unknown data kept), recent wear, weather suitability, families; e2e: favourites only | ✅ |
| Add to today's rotation | e2e: appears under "Today's rotation" on Home | ✅ |
| Weather integration | e2e with Open-Meteo responses mocked (city search + current conditions) | ✅ ⚠️ |
| Location permission denial | e2e: denied → clear message → city picker still works | ✅ |
| AI recommendation | e2e: picks restricted to the collection (server filters an injected outside id); AI error → local fallback, clearly labelled | ✅ |
| Layering suggestion + saving + rating | e2e: suggestions → detail → save → rate 5 → "worked for me" → badges unlocked | ✅ |
| Ratings | e2e (perfume and combo) | ✅ |
| Offline mode | e2e: service worker active → offline → wardrobe loads, offline banner shown, wheel still spins | ✅ |
| PWA installation | e2e: manifest (standalone, 192/512/maskable icons), SW registered and controlling; Settings has an install button when the browser offers one | ✅ (prompt UI itself can't be automated) |
| Mobile navigation | e2e: all five tabs; no horizontal page overflow on 8 main screens at phone width | ✅ |
| Error handling | unit: request validation 400, AI not configured 503, rate limit 429, refusal 422, SSRF blocks; e2e: AI 500 → toast + fallback | ✅ |
| AI not configured | e2e: clear notice, manual add works, profile marked "Your entry" | ✅ |
| i18n | unit: Italian keeps every placeholder (TypeScript enforces every key exists) | ✅ |

Manual visual QA: screenshots of every main screen at 390×844, in light and dark themes.

## Bugs found by testing and fixed

- An effect returned the Promise from `window.scrollTo`, which this Chromium returns, and that crashed route changes. All effects now use block bodies.
- Colour-surface utility classes were overridden by `.card`, so the "Today smells like…" card rendered white text on white. Fixed with higher specificity, using `background-color` so the halftone texture survives.
- A rotating starburst behind the spin result caused horizontal page scroll on phones, which pushed the bottom nav off-centre. Fixed with `overflow-x: clip` and a clipped result card; e2e now checks for overflow on every main screen.
- Accords that differed only in case weren't de-duplicated.
- Refusals were reported as "unreadable answer". The stop reason is now checked before parsing.

## Known limitations

- **Live AI was not exercised in this environment** because there's no API key in the container. The Claude adapter is covered by contract tests (real SDK, fake HTTP), but answer quality, latency and real web-search results have not been observed. Set `ANTHROPIC_API_KEY` and try a few perfumes before relying on it.
- **Live weather** returned HTTP 429 (shared egress IP) from the container, so weather tests use mocked Open-Meteo responses. The provider code path is the same one used in production.
- **og:image candidates** depend on brand and retailer pages exposing `og:image`. Many pages do, some block bots, and the image isn't always a transparent front-facing cut-out. Uploading your own photo is the most accurate option.
- **Service worker** is disabled in `npm run dev` (by design). Test offline behaviour with `npm run build && npm start`.
- **Rate limiting** is in-memory and per process. Use a shared store if you run several instances.
- **iOS**: installation is via Share → Add to Home Screen. `navigator.vibrate` isn't supported on iOS, so there are no haptics there.
- **Seed collection** contains names only. The 16 sample perfumes have no notes or images until you run AI research or fill them in (no data was invented).
- The local recommendation and layering heuristics are simple, transparent tendencies (family/accord traits). They are labelled as such and are not AI.
