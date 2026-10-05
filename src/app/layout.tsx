import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--nf-inter",
  display: "swap",
});

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--nf-display",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Mehfil — free, open-source, ad-free music player",
  description:
    "Search YouTube, build a queue, save favourites and control playback from another device. No sign-up, no ads from us, open source.",
  keywords: ["music player", "youtube", "open source", "ad-free", "qawwali", "mehfil"],
  openGraph: {
    title: "Mehfil — free, open-source, ad-free music player",
    description: "Search YouTube, queue, discover, and connect your devices.",
    images: ["/images/mehfil-bg.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}