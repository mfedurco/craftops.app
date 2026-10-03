import type { PlanId } from "./plans";
import type {
  AuditFilter,
  BadgeStatus,
  CommandRecord,
  DashboardData,
  EventInput,
  PlayerRecord,
  ServerRecord,
  ServerSummary,
  TelemetryInput,
  UserRecord,
} from "./types";

export type AckResult = { id: string; ok: boolean; message?: string };

export type AccountUsage = {
  plan: PlanId;
  serverCount: number;
  maxServers: number;
  retentionDays: number;
};

export type CreateServerResult =
  | { ok: true; server: ServerRecord; config: string }
  | { ok: false; code: "plan_limit"; plan: PlanId; maxServers: number; serverCount: number };

export class RepoError extends Error {
  code: "not_found" | "unknown_action" | "email_taken";

  constructor(code: "not_found" | "unknown_action" | "email_taken") {
    super(code);
    this.code = code;
  }
}

export interface OpsRepo {
  mode: "demo" | "postgres";
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  registerUser(input: { name: string; email: string; passwordHash: string }): Promise<UserRecord>;
  upsertDiscordUser(input: { discordId: string; email: string | null; name: string; image: string | null }): Promise<UserRecord>;
  usage(ownerId: string): Promise<AccountUsage>;
  listServers(ownerId: string): Promise<ServerSummary[]>;
  getOwnedServer(ownerId: string, serverId: string): Promise<ServerRecord | null>;
  findByApiKey(apiKey: string): Promise<ServerRecord | null>;
  createServer(ownerId: string, name: string): Promise<CreateServerResult>;
  dashboard(serverId: string): Promise<DashboardData | null>;
  players(serverId: string): Promise<PlayerRecord[]>;
  audit(serverId: string, filter: AuditFilter): Promise<AuditRecordSafe[]>;
  console(serverId: string): Promise<{ lines: AuditRecordSafe[]; queue: CommandRecord[] }>;
  addTelemetry(serverId: string, sample: TelemetryInput): Promise<void>;
  addEvents(serverId: string, events: EventInput[]): Promise<void>;
  enqueue(serverId: string, action: string, args: Record<string, string>, line: string): Promise<CommandRecord>;
  pullPending(serverId: string): Promise<CommandRecord[]>;
  ack(serverId: string, results: AckResult[]): Promise<void>;
  badge(serverId: string): Promise<BadgeStatus | null>;
}

type AuditRecordSafe = import("./types").AuditRecord;

export function usesPostgres() {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

export async function getRepo(): Promise<OpsRepo> {
  if (usesPostgres()) {
    const { prismaRepo } = await import("./prisma-repo");
    return prismaRepo;
  }
  const { demoRepo } = await import("./demo-repo");
  return demoRepo;
}
