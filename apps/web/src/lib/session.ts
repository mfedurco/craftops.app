import { getServerSession } from "next-auth";

import { authOptions, discordConfigured } from "./auth";
import { DEMO_OWNER_ID } from "./types";

export type AppUser = { id: string; name: string; email: string };

export type AppSession = {
  demo: boolean;
  user: AppUser | null;
};

export async function getAppSession(): Promise<AppSession> {
  if (!discordConfigured) {
    return {
      demo: true,
      user: {
        id: DEMO_OWNER_ID,
        name: "Demo Majiteľ",
        email: "majitel@craftops.local",
      },
    };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { demo: false, user: null };
  }
  return {
    demo: false,
    user: {
      id: (session.user as { id?: string }).id || session.user.email,
      name: session.user.name || "Majiteľ",
      email: session.user.email,
    },
  };
}
