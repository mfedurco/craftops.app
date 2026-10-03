import { NextResponse } from "next/server";

import { getRepo, type OpsRepo } from "./repo";
import { getAppSession, type AppSession } from "./session";
import type { ServerRecord } from "./types";

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export type OwnedContext =
  | { ok: false; error: NextResponse }
  | { ok: true; session: AppSession; repo: OpsRepo; server: ServerRecord };

export async function requireOwned(serverId: string | null): Promise<OwnedContext> {
  const session = await getAppSession();
  if (!session.user) {
    return { ok: false, error: apiError("Prihláste sa cez Discord.", 401) };
  }
  if (!serverId) {
    return { ok: false, error: apiError("Chýba server.", 400) };
  }
  const repo = await getRepo();
  const server = await repo.getOwnedServer(session.user.id, serverId);
  if (!server) {
    return { ok: false, error: apiError("Server sa nenašiel.", 404) };
  }
  return { ok: true, session, repo, server };
}
