import "server-only";
import { z } from "zod";

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.literal("gemini-3.8-flash").default("gemini-3.8-flash"),
  DATABASE_URL: z.string().url().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  ALLOWED_EMAIL_DOMAIN: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  CMS_API_BASE_URL: z.string().url().optional(),
  CMS_API_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  MAX_AUDIO_DURATION_SECONDS: z.coerce.number().int().positive().default(600),
  MAX_AUDIO_BYTES: z.coerce.number().int().positive().default(104_857_600),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof schema>;
let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`환경변수 형식 오류: ${names}`);
  }
  cached = result.data;
  return cached;
}

export function requireServerEnv<K extends keyof ServerEnv>(name: K): NonNullable<ServerEnv[K]> {
  const value = getServerEnv()[name];
  if (value === undefined || value === "") throw new Error(`필수 환경변수가 없습니다: ${String(name)}`);
  return value as NonNullable<ServerEnv[K]>;
}

export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;
  const required: Array<keyof ServerEnv> = [
    "GEMINI_API_KEY", "DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "AUTH_SECRET",
    "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "ALLOWED_EMAIL_DOMAIN",
    "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "CRON_SECRET",
  ];
  required.forEach(requireServerEnv);
}
