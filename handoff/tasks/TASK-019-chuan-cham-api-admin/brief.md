# TASK-019 — API chuẩn chấm + trang admin + rubric-resolver bằng pg

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
FEAT-011 phần quản trị chuẩn chấm (DEC-014, DEC-015): API CRUD `scoring_standards`, trang admin SCR-E1 để định nghĩa phần thi theo kỹ năng (thang, tuyến tính/bảng tra, rubric AI) và quy tắc điểm tổng; `lib/rubric-resolver.ts` bỏ Supabase trình duyệt, lấy rubric tiêu chí theo chuẩn chấm của đề.

## 2. Tài liệu bắt buộc đọc
- `docs/features/exam-server-grading.md` mục 2, 4 (SCR-E1), 5 (cấu trúc JSON), 6, 7 (BR-E01); `docs/14-decisions.md` DEC-014, DEC-015
- `docs/db-migration-009-scoring-standards.sql` (bảng + seed)
- `lib/rubric-resolver.ts`, `types/scoring.ts`, `app/admin/rubrics/page.tsx` (tham khảo phong cách trang admin), `components/AdminLayout.tsx`
- Test: `tests/scoring-standards-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:** `app/api/scoring-standards/route.ts` (mới: GET, POST), `app/api/scoring-standards/[id]/route.ts` (mới: PUT, DELETE), `app/admin/scoring-standards/page.tsx` (mới), `components/AdminLayout.tsx` (thêm 1 mục menu), `lib/rubric-resolver.ts`.

**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, `lib/db-pg.ts`, `lib/grading.ts`, `lib/exam-scoring.ts` (TASK-018 đang làm song song), các route/trang khác, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả chi tiết
### 4.1 API — `requireRole` dòng đầu; SQL tham số hoá; lỗi `{ success: false, error }`
- `GET /api/scoring-standards` (ADMIN, TEACHER) → `200 { standards }` — mọi chuẩn `{ id, name, framework, description, sections, aggregation, is_system, created_by, created_at, updated_at }`, chuẩn hệ thống trước rồi theo `name`.
- `POST` (ADMIN) `{ name, framework?, description?, sections, aggregation }` → validate (4.2) → `id = "std_" + crypto.randomUUID()`, `is_system = false`, `created_by = userId` → `201 { success, standard }`.
- `PUT [id]` (ADMIN) → không có 404; chỉ cập nhật trường gửi lên, validate như POST cho trường đó (sections/aggregation validate cùng nhau với giá trị hiện có); được sửa cả chuẩn hệ thống (giữ `is_system`); cập nhật `updated_at` → `200 { success, standard }`.
- `DELETE [id]` (ADMIN) → không có 404; `is_system` → 409; đang được dùng (`exams.scoring_standard_id` hoặc `courses.default_scoring_standard_id`) → `409 { success: false, error, usage: { exams: n, courses: m } }`; ngược lại xoá → `200`.

### 4.2 Validate (sai bất kỳ → 400, không ghi)
- `name` sau `trim` 1–150 ký tự.
- `sections`: mảng không rỗng; mỗi phần `skill` ∈ `Reading|Listening|Writing|Speaking`, **không trùng**; `min`, `max`, `step` là số, `min < max`, `step > 0`; `conversion` ∈ `LINEAR|TABLE`.
  - `TABLE`: `table` mảng không rỗng, `min_correct` số nguyên ≥ 0 **tăng dần nghiêm ngặt**, mỗi `score` trong `[min, max]`; `table_question_count` số nguyên ≥ 1.
  - `rubric_id` (tuỳ chọn) phải tồn tại trong `scoring_rubrics`.
- `aggregation`: `method` ∈ `AVERAGE|SUM|WEIGHTED`; `round_step > 0`; `weights` (nếu có) mỗi giá trị số ≥ 0; `pass_score` (nếu có) là số; `section_min` (nếu có) chỉ chứa kỹ năng có trong `sections`, giá trị là số.

### 4.3 `lib/rubric-resolver.ts`
- Bỏ import `@/lib/supabase`; dùng `queryPg`. Giữ nguyên các hằng `DEFAULT_*_RUBRIC` và `ALL_OFFICIAL_STANDARDS_RUBRICS`.
- `resolveRubricForExam(examId?, skillCategory?)`: kỹ năng từ `skillCategory` (`SPEAKING*` → Speaking, `WRITING*` → Writing, còn lại Reading). Chuẩn áp dụng: `exams.scoring_standard_id` → `courses.default_scoring_standard_id` của khóa chứa đề (qua `curriculum_items.exam_id`) → `std_internal_10`. Lấy phần của kỹ năng trong chuẩn; nếu phần có `rubric_id` thì đọc dòng `scoring_rubrics` (tiêu chí, `output_language`) làm rubric; không có thì dùng default theo kỹ năng như cũ. **Thang (`scale`) luôn lấy theo phần của chuẩn** (`min/max/step`). Lỗi DB → trả default như cũ (log cảnh báo).

### 4.4 Trang SCR-E1 `app/admin/scoring-standards/page.tsx` (bọc `AdminLayout`)
- Danh sách chuẩn (nhãn "Hệ thống" khi `is_system`), nút Tạo / Sửa / Xoá (ẩn Xoá với chuẩn hệ thống; 409 → hiện `json.error` và số đề/khóa đang dùng).
- Form: tên, khung (`framework`), mô tả; **phần thi** (thêm/xoá dòng; mỗi dòng chọn kỹ năng, min, max, step, cách quy đổi `LINEAR`/`TABLE`; với `TABLE` có `table_question_count` và bảng `min_correct → score` thêm/xoá dòng; với Writing/Speaking chọn `rubric_id` từ `GET /api/exam/rubrics`); **quy tắc tổng** (`AVERAGE`/`SUM`/`WEIGHTED`, `round_step`, trọng số theo kỹ năng khi WEIGHTED, `pass_score`, `section_min` theo kỹ năng). Hiện lỗi validate từ API.
- Đủ trạng thái tải / lỗi + "Thử lại" / rỗng.
- `components/AdminLayout.tsx`: thêm `{ href: "/admin/scoring-standards", label: "Chuẩn Chấm Điểm", icon: <lucide phù hợp, vd Scale> }` cạnh mục rubric.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-019`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- `GET /api/exam/rubrics` hiện còn dùng Supabase phía server — chỉ gọi, không sửa route đó.
- Không thêm thư viện mới.
