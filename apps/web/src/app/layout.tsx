import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Veylo — See it. Say it. Find it.",
  description:
    "Turns ambiguous human requests into concrete real-world shopping actions. Identifies products, verifies physical inventory, and finds nearby local stores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fbfbfd] text-zinc-900 flex flex-col antialiased selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
