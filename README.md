# PressNote Desk

인터뷰 음성을 업로드하면 화자 구분·타임코드 전사, 취재 데이터, 근거가 연결된 기사 초안을 만드는 편집 워크스페이스입니다.

## 실행

```bash
npm install
copy .env.example .env.local
npm run dev
```

로컬에서 Google 인증 변수가 없으면 개발 전용 기자 계정을 사용합니다. Production에서는 인증·Gemini·Neon·Private Blob·Upstash·Cron 환경변수가 모두 필요합니다.

## 데이터베이스

```bash
npm run db:migrate
```

DB 변수가 없는 로컬 개발에서는 프로세스 메모리 저장소와 `demo` 작업을 사용합니다. Production에서는 메모리 저장소를 사용하지 않습니다.

## 확인 명령

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

샘플 검토 화면은 `/jobs/demo/transcript`, 샘플 초안 화면은 `/jobs/demo/draft`에서 확인할 수 있습니다. 샘플 데이터는 개발 환경에서만 제공해야 하며 실제 취재 자료로 송고하면 안 됩니다.
