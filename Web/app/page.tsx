import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ROLE_HOME } from "@/lib/types/session";

export default async function RootPage() {
  const session = await auth();
  if (session?.user?.status === "ACTIVE" && session.user.role) {
    redirect(ROLE_HOME[session.user.role]);
  }
  redirect("/login");
}
