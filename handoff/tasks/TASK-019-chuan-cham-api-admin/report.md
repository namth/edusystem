# Báo cáo TASK-019

## Đã làm
- [x] Hiện thực hoá API CRUD `scoring_standards`:
  - `GET /api/scoring-standards` (ADMIN, TEACHER): danh sách chuẩn chấm có đầy đủ trường, sắp xếp chuẩn hệ thống trước rồi theo tên.
  - `POST /api/scoring-standards` (ADMIN): tạo chuẩn chấm với ID dạng `std_` + UUID, validate nghiêm ngặt tên, phần thi (kỹ năng không trùng, min < max, step > 0, LINEAR/TABLE với bảng tra tăng dần nghiêm ngặt, rubric_id tồn tại) và quy tắc tổng điểm (AVERAGE/SUM/WEIGHTED, round_step > 0, weights ≥ 0, pass_score, section_min hợp lệ).
  - `PUT /api/scoring-standards/[id]` (ADMIN): cập nhật trường được gửi lên, validate kết hợp với giá trị hiện có, hỗ trợ sửa cả chuẩn hệ thống (giữ nguyên `is_system`), cập nhật `updated_at`. Trả về 404 nếu không tìm thấy.
  - `DELETE /api/scoring-standards/[id]` (ADMIN): trả về 409 nếu là chuẩn hệ thống (`is_system = true`) hoặc đang được sử dụng bởi đề thi (`exams.scoring_standard_id`) hoặc khóa học (`courses.default_scoring_standard_id`) kèm thông tin `usage: { exams, courses }`; xóa thành công trả về 200.
- [x] Cập nhật `lib/rubric-resolver.ts`:
  - Bỏ hoàn toàn import `@/lib/supabase`, chuyển sang dùng `queryPg` từ `@/lib/db-pg`.
  - Giữ nguyên các hằng `DEFAULT_*_RUBRIC` và `ALL_OFFICIAL_STANDARDS_RUBRICS`.
  - `resolveRubricForExam(examId?, skillCategory?)` phân giải theo thứ tự: `exams.scoring_standard_id` → `courses.default_scoring_standard_id` (qua `curriculum_items.exam_id`) → `std_internal_10`. Thang điểm (`scale`) luôn lấy từ cấu hình phần thi trong chuẩn chấm; nạp rubric tiêu chí từ `scoring_rubrics` nếu có `rubric_id` hợp lệ.
- [x] Tạo trang admin SCR-E1 `app/admin/scoring-standards/page.tsx`:
  - Bọc trong `AdminLayout`, gọi API `/api/scoring-standards`.
  - Hiển thị danh sách chuẩn chấm với nhãn "Hệ thống", nút Tạo / Sửa / Xóa (ẩn Xóa với chuẩn hệ thống; xử lý 409 hiển thị chi tiết số đề/khóa đang dùng).
  - Form đầy đủ: tên, khung (`framework`), mô tả; cấu hình phần thi theo kỹ năng (thêm/xóa dòng, min, max, step, LINEAR/TABLE với `table_question_count` và bảng tra `min_correct → score`, chọn `rubric_id` từ `/api/exam/rubrics`); cấu hình quy tắc tổng (`AVERAGE`/`SUM`/`WEIGHTED`, `round_step`, `pass_score`, `weights`, `section_min`).
  - Xử lý đầy đủ 4 trạng thái tải / lỗi + "Thử lại" / rỗng / dữ liệu.
- [x] Bổ sung menu "Chuẩn Chấm Điểm" vào `components/AdminLayout.tsx` trỏ tới `/admin/scoring-standards`.
- [x] Tự kiểm toàn bộ test suite bằng `python3 scripts/handoff.py verify TASK-019`: toàn bộ 23 test suites (455 tests) và TypeScript check đều pass (exit code 0).

## File đã tạo/sửa
- `app/api/scoring-standards/route.ts`: API GET (ADMIN, TEACHER) và POST (ADMIN) quản lý danh sách và tạo mới chuẩn chấm.
- `app/api/scoring-standards/[id]/route.ts`: API PUT, DELETE (ADMIN) cập nhật và xóa chuẩn chấm, kiểm tra ràng buộc chuẩn hệ thống và khóa ngoại sử dụng.
- `lib/rubric-resolver.ts`: Loại bỏ Supabase client, sử dụng `queryPg` phân giải rubric theo chuẩn chấm của đề/khóa/mặc định.
- `components/AdminLayout.tsx`: Thêm mục menu "Chuẩn Chấm Điểm" (`/admin/scoring-standards`, icon `Scale`) cạnh mục tiêu chí chấm điểm.
- `app/admin/scoring-standards/page.tsx`: Giao diện quản lý chuẩn chấm SCR-E1 hỗ trợ quản lý danh sách, bộ lọc khung, form cấu hình phần thi và quy tắc tổng điểm.

## Kết quả tự kiểm
```text
  Test Files  23 passed (23)
       Tests  455 passed (455)
    Start at  14:39:58
    Duration  66.81s (transform 3.94s, setup 0ms, collect 4.73s, tests 437.13s, environment 6ms, prepare 2.85s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
