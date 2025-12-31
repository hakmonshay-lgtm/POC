import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function LegalQueuePage() {
  const inReview = await prisma.nbaVersion.findMany({
    where: { legalStatus: "IN_REVIEW" },
    orderBy: { updatedAt: "desc" },
    include: { nba: true, templates: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs text-[var(--nba-muted)]">
          <Link className="text-blue-600 hover:underline dark:text-blue-300" href="/nba">
            ← Back to Next Best Action
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Legal Review</h1>
        <p className="mt-1 text-sm text-[var(--nba-muted)]">
          Queue of customer-facing templates awaiting approval (MVP view).
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4 shadow-sm">
        {inReview.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--nba-muted)]">No items in legal review.</div>
        ) : (
          <div className="space-y-3">
            {inReview.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-2 rounded-2xl border border-[var(--nba-border)] bg-white p-4 shadow-sm dark:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">
                    {v.nba.name} <span className="text-[var(--nba-muted)]">• v{v.version}</span>
                  </div>
                  <Link
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-300"
                    href={`/nba/${v.nbaId}/edit?version=${v.version}&step=comms`}
                  >
                    Review
                  </Link>
                </div>
                <div className="text-xs text-[var(--nba-muted)]">
                  Templates: {v.templates.map((t) => t.channel).join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

