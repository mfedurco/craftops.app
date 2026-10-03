"use client";

import { SessionProvider } from "next-auth/react";

import { I18nProvider } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n";

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider initial={locale}>{children}</I18nProvider>
    </SessionProvider>
  );
}
