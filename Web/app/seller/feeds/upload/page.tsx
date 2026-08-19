import { FeedUploadClient } from "@/components/feed/FeedUploadClient";
import { AppShell } from "@/components/shell/AppShell";
import { requirePageSession } from "@/server/auth/page-session";

export default async function UploadFeedPage() {
  const user = await requirePageSession(["SELLER_OPERATOR"]);
  return <AppShell user={user} breadcrumb="Marketplace / Seller" title="Upload feed"><FeedUploadClient /></AppShell>;
}
