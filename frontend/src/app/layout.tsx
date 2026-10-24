import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TransitPulse | Multimodal Route Assistant",
  description: "Fastest, cheapest, and smartest multimodal public transit routing assistant across Metro, Bus, Auto, Bike, Cab and Walking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
