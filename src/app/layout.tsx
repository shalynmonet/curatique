import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Playfair_Display({ variable: "--font-serif-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Curatique — niche stores, curated by AI, powered by PayPal",
  description: "Launch a signature-niche storefront in minutes. AI curation via Claude + Channel3, checkout and payouts via PayPal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} antialiased`}>{children}</body>
    </html>
  );
}
