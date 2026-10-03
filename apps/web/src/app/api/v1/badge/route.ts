import { NextRequest, NextResponse } from "next/server";

import { fail } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const serverId = request.nextUrl.searchParams.get("server") ?? request.nextUrl.searchParams.get("serverId");
  if (!serverId) return fail("api.missingServer", 400);
  const badge = await (await getRepo()).badge(serverId);
  if (!badge) return fail("api.notFound", 404);
  return NextResponse.json(badge, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=30" },
  });
}
