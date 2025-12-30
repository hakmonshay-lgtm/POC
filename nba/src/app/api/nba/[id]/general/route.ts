import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateGeneral } from "@/lib/nbaRepo";
import { errorMessage } from "@/lib/errors";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  const body = await req.json().catch(() => null);
  try {
    const result = updateGeneral(id, body, session);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = errorMessage(e) || "Failed to update";
    const isUnique = msg.toLowerCase().includes("unique");
    return NextResponse.json({ error: msg, field: isUnique ? "name" : undefined }, { status: 400 });
  }
}

