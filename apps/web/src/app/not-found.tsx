import Link from "next/link";
import { cookies } from "next/headers";

import { localeFromCookie, t } from "@/lib/i18n";

export default function NotFound() {
  const locale = localeFromCookie(cookies().get("craftops-lang")?.value);
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">{t(locale, "notFound.title")}</h1>
      <p className="text-sm text-muted-foreground">{t(locale, "notFound.body")}</p>
      <Link href="/" className="text-sm text-primary">{t(locale, "notFound.back")}</Link>
    </div>
  );
}
