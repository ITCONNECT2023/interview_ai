# 인터뷰 전사·기사 초안 서비스 기술 요구사항 문서(TRD)

> 기준 문서: `docs/01_PRD.md`, `docs/03_FRD.md`, `design` 시안. 최종 합의 범위는 최대 10분·100MB 음성, 화자 A·B, 기사 본문 초안, CMS 데스크 검토함 송고, 30일 보관이다. 외부 자료 대조·팩트체크 전송·문맥상 추정·전문 용어 자동 교정·자동 발행은 구현하지 않는다.

## 기술 구성

화면·API·배포 설정을 한 건물 안에 두는 구조(모듈러 모놀리스, modular monolith)로 시작한다. 기능별 코드는 분리하되 하나의 Next.js 프로젝트로 빌드·배포하므로 초기 운영 복잡도가 낮고, 필요할 때 워크플로와 저장소만 독립적으로 확장할 수 있다.

긴 전사 작업은 접수 창구에서 끝날 때까지 기다리는 방식이 아니라 공정을 단계별로 넘기는 작업표(내구성 워크플로, durable workflow)로 처리한다. 각 단계의 결과와 재시도 상태가 저장되므로 브라우저가 닫히거나 함수가 재시작되어도 처음부터 다시 처리하지 않는다.

| 영역 | 선택 기술 | 적용 방식과 선택 이유 |
|---|---|---|
| 웹 애플리케이션 | Next.js App Router + React + TypeScript | 네 화면과 서버 API를 한 프로젝트에서 관리하고 Vercel에 그대로 배포한다. 읽기 화면은 Server Component, 오디오 플레이어·편집기·업로드는 Client Component로 제한한다. |
| UI | Tailwind CSS | 시안의 Tailwind 클래스를 재사용하되 CDN 스크립트가 아닌 빌드 의존성으로 적용한다. |
| 서버 실행 | Vercel Functions, Node.js runtime | 파일 메타데이터 처리, Gemini SDK, 데이터베이스, CMS 연동에 필요한 Node.js 호환성을 유지한다. Edge runtime은 사용하지 않는다. |
| 장기 작업 | Vercel Workflow DevKit | 전사·분석·초안·근거 검증을 재시도 가능한 단계로 실행한다. 워크플로 함수는 순서만 관리하고 외부 API·DB 작업은 `use step` 단계에서 수행한다. |
| AI | Google GenAI SDK `@google/genai`, `gemini-3.8-flash` | 전사와 기사 초안 모두 동일한 안정 모델을 사용한다. 오디오 입력과 구조화 출력이 지원되는 GA 모델이다. [모델 사양](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) |
| AI 호출 정책 | Gemini Developer API 유료 프로젝트, Interactions API `store: false` | 무료 서비스의 학습 활용 가능성을 피하고 서버측 상호작용 저장을 끈다. 검색·지도·코드 실행·함수 호출 도구는 전달하지 않는다. [데이터 보존 안내](https://ai.google.dev/gemini-api/docs/zdr) |
| 파일 저장 | Vercel Private Blob + `@vercel/blob/client` | 브라우저가 단기 업로드 토큰을 받아 Blob으로 직접 전송한다. Vercel Function 본문을 통과하지 않으므로 대용량 요청 제한을 피하고 실제 업로드 진행률을 표시할 수 있다. [클라이언트 업로드](https://vercel.com/docs/vercel-blob/client-upload) |
| 관계형 저장 | Neon PostgreSQL + Drizzle ORM | 작업·전사 버전·근거 ID·초안 버전·삭제 상태 사이의 관계와 트랜잭션을 보장한다. Vercel Marketplace 연결로 환경변수 주입이 단순하다. |
| 인증 | Auth.js + 조직 Google OIDC | 기자 계정과 조직을 식별하고 작업 소유권을 모든 API에서 확인한다. 조직 계정만 허용한다. |
| 속도 제한 | Upstash Redis + `@upstash/ratelimit` | 사용자·조직별 업로드와 Gemini 호출 횟수를 제한해 API 비용 남용과 중복 실행을 차단한다. |
| 입력·출력 검증 | Zod + 애플리케이션 근거 검증기 | HTTP 요청과 Gemini 구조화 JSON을 먼저 스키마로 검사하고, 인용 일치·근거 ID·수치 출처는 별도 업무 규칙으로 다시 검사한다. 구조화 출력은 JSON 형식만 보장하므로 의미 검증이 추가로 필요하다. [구조화 출력](https://ai.google.dev/gemini-api/docs/structured-output) |
| 테스트 | Vitest + Playwright | 스키마·근거 검증·삭제 로직은 단위 테스트, 네 화면 흐름과 권한·재시도는 브라우저 통합 테스트로 검증한다. |
| 배포 | Vercel Git Integration | `main`은 Production, Pull Request는 Preview로 분리하고 환경별 비밀값과 데이터베이스를 분리한다. |

핵심 데이터 모델은 다음과 같다.

| 테이블 | 핵심 필드 | 역할 |
|---|---|---|
| `users` | `id`, `email`, `organization_id`, `role` | 기자·데스크 계정과 권한 |
| `jobs` | `id`, `owner_id`, `status`, `stage`, `transcript_version`, `expires_at` | 작업 생명주기와 현재 결과 버전 |
| `source_files` | `job_id`, `blob_path`, `mime_type`, `bytes`, `duration_ms`, `etag` | 비공개 원본 음성 참조와 서버 검증값 |
| `transcript_versions` | `id`, `job_id`, `version`, `source`, `created_by` | 최초 전사와 사용자 교정본의 불변 버전 |
| `transcript_segments` | `version_id`, `segment_id`, `speaker`, `start_ms`, `end_ms`, `text`, `flags` | 화자·타임코드 전사와 `[불명확]` 상태 |
| `analysis_items` | `job_id`, `transcript_version`, `type`, `text`, `source_segment_ids` | 핵심 발언·인용문·사실 정보·확인 필요 항목 |
| `article_drafts` | `job_id`, `version`, `transcript_version`, `leads`, `outline`, `paragraphs`, `validation_status` | 리드 3안·본문 구조·근거 연결 초안 |
| `job_events` | `job_id`, `stage`, `status`, `error_code`, `created_at` | 진행 화면과 재시도 이력 |
| `cms_deliveries` | `job_id`, `draft_version`, `idempotency_key`, `status`, `receipt_id` | 데스크 검토함 송고 기록 |
| `audit_logs` | `actor_id`, `job_id_hash`, `action`, `result`, `created_at`, `expires_at` | 내용이 없는 접근·삭제 감사 기록 |

## 데이터 흐름

```text
브라우저
  → 업로드 토큰 요청
  → Vercel Private Blob 직접 업로드
  → 작업 생성 API
  → 전사 워크플로 시작
      → 서버 파일 검증
      → Gemini Files API 임시 업로드
      → gemini-3.8-flash 전사
      → 전사 기반 분석
      → 근거 검증·DB 저장
      → Gemini 임시 파일 즉시 삭제
  → 상태 조회 → 전사 검토·수정
  → 초안 워크플로 시작
      → 최신 전사 버전 확인
      → 필요 시 분석 재생성
      → gemini-3.8-flash 리드·구조·본문 생성
      → 인용·수치·근거 검증·DB 저장
  → 원문 대조·복사
  → 사용자 확인 → CMS 데스크 검토함 송고
```

1. 사용자가 로그인하면 서버는 세션의 `userId`와 `organizationId`를 확정한다.
2. 브라우저는 파일 확장자·크기·재생 시간을 사전 검사한 뒤 `/api/blob/upload`에서 해당 작업에만 유효한 단기 업로드 토큰을 받는다.
3. 음성은 브라우저에서 Vercel Private Blob으로 직접 전송한다. 업로드 토큰은 허용 MIME, 최대 100MB, 단일 경로로 제한하며 Blob 쓰기 비밀키는 브라우저에 전달하지 않는다.
4. 업로드 완료 후 `/api/jobs`가 작업을 생성한다. 서버 단계에서 `file-type`과 `music-metadata`로 실제 MIME·재생 가능 여부·10분 제한을 다시 검증한다. 브라우저 검사는 사용자 안내용이고 서버 검사가 최종 판정이다.
5. `processInterviewWorkflow(jobId)`를 시작하고 즉시 `202 Accepted`를 반환한다. 화면은 2초 간격 상태 조회를 사용하며 실제 수치가 없는 처리 단계에는 가짜 백분율을 표시하지 않는다.
6. 전사 워크플로는 `검증 → Gemini 파일 업로드 → 전사 → 분석 → 근거 검증 → 저장 → Gemini 파일 삭제` 단계로 실행한다. Gemini Files API 파일은 완료·실패와 관계없이 `finally` 단계에서 삭제하며 48시간 자동 만료에만 의존하지 않는다. [Files API](https://ai.google.dev/gemini-api/docs/files)
7. 전사 호출은 `thinking_level: "low"`, 초안 호출은 `thinking_level: "medium"`을 사용한다. 두 호출 모두 `model: "gemini-3.8-flash"`, `store: false`, `response_format: application/json`과 JSON Schema를 사용한다.
8. 전사 스키마는 화자를 `A | B | UNCLEAR`로 제한한다. 화면에서는 각각 `화자 A`, `화자 B`, `화자 [불명확]`으로 변환하고 청취 불가 문자열은 `[불명확]`으로 보존한다.
9. 사용자가 전사를 수정하면 새 `transcript_version`을 만든다. 이전 버전은 덮어쓰지 않고, 연결된 분석·초안은 `STALE`로 표시한다. 인용 후보가 새 전사에 정확히 존재하는지 다시 검사한다.
10. `generateArticleWorkflow(jobId, transcriptVersion)`은 최신 전사와 전사 내부 분석만 입력으로 사용한다. 외부 검색·보도자료·취재 메타데이터를 기사 내용의 근거로 사용하지 않는다.
11. 초안 검증기는 모든 `sourceSegmentIds`의 존재, 직접 인용의 문자 단위 일치, 초안에 등장하는 수치·날짜·고유명사의 전사 존재를 확인한다. 실패하면 위반 목록을 넣어 한 번 재생성하고, 다시 실패하면 `EVIDENCE_FAILED`로 멈춰 사용자가 검토하게 한다.
12. CMS 송고는 사용자가 대상·초안 버전·미해결 항목 수를 확인한 뒤 서버가 수행한다. `Idempotency-Key: {jobId}:{draftVersion}`으로 중복을 막고 CMS 상태는 `submitted_for_review`로 고정한다. 공개·발행 API는 호출하지 않는다.

작업 상태는 아래 값만 허용한다.

```ts
type JobStatus =
  | "UPLOADING"
  | "QUEUED"
  | "VALIDATING"
  | "TRANSCRIBING"
  | "ANALYZING"
  | "REVIEW_READY"
  | "DRAFTING"
  | "READY"
  | "FAILED"
  | "DELETING"
  | "DELETED";
```

재시도 규칙은 다음과 같다.

| 오류 | 처리 |
|---|---|
| Gemini `429`, 네트워크 오류, `5xx` | 지수 백오프로 최대 3회 재시도하고 공급자 `Retry-After`를 우선 적용 |
| Gemini JSON 파싱·스키마 실패 | 오류 내용을 포함해 1회 재생성 후 실패 처리 |
| 근거 검증 실패 | 위반 목록으로 1회 재생성 후 `EVIDENCE_FAILED` |
| 잘못된 파일·10분/100MB 초과 | 영구 오류로 처리하고 자동 재시도하지 않음 |
| DB·Blob 일시 오류 | 같은 단계와 멱등성 키로 최대 3회 재시도 |
| CMS 인증·권한 오류 | 자동 재시도하지 않고 사용자에게 재인증·관리자 확인 안내 |

## 저장·삭제 원칙

자료는 봉투 겉면과 내용물을 따로 보관하는 방식이다. 작업 상태·근거 관계는 데이터베이스(관계형 메타데이터)에, 큰 원본 음성은 비공개 객체 저장소(Object storage)에 저장한다. 데이터베이스에 음성을 Base64로 넣지 않아 백업 크기와 유출 범위를 줄인다.

| 자료 | 저장 위치 | 접근 방식 | 보관·삭제 |
|---|---|---|---|
| 원본 음성 | Vercel Private Blob | 인증된 서버 경유 스트리밍과 Range 요청만 허용 | 생성 후 30일 또는 사용자 삭제 즉시 제거 |
| Gemini 임시 음성 | Gemini Files API | 워크플로 단계에서만 파일 이름·URI 사용 | 전사·분석 종료 직후 명시적 삭제, 48시간 자동 만료는 보조 안전장치 |
| 전사·분석·초안 | Neon PostgreSQL | 조직·작업 소유권이 확인된 서버 쿼리만 허용 | 생성 후 30일 또는 사용자 삭제 즉시 하드 삭제 |
| TXT/HWP용 내보내기 | Private Blob | 생성자와 같은 조직의 인증된 다운로드만 허용 | 작업과 함께 삭제, 별도 만료를 두지 않음 |
| 진행·오류 이벤트 | Neon PostgreSQL | 내용 대신 단계·코드·시각만 저장 | 작업과 함께 삭제 |
| 감사 기록 | Neon PostgreSQL 별도 테이블 | 관리자만 조회, 원문·파일명·전사 내용 저장 금지 | 삭제 수행일로부터 30일 후 삭제 |
| 업로드·호출 속도 키 | Upstash Redis | 서버만 접근 | 최대 24시간 TTL |

삭제는 `DELETING` 상태로 접근을 먼저 차단한 뒤 `Gemini 파일 → Blob 원본·내보내기 → 전사·분석·초안 → 작업 메타데이터` 순서로 수행한다. 각 삭제 단계는 멱등적으로 실행하며 일부 실패 시 삭제 워크플로가 재시도한다. 모든 단계가 성공해야 `DELETED`로 기록한다.

매일 실행되는 `/api/cron/purge`는 `expires_at <= now()`인 작업을 삭제 워크플로에 넣는다. 요청의 `Authorization: Bearer ${CRON_SECRET}`을 검증하며, 사용자의 즉시 삭제 요청은 같은 워크플로를 바로 시작한다.

운영 로그에는 원본 파일명, 전사, 인용문, 프롬프트, 모델 응답, Blob URL, API 키를 기록하지 않는다. `requestId`, 해시 처리한 `jobId`, 단계, 오류 코드, 지연 시간만 기록한다.

## 파일 역할

```text
src/
  app/
    (auth)/login/page.tsx                    # 조직 로그인
    jobs/new/page.tsx                        # 1. 업로드 화면
    jobs/[jobId]/processing/page.tsx         # 2. 전사 중 화면
    jobs/[jobId]/transcript/page.tsx         # 3. 전사 검토 화면
    jobs/[jobId]/draft/page.tsx              # 4. 기사 초안 화면
    api/blob/upload/route.ts                  # 단기 Private Blob 업로드 토큰
    api/jobs/route.ts                         # 작업 생성
    api/jobs/[jobId]/route.ts                 # 상태·결과 조회, 삭제 요청
    api/jobs/[jobId]/transcript/route.ts      # 전사 버전 저장
    api/jobs/[jobId]/drafts/route.ts          # 초안 생성 시작
    api/jobs/[jobId]/audio/route.ts           # 권한 확인 후 음성 Range 스트리밍
    api/jobs/[jobId]/cms-deliveries/route.ts  # CMS 데스크 송고
    api/cron/purge/route.ts                   # 30일 만료 작업 정리
  components/
    upload/                                   # 파일·메타데이터·동의 UI
    processing/                               # 단계 진행·재시도 UI
    transcript/                               # 플레이어·전사 편집·근거 UI
    draft/                                    # 리드·본문·취재 데이터·송고 UI
  workflows/
    process-interview.ts                      # 전사 워크플로 순서
    generate-article.ts                       # 초안 워크플로 순서
    delete-job.ts                             # 즉시·만료 삭제 워크플로
    steps/                                    # Gemini·DB·Blob·검증 use step 함수
  lib/
    auth/                                     # Auth.js 설정과 조직 권한
    blob/                                     # Private Blob 업로드·조회·삭제
    cms/                                      # CMS 클라이언트와 멱등 송고
    db/schema.ts                              # Drizzle 테이블 정의
    db/repositories/                          # 조직 범위를 강제하는 데이터 접근
    env/server.ts                             # 서버 환경변수 Zod 검증
    gemini/client.ts                          # server-only Gemini 클라이언트
    gemini/prompts/                           # 전사·분석·초안 시스템 지침
    schemas/api.ts                            # HTTP 요청·응답 Zod 스키마
    schemas/gemini.ts                         # Gemini 구조화 출력 스키마
    validators/evidence.ts                    # 인용·수치·근거 ID 검증
    validators/audio.ts                       # MIME·길이·용량 검증
  types/                                      # 공유 직렬화 타입
drizzle/                                      # SQL 마이그레이션
tests/unit/                                   # 스키마·근거·삭제 테스트
tests/e2e/                                    # 네 화면과 권한 흐름 테스트
.env.example                                  # 값이 비어 있는 변수 목록
drizzle.config.ts                             # DB 마이그레이션 설정
next.config.ts                                # Workflow DevKit 래퍼와 보안 설정
vercel.json                                   # Cron·함수 설정
package.json                                  # 스크립트·의존성
package-lock.json                             # 재현 가능한 의존성 잠금
```

`src/lib/gemini/client.ts`는 첫 줄에 `import "server-only"`를 두고 이 파일 밖에서 `GoogleGenAI`를 생성하지 않는다. `src/lib/db/repositories`는 모든 쿼리에 `organizationId`를 요구해 UI 코드가 임의로 전체 테이블을 조회하지 못하게 한다.

`design/*/code.html`은 시각 참고 자료로만 남기고 런타임에 포함하지 않는다. 시안의 인라인 JavaScript, CDN Tailwind, 샘플 취재 내용과 48분 22초 표시는 제품 코드로 복사하지 않는다.

## 환경변수

비밀값은 열쇠 보관함에서 서버가 꺼내 쓰는 방식(서버 전용 환경변수, server-only environment variable)으로 관리한다. `NEXT_PUBLIC_` 접두사가 붙으면 브라우저 번들에 포함되므로 아래 비밀값에는 절대 사용하지 않는다.

| 변수 | 필수 | 비밀 | 용도 |
|---|---|---|---|
| `GEMINI_API_KEY` | 필수 | 예 | 유료 Gemini API 프로젝트 키. `src/lib/gemini/client.ts`에서만 읽음 |
| `GEMINI_MODEL` | 필수 | 아니요 | 고정값 `gemini-3.8-flash`; 서버에서만 읽어 임의 클라이언트 변경 차단 |
| `DATABASE_URL` | 필수 | 예 | Neon PostgreSQL 연결 문자열 |
| `BLOB_READ_WRITE_TOKEN` | 필수 | 예 | Vercel Private Blob 서버·업로드 토큰 발급 권한 |
| `AUTH_SECRET` | 필수 | 예 | Auth.js 세션 서명·암호화 |
| `AUTH_GOOGLE_ID` | 필수 | 예 | 조직 Google OIDC 클라이언트 ID |
| `AUTH_GOOGLE_SECRET` | 필수 | 예 | 조직 Google OIDC 클라이언트 비밀값 |
| `ALLOWED_EMAIL_DOMAIN` | 필수 | 아니요 | 로그인 허용 조직 도메인 |
| `UPSTASH_REDIS_REST_URL` | 필수 | 예 | 속도 제한 Redis 주소 |
| `UPSTASH_REDIS_REST_TOKEN` | 필수 | 예 | 속도 제한 Redis 토큰 |
| `CMS_API_BASE_URL` | Production 필수 | 아니요 | CMS 데스크 검토함 API 기준 URL |
| `CMS_API_TOKEN` | Production 필수 | 예 | CMS 서버 간 인증 토큰 |
| `CRON_SECRET` | 필수 | 예 | 만료 삭제 Cron 호출 검증 |
| `DATA_RETENTION_DAYS` | 필수 | 아니요 | 고정값 `30` |
| `MAX_AUDIO_DURATION_SECONDS` | 필수 | 아니요 | 고정값 `600` |
| `MAX_AUDIO_BYTES` | 필수 | 아니요 | 고정값 `104857600` |
| `APP_ORIGIN` | 필수 | 아니요 | 허용 Origin·콜백 URL 검증용 서비스 주소 |

Production·Preview·Development 값을 Vercel Dashboard에서 별도 범위로 설정한다. Preview는 Production DB·Blob·CMS 토큰을 공유하지 않는다. 로컬 비밀값은 Git에서 제외된 `.env.local`에만 두고, `.env.example`에는 변수명과 빈 값만 커밋한다.

서버 시작 시 `src/lib/env/server.ts`가 모든 필수 변수를 Zod로 검증한다. 오류 메시지에는 변수명만 포함하고 실제 값은 포함하지 않는다. 클라이언트 컴포넌트는 `process.env.GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL`, `CMS_API_TOKEN`을 참조할 수 없다.

## 요청·응답 스키마

모든 API는 `Content-Type: application/json`, ISO 8601 UTC 시각, 밀리초 단위 음성 위치를 사용한다. 작업 ID는 추측하기 어려운 UUID이며 URL의 ID만 신뢰하지 않고 세션의 조직·소유권을 함께 검증한다.

| 메서드·경로 | 요청 | 정상 응답 | 주요 오류 |
|---|---|---|---|
| `POST /api/blob/upload` | Blob SDK 토큰 교환 요청, 파일명·MIME·크기·작업 준비 ID | 범위가 제한된 단기 업로드 토큰 | `400 FILE_INVALID`, `401`, `413 FILE_TOO_LARGE`, `429` |
| `POST /api/jobs` | 업로드된 Blob 정보와 취재 메타데이터·옵션 | `202 { jobId, status, statusUrl }` | `400`, `404 BLOB_NOT_FOUND`, `409 DUPLICATE`, `422 AUDIO_INVALID` |
| `GET /api/jobs/{jobId}` | 없음 | 작업 상태·단계·요약·현재 버전 | `401`, `403`, `404` |
| `PATCH /api/jobs/{jobId}/transcript` | 기준 버전과 수정 연산 목록 | 새 전사 버전과 무효화된 결과 목록 | `409 VERSION_CONFLICT`, `422 SEGMENT_INVALID` |
| `POST /api/jobs/{jobId}/drafts` | `transcriptVersion` | `202 { runId, statusUrl }` | `409 STALE_TRANSCRIPT`, `422 EVIDENCE_INVALID`, `429` |
| `GET /api/jobs/{jobId}?include=result` | 없음 | 전사·분석·리드·구조·초안 | `403`, `404`, `409 NOT_READY` |
| `GET /api/jobs/{jobId}/audio` | `Range` 헤더 선택 | 권한이 확인된 `206 Partial Content` 음성 | `403`, `404`, `416` |
| `POST /api/jobs/{jobId}/cms-deliveries` | `draftVersion`, `confirm`, `idempotencyKey` | `201 { deliveryId, receiptId, status }` | `409 DUPLICATE`, `422 UNRESOLVED_CONFIRMATION`, `502 CMS_ERROR` |
| `DELETE /api/jobs/{jobId}` | 선택적 삭제 사유 | `202 { status: "DELETING" }` | `403`, `404`, `409 DELETE_IN_PROGRESS` |

공통 오류 봉투는 다음과 같다.

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    field?: string;
    requestId: string;
  };
};
```

작업 생성 요청과 상태 응답은 다음 구조를 따른다.

```ts
type CreateJobRequest = {
  upload: {
    blobPath: string;
    originalName: string;
    mimeType: "audio/mpeg" | "audio/mp4" | "audio/wav" | "audio/x-wav";
    bytes: number;
    durationMsFromClient: number;
    etag: string;
  };
  metadata: {
    title: string;
    sourceIdentifier: string;
    reporterName: string;
    beat?: string;
    recordedAt?: string;
    disclosure: "ON_RECORD" | "BACKGROUND" | "OFF_RECORD";
    consentAccepted: true;
  };
  options: {
    extractQuotes: boolean;
    extractFactsAndReviewItems: boolean;
  };
};

type JobStatusResponse = {
  jobId: string;
  status: JobStatus;
  stage: string;
  stageIndex: number;
  stageCount: number;
  uploadProgress?: number;
  transcriptVersion?: number;
  draftVersion?: number;
  unresolvedCount?: number;
  error?: ApiError["error"];
  updatedAt: string;
};
```

Gemini 전사 출력과 내부 저장 타입은 다음 구조를 공유한다.

```ts
type TranscriptResult = {
  schemaVersion: "1.0";
  durationMs: number;
  segments: Array<{
    id: `SEG-${string}`;
    speaker: "A" | "B" | "UNCLEAR";
    startMs: number;
    endMs: number;
    text: string;                 // 청취 불가 부분은 [불명확]
    confidence: number | null;    // 0~1, 모델이 제공하지 않으면 null
    flags: Array<
      "UNCLEAR_AUDIO" |
      "UNCLEAR_SPEAKER" |
      "UNCLEAR_NUMBER" |
      "UNCLEAR_NAME" |
      "CONTRADICTION"
    >;
  }>;
  keyStatements: AnalysisItem[];
  quoteCandidates: QuoteCandidate[];
  facts: AnalysisItem[];
  reviewItems: ReviewItem[];
};

type AnalysisItem = {
  id: string;
  text: string;
  sourceSegmentIds: string[];
};

type QuoteCandidate = AnalysisItem & {
  speaker: "A" | "B" | "UNCLEAR";
  quote: string;
  startMs: number;
  endMs: number;
};

type ReviewItem = AnalysisItem & {
  reason:
    | "UNCLEAR_AUDIO"
    | "UNCLEAR_SPEAKER"
    | "UNCLEAR_NUMBER"
    | "UNCLEAR_NAME"
    | "CONTRADICTION";
  resolved: boolean;
};
```

Gemini 초안 출력은 다음 구조를 따른다.

```ts
type ArticleDraftResult = {
  schemaVersion: "1.0";
  transcriptVersion: number;
  leads: {
    fact: Lead;
    quote: Lead;
    issue: Lead;
  };
  outline: Array<{
    order: number;
    heading: string;
    purpose: string;
    sourceSegmentIds: string[];
    analysisItemIds: string[];
  }>;
  paragraphs: Array<{
    order: number;
    heading: string;
    text: string;
    sourceSegmentIds: string[];
    quoteCandidateIds: string[];
    reviewItemIds: string[];
  }>;
};

type Lead = {
  text: string;
  sourceSegmentIds: string[];
  quoteCandidateIds: string[];
};
```

CMS 요청은 다음 최소 필드만 서버에서 조립한다. 브라우저가 임의의 본문이나 CMS 상태를 직접 전달하지 않는다.

```ts
type CmsReviewSubmission = {
  externalId: string;             // jobId:draftVersion
  title: string;                  // 취재·보도 건명
  reporter: string;
  disclosure: "ON_RECORD" | "BACKGROUND" | "OFF_RECORD";
  selectedLeadType: "FACT" | "QUOTE" | "ISSUE";
  lead: string;
  paragraphs: Array<{ order: number; heading: string; text: string }>;
  unresolvedCount: number;
  status: "submitted_for_review";
};
```

## 보안 경계

| 경계 | 허용 | 금지·통제 |
|---|---|---|
| 브라우저 | 파일 사전 검증, 단기 업로드 토큰 사용, 상대 경로 API 호출, 본인 작업 UI | Gemini·Blob·DB·CMS 비밀값, Private Blob 영구 URL, 다른 사용자의 작업 ID 접근 금지 |
| 업로드 토큰 API | 인증·조직·MIME·100MB 제한을 확인하고 단일 경로용 토큰 발급 | 범용 Blob 쓰기 토큰 전달, 임의 경로·파일 형식 업로드 금지 |
| Next.js 서버 | 세션 검증, Zod 검증, 조직 범위 쿼리, Gemini·CMS 서버 호출 | 사용자 입력을 그대로 프롬프트 지침이나 SQL·헤더로 사용 금지 |
| Workflow 단계 | 직렬화된 ID만 받고 DB에서 최신 데이터를 다시 조회 | API 키·원문 전체를 워크플로 이벤트·로그에 기록 금지 |
| Gemini | 오디오·최신 전사와 고정 시스템 지침, JSON Schema만 전달 | 검색 Grounding, Maps, URL context, 코드 실행, 함수 호출, 캐시, `store: true` 금지 |
| 데이터베이스 | 파라미터 바인딩, 조직·소유자 조건, 전사·초안 버전 불변 저장 | 클라이언트의 직접 DB 연결과 전체 테이블 조회 금지 |
| Private Blob | 서버 또는 제한된 클라이언트 업로드 토큰으로만 접근 | 공개 Blob, 추측 가능한 파일명, 인증 없는 다운로드 금지 |
| CMS | 서버 간 토큰, 검토함 전용 엔드포인트, 멱등성 키 | 브라우저 직접 호출, 자동 발행 상태, 미확인 중복 송고 금지 |

추가 보안 규칙은 다음과 같다.

- 쿠키는 `HttpOnly`, `Secure`, `SameSite=Lax`로 설정하고 상태 변경 요청은 Origin 검사와 CSRF 방어를 적용한다.
- 모든 작업 조회·수정·삭제는 `job.organizationId === session.organizationId`를 먼저 검증한다. URL의 `jobId`만으로 접근을 허용하지 않는다.
- 파일 확장자·브라우저 MIME을 신뢰하지 않고 서버에서 실제 파일 형식을 확인한다. 실행 파일·압축 파일·다중 파일은 거부한다.
- 음성 속 발언과 전사 내용은 명령이 아니라 취재 데이터로 취급한다. 시스템 지침에서 데이터 내부의 지시를 무시하도록 하고 Gemini 도구 호출을 비활성화해 프롬프트 인젝션 영향을 제한한다.
- 기사 생성 전후로 애플리케이션 근거 검증기를 실행한다. 모델의 자기 검증 결과만으로 송고 가능 상태를 만들지 않는다.
- 직접 인용은 최신 전사 문자열의 정확한 부분 문자열이어야 한다. `[불명확]`이 포함된 후보는 인용 등록·송고를 차단한다.
- Gemini API는 Cloud Billing이 연결된 유료 프로젝트만 사용한다. Interactions API는 `store: false`, 명시적 Files API 삭제, 검색 Grounding·명시적 캐시 미사용을 적용한다.
- 비밀값은 Vercel 환경변수의 Production·Preview·Development 범위를 분리하고 최소 90일마다 또는 노출 의심 즉시 교체한다.
- 보안 헤더는 CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`를 적용한다.
- 오류 응답에는 공급자 원문, 스택, Blob 경로, SQL, 프롬프트, API 키를 포함하지 않는다.

## 대안 비교

| 결정 | 선택 | 포기한 대안 | 짧은 비교 |
|---|---|---|---|
| 애플리케이션 구조 | Next.js 모듈러 모놀리스 | React SPA + 별도 Express API | 별도 API는 독립 확장에 유리하지만 배포·인증·타입 공유가 늘어난다. 현재 네 화면 규모에서는 Next.js 단일 배포가 단순하다. |
| 서버 런타임 | Node.js Vercel Functions | Edge Functions | Edge는 초기 응답이 빠르지만 파일 메타데이터·SDK·DB 호환 제약이 있다. 이 서비스는 Node.js 호환성이 더 중요하다. |
| 장기 처리 | Vercel Workflow DevKit | 한 개의 긴 Route Handler, `after()` | 단일 함수는 구현은 짧지만 타임아웃·재시작 시 단계 복구가 어렵다. Workflow는 전사·분석·삭제를 단계별로 재시도한다. |
| 진행 전달 | 2초 상태 조회 | WebSocket·SSE | 실시간 토큰 스트림이 아니라 단계 변화만 필요하다. 상태 조회가 재연결·새로고침 복구와 운영이 단순하다. |
| Gemini 연결 | `@google/genai`로 Gemini API 직접 호출 | Vercel AI Gateway | Gateway는 다중 모델 라우팅에 유리하지만 단일 지정 모델과 직접 API 키 요구에는 불필요한 중간 계층이다. |
| Gemini 서비스 등급 | 유료 Gemini Developer API + `store: false` | 무료 Gemini API | 무료 서비스는 민감한 취재 자료에 맞지 않는 데이터 사용 조건이 있다. 유료 서비스는 프롬프트·응답을 제품 개선에 사용하지 않는다. |
| 전사 모델 | `gemini-3.8-flash` | `gemini-3.5-transcribe` 등 전용 STT | 전용 STT는 화자 분리·타임코드에 유리할 수 있지만 전사와 초안 모두 3.8 Flash를 사용하라는 제품 제약을 따른다. 수동 검토와 근거 검증으로 위험을 보완한다. |
| AI 요청 방식 | Files API + 구조화 출력 | 오디오 Base64 인라인 | 인라인은 짧은 샘플에는 단순하지만 요청 크기·메모리 사용이 커진다. Files API는 오디오를 별도로 올리고 즉시 삭제할 수 있다. |
| 파일 저장 | Vercel Private Blob 직접 업로드 | Public Blob, DB Base64, Amazon S3 | Private Blob은 Vercel 통합과 인증 업로드가 단순하다. Public Blob은 취재 자료에 부적합하고 DB Base64는 비효율적이며 S3는 더 많은 IAM 구성이 필요하다. |
| 관계형 저장 | Neon PostgreSQL + Drizzle | Supabase 전체 스택, MongoDB | Supabase는 인증·저장을 함께 쓸 때 유리하지만 현재 Blob·Auth.js와 기능이 겹친다. MongoDB보다 Postgres가 버전·근거 관계와 트랜잭션을 명확히 보장한다. |
| 속도 제한 | Upstash Redis | 함수 메모리, DB 카운터 | 함수 메모리는 인스턴스 간 공유되지 않는다. DB 카운터는 가능하지만 요청마다 트랜잭션 부하가 생겨 Redis TTL 카운터가 단순하다. |
| CMS 연동 | 서버 간 REST 송고 | 브라우저 직접 호출, 자동 발행 | 서버 호출은 토큰과 멱등성을 보호한다. 자동 발행은 PRD 제외 범위이며 데스크 검토함 접수까지만 허용한다. |
