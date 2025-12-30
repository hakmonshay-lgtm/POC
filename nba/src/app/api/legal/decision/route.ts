import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { legalDecision } from "@/lib/nbaRepo";
import { errorMessage } from "@/lib/errors";

export async function POST(req: Request) {
  const session = await getSession();
  const body = (await req.json().catch(() => null)) as { templateId?: string; decision?: string; comments?: string } | null;
  if (session.role !== "legal") return NextResponse.json({ error: "Legal role required" }, { status: 403 });
  const templateId = (body?.templateId && String(body.templateId)) || "";
  const decision = (body?.decision && String(body.decision)) as "Approved" | "Rejected";
  const comments = (body?.comments && String(body.comments)) || "";
  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });
  if (decision !== "Approved" && decision !== "Rejected") return NextResponse.json({ error: "decision must be Approved or Rejected" }, { status: 400 });

  try {
    legalDecision(templateId, decision, comments, session);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) || "Failed" }, { status: 400 });
  }
}

