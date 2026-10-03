import { NextRequest, NextResponse } from "next/server";

import { fail, requestLocale } from "@/lib/http";
import { t } from "@/lib/i18n";
import { getRepo, RepoError } from "@/lib/repo";
import { getAppSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getAppSession();
  if (!session.user) return fail("api.unauthorized", 401);
  const repo = await getRepo();
  const [servers, usage] = await Promise.all([repo.listServers(session.user.id), repo.usage(session.user.id)]);
  return NextResponse.json({ servers, usage });
}

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  if (!session.user) return fail("api.unauthorized", 401);
  const json = await request.json().catch(() => null);
  const name = typeof json?.name === "string" ? json.name.trim() : "";
  if (name.length < 2) return fail("api.nameShort", 400);
  if (name.length > 48) return fail("api.nameLong", 400);
  try {
    const created = await (await getRepo()).createServer(session.user.id, name);
    if (!created.ok) {
      const locale = requestLocale();
      return fail("api.limit", 403, { plan: t(locale, `plan.${created.plan}`), max: created.maxServers });
    }
    return NextResponse.json(created);
  } catch (error) {
    if (error instanceof RepoError && error.code === "not_found") return fail("api.unauthorized", 401);
    throw error;
  }
}
