import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/http";
import { getRepo } from "@/lib/repo";
import type { EventInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const eventSchema = z.object({
  type: z.enum(["chat", "command", "join", "leave", "death", "action"]),
  player: z.string().nullable().optional(),
  message: z.string().default(""),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  z: z.number().nullable().optional(),
  dimension: z.string().nullable().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
});

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key")?.trim();
  if (!apiKey) return apiError("Chýba hlavička x-api-key.", 401);
  const repo = await getRepo();
  const server = await repo.findByApiKey(apiKey);
  if (!server) return apiError("Neplatný API kľúč.", 401);
  const json = await request.json().catch(() => null);
  const events = Array.isArray(json?.events) ? json.events : [json];
  const parsed = z.array(eventSchema).safeParse(events);
  if (!parsed.success) return apiError("Udalosti majú neplatný tvar.", 400);
  const normalized: EventInput[] = parsed.data.map((event) => ({
    ...event,
    timestamp: typeof event.timestamp === "number" ? new Date(event.timestamp).toISOString() : event.timestamp,
  }));
  await repo.addEvents(server.id, normalized);
  return NextResponse.json({ ok: true, accepted: normalized.length });
}
