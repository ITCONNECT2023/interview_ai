import "server-only";
import { getServerEnv } from "@/lib/env/server";

export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin && process.env.NODE_ENV !== "production") return;
  const requestOrigin = new URL(request.url).origin;
  if (process.env.NODE_ENV !== "production" && origin) {
    const hostname = new URL(origin).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") return;
  }
  if (origin !== requestOrigin && origin !== getServerEnv().APP_ORIGIN) throw new Error("INVALID_ORIGIN");
}

export function apiError(error: unknown, requestId = crypto.randomUUID()) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  const map: Record<string, { status: number; message: string; retryable: boolean }> = {
    UNAUTHENTICATED: { status: 401, message: "로그인이 필요합니다.", retryable: false },
    FORBIDDEN: { status: 403, message: "이 작업에 접근할 권한이 없습니다.", retryable: false },
    NOT_FOUND: { status: 404, message: "작업을 찾을 수 없습니다.", retryable: false },
    INVALID_ORIGIN: { status: 403, message: "허용되지 않은 요청 출처입니다.", retryable: false },
    VERSION_CONFLICT: { status: 409, message: "다른 변경이 먼저 저장되었습니다. 최신본을 확인해 주세요.", retryable: true },
    EVIDENCE_INVALID: { status: 422, message: "전사 근거 연결을 확인해 주세요.", retryable: false },
    FILE_INVALID: { status: 400, message: "지원하지 않거나 손상된 음성 파일입니다.", retryable: false },
    RATE_LIMITED: { status: 429, message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", retryable: true },
    CONFIGURATION_ERROR: { status: 503, message: "서버 연동 설정이 필요합니다.", retryable: false },
  };
  const detail = map[code] ?? { status: 500, message: "요청을 처리하지 못했습니다.", retryable: true };
  return Response.json({ error: { code, message: detail.message, retryable: detail.retryable, requestId } }, { status: detail.status });
}
