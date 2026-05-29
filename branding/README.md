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
    └── README.md                     # where the provided hero mascot is dropped
```

## Two expressions, one system

- **Mascot (marketing / hero):** the detailed aviator-duck-in-a-plane
  illustration — a provided/rendered asset. Drop it under `mascot/` per
  `mascot/README.md`, then add a mapping in `scripts/sync-brand.mjs`. No
  generated stand-in ships, because an unrendered vector trace can't be trusted.
- **App mark (product UI / favicon):** the forest-green roundel duck in `mark/`
  — the exact glyph used by the `/home` shell in `apps/web`. Use this anywhere
  the mascot would be too detailed (favicon, nav, small sizes).

## Palette

Canon = the locked `/home` shell palette (forest green + teal-navy). These are
the reviewed shell values — not sampled from an image, not invented.

| Token | Hex | Use |
|-------|-----|-----|
| Green | `#2F5D50` | primary — wordmark "Jumper", mark gradient start |
| Navy  | `#315D74` | secondary/accent — wordmark "Puddle", mark gradient end |
| Ink   | `#17211D` | body text / monochrome mark |
| Gold  | `#B88A3B` | beak / fine accents |
| Paper | `#F6F4ED` | surfaces / background |
| Gray  | `#6E7B86` | the "by" in the tagline |

Full set in `tokens/brand-tokens.{css,json}` (one green, one navy — the source
of truth for `scripts/sync-brand.mjs`).

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
