import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  saveAction,
  saveAudience,
  saveBenefit,
  saveComms,
  saveGeneralDetailsClient,
  legalApprove,
  legalReject,
  scheduleNba,
  publishNba,
  terminateNba,
  archiveNba,
  submitForLegalReview,
} from "@/app/nba/[id]/edit/actions";
import { GeneralDetailsForm } from "@/components/forms/general-details-form";
import { AiAssistant } from "@/components/ai-assistant";
import { runAiAssistant } from "@/lib/actions/ai";

type StepId = "general" | "audience" | "action" | "benefit" | "comms" | "summary";

type AudienceRule = { field: string; operator?: string; value?: unknown };
type GeneralDetails = {
  nbaName?: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  effectiveDate?: string | null;
};
type AudiencePayload = {
  include?: AudienceRule[];
  exclude?: AudienceRule[];
  estimate?: number | null;
};
type ActionPayload = {
  type?: string | null;
  saleChannels?: string[];
  priority?: number | null;
  maxOffers?: number | null;
};
type BenefitPayload = { type?: string | null; value?: number | null; cap?: number | null };

const steps: Array<{ id: StepId; label: string }> = [
  { id: "general", label: "General Details" },
  { id: "audience", label: "Audience" },
  { id: "action", label: "Customer Interaction" },
  { id: "benefit", label: "Offers" },
  { id: "comms", label: "Communication" },
  { id: "summary", label: "Summary" },
];

function Stepper({ nbaId, version, current }: { nbaId: string; version: number; current: StepId }) {
  return (
    <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, idx) => {
          const active = s.id === current;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <Link
                href={`/nba/${nbaId}/edit?version=${version}&step=${s.id}`}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  active
                    ? "bg-[var(--nba-green)] text-black"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    active ? "bg-black/15 text-black" : "bg-black/10 text-slate-900 dark:bg-white/10 dark:text-white"
                  }`}
                >
                  {idx + 1}
                </span>
                {s.label}
              </Link>
              {idx < steps.length - 1 && <span className="text-slate-300">—</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function NbaEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const version = Number((sp.version as string) ?? "1");
  const step = ((sp.step as string) ?? "general") as StepId;
  const currentStep = steps.some((s) => s.id === step) ? step : ("general" as StepId);

  const user = await getCurrentUser();
  const nba = await prisma.nba.findUnique({
    where: { id },
    include: {
      owner: true,
      versions: {
        where: { version },
        include: { templates: true, approvals: { include: { reviewer: true } } },
      },
    },
  });

  if (!nba) return notFound();
  const v = nba.versions[0];
  if (!v) return notFound();

  const gd = (v.generalDetails ?? {}) as unknown as GeneralDetails;
  const aud = (v.audience ?? {}) as unknown as AudiencePayload;
  const act = (v.action ?? {}) as unknown as ActionPayload;
  const ben = (v.benefit ?? {}) as unknown as BenefitPayload;

  const legalUsers = await prisma.user.findMany({ where: { role: "LEGAL" }, orderBy: { name: "asc" } });

  const selectedChannels = new Set<string>(v.templates.map((t) => t.channel));
  const sms = v.templates.find((t) => t.channel === "SMS");
  const email = v.templates.find((t) => t.channel === "EMAIL");
  const memo = v.templates.find((t) => t.channel === "MEMO");

  const stepIndex = steps.findIndex((s) => s.id === currentStep);
  const nextStep = steps[Math.min(stepIndex + 1, steps.length - 1)]?.id ?? "summary";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-[var(--nba-muted)]">
            <Link className="text-blue-600 hover:underline dark:text-blue-300" href="/nba">
              ← Back to Next Best Action
            </Link>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Next Best Action</h1>
          <div className="mt-1 text-sm text-[var(--nba-muted)]">
            <span className="font-semibold text-[var(--nba-fg)]">{nba.name}</span> • v{v.version} •{" "}
            <span className="font-semibold text-[var(--nba-fg)]">{nba.status.replaceAll("_", " ")}</span>
          </div>
        </div>

        <div className="text-xs text-[var(--nba-muted)]">
          Active user: <span className="font-semibold text-[var(--nba-fg)]">{user.role}</span>
        </div>
      </div>

      <Stepper nbaId={nba.id} version={v.version} current={currentStep} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4 shadow-sm">
          {currentStep === "general" && (
            <GeneralDetailsForm
              nbaId={nba.id}
              version={v.version}
              nextStep={nextStep}
              initial={{
                nbaName: gd.nbaName ?? nba.name,
                description: gd.description ?? nba.description ?? "",
                startDate: gd.startDate ? String(gd.startDate).slice(0, 10) : "",
                endDate: gd.endDate ? String(gd.endDate).slice(0, 10) : "",
              }}
              action={saveGeneralDetailsClient}
            />
          )}

          {currentStep === "audience" && (
            <form action={saveAudience} className="space-y-4">
              <input type="hidden" name="nbaId" value={nba.id} />
              <input type="hidden" name="version" value={v.version} />
              <input type="hidden" name="nextStep" value={nextStep} />

              <div className="rounded-2xl border border-[var(--nba-border)] bg-white p-4 dark:bg-slate-950">
                <div className="text-sm font-semibold">Customer</div>
                <div className="mt-3 space-y-4">
                  <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Auto-bill pay</div>
                      <div className="text-xs text-[var(--nba-muted)]">Enrolled for Auto-bill Pay</div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { v: "any", l: "Any" },
                        { v: "yes", l: "Yes" },
                        { v: "no", l: "No" },
                      ].map((o) => (
                        <label
                          key={o.v}
                          className="flex cursor-pointer items-center justify-center rounded-full border border-[var(--nba-border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                        >
                          <input
                            type="radio"
                            name="abpEnrolled"
                            value={o.v}
                            defaultChecked={(aud.include ?? []).some((r) => r.field === "abpEnrolled")
                              ? (aud.include ?? []).some(
                                  (r) => r.field === "abpEnrolled" && Boolean(r.value) === (o.v === "yes"),
                                )
                              : o.v === "any"}
                            className="sr-only"
                          />
                          {o.l}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                    <div className="text-sm font-semibold">Credit Card Expiry</div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="text-xs text-[var(--nba-muted)]">Number of Days</div>
                      <select
                        name="ccExpiryDays"
                        defaultValue={Number(
                          (aud.include ?? []).find((r) => r.field === "creditCardExpAt")?.value ?? 45,
                        )}
                        className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-3 text-sm outline-none dark:bg-slate-950"
                      >
                        {[15, 30, 45, 60, 90].map((d) => (
                          <option key={d} value={d}>
                            {d} Days
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="suppressHighRisk"
                      defaultChecked={(aud.exclude ?? []).some((r) => r.value === "HIGH_COMPLAINT_RISK")}
                      className="h-4 w-4 accent-[var(--nba-green)]"
                    />
                    Suppress high complaint risk customers
                  </label>

                  <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] px-4 py-3 text-sm">
                    <div className="text-xs text-[var(--nba-muted)]">Estimated Audience Size</div>
                    <div className="mt-1 text-lg font-semibold">{aud.estimate ?? "—"}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Link
                  className="text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300"
                  href={`/nba/${nba.id}/edit?version=${v.version}&step=general`}
                >
                  Previous
                </Link>
                <button
                  type="submit"
                  className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {currentStep === "action" && (
            <form action={saveAction} className="space-y-4">
              <input type="hidden" name="nbaId" value={nba.id} />
              <input type="hidden" name="version" value={v.version} />
              <input type="hidden" name="nextStep" value={nextStep} />

              <div className="rounded-2xl border border-[var(--nba-border)] bg-white p-4 dark:bg-slate-950">
                <div className="text-sm font-semibold">Customer Interaction</div>

                <div className="mt-4 space-y-5">
                  <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                    <div className="text-sm font-semibold">Sales Channel</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { v: "CARE", l: "CARE" },
                        { v: "RETAIL", l: "Retail" },
                        { v: "SELF_SERVICE", l: "Self-Service" },
                      ].map((c) => (
                        <label
                          key={c.v}
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--nba-border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                        >
                          <input
                            type="checkbox"
                            name="saleChannels"
                            value={c.v}
                            defaultChecked={Array.isArray(act.saleChannels) ? act.saleChannels.includes(c.v) : false}
                            className="accent-[var(--nba-green)]"
                          />
                          {c.l}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--nba-muted)]">Select Actions</label>
                        <select
                          name="actionType"
                          defaultValue={act.type ?? "UPDATE_PAYMENT_PROFILE"}
                          className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-3 text-sm outline-none dark:bg-slate-950"
                        >
                          <option value="UPDATE_PAYMENT_PROFILE">Update Payment Profile</option>
                          <option value="ENROLL_ABP">Enroll for Auto-bill Pay</option>
                          <option value="COMPLETE_PROFILE">Complete Profile</option>
                          <option value="PURCHASE_SKU">Purchase SKU</option>
                          <option value="CHANGE_PLAN">Change Plan</option>
                          <option value="REFERRAL">Referral</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--nba-muted)]">Set Priority</label>
                        <select
                          name="priority"
                          defaultValue={Number(act.priority ?? 3)}
                          className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-3 text-sm outline-none dark:bg-slate-950"
                        >
                          {[1, 2, 3, 4, 5].map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--nba-muted)]">How many times to offer</label>
                        <select
                          name="maxOffers"
                          defaultValue={Number(act.maxOffers ?? 1)}
                          className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-3 text-sm outline-none dark:bg-slate-950"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} Times
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Link
                  className="text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300"
                  href={`/nba/${nba.id}/edit?version=${v.version}&step=audience`}
                >
                  Previous
                </Link>
                <button
                  type="submit"
                  className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {currentStep === "benefit" && (
            <form action={saveBenefit} className="space-y-4">
              <input type="hidden" name="nbaId" value={nba.id} />
              <input type="hidden" name="version" value={v.version} />
              <input type="hidden" name="nextStep" value={nextStep} />

              <div className="rounded-2xl border border-[var(--nba-border)] bg-white p-4 dark:bg-slate-950">
                <div className="text-sm font-semibold">Offers</div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-sm font-semibold">Benefit Type</label>
                    <select
                      name="benefitType"
                      defaultValue={ben.type ?? "NONE"}
                      className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-3 text-sm outline-none dark:bg-slate-950"
                    >
                      <option value="NONE">No Offer Added</option>
                      <option value="ORDER_DISCOUNT_DEVICE">Order Discount (Device)</option>
                      <option value="ORDER_DISCOUNT_SERVICE">Order Discount (Service)</option>
                      <option value="FEE_WAIVER">Fee Waiver</option>
                      <option value="ONE_TIME_ACCOUNT_CREDIT">One-time Account Credit</option>
                      <option value="RECURRING_ACCOUNT_CREDIT">Recurring Account Credit</option>
                      <option value="FREE_ADD_ON">Free Add-on</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold">Value</label>
                    <input
                      name="benefitValue"
                      type="number"
                      step="0.01"
                      defaultValue={ben.value ?? ""}
                      className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
                      placeholder="e.g. 10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold">Cap (optional)</label>
                    <input
                      name="benefitCap"
                      type="number"
                      step="0.01"
                      defaultValue={ben.cap ?? ""}
                      className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
                      placeholder="e.g. 50000"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4 text-sm text-[var(--nba-muted)]">
                  This MVP supports basic benefit value + cap fields. Stackability rules, thresholds, and redemption logic
                  are represented in the data model and can be expanded in UI next.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Link
                  className="text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300"
                  href={`/nba/${nba.id}/edit?version=${v.version}&step=action`}
                >
                  Previous
                </Link>
                <button
                  type="submit"
                  className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {currentStep === "comms" && (
            <form action={saveComms} className="space-y-4">
              <input type="hidden" name="nbaId" value={nba.id} />
              <input type="hidden" name="version" value={v.version} />
              <input type="hidden" name="nextStep" value={nextStep} />

              <div className="rounded-2xl border border-[var(--nba-border)] bg-white p-4 dark:bg-slate-950">
                <div className="text-sm font-semibold">Communication</div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                      <div className="text-sm font-semibold">Channels</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          { v: "SMS", l: "SMS" },
                          { v: "EMAIL", l: "Email" },
                          { v: "MEMO", l: "Memo" },
                        ].map((c) => (
                          <label
                            key={c.v}
                            className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--nba-border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                          >
                            <input
                              type="checkbox"
                              name="channels"
                              value={c.v}
                              defaultChecked={selectedChannels.size === 0 ? c.v === "SMS" : selectedChannels.has(c.v)}
                              className="accent-[var(--nba-green)]"
                            />
                            {c.l}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                      <div className="text-sm font-semibold">Templates</div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--nba-muted)]">SMS Text</label>
                        <textarea
                          name="smsBody"
                          defaultValue={sms?.body ?? ""}
                          className="min-h-24 w-full rounded-2xl border border-[var(--nba-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
                          placeholder="160-char TCPA compliant SMS…"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--nba-muted)]">Email Subject</label>
                        <input
                          name="emailSubject"
                          defaultValue={email?.subject ?? ""}
                          className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--nba-muted)]">Email Body</label>
                        <textarea
                          name="emailBody"
                          defaultValue={email?.body ?? ""}
                          className="min-h-28 w-full rounded-2xl border border-[var(--nba-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--nba-muted)]">Memo</label>
                        <textarea
                          name="memoBody"
                          defaultValue={memo?.body ?? ""}
                          className="min-h-20 w-full rounded-2xl border border-[var(--nba-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                      <div className="text-sm font-semibold">Legal</div>
                      <div className="mt-3 space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[var(--nba-muted)]">Assign reviewer</label>
                          <select
                            name="legalReviewerId"
                            defaultValue={v.approvals[0]?.reviewerId ?? ""}
                            className="h-11 w-full rounded-full border border-[var(--nba-border)] bg-white px-3 text-sm outline-none dark:bg-slate-950"
                          >
                            <option value="">Unassigned</option>
                            {legalUsers.map((lu) => (
                              <option key={lu.id} value={lu.id}>
                                {lu.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[var(--nba-muted)]">Notes</label>
                          <textarea
                            name="legalNotes"
                            defaultValue={v.legalNotes ?? ""}
                            className="min-h-20 w-full rounded-2xl border border-[var(--nba-border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
                          />
                        </div>

                        <div className="rounded-2xl border border-[var(--nba-border)] bg-white px-4 py-3 text-sm dark:bg-slate-950">
                          <div className="text-xs text-[var(--nba-muted)]">Legal status</div>
                          <div className="mt-1 font-semibold">{v.legalStatus.replaceAll("_", " ")}</div>
                        </div>

                        {user.role === "LEGAL" || user.role === "ADMIN" ? (
                          <div className="rounded-2xl border border-[var(--nba-border)] bg-white p-3 dark:bg-slate-950">
                            <div className="text-xs font-semibold text-[var(--nba-muted)]">Legal decision</div>
                            <div className="mt-2 space-y-2">
                              <textarea
                                name="comments"
                                placeholder="Comments (recommended)"
                                className="min-h-16 w-full rounded-2xl border border-[var(--nba-border)] bg-white px-3 py-2 text-xs outline-none focus:border-[var(--nba-green)] dark:bg-slate-950"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="submit"
                                  formAction={legalApprove}
                                  className="h-9 rounded-full bg-[var(--nba-green)] text-xs font-semibold text-black hover:brightness-95"
                                >
                                  Approve
                                </button>
                                <button
                                  type="submit"
                                  formAction={legalReject}
                                  className="h-9 rounded-full bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4 text-xs text-[var(--nba-muted)]">
                      All customer-facing templates require Legal approval before activation.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Link
                  className="text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300"
                  href={`/nba/${nba.id}/edit?version=${v.version}&step=benefit`}
                >
                  Previous
                </Link>
                <button
                  type="submit"
                  className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-4 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  className="h-10 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {currentStep === "summary" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--nba-border)] bg-white p-4 dark:bg-slate-950">
                <div className="text-sm font-semibold">{nba.name}</div>
                <div className="mt-1 text-xs text-[var(--nba-muted)]">
                  Action Duration: {gd.startDate ? String(gd.startDate).slice(0, 10) : "—"} /{" "}
                  {gd.endDate ? String(gd.endDate).slice(0, 10) : "—"}
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                    <div className="text-xs text-[var(--nba-muted)]">If Customer Action Matches</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-[var(--nba-border)] bg-white px-3 py-1 font-semibold dark:bg-slate-950">
                        Credit Card expiring in{" "}
                        {(() => {
                          const v = (aud.include ?? []).find((r) => r.field === "creditCardExpAt")?.value;
                          return typeof v === "number" || typeof v === "string" ? v : "—";
                        })()}{" "}
                        days
                      </span>
                      <span className="rounded-full border border-[var(--nba-border)] bg-white px-3 py-1 font-semibold dark:bg-slate-950">
                        Audience estimate: {aud.estimate ?? "—"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                    <div className="text-xs text-[var(--nba-muted)]">Then Do Actions</div>
                    <div className="mt-2 inline-flex rounded-full border border-[var(--nba-border)] bg-white px-3 py-1 text-xs font-semibold dark:bg-slate-950">
                      {String(act.type ?? "—").replaceAll("_", " ")} • Priority {act.priority ?? "—"} • {act.maxOffers ?? "—"} offers
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--nba-border)] bg-[var(--nba-card)] p-4">
                    <div className="text-xs text-[var(--nba-muted)]">How to Communicate?</div>
                    <div className="mt-2 space-y-3">
                      {v.templates.map((t) => (
                        <div key={t.id} className="rounded-2xl border border-[var(--nba-border)] bg-white p-3 dark:bg-slate-950">
                          <div className="text-xs font-semibold">{t.channel} • {t.name}</div>
                          <div className="mt-1 text-xs text-[var(--nba-muted)]">Legal: {t.legalStatus}</div>
                          <div className="mt-2 text-xs">{t.subject ? <div className="font-semibold">{t.subject}</div> : null}{t.body}</div>
                        </div>
                      ))}
                      {v.templates.length === 0 && (
                        <div className="text-sm text-[var(--nba-muted)]">No communication templates configured.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Link
                  className="text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300"
                  href={`/nba/${nba.id}/edit?version=${v.version}&step=comms`}
                >
                  Previous
                </Link>

                {v.legalStatus !== "APPROVED" ? (
                  <form action={submitForLegalReview}>
                    <input type="hidden" name="nbaId" value={nba.id} />
                    <input type="hidden" name="version" value={v.version} />
                    <button
                      type="submit"
                      className="h-10 rounded-full bg-[var(--nba-green)] px-5 text-sm font-semibold text-black shadow-sm hover:brightness-95"
                    >
                      Submit for Legal Review
                    </button>
                  </form>
                ) : null}

                {v.legalStatus === "APPROVED" && nba.status !== "PUBLISHED" && nba.status !== "ARCHIVED" ? (
                  <>
                    <form action={scheduleNba}>
                      <input type="hidden" name="nbaId" value={nba.id} />
                      <input type="hidden" name="version" value={v.version} />
                      <button
                        type="submit"
                        className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-5 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                      >
                        Schedule
                      </button>
                    </form>
                    <form action={publishNba}>
                      <input type="hidden" name="nbaId" value={nba.id} />
                      <input type="hidden" name="version" value={v.version} />
                      <button
                        type="submit"
                        className="h-10 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                      >
                        Publish
                      </button>
                    </form>
                  </>
                ) : null}

                {nba.status === "PUBLISHED" ? (
                  <>
                    <form action={terminateNba}>
                      <input type="hidden" name="nbaId" value={nba.id} />
                      <input type="hidden" name="version" value={v.version} />
                      <button
                        type="submit"
                        className="h-10 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
                      >
                        Terminate
                      </button>
                    </form>
                    <form action={archiveNba}>
                      <input type="hidden" name="nbaId" value={nba.id} />
                      <input type="hidden" name="version" value={v.version} />
                      <button
                        type="submit"
                        className="h-10 rounded-full border border-[var(--nba-border)] bg-white px-5 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                      >
                        Archive
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <AiAssistant nbaVersionId={v.id} screen={currentStep} run={runAiAssistant} />
      </div>
    </div>
  );
}

