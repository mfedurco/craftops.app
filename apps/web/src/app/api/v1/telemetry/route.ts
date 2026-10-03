import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/http";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const playerSchema = z.object({
  uuid: z.string().min(1),
  username: z.string().min(1),
  ping: z.number().optional(),
  dimension: z.string().optional(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  health: z.number(),
  food: z.number().optional(),
});

const bodySchema = z.object({
  tps: z.number().min(0).max(20),
  mspt: z.number().min(0).max(10000),
  ram_used_mb: z.number().nonnegative().optional(),
  ramUsedMb: z.number().nonnegative().optional(),
  ram_allocated_mb: z.number().nonnegative().optional(),
  ramAllocMb: z.number().nonnegative().optional(),
  ram_max_mb: z.number().nonnegative().optional(),
  ramMaxMb: z.number().nonnegative().optional(),
  players_online: z.number().int().nonnegative().optional(),
  playersOnline: z.number().int().nonnegative().optional(),
  uptime_seconds: z.number().nonnegative().optional(),
  uptimeSeconds: z.number().nonnegative().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  players: z.array(playerSchema).optional(),
});

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (!apiKey) return apiError("Chýba hlavička x-api-key.", 401);
  const repo = await getRepo();
  const server = await repo.findByApiKey(apiKey);
  if (!server) return apiError("Neplatný API kľúč.", 401);
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return apiError("Telemetria má neplatný tvar.", 400);
  const body = parsed.data;
  const timestamp =
    typeof body.timestamp === "number" ? new Date(body.timestamp).toISOString() : body.timestamp;
  await repo.addTelemetry(server.id, {
    tps: body.tps,
    mspt: body.mspt,
    ramUsedMb: body.ram_used_mb ?? body.ramUsedMb ?? 0,
    ramAllocMb: body.ram_allocated_mb ?? body.ramAllocMb ?? 0,
    ramMaxMb: body.ram_max_mb ?? body.ramMaxMb ?? 0,
    playersOnline: body.players_online ?? body.playersOnline,
    uptimeSeconds: body.uptime_seconds ?? body.uptimeSeconds ?? 0,
    timestamp,
    players: body.players,
  });
  return NextResponse.json({ ok: true });
}
