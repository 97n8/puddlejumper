# Mascot — master illustration

The **master mascot** is the full-color aviator-duck-in-a-plane illustration
(the source PuddleJumper logo). It is a raster asset and is **not** generated in
this repo. Add it here:

```
mascot/
├── puddlejumper-mascot.png     # ← master illustration (add this; 2048px+ wide, transparent bg)
├── puddlejumper-mascot@2x.png  # optional hi-dpi export
└── puddlejumper-duck-flat.svg  # simplified flat vector interpretation (shipped)
```

Guidance:
- Keep the master as the largest source you have (PNG/transparent, or the
  original vector/AI if available — drop that as `puddlejumper-mascot.svg`).
- Use the master for marketing / hero / splash placements only.
- For product UI, favicons, and anywhere small or flat, use the app mark in
  `../mark/` or `puddlejumper-duck-flat.svg` instead — the detailed mascot does
  not hold up at small sizes.

> Note: `puddlejumper-duck-flat.svg` is a clean, simplified emblem, not a
> pixel-faithful trace of the master art.
