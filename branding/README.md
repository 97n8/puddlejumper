# PuddleJumper — Brand Assets

Logo kit for **PuddleJumper · by PublicLogic**. Palette and forms are derived
from the master logo (the aviator-duck illustration). These are working v1
assets; production wordmarks should have their text **outlined to paths** so
they don't depend on a font being installed.

## Folder layout

```
branding/
├── README.md
├── tokens/
│   ├── brand-tokens.css        # CSS custom properties (source of truth)
│   └── brand-tokens.json       # same tokens, machine-readable
├── colors/
│   └── palette.svg             # swatch sheet
├── wordmark/
│   ├── puddlejumper-wordmark.svg          # two-tone (navy "Puddle" + green "Jumper")
│   ├── puddlejumper-wordmark-tagline.svg  # + "by PublicLogic"  ← primary
│   ├── puddlejumper-wordmark-mono.svg      # single ink color
│   └── puddlejumper-wordmark-reverse.svg   # white, for dark backgrounds
├── mark/
│   ├── puddlejumper-mark.svg     # app/UI duck mark (color)
│   ├── puddlejumper-mark-mono.svg
│   ├── puddlejumper-mark-reverse.svg
│   └── favicon.svg              # simplified, survives 16px
├── lockup/
│   ├── puddlejumper-horizontal.svg   # mark + wordmark + tagline
│   └── puddlejumper-stacked.svg      # mark over wordmark + tagline
└── mascot/
    ├── puddlejumper-duck-flat.svg    # simplified FLAT vector mascot
    └── README.md                     # where to drop the master raster
```

## Two expressions, one system

- **Mascot (marketing / hero):** the detailed aviator-duck-in-a-plane
  illustration. This is a raster master — add it at
  `mascot/puddlejumper-mascot.png` (see `mascot/README.md`). A simplified flat
  **vector** interpretation ships as `mascot/puddlejumper-duck-flat.svg`.
- **App mark (product UI / favicon):** the simple duck mark in `mark/`. This is
  the mark already used by the `/home` shell in `apps/web`, recolored to the
  brand navy→green. Use this anywhere the mascot would be too detailed.

## Palette

| Token | Hex | Use |
|-------|-----|-----|
| Navy   | `#16489E` | "Puddle" / "Public" / plane body / primary |
| Green  | `#2EA82F` | "Jumper" / "Logic" / accent stripe |
| Ink    | `#17211D` | body text / monochrome mark |
| Gray   | `#6E7B86` | the "by" in the tagline |
| Scarf  | `#F26A1B` | mascot scarf accent |
| Beak   | `#F4A81D` | mascot beak accent |

Full set (incl. duck body / cap / tints) in `tokens/brand-tokens.{css,json}`.

## Typography

- **Wordmark:** heavy *italic* rounded sans (Baloo 2 / Nunito fallback in the
  SVGs). Outline to paths for production.
- **Tagline:** `by` in gray italic; `PublicLogic` bold, Public navy / Logic green.
- **Product UI** elsewhere uses the app's own type tokens (DM Sans / Cormorant);
  the logo type is independent of the running UI.

## Usage

- Minimum clear space around any lockup = half the mark's height.
- Don't recolor, stretch, rotate, or add effects to the wordmark.
- On dark backgrounds use the `-reverse` wordmark and `mark-reverse`.
- Prefer the **tagline** lockup for first/primary placements; the plain
  wordmark for repeat/in-product placements.

## White-label note

The PuddleJumper mark + wordmark belong to the **product**. White-label
*instances* (e.g. client environments) swap the **environment name and skin**,
not the PuddleJumper runtime branding — mirror the swap-point rule used by the
`/home` shell (`apps/web/app/home/home.data.ts`).
