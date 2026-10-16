import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin", "latin-ext"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "Ataşehir Fitness | Üye Memnuniyet Paneli",
  description:
    "WhatsApp üzerinden yapay zeka destekli üye memnuniyet anketi, analiz ve geri bildirim yönetim paneli.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
