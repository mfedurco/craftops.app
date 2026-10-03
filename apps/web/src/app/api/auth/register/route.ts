import { NextRequest, NextResponse } from "next/server";

import { fail } from "@/lib/http";
import { hashPassword } from "@/lib/passwords";
import { getRepo, RepoError } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const name = typeof json?.name === "string" ? json.name.trim() : "";
  const email = typeof json?.email === "string" ? json.email.trim().toLowerCase() : "";
  const password = typeof json?.password === "string" ? json.password : "";
  if (name.length < 2 || name.length > 48) return fail("api.badName", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("api.badEmail", 400);
  if (password.length < 8 || password.length > 200) return fail("api.passwordShort", 400);
  try {
    const user = await (await getRepo()).registerUser({
      name,
      email,
      passwordHash: hashPassword(password),
    });
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
    });
  } catch (error) {
    if (error instanceof RepoError && error.code === "email_taken") return fail("api.emailTaken", 409);
    throw error;
  }
}
