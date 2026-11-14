# Slot machine — immagini da generare

La slot viene costruita **a pezzi separati**: mobile, leva (3 pezzi), insegna,
effetti. Così l'app anima i rulli veri (con le foto dei tuoi profumi) e la
leva che tiri con il dito; un'unica immagine ferma non si potrebbe animare.

## Regole (come per il set precedente)

1. **Allega `01-onb-hero.png`** (l'armadio del benvenuto) a ogni prompt e
   inizia con *"Same art style, palette and line weight as the attached image."*
2. Sfondo **trasparente** (o pieno #F6F3ED, lo ritaglio io).
3. PNG grande (≥ 1024 px). **Niente testo** nelle immagini: le scritte le
   mette l'app.
4. Cartella e nomi:

```
slot/
├── 21-slot-cabinet.png
├── 22-slot-marquee.png
├── 23-lever-knob.png
├── 24-lever-arm.png
├── 25-lever-base.png
├── 26-slot-win-burst.png
├── 27-slot-sparkles.png
└── 28-slot-coin.png
```

## Stile comune (già incluso nei prompt)

> Risograph-printed cut-paper sticker illustration, thick uniform black ink
> outline (#202020), flat spot colours only: electric blue #3155FF, hot pink
> #FF65B8, acid lime #D5F34A, tangerine #FF7738, lilac #B69AFF, off-white
> #F6F3ED. Visible risograph grain, slight misregistration, fine halftone
> dots in shadows. No gradients, no 3D render, no gloss, no text, no logos.

---

### 21 — `21-slot-cabinet.png` · 4:3 · il mobile della slot (il pezzo più importante)
```
Same art style, palette and line weight as the attached image. Front view of a playful retro slot machine cabinet, perfectly straight-on and symmetrical, NO lever (the lever is a separate image). Rounded electric-blue body with a lilac inner panel, chunky tangerine trim, little light bulbs along the edges in lime and white, a small coin tray at the bottom. In the middle, THREE large identical rectangular reel windows side by side, with rounded corners, filled with PLAIN FLAT PURE WHITE (#FFFFFF) and nothing inside them — they must be empty white rectangles because the app will show real perfume photos through them. A thick black outline around each window. Flat spot colours from the palette (#3155FF, #FF65B8, #D5F34A, #FF7738, #B69AFF, #F6F3ED), risograph grain and halftone. No text, no numbers, no symbols in the windows, no 3D, no gradients. Wide 4:3, transparent background outside the cabinet.
```

### 22 — `22-slot-marquee.png` · 3:1 · insegna sopra la slot
```
Same art style, palette and line weight as the attached image. A wide arched retro marquee sign for the top of a slot machine, hot pink with a lime border ringed by small round light bulbs (alternating white and lime), two little stars at the ends. The central area is a PLAIN EMPTY off-white panel with no text (the app writes on it). Flat spot colours from the palette, risograph grain. No text, no 3D, no gradients. Wide 3:1, transparent background.
```

### 23 — `23-lever-knob.png` · 1:1 · pomello della leva
```
Same art style, palette and line weight as the attached image. A single round glossy-looking but flat-printed ball knob for a slot machine lever, hot pink with a small off-white highlight spot drawn as a flat shape, thick black outline, slight halftone shading on the bottom. Just the ball, nothing else. Flat spot colours, risograph grain. No 3D render, no gradients, no text. Square, centered, transparent background.
```

### 24 — `24-lever-arm.png` · 1:4 · asta della leva
```
Same art style, palette and line weight as the attached image. A single straight vertical slot machine lever arm (a rod), black with a thin off-white highlight line along one side and a small tangerine collar near the bottom. Perfectly vertical, nothing attached at the top (no ball). Flat spot colours, risograph grain. No 3D, no gradients, no text. Tall narrow 1:4, transparent background.
```

### 25 — `25-lever-base.png` · 1:1 · supporto della leva
```
Same art style, palette and line weight as the attached image. The side mount of a slot machine lever seen from the front: a rounded tangerine bracket with two black rivets and a lime pivot circle in the middle where the arm attaches. Just the mount. Flat spot colours, risograph grain. No 3D, no gradients, no text. Square, centered, transparent background.
```

### 26 — `26-slot-win-burst.png` · 1:1 · esplosione di vincita
```
Same art style, palette and line weight as the attached image. A big celebratory starburst explosion for a slot machine jackpot: a lime spiky burst with a pink inner burst, little coins, stars, confetti and streamers flying outward. The very center is a PLAIN EMPTY off-white circle (the app writes the result there). Flat spot colours, risograph grain. No text, no numbers, no 3D. Square, transparent background.
```

### 27 — `27-slot-sparkles.png` · 1:1 · scintille (ripetute dall'app)
```
Same art style, palette and line weight as the attached image. A loose scatter of 7 small four-pointed sparkle stars of different sizes in lime, pink and white, thick black outline, evenly spread with lots of empty space between them. Flat spot colours, risograph grain. No text, no 3D. Square, transparent background.
```

### 28 — `28-slot-coin.png` · 1:1 · gettone
```
Same art style, palette and line weight as the attached image. A single round slot machine token coin seen straight-on, lime with a tangerine rim, a tiny embossed perfume-bottle silhouette drawn in black in the middle, halftone shading. Just the coin. Flat spot colours, risograph grain. No text, no numbers, no 3D. Square, centered, transparent background.
```

---

## Come le userò

- **Mobile (21):** diventa la cornice della slot. I rulli con le foto dei
  profumi scorrono dentro le tre finestre bianche (le rendo trasparenti io).
- **Leva (23 + 24 + 25):** montata a destra del mobile. Il pomello segue il
  dito, l'asta si piega, il supporto resta fermo; scatti e vibrazione a ogni
  tacca (già attivi).
- **Insegna (22):** sopra il mobile, con la scritta "SLOT" fatta dall'app e
  le lampadine che lampeggiano mentre i rulli girano.
- **Vincita (26, 27, 28):** esplosione + scintille + gettoni che cadono quando
  escono due o tre rulli uguali.

Quando hai le immagini: comprimi la cartella `slot` (pesa meno di 30 MB) e
caricala qui.
