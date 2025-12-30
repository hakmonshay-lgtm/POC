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
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[color]}`}>{children}</span>;
}

