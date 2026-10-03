import { NextResponse } from "next/server";

import { getRepo, usesPostgres } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const repo = await getRepo();
  return NextResponse.json({
    ok: true,
    mode: usesPostgres() ? "postgres" : "demo",
    repo: repo.mode,
  });
}
