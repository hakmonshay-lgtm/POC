import * as React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", ...props }: Props) {
  return (
    <select
      className={`h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-[var(--cw-ink)] outline-none focus:border-[var(--cw-green)] focus:ring-4 focus:ring-[rgba(43,179,74,0.18)] ${className}`}
      {...props}
    />
  );
}

