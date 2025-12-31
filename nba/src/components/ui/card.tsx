import * as React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-zinc-200/80 bg-white shadow-sm">{children}</div>;
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-zinc-200/80 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-5 w-1.5 rounded-full bg-[var(--cw-green)]" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--cw-ink)]">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-[var(--cw-muted)]">{subtitle}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4">{children}</div>;
}

