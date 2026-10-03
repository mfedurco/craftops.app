import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import { getAppSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2, "Názov musí mať aspoň 2 znaky.").max(48, "Názov je pridlhý."),
});

export async function GET() {
  const session = await getAppSession();
  if (!session.user) return apiError("Prihláste sa cez Discord.", 401);
  const servers = await (await getRepo()).listServers(session.user.id);
  return NextResponse.json({ servers });
}

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  if (!session.user) return apiError("Prihláste sa cez Discord.", 401);
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Neplatný názov.", 400);
  const created = await (await getRepo()).createServer(session.user.id, parsed.data.name);
  return NextResponse.json(created);
}
