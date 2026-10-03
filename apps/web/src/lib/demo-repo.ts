import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

import { isKnownAction } from "./commands";
import { buildDashboard, craftOpsJson, isAuditType } from "./format";
import { buildSeed } from "./seed";
import type { OpsRepo } from "./repo";
import type {
  AuditFilter,
  AuditRecord,
  CommandRecord,
  EventInput,
  PlayerSample,
  ServerRecord,
  ServerSummary,
  StoreData,
  TelemetryInput,
} from "./types";

const STORE_VERSION = 1;
const DATA_PATH = path.join(process.cwd(), ".data", "store.json");

type Memory = { data: StoreData };
const globalStore = globalThis as unknown as {
  __craftops?: Memory;
  __craftopsChain?: Promise<void>;
};

function cid() {
  return "c" + randomBytes(12).toString("hex");
}

function load(): StoreData {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as { version?: number; data?: StoreData };
    if (parsed.version === STORE_VERSION && parsed.data?.servers?.length) {
      return parsed.data;
    }
  } catch {
    // missing or stale file falls through to a fresh seed
  }
  const data = buildSeed(Date.now());
  write(data);
  return data;
}

function write(data: StoreData) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify({ version: STORE_VERSION, data }));
}

function withStore<T>(fn: (data: StoreData) => T, persist = false): Promise<T> {
  if (!globalStore.__craftops) {
    globalStore.__craftops = { data: load() };
  }
  let result!: T;
  const previous = globalStore.__craftopsChain ?? Promise.resolve();
  const run = previous.then(() => {
    result = fn(globalStore.__craftops!.data);
    if (persist) write(globalStore.__craftops!.data);
  });
  globalStore.__craftopsChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run.then(() => result);
}

function summary(data: StoreData, server: ServerRecord): ServerSummary {
  const latest = data.telemetry
    .filter((point) => point.serverId === server.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .at(-1);
  const playersOnline = server.stopped
    ? 0
    : data.players.filter((player) => player.serverId === server.id && player.online).length;
  return { ...server, playersOnline, tps: latest ? latest.tps : null };
}

function owned(data: StoreData, ownerId: string, serverId: string) {
  return data.servers.find((server) => server.id === serverId && server.ownerId === ownerId) ?? null;
}

function touchPlayer(data: StoreData, serverId: string, sample: PlayerSample, online: boolean) {
  const now = new Date().toISOString();
  let row = data.players.find(
    (player) => player.serverId === serverId && (player.uuid === sample.uuid || player.username === sample.username),
  );
  if (!row) {
    row = {
      id: cid(),
      serverId,
      uuid: sample.uuid,
      username: sample.username,
      ping: sample.ping ?? 0,
      dimension: sample.dimension ?? "minecraft:overworld",
      x: sample.x,
      y: sample.y,
      z: sample.z,
      health: sample.health,
      food: sample.food ?? 20,
      operator: false,
      online,
      joinedAt: now,
      leftAt: online ? null : now,
    };
    data.players.push(row);
    return;
  }
  row.username = sample.username;
  row.ping = sample.ping ?? row.ping;
  row.dimension = sample.dimension ?? row.dimension;
  row.x = sample.x;
  row.y = sample.y;
  row.z = sample.z;
  row.health = sample.health;
  row.food = sample.food ?? row.food;
  row.online = online;
  if (online) row.leftAt = null;
  else row.leftAt = row.leftAt ?? now;
}

function audit(
  data: StoreData,
  serverId: string,
  type: AuditRecord["type"],
  player: string | null,
  message: string,
  extra?: Partial<Pick<AuditRecord, "x" | "y" | "z" | "dimension" | "timestamp">>,
) {
  data.auditLogs.push({
    id: cid(),
    serverId,
    type,
    player,
    message,
    x: extra?.x ?? null,
    y: extra?.y ?? null,
    z: extra?.z ?? null,
    dimension: extra?.dimension ?? null,
    timestamp: extra?.timestamp ?? new Date().toISOString(),
  });
  if (data.auditLogs.length > 2000) {
    data.auditLogs.splice(0, data.auditLogs.length - 2000);
  }
}

function findOnline(data: StoreData, serverId: string, name: string) {
  const needle = name.trim().toLowerCase();
  return data.players.find(
    (player) => player.serverId === serverId && player.online && player.username.toLowerCase() === needle,
  );
}

function preview(data: StoreData, server: ServerRecord, action: string, args: Record<string, string>) {
  const name = args.player ?? "";
  const target = name ? findOnline(data, server.id, name) : undefined;
  if (action === "kick" || action === "ban") {
    if (target) {
      target.online = false;
      target.leftAt = new Date().toISOString();
    }
  } else if (action === "heal" && target) {
    target.health = 20;
    target.food = 20;
  } else if (action === "teleport" && target && (args.spawn === "true" || !args.x)) {
    target.dimension = "minecraft:overworld";
    target.x = 0.5;
    target.y = 80;
    target.z = 0.5;
  } else if (action === "teleport" && target && args.x && args.y && args.z) {
    target.x = Number(args.x);
    target.y = Number(args.y);
    target.z = Number(args.z);
    if (args.dimension) target.dimension = args.dimension;
  } else if (action === "op" && target) {
    target.operator = true;
  } else if (action === "deop" && target) {
    target.operator = false;
  } else if (action === "stop") {
    server.stopped = true;
    for (const player of data.players) {
      if (player.serverId === server.id && player.online) {
        player.online = false;
        player.leftAt = new Date().toISOString();
      }
    }
  }
}

export const demoRepo: OpsRepo = {
  mode: "demo",
  listServers(ownerId) {
    return withStore((data) => data.servers.filter((server) => server.ownerId === ownerId).map((server) => summary(data, server)));
  },
  getOwnedServer(ownerId, serverId) {
    return withStore((data) => owned(data, ownerId, serverId));
  },
  findByApiKey(apiKey) {
    return withStore((data) => data.servers.find((server) => server.apiKey === apiKey) ?? null);
  },
  createServer(ownerId, name) {
    return withStore((data) => {
      const server: ServerRecord = {
        id: cid(),
        name,
        apiKey: `CO_${randomUUID().replace(/-/g, "").toUpperCase()}`,
        ownerId,
        motd: "",
        version: "1.20.1",
        maxPlayers: 40,
        stopped: false,
        createdAt: new Date().toISOString(),
      };
      data.servers.push(server);
      return { server, config: craftOpsJson(server.apiKey) };
    }, true);
  },
  dashboard(serverId) {
    return withStore((data) => {
      const server = data.servers.find((item) => item.id === serverId);
      if (!server) return null;
      const telemetry = data.telemetry.filter((point) => point.serverId === serverId);
      const online = data.players.filter((player) => player.serverId === serverId && player.online).length;
      const recent = data.auditLogs
        .filter((entry) => entry.serverId === serverId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 6);
      return buildDashboard(server, telemetry, online, recent);
    });
  },
  players(serverId) {
    return withStore((data) =>
      data.players
        .filter((player) => player.serverId === serverId)
        .sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username, "sk")),
    );
  },
  audit(serverId, filter: AuditFilter) {
    return withStore((data) => filterAudit(data.auditLogs, serverId, filter));
  },
  console(serverId) {
    return withStore((data) => ({
      lines: data.auditLogs
        .filter((entry) => entry.serverId === serverId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .slice(-180),
      queue: data.commands
        .filter((command) => command.serverId === serverId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20),
    }));
  },
  addTelemetry(serverId, sample: TelemetryInput) {
    return withStore((data) => {
      const server = data.servers.find((item) => item.id === serverId);
      if (!server) return;
      const timestamp = sample.timestamp ?? new Date().toISOString();
      data.telemetry.push({
        id: cid(),
        serverId,
        timestamp,
        tps: sample.tps,
        mspt: sample.mspt,
        ramUsedMb: sample.ramUsedMb,
        ramAllocMb: sample.ramAllocMb,
        ramMaxMb: sample.ramMaxMb,
        playersOnline: sample.players?.length ?? sample.playersOnline ?? 0,
        uptimeSeconds: sample.uptimeSeconds,
      });
      if (data.telemetry.length > 2500) {
        data.telemetry.splice(0, data.telemetry.length - 2500);
      }
      if (sample.players) {
        const seen = new Set(sample.players.map((player) => player.uuid));
        for (const player of sample.players) touchPlayer(data, serverId, player, true);
        for (const player of data.players) {
          if (player.serverId === serverId && player.online && !seen.has(player.uuid)) {
            player.online = false;
            player.leftAt = timestamp;
          }
        }
        server.stopped = false;
      }
    }, true);
  },
  addEvents(serverId, events: EventInput[]) {
    return withStore((data) => {
      for (const event of events) {
        if (!isAuditType(event.type)) continue;
        audit(data, serverId, event.type, event.player ?? null, event.message, {
          x: event.x ?? null,
          y: event.y ?? null,
          z: event.z ?? null,
          dimension: event.dimension ?? null,
          timestamp: event.timestamp,
        });
        if ((event.type === "join" || event.type === "leave") && event.player) {
          const online = event.type === "join";
          touchPlayer(
            data,
            serverId,
            {
              uuid: event.player,
              username: event.player,
              x: event.x ?? 0,
              y: event.y ?? 0,
              z: event.z ?? 0,
              health: online ? 20 : 0,
              dimension: event.dimension ?? undefined,
            },
            online,
          );
        }
      }
    }, true);
  },
  enqueue(serverId, action, args, line) {
    return withStore((data) => {
      const server = data.servers.find((item) => item.id === serverId);
      if (!server) throw new Error("Server sa nenašiel.");
      if (!isKnownAction(action)) throw new Error("Neznáma akcia.");
      const now = new Date().toISOString();
      const command: CommandRecord = {
        id: cid(),
        serverId,
        action,
        args,
        status: "pending",
        result: null,
        createdAt: now,
        updatedAt: now,
      };
      data.commands.push(command);
      preview(data, server, action, args);
      const text = line.trim() || describe(action, args);
      audit(data, serverId, "action", args.player || null, `> ${text}`);
      return command;
    }, true);
  },
  pullPending(serverId) {
    return withStore((data) => {
      const now = new Date().toISOString();
      const pending = data.commands.filter((command) => command.serverId === serverId && command.status === "pending");
      for (const command of pending) {
        command.status = "delivered";
        command.updatedAt = now;
      }
      return pending.map((command) => ({ ...command, status: "pending" as const }));
    }, true);
  },
  ack(serverId, results) {
    return withStore((data) => {
      const now = new Date().toISOString();
      for (const result of results) {
        const command = data.commands.find((item) => item.id === result.id && item.serverId === serverId);
        if (!command) continue;
        command.status = result.ok ? "completed" : "failed";
        command.result = result.message ?? null;
        command.updatedAt = now;
      }
    }, true);
  },
  badge(serverId) {
    return withStore((data) => {
      const server = data.servers.find((item) => item.id === serverId);
      if (!server) return null;
      const view = summary(data, server);
      const latest = data.telemetry.filter((point) => point.serverId === serverId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).at(-1);
      return {
        name: server.name,
        online: !server.stopped,
        players: view.playersOnline,
        max: server.maxPlayers,
        tps: latest?.tps ?? 0,
        mspt: latest?.mspt ?? 0,
        updatedAt: latest?.timestamp ?? server.createdAt,
      };
    });
  },
};

function filterAudit(entries: AuditRecord[], serverId: string, filter: AuditFilter) {
  const player = filter.player?.trim().toLowerCase();
  const from = filter.from ? Date.parse(filter.from) : null;
  const to = filter.to ? Date.parse(filter.to) : null;
  return entries
    .filter((entry) => entry.serverId === serverId)
    .filter((entry) => (filter.type && filter.type !== "all" ? entry.type === filter.type : true))
    .filter((entry) => (player ? (entry.player ?? "").toLowerCase().includes(player) || entry.message.toLowerCase().includes(player) : true))
    .filter((entry) => (from != null && !Number.isNaN(from) ? Date.parse(entry.timestamp) >= from : true))
    .filter((entry) => (to != null && !Number.isNaN(to) ? Date.parse(entry.timestamp) <= to : true))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 200);
}

function describe(action: string, args: Record<string, string>) {
  if (action === "broadcast") return `title ${args.title ?? ""} | ${args.subtitle ?? ""}`.trim();
  if (action === "clear_drops") return "clear";
  if (action === "stop") return "stop";
  return [action, args.player, args.item, args.reason].filter(Boolean).join(" ");
}
