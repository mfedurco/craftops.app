import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { PwaRegister } from "@/components/pwa-register";
import { Shell } from "@/components/shell";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: { default: "CraftOps", template: "%s · CraftOps" },
  description: "Prevádzka Fabric servera — telemetria, audit a vzdialené akcie.",
  applicationName: "CraftOps",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "CraftOps", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#100e0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Shell>{children}</Shell>
        <PwaRegister />
      </body>
    </html>
  );
}
