import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { RoleSwitcher } from "@/components/role-switcher";
import { setActiveUser } from "@/lib/actions/session";

export async function CricketHeader() {
  const currentUser = await getCurrentUser();
  const users = (await prisma.user.findMany({ orderBy: { role: "asc" } })).map(
    (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }),
  );

  return (
    <header className="bg-black text-white">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="text-xl font-semibold tracking-tight">
            cricket <span className="font-light">wireless</span>
          </div>
          <span className="rounded-full bg-[var(--nba-green)] px-2 py-0.5 text-[11px] font-semibold text-black">
            {currentUser.role}
          </span>
        </div>

        <nav className="ml-8 hidden items-center gap-5 text-sm text-white/90 md:flex">
          <Link className="hover:text-white" href="/nba">
            Next Best Action
          </Link>
          <Link className="hover:text-white" href="/legal">
            Legal Review
          </Link>
          <Link className="hover:text-white" href="/analytics">
            Analytics
          </Link>
          <Link className="hover:text-white" href="/admin">
            Admin
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-xs text-white/70 sm:block">
            Welcome, <span className="text-white">{currentUser.name}</span>
          </div>
          <RoleSwitcher users={users} activeUserEmail={currentUser.email} action={setActiveUser} />
        </div>
      </div>
    </header>
  );
}

