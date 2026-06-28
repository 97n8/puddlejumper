import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Canonical site origin (used to resolve OG/relative URLs).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://puddlejumper.com';

// Spec Part 7 type tokens.
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ui',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'PuddleJumper',
  title: {
    default: 'PuddleJumper — Governance Process Runtime',
    template: '%s · PuddleJumper',
  },
  description:
    'Governance Process Runtime — calm on the surface, governance machinery underneath.',
  // Favicon + apple-touch icon are served from the brand-synced files
  // app/icon.svg and app/apple-icon.svg (see scripts/sync-brand.mjs).
  openGraph: {
    type: 'website',
    siteName: 'PuddleJumper',
    title: 'PuddleJumper — Governance Process Runtime',
    description:
      'Governed continuity — gates where judgment is required, append-only proof for everything else.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary',
    title: 'PuddleJumper — Governance Process Runtime',
    description: 'Calm on the surface, governance machinery underneath.',
  },
};

// Brand forest green (canon shell --green) drives the browser theme color.
export const viewport: Viewport = {
  themeColor: '#2f5d50',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
