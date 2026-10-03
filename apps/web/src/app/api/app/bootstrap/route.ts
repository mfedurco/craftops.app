import { NextResponse } from "next/server";

import { discordConfigured } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { getAppSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getAppSession();
  if (!session.user) {
    return NextResponse.json({ demo: false, user: null, servers: [], discord: discordConfigured }, { status: 401 });
  }
  const repo = await getRepo();
  const [servers, usage] = await Promise.all([repo.listServers(session.user.id), repo.usage(session.user.id)]);
  return NextResponse.json({
    demo: session.demo,
    mode: repo.mode,
    discord: discordConfigured,
    user: session.user,
    usage,
    servers,
  });
}
