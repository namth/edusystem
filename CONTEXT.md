# CONTEXT — KitoKit: cổng bài học & đề thi đa môn

## 1. Tổng quan
KitoKit — cổng bài học & đề thi đa môn (DEC-023). Tiếng Anh đầy đủ 4 kỹ năng, chấm Writing/Speaking bằng AI; môn khác chỉ câu trắc nghiệm, chấm tự động. Thương hiệu & token màu: DEC-022.
Stack: Next.js 16 (App Router) + React 19, PostgreSQL (`lib/db-pg.ts`) và Supabase client (`lib/supabase*.ts`),
Neo4j (quan hệ khoá học–đề–lớp), Redis Streams + `worker/grading-worker.js` (chấm bất đồng bộ), Portkey/OpenAI, Gemini TTS.

## 2. Vai trò
| Vai trò | Mô tả |
| :--- | :--- |
| `ADMIN` | Quản trị tài khoản, giáo viên, học sinh, rubric, đơn đăng ký. Làm được mọi việc của `TEACHER`. |
| `TEACHER` | Tạo/sửa khoá học, đề thi, giáo trình của mình; chấm bài; quản lý lớp. Tự đăng ký thì ở chế độ dùng thử (`teacher_status = 'TRIAL'`, giới hạn DEC-027) đến khi admin xác minh. |
| `STUDENT` | Làm bài, xem kết quả và tiến độ của chính mình. |

## 3. Bất biến (không được phá)
1. **Xác thực:** phiên đăng nhập là JWT HS256 trong cookie httpOnly `auth_token` (`lib/jwt.ts`, `lib/auth.ts`). Không lưu token ở `localStorage`, không đọc vai trò từ body/query.
2. **Mọi API route trong `app/api/` phải kiểm tra phiên trước khi chạm DB/AI/queue**, trừ các route công khai có chủ đích: `app/api/auth/*` (có giới hạn số lần thử; đăng ký công khai chỉ tạo `STUDENT` hoặc `TEACHER` dùng thử, vai trò theo route), `app/api/classes/lookup/[ref]` (xem trước lớp qua link mời, chỉ trả trường công khai) và `app/api/leads` (form liên hệ landing, giới hạn theo IP). Không có phiên → `401`; sai vai trò → `403`. Thân lỗi: `{ success: false, error: string }`.
3. Danh tính người dùng lấy từ token (`userId`, `role`), **không bao giờ** từ `student_id`/`userId` client gửi lên khi người gọi là `STUDENT`.
4. `TEACHER` chỉ thao tác trên khoá học/đề do mình tạo (`created_by`); `ADMIN` thao tác mọi thứ.
5. Gọi nội bộ máy–máy (worker → API) xác thực bằng header `x-internal-token` khớp biến môi trường `INTERNAL_API_TOKEN` (không rỗng).
6. Mật khẩu luôn băm scrypt dạng `salt:hash`; không so sánh plaintext.
7. Bí mật (JWT, API key) chỉ đọc từ biến môi trường, không có giá trị dự phòng viết cứng trong mã.
8. Migration SQL đã có trong `docs/db-migration-00*.sql` không sửa; thay đổi schema là file migration mới.
9. Trình duyệt không truy cập DB trực tiếp: dữ liệu đi qua API route dùng `queryPg` (`lib/db-pg.ts`). Không dùng Supabase client cho dữ liệu nghiệp vụ.
10. Đồng bộ Neo4j là phụ: lỗi Neo4j được log, không làm hỏng giao dịch PostgreSQL chính.

## 4. Quy ước
- Phản hồi API: `{ success: true, ... }` hoặc `{ success: false, error }` với mã HTTP đúng nghĩa.
- Thông điệp lỗi hiển thị cho người dùng bằng tiếng Việt.
- Test: Vitest, đặt ở `tests/**/*.test.ts`, chạy `npm test`. Alias `@/` trỏ về gốc repo.
- `stitch_english_mock_exam_portal/` là mockup thiết kế, chỉ tham khảo, không sửa.

## 5. Bản đồ tài liệu & tính năng
Chuẩn duy nhất (DEC-036) — code lệch tài liệu thì sửa tài liệu theo code.
- `docs/01-overview.md` — sản phẩm, vai trò, phạm vi · `docs/02-modules-and-features.md` — phân hệ, menu, ma trận phân quyền
- `docs/03-screens-and-ui.md` — SCR-NN, điều hướng, quy tắc UI · `docs/04-user-flows.md` — UF-NN
- `docs/05-architecture.md` — stack, hàng đợi chấm, hạ tầng, deploy · `docs/06-database-schema.md` — bảng, migration 001–017
- `docs/07-api-contracts.md` — mọi endpoint + vai trò + test khoá · `docs/08-integrations.md` — AI, Storage, Redis, Neo4j, VietQR, TTS
- `docs/09-conventions.md` — thư mục, đặt tên, test, git · `docs/10-env-and-security.md` — `.env.example`, bất biến bảo mật, rủi ro mở
- `docs/11-tasks.md` — milestone, TASK-NNN, tồn đọng D1–D10 · `docs/12-business-rules.md` — BR-A/T/S/O/L/E/G/N/D/B, máy trạng thái
- `docs/13-test-cases-and-qa.md` — bản đồ test, ca bắt buộc, DoD · `docs/15-operations.md` — deploy, migration tay, cấu hình sau deploy, rollback
- `docs/archive/` — tài liệu cũ, không còn là chuẩn · `tests/docs-sync.test.ts` — đỏ khi code đổi mà docs chưa cập nhật
- `docs/14-decisions.md` — quyết định đã chốt (DEC), thắng khi mâu thuẫn.
- `docs/features/` — đặc tả từng FEAT:
- `docs/features/ai-exam-ingestion.md` — FEAT-009 AI Import DOCX/PDF/ảnh → đề thi.
- `docs/features/lesson-library.md` — FEAT-010 Kho bài học & học theo lộ trình lớp (TASK-007 → TASK-013).
- `docs/features/dang-ky-phong-van.md` — FEAT-012 Đăng nhập mới, đăng ký kiểu phỏng vấn, giáo viên dùng thử & xác minh (TASK-035 → TASK-037).
- `docs/features/quan-tri-he-thong.md` — FEAT-013 Tổng quan admin, đơn hàng slot + VietQR, chi phí AI, slot = học sinh (TASK-038 → TASK-043).
- `docs/features/cham-diem-bang-diem.md` — FEAT-014 Chấm & Bảng điểm theo lớp: bảng điểm từng bài, sửa điểm từng câu AI, chốt, tổng kết thang 10 (TASK-044 → TASK-047, DONE 06/11).
- `docs/db-migration-00N-*.sql` — migration theo thứ tự; `lib/db-pg.ts` `ensureSchema()` chạy cùng DDL.
- `handoff/KE-HOACH.md` — kế hoạch và tiến độ.
