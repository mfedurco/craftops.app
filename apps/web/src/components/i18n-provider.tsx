"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { localeFromCookie, t, type Locale, type MessageKey } from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  const value = useMemo<I18nValue>(() => {
    return {
      locale,
      t: (key, vars) => t(locale, key, vars),
      setLocale(next) {
        document.cookie = `craftops-lang=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = next;
        setLocaleState(next);
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n outside provider");
  return value;
}

export function LanguageSwitch() {
  const { locale, setLocale, t: tr } = useI18n();
  return (
    <div className="flex items-center rounded-md border border-border p-0.5 text-[11px]" role="group" aria-label={tr("lang.label")}>
      {(["sk", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          className={code === locale ? "rounded-sm bg-primary px-2 py-1 font-medium text-primary-foreground" : "rounded-sm px-2 py-1 text-muted-foreground"}
          onClick={() => setLocale(localeFromCookie(code))}
        >
          {tr(code === "sk" ? "lang.sk" : "lang.en")}
        </button>
      ))}
    </div>
  );
}
