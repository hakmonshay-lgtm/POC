"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { errorMessage } from "@/lib/errors";

type NbaItem = {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  owner_id: string;
  priority: number;
  arbitration_weight: number;
  current_version: number;
  created_at: string;
  updated_at: string;
  audience_size?: number | null;
  action_type?: string | null;
};

const STATUS_ORDER = [
  "All Statuses",
  "Draft",
  "Submitted",
  "In Legal Review",
  "Approved",
  "In Testing",
  "Scheduled",
  "Publishing",
  "Published",
  "Rejected",
  "Cancelled",
  "Terminated",
  "Expired",
  "Completed",
  "Archived",
] as const;

function statusPillColor(status: string): "zinc" | "green" | "yellow" | "red" | "blue" {
  if (status === "Published") return "green";
  if (status === "Approved") return "green";
  if (status === "In Legal Review" || status === "Submitted" || status === "Scheduled" || status === "Publishing" || status === "In Testing") return "yellow";
  if (status === "Rejected" || status === "Cancelled" || status === "Terminated") return "red";
  if (status === "Expired" || status === "Completed" || status === "Archived") return "zinc";
  return "blue";
}

function statusBarClass(status: string) {
  const c = statusPillColor(status);
  if (c === "green") return "bg-green-600";
  if (c === "yellow") return "bg-amber-500";
  if (c === "red") return "bg-red-600";
  if (c === "zinc") return "bg-zinc-800";
  return "bg-blue-600";
}

function withinDays(iso: string, days: number) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= days * 86400000;
}

export function NbaList() {
  const [items, setItems] = useState<NbaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_ORDER)[number]>("All Statuses");
  const [rangeDays, setRangeDays] = useState<number>(90);
  const [sort, setSort] = useState<"updated_desc" | "name_asc" | "start_desc">("updated_desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nba");
      const data = await res.json();
      setItems((data.items ?? []) as NbaItem[]);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let out = items.slice();
    if (rangeDays > 0) {
      out = out.filter((x) => withinDays(x.updated_at ?? x.created_at, rangeDays));
    }
    if (status !== "All Statuses") {
      out = out.filter((x) => x.status === status);
    }
    if (s) {
      out = out.filter((x) => (x.name ?? "").toLowerCase().includes(s) || (x.description ?? "").toLowerCase().includes(s) || (x.owner_id ?? "").toLowerCase().includes(s));
    }

    out.sort((a, b) => {
      if (sort === "name_asc") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sort === "start_desc") return Date.parse(b.start_date) - Date.parse(a.start_date);
      return Date.parse(b.updated_at) - Date.parse(a.updated_at);
    });
    return out;
  }, [items, rangeDays, search, sort, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(Math.max(page, 1), totalPages);
  const pageItems = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, status, rangeDays, sort, pageSize]);

  async function onDelete(id: string) {
    const ok = window.confirm("Delete this NBA? This cannot be undone.");
    if (!ok) return;
    setError(null);
    const res = await fetch(`/api/nba/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  async function onClone(id: string) {
    setError(null);
    const res = await fetch(`/api/nba/${id}/clone`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Clone failed");
      return;
    }
    const newId = data.nba?.id as string | undefined;
    if (newId) window.location.href = `/nbas/${encodeURIComponent(newId)}/wizard`;
    else void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold tracking-tight text-zinc-900">Next Best Action</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/nbas/new">
            <Button>Create New NBA</Button>
          </Link>
          <Select value={String(rangeDays)} onChange={(e) => setRangeDays(Number(e.target.value))} className="w-[160px]">
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 180 Days</option>
            <option value="0">All time</option>
          </Select>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search NBA" className="md:max-w-[320px]" />
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium text-zinc-600">Sort by</div>
                <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="w-[220px]">
                  <option value="updated_desc">Last updated</option>
                  <option value="start_desc">Start date</option>
                  <option value="name_asc">Name (A–Z)</option>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => {
                const on = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`rounded-full px-3 py-1 text-sm ${
                      on ? "bg-blue-700 text-white" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {error ? <div className="text-sm text-red-700">{error}</div> : null}
            {loading ? <div className="text-sm text-zinc-600">Loading…</div> : null}

            {!loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {pageItems.map((n) => (
                  <div key={n.id} className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white">
                    <div className={`absolute inset-y-0 left-0 w-2 ${statusBarClass(n.status)}`} />
                    <div className="p-4 pl-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color={statusPillColor(n.status)}>{n.status}</Badge>
                            <span className="text-xs text-zinc-500">v{n.current_version}</span>
                          </div>
                          <Link href={`/nbas/${n.id}`} className="mt-1 block truncate text-base font-semibold text-zinc-900 hover:underline">
                            {n.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" onClick={() => void onClone(n.id)}>
                            Clone
                          </Button>
                          <Button variant="ghost" onClick={() => void onDelete(n.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-1 text-sm text-zinc-700 md:grid-cols-2">
                        <div>
                          <span className="text-zinc-500">Created:</span> {new Date(n.created_at).toLocaleDateString()}{" "}
                          <span className="text-zinc-500">by</span> {n.owner_id}
                        </div>
                        <div className="md:text-right">
                          <span className="text-zinc-500">Effective:</span> {new Date(n.start_date).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="text-zinc-500">Type:</span> {n.action_type ?? "—"}
                        </div>
                        <div className="md:text-right">
                          <span className="text-zinc-500">Audience:</span> {typeof n.audience_size === "number" ? n.audience_size.toLocaleString() : "—"}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs text-zinc-500">Updated: {new Date(n.updated_at).toLocaleString()}</div>
                        <Link href={`/nbas/${n.id}/wizard`}>
                          <Button variant="secondary">Open wizard</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
                {pageItems.length === 0 ? <div className="py-10 text-sm text-zinc-600">No NBAs match your filters.</div> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-100 pt-4">
              <div className="text-sm text-zinc-600">
                Rows per page:{" "}
                <Select value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))} className="inline-block w-[90px] align-middle">
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                </Select>
              </div>
              <div className="text-sm text-zinc-600">
                {(pageSafe - 1) * pageSize + 1}-{Math.min(pageSafe * pageSize, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="secondary" onClick={() => setPage(1)} disabled={pageSafe === 1}>
                  {"<<"}
                </Button>
                <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe === 1}>
                  {"<"}
                </Button>
                <Button variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}>
                  {">"}
                </Button>
                <Button variant="secondary" onClick={() => setPage(totalPages)} disabled={pageSafe === totalPages}>
                  {">>"}
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

