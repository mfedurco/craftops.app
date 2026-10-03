import type { MetadataRoute } from "next";
import { cookies } from "next/headers";

import { localeFromCookie, t } from "@/lib/i18n";

export default function manifest(): MetadataRoute.Manifest {
  const locale = localeFromCookie(cookies().get("craftops-lang")?.value);
  return {
    name: "CraftOps",
    short_name: "CraftOps",
    description: t(locale, "meta.description"),
    start_url: "/",
    display: "standalone",
    background_color: "#100e0c",
    theme_color: "#100e0c",
    lang: locale,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
