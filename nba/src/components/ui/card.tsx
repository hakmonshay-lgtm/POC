import * as React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-zinc-200 bg-white">{children}</div>;
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-zinc-200 px-5 py-4">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-zinc-600">{subtitle}</div> : null}
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4">{children}</div>;
}

