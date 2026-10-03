"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-4" role="alert">
      <h1 className="text-lg font-semibold">{t("error.pageTitle")}</h1>
      <p className="text-sm">{error.message || t("error.pageBody")}</p>
      <Button variant="outline" onClick={reset}>{t("error.retry")}</Button>
    </div>
  );
}
