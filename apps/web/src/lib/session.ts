import { getServerSession } from "next-auth";

import { authOptions } from "./auth";
import { normalizePlan, type PlanId } from "./plans";
import { getRepo } from "./repo";
import { DEMO_OWNER_ID } from "./types";

export type AppUser = { id: string; name: string; email: string; plan: PlanId };

export type AppSession = {
  demo: boolean;
  user: AppUser | null;
};

export async function getAppSession(): Promise<AppSession> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return { demo: false, user: null };
  const user = await (await getRepo()).findUserById(id);
  if (!user) return { demo: false, user: null };
  return {
    demo: user.id === DEMO_OWNER_ID,
    user: {
      id: user.id,
      name: user.name,
      email: user.email ?? "",
      plan: normalizePlan(user.plan),
    },
  };
}
