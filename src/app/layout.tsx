import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Cormorant_Garamond, Amiri } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mehfil-e-Qawwali · The Sufi Listening Room",
  description:
    "A quiet digital room for qawwali — for late nights, old memories, long drives, prayer, poetry, and the moments when a voice says what you cannot.",
  keywords: [
    "qawwali",
    "mehfil",
    "nusrat fateh ali khan",
    "sufi",
    "devotional music",
    "listening room",
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${amiri.variable}`}
    >
      <body className={`${inter.className} antialiased bg-transparent`}>
        {children}
      </body>
    </html>
  );
}