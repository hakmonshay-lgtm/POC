import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { cloneNba } from "@/lib/nbaRepo";
import { errorMessage } from "@/lib/errors";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (session.role !== "marketing") return NextResponse.json({ error: "Marketing role required" }, { status: 403 });
  try {
    const nba = cloneNba(id, session);
    return NextResponse.json({ nba });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) || "Failed" }, { status: 400 });
  }
}

