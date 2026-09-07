import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Day One Pay NYC",
  description: "An evidence-backed first-payment early-warning system for NYC child and education service contracts.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
