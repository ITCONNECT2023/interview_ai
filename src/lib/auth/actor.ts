import "server-only";
import { auth } from "@/auth";
import { getServerEnv } from "@/lib/env/server";

export type Actor = { userId: string; organizationId: string; email: string };

export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (email) {
    const domain = email.split("@")[1] ?? "unknown";
    return { userId: email, organizationId: domain, email };
  }
  const env = getServerEnv();
  if (process.env.NODE_ENV !== "production" && !env.AUTH_GOOGLE_ID) {
    return { userId: "local-reporter", organizationId: "local-newsroom", email: "reporter@local.test" };
  }
  return null;
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new Error("UNAUTHENTICATED");
  return actor;
}
