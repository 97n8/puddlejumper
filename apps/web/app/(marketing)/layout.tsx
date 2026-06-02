// PublicLogic marketing layout — Nav + Footer wrapper for all marketing pages.
// Build Sequence step 1: brand/nav lock applies site-wide here.

import './site.css';
import Nav from '../../components/site/Nav';
import Footer from '../../components/site/Footer';

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
