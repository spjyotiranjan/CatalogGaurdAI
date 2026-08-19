import { FeedDetailClient } from "@/components/feed/FeedDetailClient";
import { AppShell } from "@/components/shell/AppShell";
import { requirePageSession } from "@/server/auth/page-session";

export default async function FeedDetailPage({ params }: { params: Promise<{ feedId: string }> }) { const [user, { feedId }] = await Promise.all([requirePageSession(["SELLER_OPERATOR"]), params]); return <AppShell user={user} breadcrumb="Marketplace / Seller / Feeds" title="Feed detail"><FeedDetailClient feedId={feedId} /></AppShell>; }
