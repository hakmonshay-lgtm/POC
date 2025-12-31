import * as React from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: Props) {
  return (
    <textarea
      className={`w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-[var(--cw-ink)] outline-none placeholder:text-zinc-400 focus:border-[var(--cw-green)] focus:ring-4 focus:ring-[rgba(43,179,74,0.18)] ${className}`}
      {...props}
    />
  );
}

