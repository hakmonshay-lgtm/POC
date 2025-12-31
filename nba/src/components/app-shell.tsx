import type { ReactNode } from "react";
import { CricketHeader } from "@/components/cricket-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--nba-bg)] text-[var(--nba-fg)]">
      <CricketHeader />
      <div className="mx-auto w-full max-w-[1200px] px-6 py-6">{children}</div>
    </div>
  );
}

