"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-6 shadow-sm">
        <div className="text-sm font-semibold text-rose-600">Couldn’t save your changes</div>
        <div className="mt-2 text-sm text-[var(--nba-muted)]">{error.message}</div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => reset()}
            className="h-10 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <Link className="text-sm font-semibold text-blue-600 hover:underline" href="/nba">
            Back to list
          </Link>
        </div>
      </div>
    </div>
  );
}

