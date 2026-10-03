export type AuditType = "chat" | "command" | "join" | "leave" | "death" | "action";
export type CommandStatus = "pending" | "delivered" | "completed" | "failed";

export type ServerRecord = {
  id: string;
  name: string;
  apiKey: string;
  ownerId: string;
  motd: string;
  version: string;
  maxPlayers: number;
  stopped: boolean;
  createdAt: string;
};

export type ServerSummary = ServerRecord & {
  playersOnline: number;
  tps: number | null;
};

export type TelemetryPoint = {
  id: string;
  serverId: string;
  timestamp: string;
  tps: number;
  mspt: number;
  ramUsedMb: number;
  ramAllocMb: number;
  ramMaxMb: number;
  playersOnline: number;
  uptimeSeconds: number;
};

export type AuditRecord = {
  id: string;
  serverId: string;
  type: AuditType;
  player: string | null;
  message: string;
  x: number | null;
  y: number | null;
  z: number | null;
  dimension: string | null;
  timestamp: string;
};

export type PlayerRecord = {
  id: string;
  serverId: string;
  uuid: string;
  username: string;
  ping: number;
  dimension: string;
  x: number;
  y: number;
  z: number;
  health: number;
  food: number;
  operator: boolean;
  online: boolean;
  joinedAt: string;
  leftAt: string | null;
};

export type CommandRecord = {
  id: string;
  serverId: string;
  action: string;
  args: Record<string, string>;
  status: CommandStatus;
  result: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SeriesPoint = {
  t: string;
  label: string;
  tps: number;
  mspt: number;
  ram: number;
};

export type DashboardData = {
  server: ServerRecord;
  kpis: {
    uptimeRatio: number;
    uptimeLabel: string;
    playersOnline: number;
    maxPlayers: number;
    avgMspt: number;
    tps: number;
    mspt: number;
    ramUsedMb: number;
  };
  series: { h24: SeriesPoint[]; d7: SeriesPoint[] };
  recent: AuditRecord[];
};

export type AuditFilter = {
  player?: string;
  type?: string;
  from?: string;
  to?: string;
};

export type PlayerSample = {
  uuid: string;
  username: string;
  ping?: number;
  dimension?: string;
  x: number;
  y: number;
  z: number;
  health: number;
  food?: number;
};

export type TelemetryInput = {
  tps: number;
  mspt: number;
  ramUsedMb: number;
  ramAllocMb: number;
  ramMaxMb: number;
  playersOnline?: number;
  uptimeSeconds: number;
  timestamp?: string;
  players?: PlayerSample[];
};

export type EventInput = {
  type: AuditType;
  player?: string | null;
  message: string;
  x?: number | null;
  y?: number | null;
  z?: number | null;
  dimension?: string | null;
  timestamp?: string;
};

export type BadgeStatus = {
  name: string;
  online: boolean;
  players: number;
  max: number;
  tps: number;
  mspt: number;
  updatedAt: string;
};

export type StoreData = {
  users: { id: string; name: string; email: string; discordId: string | null }[];
  servers: ServerRecord[];
  telemetry: TelemetryPoint[];
  auditLogs: AuditRecord[];
  players: PlayerRecord[];
  commands: CommandRecord[];
};

export const DEMO_OWNER_ID = "user_demo_owner";
export const DEMO_SERVER_ID = "srv_hory_a_doly";
export const DEMO_API_KEY = "CO_DEMO_HORYADOLY_7F3A9C2E";
