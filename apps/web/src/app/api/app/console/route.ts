import { NextRequest, NextResponse } from "next/server";

import { requireOwned } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ctx = await requireOwned(request.nextUrl.searchParams.get("serverId"));
  if (!ctx.ok) return ctx.error;
  return NextResponse.json(await ctx.repo.console(ctx.server.id));
}
