// Design token map — mirrors tokens.css for programmatic consumers.
// Source: Master Build Spec v1.1, Part 7 (@pj/ui).

export const TOKENS = {
  // Surface scale
  bg:  '#f5f4f1',
  s0:  '#ffffff',
  s1:  '#faf9f7',
  s2:  '#f0eeea',
  bd:  '#e2dfd9',
  bd2: '#ccc9c2',

  // Ink
  ink:  '#1a1916',
  ink2: '#4a4840',
  ink3: '#857f74',
  ink4: '#b5b0a6',

  // PublicLogic green
  g:     '#2e7a50',
  gLt:   '#f0f7f3',
  gBd:   '#b8d9c6',
  gMid:  '#4a9b72',

  // Domain accents
  amber: '#8a6010',
  blue:  '#2a4a8a',
  red:   '#8b2a1a',

  // Layout widths (px)
  railW:    48,
  sidebarW: 196,
  detailW:  340,
} as const;

export type TokenName = keyof typeof TOKENS;
