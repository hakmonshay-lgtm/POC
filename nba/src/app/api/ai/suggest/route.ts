import { NextResponse } from "next/server";
import { aiSuggest } from "@/lib/ai";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { prompt?: string; screen?: string; context?: Record<string, unknown> } | null;
  const screen = (body?.screen && String(body.screen)) || "general";
  const prompt = (body?.prompt && String(body.prompt)) || "";
  const context = body?.context ?? {};

  const out = aiSuggest({ prompt, screen, context });
  return NextResponse.json(out);
}

