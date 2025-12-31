import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { evalAudienceRules, type CustomerRow } from "@/lib/audience";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId") ?? "";
  if (!customerId) return NextResponse.json({ error: "customerId required" }, { status: 400 });

  const db = getDb();
  const customer = db.prepare("SELECT * FROM customer WHERE id=?").get(customerId) as CustomerRow | undefined;
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const candidates = db
    .prepare(
      `
      SELECT id, name, status, priority, arbitration_weight, current_version, updated_at
      FROM nba
      WHERE status IN ('Published', 'Scheduled')
    `,
    )
    .all() as Array<{
    id: string;
    name: string;
    status: string;
    priority: number;
    arbitration_weight: number;
    current_version: number;
    updated_at: string;
  }>;

  const scored: Array<{ nbaId: string; name: string; score: number; factors: Record<string, unknown> }> = [];
  for (const nba of candidates) {
    const audienceRow = db.prepare("SELECT rules_json FROM audience WHERE nba_id=? AND version=?").get(nba.id, nba.current_version) as
      | { rules_json: string }
      | undefined;
    if (!audienceRow) continue;
    const rules = JSON.parse(audienceRow.rules_json);
    if (!evalAudienceRules(customer, rules)) continue;

    // Basic scoring: higher priority (1) wins; arbitration_weight scales. Add a tiny deterministic jitter for tie-breaking.
    const base = (11 - Math.max(1, Math.min(10, nba.priority))) * 10;
    const jitter = (nba.id.charCodeAt(0) % 7) / 100;
    const score = base * nba.arbitration_weight + jitter;
    scored.push({
      nbaId: nba.id,
      name: nba.name,
      score,
      factors: {
        base,
        priority: nba.priority,
        arbitrationWeight: nba.arbitration_weight,
        tieBreaker: "jitter(id)",
        reasonCodes: ["AUDIENCE_MATCH", "PRIORITY_WEIGHTED"],
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0] ?? null;
  return NextResponse.json({
    customerId,
    top,
    considered: scored.length,
    explanation: top
      ? {
          why: "Top eligible NBA by priority-weighted score.",
          factors: top.factors,
          counterfactual: "If priority or weight changes, a different NBA may win; see factors.reasonCodes.",
        }
      : { why: "No eligible NBA found (no audience match or no published NBAs)." },
  });
}

