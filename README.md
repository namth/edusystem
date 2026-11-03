# KitoKit

Cổng bài học & đề thi đa môn cho trung tâm và giáo viên. Tiếng Anh đủ 4 kỹ năng, Writing/Speaking chấm bằng AI.
Next.js 16 · PostgreSQL · Redis Streams · Neo4j · Portkey/OpenAI/Gemini.

## Bắt đầu đọc
- [`CONTEXT.md`](CONTEXT.md) — bối cảnh, bất biến, bản đồ tài liệu
- [`docs/01-overview.md`](docs/01-overview.md) → [`docs/15-operations.md`](docs/15-operations.md) — bộ tài liệu chuẩn (DEC-036)
- [`docs/14-decisions.md`](docs/14-decisions.md) — quyết định đã chốt, thắng khi mâu thuẫn
- [`handoff/README.md`](handoff/README.md) — giao việc Claude ↔ Antigravity

## Lệnh
```bash
npm install
```
```bash
npm run dev
```
```bash
npm test
```
```bash
npx tsc --noEmit
```
```bash
npm run e2e
```
Biến môi trường: xem `docs/10-env-and-security.md` §1. Deploy: xem `docs/15-operations.md` (luôn hỏi trước, không build trên server).
