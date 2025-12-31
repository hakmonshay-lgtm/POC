import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { cloneNba, createDraftNba } from "@/app/nba/actions";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-50",
    SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100",
    IN_LEGAL_REVIEW: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
    APPROVED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
    SCHEDULED: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100",
    PUBLISHED: "bg-[color:var(--nba-green)] text-black",
    TERMINATED: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
    COMPLETED: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
    ARCHIVED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    CANCELLED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };
  const cls = map[status] ?? "bg-slate-200 text-slate-900";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default async function NbaListPage() {
  const user = await getCurrentUser();
  const nbas = await prisma.nba.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      owner: true,
      versions: { orderBy: { version: "desc" }, take: 1, include: { templates: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-[var(--nba-muted)]">
            <Link className="text-blue-600 hover:underline dark:text-blue-300" href="/">
              Back to Landing Page
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Next Best Action</h1>
          <p className="mt-1 text-sm text-[var(--nba-muted)]">
            Manage NBA drafts, approvals, schedules, and publishing. Active user:{" "}
            <span className="font-medium text-[var(--nba-fg)]">{user.email}</span>
          </p>
        </div>

        <form action={createDraftNba}>
          <button
            type="submit"
            className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 dark:bg-[var(--nba-card)] dark:text-slate-50 dark:hover:bg-slate-800"
          >
            Create New NBA
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-[var(--nba-border)] bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
            <span className="text-slate-400">⌕</span>
            <input
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
              placeholder="Search NBA (demo only)"
              disabled
            />
          </div>
          <div className="text-xs text-[var(--nba-muted)]">Sort by: Recently updated</div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {nbas.map((nba) => {
            const latest = nba.versions[0];
            const gd = (latest?.generalDetails ?? {}) as Record<string, unknown>;
            const effective = (gd.effectiveDate ?? nba.startAt?.toISOString().slice(0, 10) ?? "—") as string;
            const action = (latest?.action ?? {}) as unknown as { type?: string | null };
            const type = action.type ?? "—";
            return (
              <div
                key={nba.id}
                className="rounded-2xl border border-[var(--nba-border)] bg-white p-4 shadow-sm dark:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <StatusPill status={nba.status} />
                  <div className="flex items-center gap-3">
                    <form action={cloneNba}>
                      <input type="hidden" name="nbaId" value={nba.id} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-slate-600 hover:underline dark:text-slate-200"
                      >
                        Clone
                      </button>
                    </form>
                    <Link
                      className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-300"
                      href={`/nba/${nba.id}/edit?version=${latest?.version ?? 1}&step=general`}
                    >
                      Open
                    </Link>
                  </div>
                </div>

                <div className="mt-3 text-lg font-semibold">{nba.name}</div>
                <div className="mt-1 text-xs text-[var(--nba-muted)]">
                  Created by {nba.owner.name} • Version {nba.currentVersion}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-[var(--nba-border)] bg-[var(--nba-card)] px-3 py-2">
                    <div className="text-[var(--nba-muted)]">Effective Date</div>
                    <div className="mt-1 font-semibold">{effective}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--nba-border)] bg-[var(--nba-card)] px-3 py-2">
                    <div className="text-[var(--nba-muted)]">Type</div>
                    <div className="mt-1 font-semibold">{String(type).replaceAll("_", " ")}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

