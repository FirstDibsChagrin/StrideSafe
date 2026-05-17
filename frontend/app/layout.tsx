import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StrideSafe",
  description: "High school cross-country injury prediction platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ backgroundColor: '#0d0d14', color: '#e2e2f0' }}>{children}</body>
    </html>
  );
}
