import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "চাকরির বাজার — AI Career Co-Pilot",
  description: "Your elite AI-powered career co-pilot. Job search, CV analysis, interview prep, and career intelligence — all grounded in your real profile.",
  keywords: ["career", "AI", "job search", "resume", "CV", "interview prep"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
