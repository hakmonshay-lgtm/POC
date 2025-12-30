import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { upsertAudience } from "@/lib/nbaRepo";
import { RuleGroupSchema } from "@/lib/domain";
import { errorMessage } from "@/lib/errors";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  const body = await req.json().catch(() => null);
  try {
    const rules = RuleGroupSchema.parse(body?.rules);
    if (!rules.rules.length) throw new Error("At least one inclusion rule is required");
    const result = upsertAudience(id, rules, session);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) || "Failed to save audience" }, { status: 400 });
  }
}

