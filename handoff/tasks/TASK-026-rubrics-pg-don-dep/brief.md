# TASK-026 — Rubric bằng pg, xoá route chết, bỏ mock-data trang lộ trình

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Dọn phần còn sót dùng Supabase phía server và dữ liệu giả:
1. `app/api/exam/rubrics/route.ts` (CRUD `scoring_rubrics`) đang dùng Supabase service client → chuyển sang `queryPg`, **giữ nguyên hợp đồng phản hồi** (các trang admin rubric, chuẩn chấm, `QuestionSetEditor` đang dùng).
2. Xoá `app/api/exam/categories/route.ts` và `app/api/exam/bind-lesson/route.ts`: bảng `exam_categories`/`lesson_exams` không tồn tại trong DB và không trang nào gọi.
3. `app/teacher/tests/page.tsx`: bỏ import `INITIAL_COURSES` từ `@/lib/mock-data`.

## 2. Tài liệu bắt buộc đọc
- `app/api/exam/rubrics/route.ts` (hiện trạng — giữ `inferFrameworkAndLanguage`, cách map `skill/framework/language`)
- `lib/api-auth.ts`, `docs/db-migration-009-scoring-standards.sql` (`scoring_standards.sections[].rubric_id`)
- Test: `tests/rubrics-pg.test.ts`

## 3. Phạm vi file
**Được sửa/xoá:** `app/api/exam/rubrics/route.ts`, xoá `app/api/exam/categories/route.ts` và `app/api/exam/bind-lesson/route.ts`, `app/teacher/tests/page.tsx` (chỉ xoá import).
**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, `lib/**`, route/trang khác, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả
- Giữ quyền: `GET` (ADMIN, TEACHER), `POST`/`PUT`/`DELETE` (ADMIN), `requireRole` dòng đầu.
- `GET` → `{ success: true, rubrics }`: mọi dòng `scoring_rubrics` sắp theo `created_at`, các cột số (`scale_min/max/step`) trả `number`, kèm `skill`/`framework`/`language` như hiện tại.
- `POST` `{ name, description?, scale_min?, scale_max?, scale_step?, criteria?, output_language?, id? }` — `name` trim rỗng → 400; mặc định thang 0/9/0.5, `criteria []`, `output_language "vi"`; id như hiện tại nếu không gửi → `{ success: true, rubric }` (201 hoặc 200).
- `PUT` `{ id, …trường cần sửa }` — thiếu `id` → 400; không có → 404; cập nhật trường gửi lên → `{ success: true, rubric }`.
- `DELETE ?id=` — thiếu → 400; rubric đang được chuẩn chấm tham chiếu (`EXISTS (SELECT 1 FROM scoring_standards, jsonb_array_elements(sections) s WHERE s->>'rubric_id' = $1)`) → 409; ngược lại xoá → 200. Nếu bảng `scoring_standards` chưa có thì bỏ qua kiểm tra (bắt lỗi).
- Lỗi trả `{ success: false, error }`.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-026`). `npx`, `git`, `find`, `ls` bị từ chối; **xoá file**: dùng công cụ xoá file của bạn nếu có, nếu không làm được thì ghi rõ trong report để trưởng phòng xoá.
- Không thêm thư viện mới.
