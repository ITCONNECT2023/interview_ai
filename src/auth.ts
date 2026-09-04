import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getServerEnv } from "@/lib/env/server";

const env = getServerEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: env.AUTH_SECRET ?? "local-development-secret-change-me",
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID ?? "not-configured",
      clientSecret: env.AUTH_GOOGLE_SECRET ?? "not-configured",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!env.ALLOWED_EMAIL_DOMAIN || process.env.NODE_ENV !== "production") return true;
      return Boolean(user.email?.toLowerCase().endsWith(`@${env.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`));
    },
  },
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-pressnote.session-token" : "pressnote.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
});
