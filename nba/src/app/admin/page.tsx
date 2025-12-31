import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function AdminPage() {
  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs text-[var(--nba-muted)]">
          <Link className="text-blue-600 hover:underline dark:text-blue-300" href="/nba">
            ← Back to Next Best Action
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-[var(--nba-muted)]">RBAC / integrations placeholders.</p>
      </div>

      <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4 shadow-sm">
        <div className="text-sm font-semibold">Users</div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-[var(--nba-border)] bg-white p-4 text-sm shadow-sm dark:bg-slate-950"
            >
              <div className="font-semibold">{u.name}</div>
              <div className="mt-1 text-xs text-[var(--nba-muted)]">{u.email}</div>
              <div className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                {u.role}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

