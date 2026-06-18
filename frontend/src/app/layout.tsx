import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Belarro V4 — Farm Management",
  description: "Crop administration for Belarro vertical farm",
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
