import { NextResponse } from "next/server";

import { getRepo } from "@/lib/repo";
import { getAppSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getAppSession();
  if (!session.user) {
    return NextResponse.json({ demo: false, user: null, servers: [] }, { status: 401 });
  }
  const repo = await getRepo();
  const servers = await repo.listServers(session.user.id);
  return NextResponse.json({
    demo: session.demo,
    mode: repo.mode,
    user: session.user,
    servers,
  });
}
