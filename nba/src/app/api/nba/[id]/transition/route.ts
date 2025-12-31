import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getNbaById, transitionNba } from "@/lib/nbaRepo";

const allowed: Record<string, string[]> = {
  Draft: ["Submitted", "Cancelled", "Archived"],
  Submitted: ["In Legal Review", "Cancelled"],
  "In Legal Review": ["Approved", "Rejected"],
  Rejected: ["Draft", "Archived", "Cancelled"],
  Approved: ["In Testing", "Scheduled", "Archived", "Cancelled"],
  "In Testing": ["Approved", "Scheduled", "Cancelled"],
  Scheduled: ["Publishing", "Cancelled", "Archived"],
  Publishing: ["Published", "Cancelled"],
  Published: ["Terminated", "Completed", "Expired"],
  Expired: ["Archived", "Completed"],
  Terminated: ["Completed", "Archived"],
  Completed: ["Archived"],
  Archived: [],
  Cancelled: ["Archived"],
};

function isAllowed(from: string, to: string) {
  return (allowed[from] ?? []).includes(to);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  const body = (await req.json().catch(() => null)) as { nextStatus?: string } | null;
  const nextStatus = (body?.nextStatus && String(body.nextStatus)) || "";

  const nba = getNbaById(id);
  if (!nba) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!nextStatus) return NextResponse.json({ error: "nextStatus required" }, { status: 400 });
  if (!isAllowed(nba.status, nextStatus)) {
    return NextResponse.json({ error: `Transition not allowed: ${nba.status} -> ${nextStatus}` }, { status: 400 });
  }

  // Legal approval gate before activation.
  if (["Scheduled", "Publishing", "Published"].includes(nextStatus)) {
    const db = getDb();
    const pending = db
      .prepare("SELECT COUNT(1) as c FROM comm_template WHERE nba_id=? AND version=? AND legal_status != 'Approved'")
      .get(id, nba.current_version) as { c: number };
    if (pending.c > 0) {
      return NextResponse.json({ error: "Legal approval required for all customer-facing templates before activation." }, { status: 400 });
    }
  }

  transitionNba(id, nextStatus, session);
  return NextResponse.json({ ok: true });
}

