import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type Rule = { field: string; operator: string; value: unknown };

type CustomerLite = {
  creditCardExpAt: Date | null;
  abpEnrolled: boolean;
  riskFlags: unknown;
  consentSms: boolean;
  consentEmail: boolean;
};

type AudienceLite = { include?: Rule[]; exclude?: Rule[] };

function isEligible(customer: CustomerLite, audience: AudienceLite) {
  const include: Rule[] = Array.isArray(audience?.include) ? audience.include : [];
  const exclude: Rule[] = Array.isArray(audience?.exclude) ? audience.exclude : [];

  const now = new Date();

  for (const r of include) {
    if (r.field === "creditCardExpAt" && r.operator === "withinDays") {
      const days = Number(r.value ?? 0);
      if (!customer.creditCardExpAt) return { ok: false, reasons: ["NO_CC_EXPIRY_DATE"] };
      const cut = new Date(now);
      cut.setDate(cut.getDate() + days);
      if (new Date(customer.creditCardExpAt).getTime() > cut.getTime()) {
        return { ok: false, reasons: ["CC_NOT_EXPIRING_SOON"] };
      }
    }
    if (r.field === "abpEnrolled" && r.operator === "equals") {
      if (Boolean(customer.abpEnrolled) !== Boolean(r.value)) return { ok: false, reasons: ["ABP_MISMATCH"] };
    }
  }

  for (const r of exclude) {
    if (r.field === "riskFlags" && r.operator === "contains") {
      const flags = Array.isArray(customer.riskFlags) ? customer.riskFlags : [];
      if (flags.includes(r.value)) return { ok: false, reasons: ["SUPPRESSED_RISK_FLAG"] };
    }
  }

  return { ok: true, reasons: ["AUDIENCE_MATCH"] };
}

type NbaLite = { id: string; name: string; status: string; arbitrationWeight: number; priority: number };
type VersionLite = { version: number; audience: unknown; action: unknown; benefit: unknown };

function scoreNba(nba: NbaLite, version: { action?: Record<string, unknown> }, customer: CustomerLite) {
  const reasons: string[] = [];
  let score = 0;

  // Base from arbitration weight
  score += (nba.arbitrationWeight ?? 50) / 100;
  reasons.push("ARBITRATION_WEIGHT");

  // Priority: lower number wins
  const p = Number(version?.action?.priority ?? nba.priority ?? 3);
  score += (6 - Math.max(1, Math.min(p, 5))) * 0.05;
  reasons.push("PRIORITY");

  // Expiry urgency signal (stub)
  if (customer.creditCardExpAt) {
    const days = Math.round((new Date(customer.creditCardExpAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 15) {
      score += 0.2;
      reasons.push("URGENT_EXPIRY");
    } else if (days <= 45) {
      score += 0.1;
      reasons.push("EXPIRY_SOON");
    }
  }

  // Consent signal (stub)
  if (customer.consentSms || customer.consentEmail) {
    score += 0.05;
    reasons.push("CONSENT_AVAILABLE");
  }

  // Fatigue (stub)
  score -= 0.03;
  reasons.push("FATIGUE_PENALTY_STUB");

  return { score, reasons };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const nbas = await prisma.nba.findMany({
    where: { status: "PUBLISHED" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  const candidates: Array<{
    nba: NbaLite;
    version: VersionLite;
    score: number;
    reasonCodes: string[];
  }> = [];

  for (const nba of nbas) {
    const version = nba.versions[0] as unknown as VersionLite | undefined;
    if (!version) continue;
    const aud = (version.audience ?? {}) as unknown as AudienceLite;
    const elig = isEligible(customer as unknown as CustomerLite, aud);
    if (!elig.ok) continue;

    const action = (version.action ?? {}) as Record<string, unknown>;
    const s = scoreNba(
      nba as unknown as NbaLite,
      { action },
      customer as unknown as CustomerLite,
    );
    candidates.push({
      nba: nba as unknown as NbaLite,
      version,
      score: s.score,
      reasonCodes: [...elig.reasons, ...s.reasons],
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];

  if (!top) {
    return NextResponse.json({ customerId, eligible: false, nba: null });
  }

  await prisma.arbitrationScore.create({
    data: {
      customerId,
      nbaId: top.nba.id,
      score: top.score,
      factors: {
        reasonCodes: top.reasonCodes,
        audience: top.version.audience as unknown as Prisma.InputJsonValue,
        action: top.version.action as unknown as Prisma.InputJsonValue,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    customerId,
    eligible: true,
    nba: {
      id: top.nba.id,
      name: top.nba.name,
      status: top.nba.status,
      version: top.version.version,
      action: top.version.action,
      benefit: top.version.benefit,
      score: top.score,
      reasonCodes: top.reasonCodes,
    },
  });
}

