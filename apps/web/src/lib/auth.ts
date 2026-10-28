import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";

import { verifyPassword } from "./passwords";

if (!process.env.NEXTAUTH_SECRET) {
  // Záložný kľúč je povolený len pre lokálny vývoj a demo. V produkcii za behu
  // (nie počas `next build`) radšej zlyhať, než podpisovať sessions známym kľúčom.
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("NEXTAUTH_SECRET musí byť v produkcii nastavený.");
  }
  process.env.NEXTAUTH_SECRET = "dev-craftops-secret";
}
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = "http://127.0.0.1:38471";
}

export const discordConfigured = Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase() ?? "";
        const password = credentials?.password?.toString() ?? "";
        if (!email || !password) return null;
        const { getRepo } = await import("./repo");
        const user = await (await getRepo()).findUserByEmail(email);
        if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) return null;
        return { id: user.id, email: user.email ?? email, name: user.name };
      },
    }),
    ...(discordConfigured
      ? [
          DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID as string,
            clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account?.provider === "discord") {
        const { getRepo } = await import("./repo");
        const saved = await (await getRepo()).upsertDiscordUser({
          discordId: account.providerAccountId,
          email: user.email ?? null,
          name: user.name || "Discord",
          image: user.image ?? null,
        });
        token.sub = saved.id;
        token.email = saved.email;
        token.name = saved.name;
      } else if (user?.id) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        if (token.email) session.user.email = token.email;
        if (token.name) session.user.name = token.name;
      }
      return session;
    },
  },
};
