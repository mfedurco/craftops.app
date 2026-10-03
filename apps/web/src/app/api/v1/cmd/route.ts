import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isKnownAction, parseConsoleLine, stringArgs } from "@/lib/commands";
import { fail, requestLocale } from "@/lib/http";
import { t } from "@/lib/i18n";
import { getRepo, RepoError } from "@/lib/repo";
import { getAppSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ackSchema = z.object({
  ack: z.array(
    z.object({
      id: z.string().min(1),
      ok: z.boolean(),
      message: z.string().optional(),
    }),
  ),
});

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key")?.trim();
  const repo = await getRepo();
  if (apiKey) {
    const server = await repo.findByApiKey(apiKey);
    if (!server) return fail("api.badKey", 401);
    const pending = await repo.pullPending(server.id);
    return NextResponse.json({
      commands: pending.map((command) => ({
        id: command.id,
        action: command.action,
        args: command.args,
      })),
    });
  }
  const session = await getAppSession();
  if (!session.user) return fail("api.unauthorized", 401);
  const serverId = request.nextUrl.searchParams.get("serverId");
  if (!serverId) return fail("api.missingServer", 400);
  const server = await repo.getOwnedServer(session.user.id, serverId);
  if (!server) return fail("api.notFound", 404);
  const feed = await repo.console(serverId);
  return NextResponse.json({ commands: feed.queue });
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const apiKey = request.headers.get("x-api-key")?.trim();
  const repo = await getRepo();

  if (apiKey && json && typeof json === "object" && "ack" in json) {
    const server = await repo.findByApiKey(apiKey);
    if (!server) return fail("api.badKey", 401);
    const parsed = ackSchema.safeParse(json);
    if (!parsed.success) return fail("api.badAck", 400);
    await repo.ack(server.id, parsed.data.ack);
    return NextResponse.json({ ok: true });
  }

  let serverId = typeof json?.serverId === "string" ? json.serverId : "";
  if (apiKey) {
    const server = await repo.findByApiKey(apiKey);
    if (!server) return fail("api.badKey", 401);
    serverId = server.id;
  } else {
    const session = await getAppSession();
    if (!session.user) return fail("api.unauthorized", 401);
    const owned = await repo.getOwnedServer(session.user.id, serverId);
    if (!owned) return fail("api.notFound", 404);
  }

  let action = "";
  let args: Record<string, string> = {};
  let line = "";
  if (typeof json?.line === "string") {
    line = json.line.trim();
    if (!line) return fail("api.emptyCommand", 400);
    const parsed = parseConsoleLine(line);
    action = parsed.action;
    args = parsed.args;
  } else if (typeof json?.action === "string") {
    action = json.action;
    args = stringArgs(json.args);
    line = typeof json.line === "string" ? json.line : "";
  } else {
    return fail("api.badCommand", 400);
  }
  if (!isKnownAction(action)) return fail("api.unknownAction", 400);
  if ((action === "kick" || action === "ban" || action === "heal" || action === "op" || action === "deop" || action === "give") && !args.player) {
    return fail("api.missingPlayer", 400);
  }
  try {
    const command = await repo.enqueue(serverId, action, args, line);
    return NextResponse.json({
      ok: true,
      command,
      message: t(requestLocale(), "api.queued"),
    });
  } catch (error) {
    if (error instanceof RepoError && error.code === "unknown_action") return fail("api.unknownAction", 400);
    if (error instanceof RepoError && error.code === "not_found") return fail("api.notFound", 404);
    return fail("api.commandFailed", 400);
  }
}
