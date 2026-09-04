import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env/server";

export async function checkRateLimit(key: string, limit = 10) {
  const env = getServerEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    if (process.env.NODE_ENV === "production") throw new Error("CONFIGURATION_ERROR");
    return;
  }
  const ratelimit = new Ratelimit({
    redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
    limiter: Ratelimit.slidingWindow(limit, "1 h"),
    prefix: "pressnote",
  });
  const result = await ratelimit.limit(key);
  if (!result.success) throw new Error("RATE_LIMITED");
}
