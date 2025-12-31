import * as React from "react";

export function Badge({
  children,
  color = "zinc",
}: {
  children: React.ReactNode;
  color?: "zinc" | "green" | "yellow" | "red" | "blue";
}) {
  const map: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-800",
    green: "bg-[rgba(43,179,74,0.14)] text-[var(--cw-green-dark)]",
    yellow: "bg-[rgba(247,148,29,0.16)] text-[color:rgba(160,98,12,1)]",
    red: "bg-red-100 text-red-800",
    blue: "bg-sky-100 text-sky-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${map[color]}`}>
      {children}
    </span>
  );
}

