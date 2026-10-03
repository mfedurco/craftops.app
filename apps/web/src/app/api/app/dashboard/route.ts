import { NextRequest, NextResponse } from "next/server";

import { requireOwned } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const serverId = request.nextUrl.searchParams.get("serverId");
  const ctx = await requireOwned(serverId);
  if (!ctx.ok) return ctx.error;
  const dashboard = await ctx.repo.dashboard(ctx.server.id);
  if (!dashboard) return NextResponse.json({ error: "Server sa nenašiel." }, { status: 404 });
  return NextResponse.json(dashboard);
}
