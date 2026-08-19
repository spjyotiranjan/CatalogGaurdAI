import { AdminAccessRequests } from "@/components/access/AdminAccessRequests";
import { AppShell } from "@/components/shell/AppShell";
import { randomUUID } from "node:crypto";
import { requirePageSession } from "@/server/auth/page-session";
import { accessRequestService } from "@/server/services/access-requests";
export default async function AdminAccessRequestsPage() { const user = await requirePageSession(["ADMIN"], "/login?returnTo=admin-access-requests&reason=session"); const requests = await accessRequestService.list({ userId: user.userId }, randomUUID()); return <AppShell user={user} breadcrumb="Marketplace / Administration" title="Access requests"><p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">Review seller and reviewer proposals. Approval activates the submitted credentials.</p><AdminAccessRequests initialRequests={requests} /></AppShell>; }
