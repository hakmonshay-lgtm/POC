import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function AnalyticsPage() {
  const totalIssued = await prisma.event.count({ where: { type: "OFFER_ISSUED" } });
  const delivered = await prisma.event.count({ where: { type: "SMS_DELIVERED" } });
  const clicked = await prisma.event.count({ where: { type: "SMS_CLICKED" } });
  const converted = await prisma.event.count({ where: { type: "PAYMENT_PROFILE_UPDATED" } });

  const ctr = delivered === 0 ? 0 : clicked / delivered;
  const conv = delivered === 0 ? 0 : converted / delivered;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs text-[var(--nba-muted)]">
          <Link className="text-blue-600 hover:underline dark:text-blue-300" href="/nba">
            ← Back to Next Best Action
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--nba-muted)]">
          Funnel metrics preview (seeded demo events).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Reach / Issued", value: totalIssued },
          { label: "Delivered", value: delivered },
          { label: "CTR", value: `${(ctr * 100).toFixed(1)}%` },
          { label: "Conversion", value: `${(conv * 100).toFixed(1)}%` },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4 shadow-sm"
          >
            <div className="text-xs text-[var(--nba-muted)]">{m.label}</div>
            <div className="mt-2 text-2xl font-semibold">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-6 text-sm text-[var(--nba-muted)] shadow-sm">
        Charts, channel comparisons, and A/B/n significance are stubbed in this MVP and will be
        driven by real event ingestion in the full implementation.
      </div>
    </div>
  );
}

