import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: Props) {
  return (
    <input
      className={`h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-[var(--cw-ink)] outline-none placeholder:text-zinc-400 focus:border-[var(--cw-green)] focus:ring-4 focus:ring-[rgba(43,179,74,0.18)] ${className}`}
      {...props}
    />
  );
}

