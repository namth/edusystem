# Hệ thống học tiếng Anh & thi thử có chấm AI

Next.js 16 (App Router) · PostgreSQL · Neo4j · Redis Streams · Portkey/OpenAI/Gemini.
Danh mục tính năng: `FEATURE_INDEX.md` · Bất biến & quy ước: `CONTEXT.md` · Quyết định: `docs/14-decisions.md`.

## Chạy ở máy local

```bash
npm ci
cp .env.example .env.local   # điền DATABASE_URL, JWT_SECRET (≥ 32 ký tự), INTERNAL_API_TOKEN, NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY, khoá AI…
npm run dev
```

Lần đầu kết nối DB, `ensureSchema()` tự tạo/bổ sung bảng theo `docs/db-migration-00*.sql`.

Biến môi trường thường dùng: `DATABASE_URL`, `JWT_SECRET`, `INTERNAL_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (upload Storage), `PORTKEY_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `REDIS_URL`, `NEO4J_*`, `SLOT_UNIT_PRICE_VND` (giá mỗi slot AI), `SEED_DEFAULT_PASSWORD` (chỉ khi chạy `lib/db-init.js`).

## Kiểm thử

```bash
npm test                      # Vitest + PGlite (Postgres thật trong bộ nhớ)
npx tsc --noEmit -p tsconfig.json
```

## Deploy

```bash
scripts/deploy.sh             # build image ở máy local (cần Docker Desktop), đẩy lên server, docker compose up --no-build
```

## Phối hợp Claude ↔ Antigravity

Quy trình giao việc/nghiệm thu: `handoff/README.md`, tiến độ: `handoff/KE-HOACH.md`. Chạy task song song theo worktree (nhiều tài khoản, máy thợ qua SSH): `scripts/agy-worktree.sh`.
