import { ProfileSecurityClient } from "@/components/profile/ProfileSecurityClient";
import { requirePageSession } from "@/server/auth/page-session";

/** Authenticated account-security route backed by the current Web account. */
export default async function ProfileSecurityPage() {
  const user = await requirePageSession();
  return <ProfileSecurityClient user={user} />;
}
