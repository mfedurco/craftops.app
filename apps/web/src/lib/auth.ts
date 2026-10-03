import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const discordConfigured = Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  providers: discordConfigured
    ? [
        DiscordProvider({
          clientId: process.env.DISCORD_CLIENT_ID as string,
          clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
        }),
      ]
    : [],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "dev-craftops-secret",
  callbacks: {
    async jwt({ token, profile }) {
      if (profile && typeof profile === "object" && "id" in profile) {
        token.discordId = String((profile as { id: string }).id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
};
