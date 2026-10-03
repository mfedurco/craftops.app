import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { localeFromCookie, t, type Locale, type MessageKey } from "./i18n";
import { getRepo, type OpsRepo } from "./repo";
import { getAppSession, type AppSession } from "./session";
import type { ServerRecord } from "./types";

export function requestLocale(): Locale {
  return localeFromCookie(cookies().get("craftops-lang")?.value);
}

export function fail(key: MessageKey, status: number, vars?: Record<string, string | number>) {
  return NextResponse.json({ error: t(requestLocale(), key, vars) }, { status });
}

export type OwnedContext =
  | { ok: false; error: NextResponse }
  | { ok: true; session: AppSession; repo: OpsRepo; server: ServerRecord };

export async function requireOwned(serverId: string | null): Promise<OwnedContext> {
  const session = await getAppSession();
  if (!session.user) {
    return { ok: false, error: fail("api.unauthorized", 401) };
  }
  if (!serverId) {
    return { ok: false, error: fail("api.missingServer", 400) };
  }
  const repo = await getRepo();
  const server = await repo.getOwnedServer(session.user.id, serverId);
  if (!server) {
    return { ok: false, error: fail("api.notFound", 404) };
  }
  return { ok: true, session, repo, server };
}
