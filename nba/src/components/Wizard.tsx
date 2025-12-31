"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { errorMessage } from "@/lib/errors";
import { NbaAssistant } from "@/components/NbaAssistant";

type Channel = "SMS" | "Email" | "Memo";

type Snapshot = {
  nba: {
    id: string;
    name: string;
    description?: string | null;
    start_date: string;
    end_date: string;
    status: string;
    priority: number;
    arbitration_weight: number;
    current_version: number;
  };
  version: number;
  audience?: { rules: unknown; sizeEstimate: number } | null;
  action?: {
    type: string;
    completionEvent: string;
    saleChannels: string[];
    offerPriority: number;
    maxOffersPerCustomer: number;
  } | null;
  benefit?: {
    type: string;
    valueNumber: number;
    valueUnit: string;
    capNumber: number;
    redemptionLogic: string;
    description: string;
    threshold?: Record<string, unknown>;
    stackability?: { allowed: boolean; exclusivityTags: string[] };
    exclusions?: { excludedOfferIds: string[] };
  } | null;
  comms?: Array<{ channel: Channel; subject?: string; body: string; legalStatus: string }> | null;
};

const steps = [
  { id: 1, title: "General" },
  { id: 2, title: "Audience" },
  { id: 3, title: "Action" },
  { id: 4, title: "Benefit" },
  { id: 5, title: "Communication & Legal" },
  { id: 6, title: "Summary" },
];

function isoForInput(iso?: string) {
  if (!iso) return "";
  // datetime-local expects no timezone; this is a simple MVP conversion.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputToIso(v: string) {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return d.toISOString();
}

export function Wizard({ initialNbaId }: { initialNbaId?: string }) {
  const [nbaId, setNbaId] = useState<string | undefined>(initialNbaId);
  const [step, setStep] = useState(1);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const generalDefaults = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getTime() + 3 * 86400000);
    const end = new Date(now.getTime() + 33 * 86400000);
    return {
      name: "",
      description: "",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      priority: 5,
      arbitrationWeight: 1,
    };
  }, []);

  const [general, setGeneral] = useState(generalDefaults);
  const [audienceJson, setAudienceJson] = useState(
    JSON.stringify(
      {
        kind: "group",
        op: "AND",
        rules: [{ kind: "condition", field: "consent_email", op: "=", value: true }],
      },
      null,
      2,
    ),
  );
  const [audienceEstimate, setAudienceEstimate] = useState<number | null>(null);

  const [action, setAction] = useState({
    type: "complete_profile",
    completionEvent: "profile.completed",
    saleChannels: ["SelfService"],
    offerPriority: 5,
    maxOffersPerCustomer: 1,
  });

  const [benefit, setBenefit] = useState({
    type: "order_discount",
    valueNumber: 10,
    valueUnit: "percent",
    capNumber: 50000,
    threshold: {} as Record<string, unknown>,
    stackability: { allowed: false, exclusivityTags: [] as string[] },
    exclusions: { excludedOfferIds: [] as string[] },
    redemptionLogic: "auto_apply",
    description: "10% off eligible purchase",
  });

  type CommsTemplate = { channel: Channel; subject: string; body: string };
  type CommsState = { channels: Channel[]; templates: CommsTemplate[]; legalReviewerId: string; legalNotes: string };

  const [comms, setComms] = useState<CommsState>({
    channels: ["SMS", "Email"],
    templates: [
      { channel: "SMS", subject: "", body: "Hi {{first name}}, complete your profile to unlock your offer: {{cta_url}} Reply STOP to opt out." },
      { channel: "Email", subject: "Complete your profile to unlock your offer", body: "Hi {{first name}},\n\nFinish here: {{cta_url}}\n\nThanks!" },
    ],
    legalReviewerId: "LEGAL-USER-1",
    legalNotes: "",
  });

  async function load() {
    if (!nbaId) return;
    const res = await fetch(`/api/nba/${nbaId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSnapshot(data.snapshot as Snapshot);
  }

  useEffect(() => {
    if (!nbaId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nbaId]);

  useEffect(() => {
    if (!snapshot) return;
    const nba = snapshot.nba;
    setGeneral({
      name: nba.name ?? "",
      description: nba.description ?? "",
      startDate: nba.start_date,
      endDate: nba.end_date,
      priority: nba.priority,
      arbitrationWeight: nba.arbitration_weight,
    });
    if (snapshot.audience?.rules) setAudienceJson(JSON.stringify(snapshot.audience.rules, null, 2));
    if (typeof snapshot.audience?.sizeEstimate === "number") setAudienceEstimate(snapshot.audience.sizeEstimate);
    if (snapshot.action) {
      setAction({
        type: snapshot.action.type,
        completionEvent: snapshot.action.completionEvent,
        saleChannels: snapshot.action.saleChannels,
        offerPriority: snapshot.action.offerPriority,
        maxOffersPerCustomer: snapshot.action.maxOffersPerCustomer,
      });
    }
    if (snapshot.benefit) {
      setBenefit({
        type: snapshot.benefit.type,
        valueNumber: snapshot.benefit.valueNumber,
        valueUnit: snapshot.benefit.valueUnit,
        capNumber: snapshot.benefit.capNumber,
        threshold: snapshot.benefit.threshold ?? {},
        stackability: snapshot.benefit.stackability ?? { allowed: false, exclusivityTags: [] as string[] },
        exclusions: snapshot.benefit.exclusions ?? { excludedOfferIds: [] as string[] },
        redemptionLogic: snapshot.benefit.redemptionLogic,
        description: snapshot.benefit.description,
      });
    }
    if (snapshot.comms?.length) {
      const commsArr = snapshot.comms ?? [];
      const channels = commsArr.map((t) => t.channel);
      setComms((c) => ({
        ...c,
        channels,
        templates: commsArr.map((t) => ({ channel: t.channel, subject: t.subject ?? "", body: t.body ?? "" })),
      }));
    }
  }, [snapshot]);

  async function saveGeneral() {
    setError(null);
    setSaving(true);
    try {
      const payload = { ...general };
      const res = nbaId
        ? await fetch(`/api/nba/${nbaId}/general`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch(`/api/nba`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const id = data.nba?.id ?? nbaId;
      if (!id) throw new Error("Missing id");
      setNbaId(id);
      await load();
      setStep(2);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveAudience() {
    if (!nbaId) return;
    setError(null);
    setSaving(true);
    try {
      const rules = JSON.parse(audienceJson);
      const res = await fetch(`/api/nba/${nbaId}/audience`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setAudienceEstimate(data.sizeEstimate);
      await load();
      setStep(3);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveAction() {
    if (!nbaId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/nba/${nbaId}/action`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await load();
      setStep(4);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveBenefit() {
    if (!nbaId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/nba/${nbaId}/benefit`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(benefit),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await load();
      setStep(5);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveComms() {
    if (!nbaId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/nba/${nbaId}/comms`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(comms),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await load();
      setStep(6);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const aiScreen = useMemo(() => {
    if (step === 1) return "general";
    if (step === 2) return "audience";
    if (step === 3) return "action";
    if (step === 4) return "benefit";
    if (step === 5) return "comms";
    return "summary";
  }, [step]);

  async function transition(nextStatus: string) {
    if (!nbaId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/nba/${nbaId}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transition failed");
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const readiness = useMemo(() => {
    const s = snapshot;
    const nba = s?.nba;
    const items: Array<{ key: string; label: string; ok: boolean; detail?: string }> = [];

    const hasNba = Boolean(nba?.id);
    items.push({ key: "nba", label: "NBA created", ok: hasNba });
    items.push({ key: "name", label: "Unique name (validated on save)", ok: Boolean(nba?.name?.trim()?.length) });
    items.push({
      key: "dates",
      label: "Start date is before end date",
      ok: nba ? Date.parse(nba.start_date) < Date.parse(nba.end_date) : false,
      detail: nba ? `${new Date(nba.start_date).toLocaleDateString()} → ${new Date(nba.end_date).toLocaleDateString()}` : undefined,
    });
    items.push({ key: "audience", label: "Audience configured (≥1 inclusion rule)", ok: Boolean(s?.audience?.rules) });
    items.push({
      key: "audienceEstimate",
      label: "Audience size estimate computed",
      ok: typeof s?.audience?.sizeEstimate === "number" && s.audience.sizeEstimate >= 0,
      detail: typeof s?.audience?.sizeEstimate === "number" ? `${s.audience.sizeEstimate.toLocaleString()} customers` : undefined,
    });
    items.push({ key: "actionType", label: "Action type selected", ok: Boolean(s?.action?.type) });
    items.push({ key: "actionChannels", label: "Sale channel(s) selected", ok: Boolean(s?.action?.saleChannels?.length) });
    items.push({ key: "benefit", label: "Benefit configured (value + cap)", ok: Boolean(s?.benefit?.type && s.benefit.valueNumber > 0 && s.benefit.capNumber > 0) });
    items.push({ key: "comms", label: "At least one channel enabled", ok: Boolean(s?.comms?.length) });
    items.push({
      key: "templates",
      label: "Templates present for enabled channels",
      ok: Boolean(s?.comms?.length && s.comms.every((t) => (t.body ?? "").trim().length >= 3)),
    });
    const legalOk = Boolean(s?.comms?.length) && s!.comms!.every((t) => t.legalStatus === "Approved");
    items.push({
      key: "legal",
      label: "Legal approved all customer-facing templates",
      ok: legalOk,
      detail: s?.comms?.length ? s.comms.map((t) => `${t.channel}: ${t.legalStatus}`).join(" · ") : undefined,
    });

    const okCount = items.filter((x) => x.ok).length;
    const score = Math.round((okCount / items.length) * 100);
    const canActivate = legalOk;
    return { items, score, canActivate };
  }, [snapshot]);

  async function submitForLegalReview() {
    if (!nbaId) return;
    // Draft -> Submitted -> In Legal Review (keeps the explicit lifecycle steps)
    await transition("Submitted");
    await transition("In Legal Review");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-zinc-900">NBA Wizard</div>
          <div className="text-sm text-zinc-600">Create an NBA with a Legal approval gate for customer-facing messaging.</div>
          {nbaId ? (
            <div className="mt-2 text-xs text-zinc-500">
              NBA:{" "}
              <Link href={`/nbas/${nbaId}`} className="font-medium text-zinc-900 hover:underline">
                {nbaId}
              </Link>{" "}
              {snapshot?.nba?.status ? `· Status: ${snapshot.nba.status}` : null} {snapshot?.version ? `· v${snapshot.version}` : null}
            </div>
          ) : null}
        </div>
        <Link href="/nbas">
          <Button variant="secondary">Back to list</Button>
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <button
                key={s.id}
                onClick={() => (nbaId || s.id === 1 ? setStep(s.id) : null)}
                className={`rounded-full px-3 py-1 text-sm ${
                  step === s.id ? "bg-zinc-900 text-white" : nbaId || s.id === 1 ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200" : "bg-zinc-50 text-zinc-400"
                }`}
                disabled={!nbaId && s.id !== 1}
              >
                {s.id}. {s.title}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Card>
          <CardBody>
            <div className="text-sm font-medium text-red-700">Error</div>
            <div className="mt-1 text-sm text-red-700">{error}</div>
          </CardBody>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader title="1) NBA General Details" subtitle="Name must be unique. Start < End. Draft saved as version 1." />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-medium text-zinc-700">NBA Name</div>
                <Input value={general.name} onChange={(e) => setGeneral((g) => ({ ...g, name: e.target.value }))} placeholder="e.g., Complete Profile → Get 10% Off" />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-medium text-zinc-700">Description</div>
                <Textarea value={general.description} onChange={(e) => setGeneral((g) => ({ ...g, description: e.target.value }))} rows={3} />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Start Date</div>
                <Input
                  type="datetime-local"
                  value={isoForInput(general.startDate)}
                  onChange={(e) => setGeneral((g) => ({ ...g, startDate: inputToIso(e.target.value) }))}
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">End Date</div>
                <Input type="datetime-local" value={isoForInput(general.endDate)} onChange={(e) => setGeneral((g) => ({ ...g, endDate: inputToIso(e.target.value) }))} />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Priority (1=highest)</div>
                <Input type="number" min={1} max={10} value={general.priority} onChange={(e) => setGeneral((g) => ({ ...g, priority: Number(e.target.value) }))} />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Arbitration Weight</div>
                <Input type="number" step="0.1" value={general.arbitrationWeight} onChange={(e) => setGeneral((g) => ({ ...g, arbitrationWeight: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveGeneral} disabled={saving}>
                {saving ? "Saving…" : nbaId ? "Save & Continue" : "Create Draft & Continue"}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader title="2) Audience Definition" subtitle="Rule builder MVP is JSON-based; size estimate computed on save." />
          <CardBody>
            <div className="grid gap-3">
              <div className="text-xs text-zinc-600">
                Tip: fields include <span className="font-mono">plan</span>, <span className="font-mono">tenure_months</span>, <span className="font-mono">purchases_12mo</span>,{" "}
                <span className="font-mono">complaints_12mo</span>, <span className="font-mono">risk_flag</span>, <span className="font-mono">consent_sms</span>, <span className="font-mono">consent_email</span>.
              </div>
              <Textarea value={audienceJson} onChange={(e) => setAudienceJson(e.target.value)} rows={14} className="font-mono" />
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-700">{audienceEstimate != null ? `Estimated audience size: ${audienceEstimate}` : "No estimate yet."}</div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={saveAudience} disabled={saving}>
                    {saving ? "Saving…" : "Save & Continue"}
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader title="3) Action Definition" subtitle="Select action type, completion event, and sale channels." />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Action type</div>
                <Select value={action.type} onChange={(e) => setAction((a) => ({ ...a, type: e.target.value }))}>
                  <option value="purchase_sku">Purchase SKU</option>
                  <option value="change_plan">Change plan</option>
                  <option value="enroll_abp">Enroll for ABP</option>
                  <option value="update_payment_profile">Update payment profile</option>
                  <option value="referral">Referral</option>
                  <option value="usage_milestone">Usage milestone</option>
                  <option value="complete_profile">Complete profile</option>
                </Select>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Completion event</div>
                <Input value={action.completionEvent} onChange={(e) => setAction((a) => ({ ...a, completionEvent: e.target.value }))} placeholder="e.g., profile.completed" />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Sale channels</div>
                <div className="flex flex-wrap gap-2">
                  {["Store", "Care", "SelfService", "Web"].map((ch) => {
                    const on = action.saleChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() =>
                          setAction((a) => ({
                            ...a,
                            saleChannels: on ? a.saleChannels.filter((x) => x !== ch) : [...a.saleChannels, ch],
                          }))
                        }
                        className={`rounded-full px-3 py-1 text-sm ${on ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"}`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-700">Action/offer priority</div>
                  <Input type="number" min={1} max={10} value={action.offerPriority} onChange={(e) => setAction((a) => ({ ...a, offerPriority: Number(e.target.value) }))} />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-700">Times to offer</div>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={action.maxOffersPerCustomer}
                    onChange={(e) => setAction((a) => ({ ...a, maxOffersPerCustomer: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={saveAction} disabled={saving}>
                {saving ? "Saving…" : "Save & Continue"}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader title="4) Benefit Definition" subtitle="Define benefit type, value, caps, and redemption logic." />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Benefit type</div>
                <Select value={benefit.type} onChange={(e) => setBenefit((b) => ({ ...b, type: e.target.value }))}>
                  <option value="order_discount">Order discount</option>
                  <option value="one_time_credit">One-time account credit</option>
                  <option value="recurring_credit">Recurring account credit</option>
                  <option value="free_add_on">Free add on</option>
                </Select>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Redemption logic</div>
                <Select value={benefit.redemptionLogic} onChange={(e) => setBenefit((b) => ({ ...b, redemptionLogic: e.target.value }))}>
                  <option value="auto_apply">Auto-apply</option>
                  <option value="promo_code">Promo code</option>
                  <option value="rep_assisted">Rep-assisted</option>
                </Select>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Value</div>
                <Input type="number" value={benefit.valueNumber} onChange={(e) => setBenefit((b) => ({ ...b, valueNumber: Number(e.target.value) }))} />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Unit</div>
                <Select value={benefit.valueUnit} onChange={(e) => setBenefit((b) => ({ ...b, valueUnit: e.target.value }))}>
                  <option value="percent">Percent</option>
                  <option value="usd">USD</option>
                  <option value="points">Points</option>
                  <option value="add_on">Add-on</option>
                </Select>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Cap (liability ceiling)</div>
                <Input type="number" value={benefit.capNumber} onChange={(e) => setBenefit((b) => ({ ...b, capNumber: Number(e.target.value) }))} />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-medium text-zinc-700">Benefit description (memo/receipt)</div>
                <Input value={benefit.description} onChange={(e) => setBenefit((b) => ({ ...b, description: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button onClick={saveBenefit} disabled={saving}>
                {saving ? "Saving…" : "Save & Continue"}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card>
          <CardHeader title="5) Communication & Legal" subtitle="Select channels, design templates, assign Legal reviewer. Templates require Legal approval before activation." />
          <CardBody>
            <div className="grid gap-4">
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">Channels</div>
                <div className="flex flex-wrap gap-2">
                  {(["SMS", "Email", "Memo"] as Channel[]).map((ch) => {
                    const on = comms.channels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() =>
                          setComms((c) => ({
                            ...c,
                            channels: on ? c.channels.filter((x) => x !== ch) : [...c.channels, ch],
                            templates: on
                              ? c.templates.filter((t) => t.channel !== ch)
                              : [...c.templates, { channel: ch, subject: "", body: ch === "Memo" ? "Customer memo text…" : "Template body…" }],
                          }))
                        }
                        className={`rounded-full px-3 py-1 text-sm ${on ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"}`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4">
                {comms.channels.map((ch) => {
                  const tpl = comms.templates.find((t) => t.channel === ch) ?? { channel: ch, subject: "", body: "" };
                  return (
                    <div key={ch} className="rounded-md border border-zinc-200 p-4">
                      <div className="text-sm font-medium text-zinc-900">{ch} template</div>
                      {ch === "Email" ? (
                        <div className="mt-3">
                          <div className="mb-1 text-xs font-medium text-zinc-700">Subject</div>
                          <Input
                            value={tpl.subject}
                            onChange={(e) =>
                              setComms((c) => ({
                                ...c,
                                templates: c.templates.map((t) => (t.channel === ch ? { ...t, subject: e.target.value } : t)),
                              }))
                            }
                          />
                        </div>
                      ) : null}
                      <div className="mt-3">
                        <div className="mb-1 text-xs font-medium text-zinc-700">Body</div>
                        <Textarea
                          value={tpl.body}
                          onChange={(e) =>
                            setComms((c) => ({
                              ...c,
                              templates: c.templates.map((t) => (t.channel === ch ? { ...t, body: e.target.value } : t)),
                            }))
                          }
                          rows={ch === "SMS" ? 4 : 6}
                        />
                        {ch === "SMS" ? <div className="mt-1 text-xs text-zinc-500">Reminder: keep SMS to 160 characters when possible. Include STOP language.</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-700">Assign Legal reviewer</div>
                  <Input value={comms.legalReviewerId} onChange={(e) => setComms((c) => ({ ...c, legalReviewerId: e.target.value }))} placeholder="LEGAL-USER-1" />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-zinc-700">Notes for Legal</div>
                  <Input value={comms.legalNotes} onChange={(e) => setComms((c) => ({ ...c, legalNotes: e.target.value }))} placeholder="e.g., Please confirm claims + TCPA wording" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep(4)}>
                Back
              </Button>
              <Button onClick={saveComms} disabled={saving}>
                {saving ? "Saving…" : "Save & Continue"}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {step === 6 ? (
        <Card>
          <CardHeader title="6) Summary & Submission" subtitle="Review configuration, run readiness checks, submit for Legal, and (after approval) schedule/publish." />
          <CardBody>
            <div className="grid gap-4">
              <div className="rounded-md border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Readiness checklist</div>
                    <div className="mt-1 text-xs text-zinc-500">Score: {readiness.score}/100</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Current status:</span>
                    <span className="text-sm font-medium text-zinc-900">{snapshot?.nba?.status ?? "—"}</span>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-zinc-100 rounded-md border border-zinc-200">
                  {readiness.items.map((it) => (
                    <div key={it.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="text-zinc-800">{it.label}</div>
                      <div className="flex items-center gap-2">
                        {it.detail ? <div className="text-xs text-zinc-500">{it.detail}</div> : null}
                        <Badge color={it.ok ? "green" : "yellow"}>{it.ok ? "OK" : "Needs attention"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Tip: Legal approvals happen in <Link className="underline" href="/legal">Legal Inbox</Link>.
                </div>
              </div>

              <div className="rounded-md border border-zinc-200 p-4">
                <div className="text-sm font-medium text-zinc-900">Read-only summary</div>
                <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">{JSON.stringify(snapshot, null, 2)}</pre>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-zinc-700">
                  Next steps: submit → Legal approves templates → schedule/publish.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setStep(5)}>
                    Back
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void submitForLegalReview()}
                    disabled={saving || !nbaId || !snapshot?.nba || !["Draft", "Rejected"].includes(snapshot.nba.status)}
                  >
                    Submit for Legal Review
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => transition("In Testing")}
                    disabled={saving || !readiness.canActivate || snapshot?.nba?.status !== "Approved"}
                  >
                    Move to Testing
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => transition("Scheduled")}
                    disabled={saving || !readiness.canActivate || !["Approved", "In Testing"].includes(snapshot?.nba?.status ?? "")}
                  >
                    Schedule
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => transition("Publishing")}
                    disabled={saving || !readiness.canActivate || snapshot?.nba?.status !== "Scheduled"}
                  >
                    Start Publishing
                  </Button>
                  <Button onClick={() => transition("Published")} disabled={saving || !readiness.canActivate || snapshot?.nba?.status !== "Publishing"}>
                    Publish
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <NbaAssistant screen={aiScreen} context={{ nbaId, step, snapshot }} />
    </div>
  );
}

