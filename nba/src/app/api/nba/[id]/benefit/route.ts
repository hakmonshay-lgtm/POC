import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { upsertBenefit } from "@/lib/nbaRepo";
import { errorMessage } from "@/lib/errors";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  const body = await req.json().catch(() => null);
  try {
    const result = upsertBenefit(id, body, session);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) || "Failed to save benefit" }, { status: 400 });
  }
}

