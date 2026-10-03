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
} from "./types";

export type AckResult = { id: string; ok: boolean; message?: string };

export interface OpsRepo {
  mode: "demo" | "postgres";
  listServers(ownerId: string): Promise<ServerSummary[]>;
  getOwnedServer(ownerId: string, serverId: string): Promise<ServerRecord | null>;
  findByApiKey(apiKey: string): Promise<ServerRecord | null>;
  createServer(ownerId: string, name: string): Promise<{ server: ServerRecord; config: string }>;
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
