import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

import { isKnownAction } from "./commands";
import { buildDashboard, craftOpsJson, isAuditType } from "./format";
import type { AckResult, OpsRepo } from "./repo";
import type {
  AuditFilter,
  AuditRecord,
  CommandRecord,
  EventInput,
  PlayerRecord,
  ServerRecord,
  TelemetryInput,
} from "./types";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function db() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

function iso(value: Date) {
  return value.toISOString();
}

function mapServer(row: {
  id: string;
  name: string;
  apiKey: string;
  ownerId: string;
  motd: string | null;
  version: string | null;
  maxPlayers: number;
  stopped: boolean;
  createdAt: Date;
}): ServerRecord {
  return {
    id: row.id,
    name: row.name,
    apiKey: row.apiKey,
    ownerId: row.ownerId,
    motd: row.motd ?? "",
    version: row.version ?? "1.20.1",
    maxPlayers: row.maxPlayers,
    stopped: row.stopped,
    createdAt: iso(row.createdAt),
  };
}

function mapAudit(row: {
  id: string;
  serverId: string;
  type: string;
  player: string | null;
  message: string;
  x: number | null;
  y: number | null;
  z: number | null;
  dimension: string | null;
  timestamp: Date;
}): AuditRecord {
  return {
    id: row.id,
    serverId: row.serverId,
    type: isAuditType(row.type) ? row.type : "action",
    player: row.player,
    message: row.message,
    x: row.x,
    y: row.y,
    z: row.z,
    dimension: row.dimension,
    timestamp: iso(row.timestamp),
  };
}

function mapPlayer(row: {
  id: string;
  serverId: string;
  uuid: string;
  username: string;
  ping: number;
  dimension: string | null;
  x: number;
  y: number;
  z: number;
  health: number;
  food: number;
  operator: boolean;
  online: boolean;
  joinedAt: Date;
  leftAt: Date | null;
}): PlayerRecord {
  return {
    id: row.id,
    serverId: row.serverId,
    uuid: row.uuid,
    username: row.username,
    ping: row.ping,
    dimension: row.dimension ?? "minecraft:overworld",
    x: row.x,
    y: row.y,
    z: row.z,
    health: row.health,
    food: row.food,
    operator: row.operator,
    online: row.online,
    joinedAt: iso(row.joinedAt),
    leftAt: row.leftAt ? iso(row.leftAt) : null,
  };
}

function asArgs(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry == null) continue;
    out[key] = String(entry);
  }
  return out;
}

function mapCommand(row: {
  id: string;
  serverId: string;
  action: string;
  args: Prisma.JsonValue;
  status: string;
  result: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CommandRecord {
  const status = row.status;
  const safe: CommandRecord["status"] =
    status === "pending" || status === "delivered" || status === "completed" || status === "failed" ? status : "pending";
  return {
    id: row.id,
    serverId: row.serverId,
    action: row.action,
    args: asArgs(row.args),
    status: safe,
    result: row.result,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function ensureOwner(ownerId: string) {
  const prisma = db();
  await prisma.user.upsert({
    where: { id: ownerId },
    update: {},
    create: { id: ownerId, name: "Majiteľ", email: `${ownerId}@craftops.local` },
  });
}

export const prismaRepo: OpsRepo = {
  mode: "postgres",
  async listServers(ownerId) {
    await ensureOwner(ownerId);
    const prisma = db();
    const servers = await prisma.server.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } });
    return Promise.all(
      servers.map(async (server) => {
        const [latest, playersOnline] = await Promise.all([
          prisma.telemetry.findFirst({ where: { serverId: server.id }, orderBy: { timestamp: "desc" } }),
          prisma.playerSession.count({ where: { serverId: server.id, online: true } }),
        ]);
        return {
          ...mapServer(server),
          playersOnline: server.stopped ? 0 : playersOnline,
          tps: latest?.tps ?? null,
        };
      }),
    );
  },
  async getOwnedServer(ownerId, serverId) {
    const row = await db().server.findFirst({ where: { id: serverId, ownerId } });
    return row ? mapServer(row) : null;
  },
  async findByApiKey(apiKey) {
    const row = await db().server.findUnique({ where: { apiKey } });
    return row ? mapServer(row) : null;
  },
  async createServer(ownerId, name) {
    await ensureOwner(ownerId);
    const row = await db().server.create({
      data: {
        name,
        ownerId,
        version: "1.20.1",
        motd: "",
        apiKey: `CO_${randomUUID().replace(/-/g, "").toUpperCase()}`,
      },
    });
    const server = mapServer(row);
    return { server, config: craftOpsJson(server.apiKey, "https://craftops.app/api/v1") };
  },
  async dashboard(serverId) {
    const prisma = db();
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) return null;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [telemetry, online, recent] = await Promise.all([
      prisma.telemetry.findMany({ where: { serverId, timestamp: { gte: since } }, orderBy: { timestamp: "asc" } }),
      prisma.playerSession.count({ where: { serverId, online: true } }),
      prisma.auditLog.findMany({ where: { serverId }, orderBy: { timestamp: "desc" }, take: 6 }),
    ]);
    return buildDashboard(
      mapServer(server),
      telemetry.map((point) => ({
        id: point.id,
        serverId: point.serverId,
        timestamp: iso(point.timestamp),
        tps: point.tps,
        mspt: point.mspt,
        ramUsedMb: point.ramUsedMb,
        ramAllocMb: point.ramAllocMb,
        ramMaxMb: point.ramMaxMb,
        playersOnline: point.playersOnline,
        uptimeSeconds: point.uptimeSeconds,
      })),
      online,
      recent.map(mapAudit),
    );
  },
  async players(serverId) {
    const rows = await db().playerSession.findMany({
      where: { serverId },
      orderBy: [{ online: "desc" }, { username: "asc" }],
    });
    return rows.map(mapPlayer);
  },
  async audit(serverId, filter: AuditFilter) {
    const where: Prisma.AuditLogWhereInput = { serverId };
    if (filter.type && filter.type !== "all") where.type = filter.type;
    if (filter.from || filter.to) {
      const timestamp: Prisma.DateTimeFilter = {};
      if (filter.from) timestamp.gte = new Date(filter.from);
      if (filter.to) timestamp.lte = new Date(filter.to);
      where.timestamp = timestamp;
    }
    if (filter.player?.trim()) {
      where.OR = [
        { player: { contains: filter.player.trim(), mode: "insensitive" } },
        { message: { contains: filter.player.trim(), mode: "insensitive" } },
      ];
    }
    const rows = await db().auditLog.findMany({ where, orderBy: { timestamp: "desc" }, take: 200 });
    return rows.map(mapAudit);
  },
  async console(serverId) {
    const prisma = db();
    const [lines, queue] = await Promise.all([
      prisma.auditLog.findMany({ where: { serverId }, orderBy: { timestamp: "desc" }, take: 180 }),
      prisma.remoteCommand.findMany({ where: { serverId }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return { lines: lines.map(mapAudit).reverse(), queue: queue.map(mapCommand) };
  },
  async addTelemetry(serverId, sample: TelemetryInput) {
    const prisma = db();
    const timestamp = sample.timestamp ? new Date(sample.timestamp) : new Date();
    await prisma.telemetry.create({
      data: {
        serverId,
        timestamp,
        tps: sample.tps,
        mspt: sample.mspt,
        ramUsedMb: sample.ramUsedMb,
        ramAllocMb: sample.ramAllocMb,
        ramMaxMb: sample.ramMaxMb,
        playersOnline: sample.players?.length ?? sample.playersOnline ?? 0,
        uptimeSeconds: Math.round(sample.uptimeSeconds),
      },
    });
    if (!sample.players) return;
    const seen = new Set(sample.players.map((player) => player.uuid));
    for (const player of sample.players) {
      const existing = await prisma.playerSession.findFirst({
        where: { serverId, OR: [{ uuid: player.uuid }, { username: player.username }] },
        orderBy: { joinedAt: "desc" },
      });
      if (existing) {
        await prisma.playerSession.update({
          where: { id: existing.id },
          data: {
            username: player.username,
            ping: player.ping ?? existing.ping,
            dimension: player.dimension,
            x: player.x,
            y: player.y,
            z: player.z,
            health: player.health,
            food: player.food ?? existing.food,
            online: true,
            leftAt: null,
          },
        });
      } else {
        await prisma.playerSession.create({
          data: {
            serverId,
            uuid: player.uuid,
            username: player.username,
            ping: player.ping ?? 0,
            dimension: player.dimension,
            x: player.x,
            y: player.y,
            z: player.z,
            health: player.health,
            food: player.food ?? 20,
            online: true,
          },
        });
      }
    }
    await prisma.playerSession.updateMany({
      where: { serverId, online: true, uuid: { notIn: Array.from(seen) } },
      data: { online: false, leftAt: timestamp },
    });
    await prisma.server.update({ where: { id: serverId }, data: { stopped: false } });
  },
  async addEvents(serverId, events: EventInput[]) {
    const prisma = db();
    for (const event of events) {
      if (!isAuditType(event.type)) continue;
      await prisma.auditLog.create({
        data: {
          serverId,
          type: event.type,
          player: event.player ?? null,
          message: event.message,
          x: event.x ?? null,
          y: event.y ?? null,
          z: event.z ?? null,
          dimension: event.dimension ?? null,
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        },
      });
    }
  },
  async enqueue(serverId, action, args, line) {
    if (!isKnownAction(action)) throw new Error("Neznáma akcia.");
    const row = await db().remoteCommand.create({
      data: { serverId, action, args, status: "pending" },
    });
    await db().auditLog.create({
      data: {
        serverId,
        type: "action",
        player: args.player || null,
        message: `> ${line.trim() || action}`,
      },
    });
    return mapCommand(row);
  },
  async pullPending(serverId) {
    const prisma = db();
    const rows = await prisma.remoteCommand.findMany({
      where: { serverId, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (rows.length) {
      await prisma.remoteCommand.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { status: "delivered" },
      });
    }
    return rows.map((row) => ({ ...mapCommand(row), status: "pending" as const }));
  },
  async ack(serverId, results: AckResult[]) {
    const prisma = db();
    for (const result of results) {
      await prisma.remoteCommand.updateMany({
        where: { id: result.id, serverId },
        data: { status: result.ok ? "completed" : "failed", result: result.message ?? null },
      });
    }
  },
  async badge(serverId) {
    const prisma = db();
    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) return null;
    const [latest, players] = await Promise.all([
      prisma.telemetry.findFirst({ where: { serverId }, orderBy: { timestamp: "desc" } }),
      prisma.playerSession.count({ where: { serverId, online: true } }),
    ]);
    return {
      name: server.name,
      online: !server.stopped,
      players: server.stopped ? 0 : players,
      max: server.maxPlayers,
      tps: latest?.tps ?? 0,
      mspt: latest?.mspt ?? 0,
      updatedAt: latest ? iso(latest.timestamp) : iso(server.createdAt),
    };
  },
};
