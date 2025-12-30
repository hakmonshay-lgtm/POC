import { NextResponse } from "next/server";
import { listAuditForEntity } from "@/lib/nbaRepo";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const items = listAuditForEntity("NBA", id);
  return NextResponse.json({ items });
}

