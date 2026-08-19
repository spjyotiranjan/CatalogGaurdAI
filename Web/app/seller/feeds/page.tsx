import { FeedHistoryClient } from "@/components/feed/FeedHistoryClient";
import { AppShell } from "@/components/shell/AppShell";
import { requirePageSession } from "@/server/auth/page-session";

export default async function SellerFeedHistoryPage() { const user = await requirePageSession(["SELLER_OPERATOR"]); return <AppShell user={user} breadcrumb="Marketplace / Seller" title="Feed history"><FeedHistoryClient /></AppShell>; }
