import { NextRequest, NextResponse } from "next/server";

import { requireOwned } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ctx = await requireOwned(params.get("serverId"));
  if (!ctx.ok) return ctx.error;
  const entries = await ctx.repo.audit(ctx.server.id, {
    player: params.get("player") ?? undefined,
    type: params.get("type") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  return NextResponse.json({ entries, total: entries.length });
}
