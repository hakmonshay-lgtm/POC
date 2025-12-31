import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
};

const base =
  "inline-flex items-center justify-center rounded-md font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(43,179,74,0.25)]";

const variants: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-[var(--cw-green)] text-white hover:bg-[var(--cw-green-dark)]",
  secondary: "border border-[var(--cw-green)] bg-white text-[var(--cw-green-dark)] hover:bg-[rgba(43,179,74,0.08)]",
  danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-4 focus-visible:ring-[rgba(220,38,38,0.25)]",
  ghost: "bg-transparent text-[var(--cw-ink)] hover:bg-zinc-100",
};

const sizes: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: Props) {
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}

