import { NextResponse } from "next/server";
import { getLatestSnapshot } from "@/lib/nbaRepo";
import { deleteNba } from "@/lib/nbaRepo";
import { getSession } from "@/lib/session";
import { errorMessage } from "@/lib/errors";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const snapshot = getLatestSnapshot(id);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ snapshot });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (session.role !== "marketing") return NextResponse.json({ error: "Marketing role required" }, { status: 403 });
  try {
    deleteNba(id, session);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) || "Failed" }, { status: 400 });
  }
}

