# Báo cáo TASK-004

## Đã làm
- Tạo route `GET /api/exams` trả danh sách đề thi luyện tập (`id, title, duration_minutes, skills, created_at`) sắp xếp mới nhất trước, kiểm tra phiên đăng nhập bằng `requireRole()`, không trả `stimulus_text` hay `question_ids`.
- Cập nhật `app/student/dashboard/page.tsx`: Chuyển sang gọi `GET /api/student/classes`, `GET /api/submissions`, `POST /api/student/enroll` bằng `fetch`; bỏ hoàn toàn Supabase client, Neo4j import và dữ liệu mẫu viết cứng (`teacherName`, `studentCount`, `test_01`, v.v.); xử lý đầy đủ các mã phản hồi khi ghi danh (`alreadyEnrolled`, `404`, `409`); cung cấp đủ 4 trạng thái (đang tải, lỗi + Thử lại, rỗng, có dữ liệu).
- Cập nhật `app/student/class/[classId]/page.tsx`: Chuyển sang gọi `GET /api/student/classes/[classId]` và `GET /api/exams`; xử lý trạng thái 403 (chưa tham gia lớp) và 404 (không tìm thấy lớp); ánh xạ bài được giao từ assignments (đề `exam === null` hiển thị tiêu đề "Đề thi không còn tồn tại" và không có nút làm bài); tab bài đã chấm lấy điểm thật `final_score ?? ai_score` (hiển thị "Chưa chấm" khi null); tab luyện tập nạp danh sách đề từ `/api/exams`; cung cấp đủ 4 trạng thái cho từng tab và toàn trang.
- Cập nhật `app/student/analytics/page.tsx`: Chuyển sang gọi `GET /api/submissions` và `GET /api/exams`; xoá bỏ toàn bộ thuật toán mô phỏng điểm kỹ năng từ `ai_score`, lấy điểm thật từ các cột kỹ năng (hiển thị "—" khi null); tính `avgScore` thật trên các bài có điểm; hiển thị trạng thái rỗng khi học sinh chưa làm bài nào kèm link về dashboard, không hiển thị biểu đồ giả; hỗ trợ nút Thử lại khi có lỗi.
- Xoá thư mục `app/student/test/` (trang cũ schema đề cũ).
- Toàn bộ test suite Vitest và TypeCheck (`verify.sh`) chạy pass 100%.

## File đã tạo/sửa
- `app/api/exams/route.ts`: Endpoint GET danh sách đề thi luyện tập rút gọn cho học sinh.
- `app/student/dashboard/page.tsx`: Trang dashboard học sinh gọi API pg, bỏ Supabase và mock data.
- `app/student/class/[classId]/page.tsx`: Trang chi tiết lớp học sinh gọi API pg, xử lý 403/404, bỏ Supabase và mock data.
- `app/student/analytics/page.tsx`: Trang phân tích học tập học sinh gọi API pg, điểm kỹ năng thật, bỏ dữ liệu giả.
- `app/student/test/`: Xoá thư mục chứa trang kiểm tra schema cũ.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-004-trang-hoc-sinh-pg/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/learningsystem/.claude/worktrees/phoi-hop-antigravity-review-468cb6

 ✓ tests/api-auth.test.ts (87 tests) 705ms
 ✓ tests/secrets-password.test.ts (16 tests) 755ms
 ✓ tests/student-pages.test.ts (18 tests) 12118ms
 ✓ tests/student-api.test.ts (28 tests) 17000ms

 Test Files  4 passed (4)
      Tests  149 passed (149)
   Start at  08:35:35
   Duration  17.53s (transform 529ms, setup 0ms, collect 475ms, tests 30.58s, environment 0ms, prepare 358ms)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
