import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reliability-Quantified Thematic Analyzer",
  description:
    "Ensemble thematic analysis with dual reliability metrics (Cohen's kappa + cosine similarity) and consensus extraction.",
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