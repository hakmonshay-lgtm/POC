"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

export function GeneralDetailsForm({
  nbaId,
  version,
  nextStep,
  initial,
  action,
}: {
  nbaId: string;
  version: number;
  nextStep: string;
  initial: { nbaName: string; description: string; startDate: string; endDate: string };
  action: (
    prevState: { error?: string } | undefined,
    formData: FormData,
  ) => Promise<{ error?: string; redirectTo?: string }>;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.redirectTo) router.push(state.redirectTo);
  }, [router, state?.redirectTo]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="nbaId" value={nbaId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="nextStep" value={nextStep} />

      {state?.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-100">
          {state.error}
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="text-sm font-semibold">NBA Name</label>
        <input
          name="nbaName"
          defaultValue={initial.nbaName}
          className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold">Description</label>
        <textarea
          name="description"
          defaultValue={initial.description}
          className="min-h-24 w-full rounded-2xl border border-[var(--nba-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-semibold">Start Date</label>
          <input
            type="date"
            name="startDate"
            defaultValue={initial.startDate}
            className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold">End Date</label>
          <input
            type="date"
            name="endDate"
            defaultValue={initial.endDate}
            className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link className="text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300" href="/nba">
          Cancel
        </Link>
        <button
          type="submit"
          className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          Save Draft
        </button>
        <button type="submit" className="h-10 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          Continue
        </button>
      </div>
    </form>
  );
}

