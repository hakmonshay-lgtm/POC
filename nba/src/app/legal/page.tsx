import { LegalInbox } from "@/components/LegalInbox";
import { Card, CardBody } from "@/components/ui/card";
import { getSession } from "@/lib/session";

export default async function LegalPage() {
  const session = await getSession();
  return (
    <div className="space-y-6">
      {session.role !== "legal" ? (
        <Card>
          <CardBody>
            <div className="text-sm font-medium text-zinc-900">Heads up</div>
            <div className="mt-1 text-sm text-zinc-700">
              You are currently in the <span className="font-medium">{session.role}</span> role. Switch to <span className="font-medium">legal</span> to approve/reject templates.
            </div>
          </CardBody>
        </Card>
      ) : null}
      <LegalInbox />
    </div>
  );
}

