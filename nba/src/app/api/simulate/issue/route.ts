import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb, dbNowIso } from "@/lib/db";
import { evalAudienceRules, type CustomerRow } from "@/lib/audience";
import { getNbaById } from "@/lib/nbaRepo";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { nbaId?: string; count?: number; channel?: string } | null;
  const nbaId = (body?.nbaId && String(body.nbaId)) || "";
  const count = Math.max(1, Math.min(500, Number(body?.count ?? 50)));
  const channel = (body?.channel && String(body.channel)) || "SMS";
  if (!nbaId) return NextResponse.json({ error: "nbaId required" }, { status: 400 });

  const nba = getNbaById(nbaId);
  if (!nba) return NextResponse.json({ error: "NBA not found" }, { status: 404 });

  const db = getDb();
  const aud = db.prepare("SELECT rules_json FROM audience WHERE nba_id=? AND version=?").get(nbaId, nba.current_version) as { rules_json: string } | undefined;
  if (!aud) return NextResponse.json({ error: "Audience not configured" }, { status: 400 });
  const rules = JSON.parse(aud.rules_json);

  const customers = db.prepare("SELECT * FROM customer").all() as CustomerRow[];
  const eligible = customers.filter((c) => evalAudienceRules(c, rules));

  const now = dbNowIso();
  const insert = db.prepare(
    "INSERT INTO offer_assignment (id, customer_id, nba_id, nba_version, status, issued_at, redeemed_at, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const tx = db.transaction(() => {
    let issued = 0;
    for (const c of eligible) {
      if (issued >= count) break;
      insert.run(nanoid(), c.id, nbaId, nba.current_version, "Issued", now, null, channel);
      issued++;
    }
    return issued;
  });

  const issued = tx();
  return NextResponse.json({ ok: true, issued, version: nba.current_version });
}

