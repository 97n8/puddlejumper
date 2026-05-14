import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://publiclogic.org"),
  title: {
    default: "PuddleJumper — The First Governance Process Runtime",
    template: "%s | PuddleJumper",
  },
  description:
    "PuddleJumper sits between a decision and an action — evaluating authority, routing to the right person, and producing an audit trail that can't be altered.",
  keywords: [
    "PuddleJumper",
    "governance process runtime",
    "GPR",
    "PublicLogic",
    "govtech",
    "municipal technology",
    "VAULT framework",
    "civic automation",
  ],
  authors: [{ name: "PublicLogic LLC" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "PuddleJumper by PublicLogic",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
