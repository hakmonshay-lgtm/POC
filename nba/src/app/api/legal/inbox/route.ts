import { NextResponse } from "next/server";
import { listLegalInbox } from "@/lib/nbaRepo";

export async function GET() {
  return NextResponse.json({ items: listLegalInbox() });
}

