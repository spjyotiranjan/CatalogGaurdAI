import { StatusBadge } from "@/components/ui/StatusBadge";
import { FEED_STATUS_LABEL, FEED_STATUS_TONE } from "@/lib/types/feed";
import type { FeedStatus } from "@/lib/types/feed";

export function FeedStatusBadge({ status }: { status: FeedStatus }) {
  return <StatusBadge tone={FEED_STATUS_TONE[status]}>{FEED_STATUS_LABEL[status]}</StatusBadge>;
}
