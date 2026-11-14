# Fragrance catalogue: research rules and format

The catalogue ships inside the app so people can add a perfume (with notes and
sources) even without AI. It must meet the app's honesty bar: **every fact comes
from a web page that was actually opened during research, and that page's URL is recorded.**

## Hard rules

1. **No memory, no guessing.** If a fact wasn't read on a page you opened (WebFetch, or a
   WebSearch result snippet that states it explicitly), leave it `null` / `[]`.
2. **Every fragrance needs at least one source** with a real URL you opened or
   that WebSearch returned. Never construct or guess URLs.
3. **Source priority:** (1) the brand's official site, (2) an authorised retailer
   or distributor product page, (3) a reputable database (Fragrantica, Parfumo,
   Basenotes), (4) specialist publications. Prefer official.
4. **`noteSource`**: `"official"` only if the notes come from the brand's own
   site; `"reported"` if they come from a retailer, database or publication.
5. **Facts only, in your own words.** Don't copy marketing descriptions. Notes, accords,
   concentration, year, perfumer and family are facts. Don't collect images.
6. **Don't invent fragrances.** Include only names that a source lists as a
   product of that brand. Include discontinued ones only if a source says so, and
   set `discontinued: true`.
7. If a site blocks fetching (empty page, 403), say so in `researchNotes` and try
   the next source type. Don't loop on a blocked site.
8. Be efficient: one listing page plus product pages, at most ~3 sources per fragrance.

## File format — `catalog/brands/<brand-slug>.json`

```json
{
  "brand": "Electimuss",
  "slug": "electimuss",
  "officialSite": "https://www.electimuss.com/",
  "distributors": [{ "name": "BJ Distribuzione", "country": "IT", "url": "https://www.bjdistribuzione.it/en/our-brands/electimuss-perfumes/" }],
  "country": "United Kingdom",
  "retrievedAt": "2026-11-13",
  "researchNotes": "Official site lists 24 fragrances; notes from product pages.",
  "fragrances": [
    {
      "name": "Mercurial Cashmere",
      "collection": null,
      "concentration": "Pure Parfum",
      "releaseYear": 2018,
      "perfumer": null,
      "family": "Woody Floral Musk",
      "accords": ["musky", "woody"],
      "notes": { "top": ["..."], "heart": ["..."], "base": ["..."], "flat": [] },
      "noteSource": "official",
      "discontinued": false,
      "sources": [
        { "url": "https://...", "name": "Electimuss — Mercurial Cashmere", "type": "official", "supports": ["notes", "concentration"] }
      ]
    }
  ]
}
```

- `notes.flat` is for brands that publish notes without a top/heart/base pyramid.
- `type` must be one of `official` | `retailer` | `database` | `publication`.
- `supports` lists the facts that source states; allowed values: `notes`, `accords`,
  `family`, `year`, `perfumer`, `concentration`, `discontinued`, `performance`, `usage`.
- Each of `releaseYear`, `perfumer`, `family` and `accords` must be backed by a
  source whose `supports` includes it, or else set to `null` / `[]`.
- Note names: lowercase English, singular, e.g. `"bergamot"`, `"oud"`, `"vanilla"`.

Validate with `node scripts/validate-catalog.mjs`.

## Performance and usage (optional)

```json
"performance": { "longevity": 4, "sillage": 3, "projection": null, "basis": "reported" },
"usage": { "seasons": ["autumn", "winter"], "times": ["evening", "night"] },
"performanceEvidence": "Retailer: 'lasts 8–10 hours'; review: 'moderate sillage'"
```

- Levels are 1–5, a tendency, never a measurement:
  - longevity: 1 = under 2 h, 2 = 2–4 h, 3 = 4–6 h, 4 = 6–10 h, 5 = over 10 h;
  - sillage / projection: 1 = skin scent, 2 = soft, 3 = moderate, 4 = strong, 5 = enormous.
- `basis`: `"official"` (brand states it), `"retailer"`, `"reviews"` (independent
  reviews or publications), `"search"` (a search-result summary that states it).
- `seasons` from `spring, summer, autumn, winter`; `times` from `morning, afternoon, evening, night`.
- A source supports `performance` / `usage` only if it states it; otherwise use null / [].
- `performanceEvidence`: one short line in your own words saying what each source states.
