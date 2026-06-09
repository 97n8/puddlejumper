import type { Metadata } from 'next';
import { Nav, Footer, Container } from '../../components/marketing/site';

export const metadata: Metadata = {
  title: {
    default: 'PublicLogic — Institutional stewardship that keeps work alive',
    template: '%s · PublicLogic',
  },
  description:
    'PublicLogic helps projects move through public systems and helps organizations keep the capacity to sustain what they build. Start with a Stewardship Map.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-ink font-ui flex flex-col">
      <Nav />
      <main className="flex-1">
        <Container>{children}</Container>
      </main>
      <Footer />
    </div>
  );
}
