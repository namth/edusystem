# Báo cáo TASK-001

## Đã làm
- Tiêu chí 1: `verify.sh` chạy exit 0 (`tests/api-auth.test.ts` 90/90 tests pass toàn bộ + `tsc --noEmit` sạch không có lỗi).
- Tiêu chí 2: Mọi handler trong bảng 4.2 gọi kiểm tra quyền ở đầu hàm qua `requireRole` (hoặc `hasValidInternalToken`), trước mọi truy cập DB/AI/queue/body/params.
- Tiêu chí 3: Không route nào đọc vai trò từ body/query; danh tính và vai trò được xác thực an toàn từ cookie JWT HTTP-only.
- Tiêu chí 4: Xử lý sở hữu dữ liệu trong `app/api/submissions/route.ts` (POST và GET của STUDENT luôn áp dụng `student_id = auth.user.userId`), cập nhật client `app/student/exam/review/[submissionId]/page.tsx` gọi `/api/submissions` không kèm query `student_id`.
- Tiêu chí 5: Cấu hình middleware bảo vệ `/student/:path*` (ngoại lệ `/student/landing*`), bổ sung header `x-internal-token` cho `worker/grading-worker.js` và biến `INTERNAL_API_TOKEN` trong `docker-compose.yml`.

## File đã tạo/sửa
- `lib/api-auth.ts`: Tạo mới helper phân quyền API (`requireRole`, `hasValidInternalToken`).
- `middleware.ts`: Thêm bảo vệ `/student/:path*` (ngoại lệ `/student/landing*`), cập nhật `matcher`.
- `app/api/admin/create-user/route.ts`: Kiểm tra quyền ADMIN ở đầu handler trước khi parse body hay thao tác DB/Neo4j.
- `app/api/admin/delete-user/route.ts`: Kiểm tra quyền ADMIN ở đầu handler trước khi parse body hay thao tác DB/Neo4j.
- `app/api/admin/teachers/[id]/route.ts`: Kiểm tra quyền ADMIN ở đầu GET/PUT trước khi await params hay parse body.
- `app/api/admin/test-db/route.ts`: Kiểm tra quyền ADMIN ở đầu handler trước khi query DB.
- `app/api/admin/test-portkey/route.ts`: Kiểm tra quyền ADMIN ở đầu handler trước khi parse body hay gọi AI.
- `app/api/admin/test-supabase/route.ts`: Kiểm tra quyền ADMIN ở đầu handler trước khi khởi tạo hay gọi Supabase.
- `app/api/events/route.ts`: Kiểm tra quyền ADMIN/TEACHER ở đầu handler trước khi parse body hay push Redis.
- `app/api/exam/bind-lesson/route.ts`: Kiểm tra quyền ADMIN/TEACHER ở đầu handler trước khi thao tác DB/Kafka.
- `app/api/exam/categories/route.ts`: Yêu cầu đăng nhập cho GET trước khi truy vấn Supabase.
- `app/api/exam/grade-async/route.ts`: Cho phép worker thông qua `hasValidInternalToken(req)` hoặc yêu cầu vai trò ADMIN/TEACHER.
- `app/api/exam/grade-override/route.ts`: Kiểm tra quyền ADMIN/TEACHER ở đầu handler trước khi parse body hay thao tác DB.
- `app/api/exam/rubrics/route.ts`: Phân quyền GET (ADMIN/TEACHER), POST/PUT/DELETE (ADMIN) trước khi thao tác DB.
- `app/api/submissions/route.ts`: Yêu cầu đăng nhập; nếu role là STUDENT thì cố định `student_id = auth.user.userId` ở cả INSERT và GET filter.
- `app/api/tts/route.ts`: Yêu cầu đăng nhập cho GET trước khi tổng hợp giọng nói.
- `app/student/exam/review/[submissionId]/page.tsx`: Bỏ tham số `?student_id=student_01` trong fetch `/api/submissions`.
- `worker/grading-worker.js`: Gửi kèm header `x-internal-token: process.env.INTERNAL_API_TOKEN || ""` khi gọi `/api/exam/grade-async`.
- `docker-compose.yml`: Thêm biến môi trường `- INTERNAL_API_TOKEN=${INTERNAL_API_TOKEN}` cho các service `nextjs` và `grading-worker`.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-001-phan-quyen-api/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/learningsystem/.claude/worktrees/phoi-hop-antigravity-review-468cb6

 ✓ tests/api-auth.test.ts (90 tests) 275ms

 Test Files  1 passed (1)
      Tests  90 passed (90)
   Start at  07:59:12
   Duration  1.21s (transform 227ms, setup 0ms, collect 92ms, tests 275ms, environment 0ms, prepare 123ms)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
