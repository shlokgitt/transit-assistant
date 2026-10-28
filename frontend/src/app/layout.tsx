import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TransitPulse | Smart Multimodal Route Planner — Delhi NCR",
  description: "AI-powered multimodal transit routing across Metro, DTC Bus, Auto, Bike Taxi, Cab & Walk for Delhi NCR.",
  keywords: "transit, route planner, Delhi Metro, multimodal, GTFS, Delhi NCR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#04060f" />
      </head>
      <body>{children}</body>
    </html>
  );
}
