import type { Metadata } from "next";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthProvider } from "../lib/auth";

export const metadata: Metadata = {
  title: "PuddleJumper",
  description: "PublicLogic governance control surface",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the CSP nonce injected by middleware — forces dynamic rendering
  // so every page gets a fresh nonce matching the CSP header.
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
        nonce={nonce}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
