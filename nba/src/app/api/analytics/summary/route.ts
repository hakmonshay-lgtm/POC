import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nbaId = searchParams.get("nbaId") ?? "";
  if (!nbaId) return NextResponse.json({ error: "nbaId required" }, { status: 400 });

  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        COUNT(1) as reach,
        SUM(CASE WHEN status='Issued' THEN 1 ELSE 0 END) as issued,
        SUM(CASE WHEN status='Redeemed' THEN 1 ELSE 0 END) as redeemed
      FROM offer_assignment
      WHERE nba_id=?
    `,
    )
    .get(nbaId) as { reach: number; issued: number; redeemed: number };

  const byChannel = db
    .prepare(
      `
      SELECT channel, COUNT(1) as reach,
             SUM(CASE WHEN status='Redeemed' THEN 1 ELSE 0 END) as redeemed
      FROM offer_assignment
      WHERE nba_id=?
      GROUP BY channel
      ORDER BY reach DESC
    `,
    )
    .all(nbaId) as Array<{ channel: string | null; reach: number; redeemed: number }>;

  const reach = rows.reach ?? 0;
  const redeemed = rows.redeemed ?? 0;
  const conversion = reach > 0 ? redeemed / reach : 0;

  return NextResponse.json({
    nbaId,
    metrics: {
      reach,
      redeemed,
      conversion,
      uplift: 0.12, // placeholder for MVP
      revenue: redeemed * 12.5, // placeholder
    },
    byChannel: byChannel.map((r) => ({
      channel: r.channel ?? "Unknown",
      reach: r.reach,
      redeemed: r.redeemed,
      conversion: r.reach > 0 ? r.redeemed / r.reach : 0,
    })),
  });
}

