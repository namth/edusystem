# 09 — Quy ước

> Cập nhật: 2026-11-03 · Nguồn: cấu trúc repo, `eslint.config.mjs`, `vitest.config.ts`, `handoff/README.md`, lịch sử commit.

## 1. Cấu trúc thư mục
| Thư mục | Nội dung |
| :--- | :--- |
| `app/` | App Router: trang `page.tsx` theo phân hệ `admin/`, `teacher/`, `student/`, công khai; API ở `app/api/**/route.ts` |
| `components/` | `*Layout.tsx` theo vai trò; thư mục theo miền: `admin/`, `orders/`, `question-builder/`, `lesson-player/`, `class-roadmap/`, `onboarding/`, `landing/`, `teacher/` |
| `lib/` | Logic server và hàm thuần. Hàm thuần dùng được ở client: `vietqr.ts`, `vietqr-banks.ts`, `ai-pricing.ts`, `brand.ts`, `roadmap.ts`, `score-display.ts`, `stimulus-html.ts`, `exam-layout.ts`. Module server **không** import vào `"use client"` (`tests/client-bundle-safety.test.ts`) |
| `context/` | `AuthContext` (client) |
| `types/` | Kiểu dùng chung (`types/scoring.ts`, …) |
| `worker/` | `grading-worker.js` + Dockerfile riêng |
| `tests/` | Vitest `*.test.ts`; `tests/helpers/pg-fake.ts` (PGlite) |
| `e2e/` | Playwright + `schema.sql` + seed |
| `docs/` | Bộ tài liệu chuẩn 01–14, `features/`, `qa/`, migration SQL |
| `handoff/` | Giao việc Claude ↔ Antigravity (`tasks/TASK-NNN-*`, `KE-HOACH.md`) |
| `public/brand/` | Logo, mascot |
| `stitch_english_mock_exam_portal/` | Mockup thiết kế, **chỉ tham khảo, không sửa** |

## 2. Đặt tên
- File và route: `kebab-case`. Component: `PascalCase.tsx`. Hàm và biến: `camelCase`. Cột DB và trường JSON API: `snake_case`.
- Id có tiền tố, ví dụ `usr_`, `cls_`, `sub_`, `att_`, `slr_`, `aiu_`, `enr_`, `lsn_`. Mã đơn có dạng `KK` + 8 ký tự.
- Mã tài liệu:

  | Mã | Loại | Nơi ghi |
  | :--- | :--- | :--- |
  | `FEAT-NNN` | tính năng | `docs/features/` |
  | `DEC-NNN` | quyết định | `docs/14` |
  | `BR-<miền>NN` | quy tắc nghiệp vụ | `docs/12` |
  | `TC-<miền>NN` | test case | `docs/13` |
  | `SCR-NN` | màn hình | `docs/03` |
  | `UF-NN` | luồng người dùng | `docs/04` |
  | `TASK-NNN` | việc | `handoff/` |

- Migration: `docs/db-migration-0NN-<mô-tả>.sql`, số tăng dần, **không sửa file cũ**.

## 3. Code
- **API route:**
  - Thứ tự xử lý: `requireRole` → kiểm input → kiểm quyền sở hữu → `queryPg`.
  - Thân lỗi luôn là `{ success:false, error }`, thông điệp tiếng Việt.
  - Thao tác nhiều bước dùng `getPgPool().connect()` + `BEGIN` / `COMMIT`, cập nhật có điều kiện trạng thái (ví dụ `WHERE status='PENDING'`) để chống chạy hai lần.
- **Không** tự `ALTER TABLE` hay `CREATE TABLE` lúc chạy. **Không** có nhánh "dự phòng schema cũ" bắt lỗi `42703`.
- Đồng bộ Neo4j bọc try/catch, chỉ log.
- Client gọi API bằng `fetch`. Trang dùng `useSearchParams` phải bọc `<Suspense>`.
- UI theo `docs/03` §3: token màu, không viết mã hex trong class, gradient một dải màu, nút không có "+", icon trên nền xanh dùng trắng.
- Tiền là số nguyên VND, hiển thị bằng `toLocaleString("vi-VN")`.

## 4. Test & xác minh
| Lệnh | Mục đích |
| :--- | :--- |
| `npm test` (`vitest run`) | Unit/API test. API test dùng PGlite qua `createFakePg([...migration])` và chạy migration thật trong `docs/` |
| `npx tsc --noEmit` | Kiểu |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npx next build` | Bắt lỗi build trang (Suspense, server/client) |
| `npm run e2e` | Playwright trên DB Docker riêng |

Quy tắc test:
- Test hành vi thật (gọi route, chạy migration), chỉ dùng grep cho quy ước tĩnh.
- Test do trưởng phòng (Claude) viết và khoá trong `tests.lock` của task; Antigravity không được sửa.

## 5. Git & quy trình
- **Nhánh:** `main` là nhánh chuẩn. Claude làm ở `claude/<mô-tả>`; Antigravity làm ở `agy/TASK-NNN` (worktree riêng, `scripts/agy-worktree.sh`). Merge vào `main` qua PR.
- **Commit:** Conventional Commits có phạm vi, mô tả tiếng Việt, ví dụ `feat(admin): …`, `fix(auth,onboarding): …`, `chore(handoff): …`, `docs: …`.
- **Giao việc:** `/giao-viec` (brief + test + `verify.sh`), nghiệm thu bằng `/nghiem-thu` (`python3 scripts/handoff.py verify|accept|reject`).
- **Tài liệu (DEC-036):**
  - mỗi tính năng lớn đi qua `/grill-feature` và cập nhật chéo `docs/02, 03, 04, 06, 07, 12, 13, 11, 14` + `CONTEXT.md` trong cùng PR;
  - code lệch tài liệu thì sửa tài liệu theo code.
