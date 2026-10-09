import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veylo — See it. Say it. Find it. | Alexa+ Physical Shopping Capability",
  description:
    "Turns ambiguous human requests into concrete real-world shopping actions. Built for the Amazon Developer Hackathon (Alexa+ Track & AWS Builder Mini Challenge) using self-hosted MCP (Streamable HTTP, spec 2025-11-25).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-slate-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}

