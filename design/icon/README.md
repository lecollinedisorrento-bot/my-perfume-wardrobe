# App icon

| File | What it is |
|---|---|
| `icon-master.png` | Master artwork, 1254×1254, full-bleed, no rounded corners. Every app icon is generated from it. |
| `icon-dark.png` | Dark variant (iOS 18+ dark appearance / native stores). |
| `icon-tinted.png` | Tinted/monochrome variant: pure white glyph on a fully transparent background (alpha cleaned to 0/255). |

Run `npm run icons` after changing the master. It writes `public/icons/`:

- `icon-512.png`, `icon-192.png`: "any" purpose, rounded corners (22.37% radius), transparent outside
- `icon-maskable-512.png`: full-bleed, artwork scaled to 86% so it stays inside the 80% safe circle; the halftone background is extended by mirroring
- `apple-touch-icon.png`: 180×180, opaque (iOS applies its own mask)
- `favicon-32.png`, `favicon-16.png`

The dark and tinted variants are kept for native or store builds; browsers and PWAs don't use them.
