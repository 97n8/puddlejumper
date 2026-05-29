# Mascot — master illustration

The **mascot** is the full-color aviator-duck-in-a-plane illustration (the
source PuddleJumper logo). It is a provided/rendered asset — this repo does
**not** ship a generated stand-in, because a sight-unseen vector trace would be
unverifiable. Drop the rendered files here:

```
mascot/
├── puddlejumper-mascot.png       # ← master illustration (add this; 2048px+, transparent bg)
├── puddlejumper-mascot@2x.png    # optional hi-dpi export
├── puddlejumper-mascot.svg       # optional, if a true vector master exists
└── puddlejumper-hero.svg         # optional flat hero tuned to brand tokens
```

Then wire it: add a mapping in `scripts/sync-brand.mjs` and run
`node scripts/sync-brand.mjs` to publish it under `apps/web/public/brand/`.

Guidance:
- Use the mascot for marketing / hero / splash placements only.
- For product UI, favicons, and anywhere small or flat, use the **app mark**
  in `../mark/` (the forest-green roundel) — the detailed mascot does not hold
  up at small sizes and is **not** the favicon.
- Palette must match `../tokens/brand-tokens.css` (forest green `#2f5d50`,
  teal-navy `#315d74`, gold `#b88a3b`).
