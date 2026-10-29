import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CookieConsent } from "@/components/CookieConsent";

export const viewport: Viewport = {
  themeColor: "#04060f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://transitsaathi.in"),
  title: {
    default: "TransitSaathi | Multimodal Transit Route Planner — Delhi NCR",
    template: "%s | TransitSaathi",
  },
  description:
    "AI-powered multimodal transit routing combining Delhi Metro, DTC Bus, Auto-rickshaw, and Walking for Delhi NCR with live fare calculations, crowd insights, and real route maps.",
  keywords: [
    "TransitSaathi",
    "Delhi Metro route planner",
    "DTC bus routes",
    "multimodal transit Delhi NCR",
    "Delhi transit assistant",
    "metro fare calculator",
    "Noida metro",
    "Gurgaon metro",
    "Delhi NCR transport",
  ],
  authors: [{ name: "TransitSaathi Team" }],
  creator: "TransitSaathi",
  publisher: "TransitSaathi",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "TransitSaathi | Multimodal Transit Route Planner — Delhi NCR",
    description:
      "Find the fastest and cheapest multimodal routes combining Metro, Bus, Auto, and Walking across Delhi NCR.",
    url: "https://transitsaathi.in",
    siteName: "TransitSaathi",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TransitSaathi — Delhi NCR Multimodal Route Planner",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TransitSaathi | Smart Delhi NCR Transit Planner",
    description:
      "Multimodal journey planning across Delhi Metro, DTC bus, and first-mile autos.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
