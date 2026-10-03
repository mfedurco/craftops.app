import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";

import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";
import { Shell } from "@/components/shell";
import { localeFromCookie, t } from "@/lib/i18n";
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

export function generateMetadata(): Metadata {
  const locale = localeFromCookie(cookies().get("craftops-lang")?.value);
  return {
    title: { default: "CraftOps", template: "%s · CraftOps" },
    description: t(locale, "meta.description"),
    applicationName: "CraftOps",
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
    appleWebApp: { capable: true, title: "CraftOps", statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = {
  themeColor: "#100e0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = localeFromCookie(cookies().get("craftops-lang")?.value);
  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers locale={locale}>
          <Shell>{children}</Shell>
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
