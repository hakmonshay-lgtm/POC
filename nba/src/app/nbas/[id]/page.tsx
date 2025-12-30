import Link from "next/link";
import { getLatestSnapshot } from "@/lib/nbaRepo";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimulateIssue } from "@/components/SimulateIssue";

type BadgeColor = "zinc" | "green" | "yellow" | "red" | "blue";

type CommsItem = {
  channel: string;
  legalStatus: string;
  subject?: string;
  body?: string;
};

function statusColor(status: string): BadgeColor {
  if (status === "Published" || status === "Approved") return "green";
  if (status === "In Legal Review" || status === "Submitted" || status === "Scheduled") return "yellow";
  if (status === "Archived" || status === "Completed") return "zinc";
  if (status === "Terminated") return "red";
  return "blue";
}

export default async function NbaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const snapshot = getLatestSnapshot(id);
  if (!snapshot) {
    return (
      <Card>
        <CardBody>Not found.</CardBody>
      </Card>
    );
  }

  const nba = snapshot.nba;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-zinc-900">{nba.name}</div>
          <div className="mt-1 text-sm text-zinc-600">{nba.description || "—"}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={statusColor(nba.status)}>{nba.status}</Badge>
            <span className="text-xs text-zinc-500">v{nba.current_version}</span>
            <span className="text-xs text-zinc-500">Priority {nba.priority}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/nbas/${id}/wizard`}>
            <Button>Open wizard</Button>
          </Link>
          <Link href="/nbas">
            <Button variant="secondary">Back</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Configuration" subtitle="Current version snapshot (server-side read)." />
          <CardBody>
            <div className="space-y-3 text-sm text-zinc-700">
              <div>
                <div className="text-xs font-medium text-zinc-700">Dates</div>
                <div className="mt-1">
                  {new Date(nba.start_date).toLocaleString()} → {new Date(nba.end_date).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-700">Audience estimate</div>
                <div className="mt-1">{snapshot.audience?.sizeEstimate ?? "Not set"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-700">Action</div>
                <div className="mt-1">{snapshot.action ? `${snapshot.action.type} (${snapshot.action.completionEvent})` : "Not set"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-700">Benefit</div>
                <div className="mt-1">{snapshot.benefit ? `${snapshot.benefit.type} · ${snapshot.benefit.valueNumber} ${snapshot.benefit.valueUnit} · cap ${snapshot.benefit.capNumber}` : "Not set"}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-700">Templates / Legal</div>
                <div className="mt-1 space-y-1">
                  {snapshot.comms?.length ? (
                    (snapshot.comms as CommsItem[]).map((t) => (
                      <div key={t.channel} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
                        <div className="text-sm">{t.channel}</div>
                        <Badge color={t.legalStatus === "Approved" ? "green" : t.legalStatus === "Rejected" ? "red" : "yellow"}>{t.legalStatus}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-500">No templates yet.</div>
                  )}
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Legal approves/rejects templates in <Link className="underline" href="/legal">Legal Inbox</Link>.
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preview / APIs" subtitle="Useful endpoints for integration testing." />
          <CardBody>
            <div className="space-y-2 text-sm text-zinc-700">
              <div>
                <span className="font-medium">Snapshot API:</span> <span className="font-mono text-xs">GET /api/nba/{id}</span>
              </div>
              <div>
                <span className="font-medium">Arbitration API:</span> <span className="font-mono text-xs">GET /api/arbitration/top?customerId=CUST-0001</span>
              </div>
              <div>
                <span className="font-medium">Analytics:</span> <span className="font-mono text-xs">GET /api/analytics/summary?nbaId={id}</span>
              </div>
              <div className="pt-3">
                <SimulateIssue nbaId={id} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

