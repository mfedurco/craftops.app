export const PLANS = {
  free: { maxServers: 1, retentionDays: 7 },
  pro: { maxServers: 10, retentionDays: 90 },
} as const;

export type PlanId = keyof typeof PLANS;

export function normalizePlan(plan: string | null | undefined): PlanId {
  return plan === "pro" ? "pro" : "free";
}

export function planLimits(plan: string | null | undefined) {
  const id = normalizePlan(plan);
  return { id, ...PLANS[id] };
}

export function retentionCutoff(plan: string | null | undefined, now = Date.now()) {
  const { retentionDays } = planLimits(plan);
  return new Date(now - retentionDays * 24 * 60 * 60 * 1000);
}
