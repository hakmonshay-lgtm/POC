import Link from "next/link";
import { listNbas } from "@/lib/nbaRepo";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function statusColor(status: string): "zinc" | "green" | "yellow" | "red" | "blue" {
  if (status === "Published" || status === "Approved") return "green";
  if (status === "In Legal Review" || status === "Submitted" || status === "Scheduled") return "yellow";
  if (status === "Archived" || status === "Completed") return "zinc";
  if (status === "Terminated") return "red";
  return "blue";
}

export default function NbasPage() {
  const items = listNbas();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-zinc-900">NBAs</div>
          <div className="text-sm text-zinc-600">Create, version, and manage Next Best Actions.</div>
        </div>
        <Link href="/nbas/new">
          <Button>Create NBA</Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="All NBAs" subtitle={`${items.length} total`} />
        <CardBody>
          <div className="divide-y divide-zinc-100">
            {items.map((n) => (
              <div key={n.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <Link href={`/nbas/${n.id}`} className="truncate text-sm font-medium text-zinc-900 hover:underline">
                      {n.name}
                    </Link>
                    <Badge color={statusColor(n.status)}>{n.status}</Badge>
                    <span className="text-xs text-zinc-500">v{n.current_version}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {new Date(n.start_date).toLocaleDateString()} → {new Date(n.end_date).toLocaleDateString()} · Priority {n.priority}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/nbas/${n.id}/wizard`}>
                    <Button variant="secondary">Open wizard</Button>
                  </Link>
                </div>
              </div>
            ))}
            {items.length === 0 ? <div className="py-10 text-sm text-zinc-600">No NBAs yet.</div> : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

