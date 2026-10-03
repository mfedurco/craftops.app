import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

import { isKnownAction } from "./commands";
import { buildDashboard, craftOpsJson, isAuditType } from "./format";
import { planLimits, retentionCutoff } from "./plans";
import { RepoError, type AckResult, type OpsRepo } from "./repo";
import type {
  AuditFilter,
  AuditRecord,
  CommandRecord,
  EventInput,
  PlayerRecord,
  ServerRecord,
  TelemetryInput,
  UserRecord,
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

function mapUser(row: {
  id: string;
  name: string | null;
  email: string | null;
  discordId: string | null;
  passwordHash: string | null;
  plan: string;
  image: string | null;
}): UserRecord {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email,
    discordId: row.discordId,
    passwordHash: row.passwordHash,
    plan: row.plan === "pro" ? "pro" : "free",
    image: row.image,
  };
}

async function cutoffFor(serverId: string) {
  const server = await db().server.findUnique({ where: { id: serverId }, include: { owner: true } });
  if (!server) return null;
  return { server, cutoff: retentionCutoff(server.owner.plan) };
}

export const prismaRepo: OpsRepo = {
  mode: "postgres",
  async findUserById(id) {
    const row = await db().user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  },
  async findUserByEmail(email) {
    const row = await db().user.findUnique({ where: { email: email.trim().toLowerCase() } });
    return row ? mapUser(row) : null;
  },
  async registerUser({ name, email, passwordHash }) {
    const prisma = db();
    const needle = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: needle } });
    if (existing) throw new RepoError("email_taken");
    const row = await prisma.user.create({
      data: { name: name.trim(), email: needle, passwordHash, plan: "free" },
    });
    return mapUser(row);
  },
  async upsertDiscordUser({ discordId, email, name, image }) {
    const prisma = db();
    const byDiscord = await prisma.user.findUnique({ where: { discordId } });
    if (byDiscord) {
      const row = await prisma.user.update({
        where: { id: byDiscord.id },
        data: { name: name || byDiscord.name, image, email: byDiscord.email ?? email?.toLowerCase() ?? null },
      });
      return mapUser(row);
    }
    const needle = email?.trim().toLowerCase();
    if (needle) {
      const byEmail = await prisma.user.findUnique({ where: { email: needle } });
      if (byEmail) {
        const row = await prisma.user.update({
          where: { id: byEmail.id },
          data: { discordId, image: image ?? byEmail.image, name: byEmail.name || name },
        });
        return mapUser(row);
      }
    }
    const row = await prisma.user.create({
      data: { name: name.trim() || "Discord", email: needle || null, discordId, image, plan: "free" },
    });
    return mapUser(row);
  },
  async usage(ownerId) {
    const prisma = db();
    const user = await prisma.user.findUnique({ where: { id: ownerId } });
    const limits = planLimits(user?.plan);
    const serverCount = await prisma.server.count({ where: { ownerId } });
    return { plan: limits.id, serverCount, maxServers: limits.maxServers, retentionDays: limits.retentionDays };
  },
  async listServers(ownerId) {
    const prisma = db();
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    const cutoff = retentionCutoff(owner?.plan);
    const servers = await prisma.server.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" } });
    return Promise.all(
      servers.map(async (server) => {
        const [latest, playersOnline] = await Promise.all([
          prisma.telemetry.findFirst({ where: { serverId: server.id, timestamp: { gte: cutoff } }, orderBy: { timestamp: "desc" } }),
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
    const prisma = db();
    const user = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!user) throw new RepoError("not_found");
    const limits = planLimits(user.plan);
    const serverCount = await prisma.server.count({ where: { ownerId } });
    if (serverCount >= limits.maxServers) {
      return { ok: false, code: "plan_limit", plan: limits.id, maxServers: limits.maxServers, serverCount };
    }
    const row = await prisma.server.create({
      data: {
        name,
        ownerId,
        version: "1.20.1",
        motd: "",
        apiKey: `CO_${randomUUID().replace(/-/g, "").toUpperCase()}`,
      },
    });
    const server = mapServer(row);
    return { ok: true, server, config: craftOpsJson(server.apiKey, "https://craftops.app/api/v1") };
  },
  async dashboard(serverId) {
    const prisma = db();
    const scoped = await cutoffFor(serverId);
    if (!scoped) return null;
    const { server, cutoff } = scoped;
    const [telemetry, online, recent] = await Promise.all([
      prisma.telemetry.findMany({ where: { serverId, timestamp: { gte: cutoff } }, orderBy: { timestamp: "asc" } }),
      prisma.playerSession.count({ where: { serverId, online: true } }),
      prisma.auditLog.findMany({ where: { serverId, timestamp: { gte: cutoff } }, orderBy: { timestamp: "desc" }, take: 6 }),
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
    const scoped = await cutoffFor(serverId);
    const cutoff = scoped?.cutoff ?? retentionCutoff("free");
    const where: Prisma.AuditLogWhereInput = { serverId };
    if (filter.type && filter.type !== "all") where.type = filter.type;
    const timestamp: Prisma.DateTimeFilter = { gte: cutoff };
    if (filter.from) {
      const requested = new Date(filter.from);
      if (requested > cutoff) timestamp.gte = requested;
    }
    if (filter.to) timestamp.lte = new Date(filter.to);
    where.timestamp = timestamp;
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
    const scoped = await cutoffFor(serverId);
    const cutoff = scoped?.cutoff ?? retentionCutoff("free");
    const [lines, queue] = await Promise.all([
      prisma.auditLog.findMany({ where: { serverId, timestamp: { gte: cutoff } }, orderBy: { timestamp: "desc" }, take: 180 }),
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
    if (!isKnownAction(action)) throw new RepoError("unknown_action");
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
    const scoped = await cutoffFor(serverId);
    if (!scoped) return null;
    const { server, cutoff } = scoped;
    const [latest, players] = await Promise.all([
      prisma.telemetry.findFirst({ where: { serverId, timestamp: { gte: cutoff } }, orderBy: { timestamp: "desc" } }),
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
