import { NextResponse } from "next/server";
import { createNba, listNbas } from "@/lib/nbaRepo";
import { getSession } from "@/lib/session";
import { errorMessage } from "@/lib/errors";

export async function GET() {
  return NextResponse.json({ items: listNbas() });
}

export async function POST(req: Request) {
  const session = await getSession();
  const body = await req.json().catch(() => null);
  try {
    const nba = createNba(body, session);
    return NextResponse.json({ nba });
  } catch (e: unknown) {
    const msg = errorMessage(e) || "Failed to create NBA";
    const isUnique = msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate");
    return NextResponse.json({ error: msg, field: isUnique ? "name" : undefined }, { status: 400 });
  }
}

