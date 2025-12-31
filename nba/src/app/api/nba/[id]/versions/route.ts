import { NextResponse } from "next/server";
import { listNbaVersions } from "@/lib/nbaRepo";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const items = listNbaVersions(id);
  return NextResponse.json({ items });
}

