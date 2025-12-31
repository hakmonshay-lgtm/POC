import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { RoleSchema } from "@/lib/domain";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { role?: string; userId?: string } | null;
  const role = RoleSchema.catch("marketing").parse(body?.role ?? "marketing");
  const userId = (body?.userId && String(body.userId)) || `${role.toUpperCase()}-USER-1`;

  const c = await cookies();
  c.set("nba_role", role, { httpOnly: false, sameSite: "lax", path: "/" });
  c.set("nba_user", userId, { httpOnly: false, sameSite: "lax", path: "/" });

  return NextResponse.json({ ok: true, role, userId });
}

