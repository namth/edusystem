# Báo cáo TASK-026

## Đã làm
- Chuyển `app/api/exam/rubrics/route.ts` (CRUD `scoring_rubrics`) từ Supabase service client sang `queryPg`, loại bỏ hoàn toàn Supabase, giữ nguyên hợp đồng phản hồi cho admin rubrics, chuẩn chấm điểm, và `QuestionSetEditor`.
- Giữ đầy đủ phân quyền theo đặc tả: `GET` (ADMIN, TEACHER), `POST`/`PUT`/`DELETE` (ADMIN) với `requireRole` đặt ở đầu route.
- Xử lý các nghiệp vụ của rubric:
  - `GET`: trả danh sách rubrics sắp theo `created_at`, ép kiểu các cột số `scale_min`, `scale_max`, `scale_step` sang `number`, kèm `skill`, `framework`, `language` suy luận qua `inferFrameworkAndLanguage`.
  - `POST`: validate `name` không rỗng (400 nếu rỗng), áp dụng các giá trị mặc định thang 0-9 bước 0.5, `criteria []`, `output_language "vi"`, trả rubric tạo mới với status 201.
  - `PUT`: validate thiếu `id` (400), kiểm tra rubric tồn tại (404 nếu không tìm thấy), cập nhật các trường được truyền lên và trả dữ liệu rubric đã cập nhật (200).
  - `DELETE`: validate thiếu `id` (400), kiểm tra nếu rubric đang được chuẩn chấm tham chiếu trong `scoring_standards.sections[].rubric_id` thì trả 409 Conflict, ngược lại xoá thành công (200). Bỏ qua kiểm tra nếu bảng `scoring_standards` chưa tồn tại.
- Xoá hai route chết không có bảng trong cơ sở dữ liệu và không còn trang nào gọi: `app/api/exam/categories/route.ts` và `app/api/exam/bind-lesson/route.ts`.
- Bỏ import không sử dụng `INITIAL_COURSES` từ `@/lib/mock-data` trong `app/teacher/tests/page.tsx`.
- Chạy tự kiểm `python3 scripts/handoff.py verify TASK-026`: 31/31 test files passed (580/580 tests), type check tsc không lỗi, exit 0.

## File đã tạo/sửa
- `app/api/exam/rubrics/route.ts`: Chuyển CRUD sang `queryPg`, loại bỏ hoàn toàn việc dùng Supabase.
- `app/api/exam/categories/route.ts`: Xoá route chết.
- `app/api/exam/bind-lesson/route.ts`: Xoá route chết.
- `app/teacher/tests/page.tsx`: Xoá import `INITIAL_COURSES` từ `@/lib/mock-data`.

## Kết quả tự kiểm
```
 Test Files  31 passed (31)
      Tests  580 passed (580)
   Start at  22:52:14
   Duration  75.04s (transform 2.85s, setup 0ms, collect 3.16s, tests 489.30s, environment 6ms, prepare 4.56s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
