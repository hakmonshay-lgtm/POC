import { NextResponse } from "next/server";
import { getLatestSnapshot } from "@/lib/nbaRepo";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const snapshot = getLatestSnapshot(id);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ snapshot });
}

