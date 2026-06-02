// PublicLogic marketing layout — Nav + Footer wrapper for all marketing pages.
// Build Sequence step 1: brand/nav lock applies site-wide here.

import type { Metadata } from 'next';
import './site.css';
import Nav from '../../components/site/Nav';
import Footer from '../../components/site/Footer';

// Marketing site metadata. Overrides the root layout's "PuddleJumper" title:
// these pages are publiclogic.org. Per-page titles fill the %s template.
export const metadata: Metadata = {
  title: {
    template: '%s · PublicLogic',
    default: 'PublicLogic — Systems for Continuity',
  },
  description:
    'PublicLogic builds systems for continuity — connecting policy, data, ' +
    'training, leadership, and records into structures people can actually run.',
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <div className="pl-page">{children}</div>
      <Footer />
    </>
  );
}
