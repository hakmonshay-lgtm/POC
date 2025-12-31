import { NextResponse } from "next/server";
import { diffNbaVersions } from "@/lib/nbaRepo";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const from = Number(searchParams.get("from") ?? "");
  const to = Number(searchParams.get("to") ?? "");
  if (!Number.isFinite(from) || !Number.isFinite(to)) return NextResponse.json({ error: "from/to required" }, { status: 400 });
  const patch = diffNbaVersions(id, from, to);
  if (!patch) return NextResponse.json({ error: "Snapshots not found for versions" }, { status: 404 });
  return NextResponse.json({ patch });
}

