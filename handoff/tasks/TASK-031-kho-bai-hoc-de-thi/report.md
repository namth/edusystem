# Báo cáo TASK-031

## Đã làm
- Mở rộng `GET /api/teacher/exams?q=`: giữ nguyên phân quyền và các trường cũ; bổ sung `skills` (mảng, null → `[]`), `duration_minutes`, `question_count` (độ dài `question_ids`, null → 0), `usage_count` (số dòng `curriculum_items` có `exam_id` tương ứng) trong một truy vấn SQL duy nhất; hỗ trợ lọc theo `?q=` (`title ILIKE %q%`) và sắp xếp mới nhất trước.
- Bổ sung `DELETE /api/teacher/exams/[id]`: kiểm tra quyền `requireRole(["ADMIN", "TEACHER"])`, trả 404 nếu không tồn tại, 403 nếu giáo viên không phải người tạo; kiểm tra số lượng đang dùng trong `curriculum_items`, `class_assignments`, `submissions` và trả 409 kèm `usages: { curriculum, assignments, submissions }` nếu đang dùng; xoá dòng `exams` (không xoá `questions`) và trả 200 `{ success: true }` khi chưa dùng ở đâu.
- Tạo `components/teacher/LessonLibraryPanel.tsx` chuyển nguyên giao diện và chức năng kho bài học từ `app/teacher/lessons/page.tsx` (bỏ `TeacherLayout` bọc ngoài).
- Tạo `components/teacher/ExamLibraryPanel.tsx` hiển thị danh sách kho đề thi giàu thông tin (tên, chip kỹ năng, `question_count`, `duration_minutes`, `usage_count`, ngày tạo), tìm kiếm có debounce (`?q=`), nút Tạo đề mới (`/teacher/tests/create`), nút phụ AI Import (`/admin/tests/import`), hành động Xem thử / Sửa / Xoá (xử lý 409 hiển thị chi tiết số mục lộ trình, lớp giao, bài nộp), và đủ 4 trạng thái (đang tải, lỗi kèm nút "Thử lại", rỗng, dữ liệu).
- Tạo trang `app/teacher/library/page.tsx` tiêu đề "Kho Bài Học & Đề Thi" với 2 tab "Bài học" / "Đề thi" đồng bộ qua `?tab=lessons|exams` (`router.replace`), bọc `useSearchParams` trong `Suspense`.
- Chuyển `app/teacher/lessons/page.tsx` thành trang chuyển hướng `redirect("/teacher/library?tab=lessons")` và cập nhật link quay lại trong `app/teacher/lessons/[id]/page.tsx` sang `/teacher/library?tab=lessons`.
- Cập nhật menu trong `components/TeacherLayout.tsx`: gộp thành mục "Kho Bài Học & Đề Thi" (`/teacher/library`, sáng khi ở `/teacher/library`, `/teacher/lessons*`, `/teacher/tests/create*`) và đổi tên mục `/teacher/tests` thành "Quản Lý Lộ Trình & Khóa Học" (chỉ sáng đúng `/teacher/tests`), đồng thời đổi tiêu đề `h1` của `app/teacher/tests/page.tsx`.

## File đã tạo/sửa
- `app/api/teacher/exams/route.ts` — Mở rộng `GET` trả thêm `skills`, `duration_minutes`, `question_count`, `usage_count` và lọc `?q=`.
- `app/api/teacher/exams/[id]/route.ts` — Thêm handler `DELETE` kiểm tra quyền sở hữu và ràng buộc sử dụng (409 kèm `usages`).
- `components/teacher/LessonLibraryPanel.tsx` — Panel danh sách kho bài học tách từ trang `/teacher/lessons`.
- `components/teacher/ExamLibraryPanel.tsx` — Panel danh sách kho đề thi mới với tìm kiếm, tạo/sửa/xem thử/xoá an toàn.
- `app/teacher/library/page.tsx` — Trang "Kho Bài Học & Đề Thi" gồm 2 tab "Bài học" và "Đề thi".
- `app/teacher/lessons/page.tsx` — Chuyển hướng sang `/teacher/library?tab=lessons`.
- `app/teacher/lessons/[id]/page.tsx` — Đổi các liên kết quay lại kho bài học sang `/teacher/library?tab=lessons`.
- `components/TeacherLayout.tsx` — Cập nhật `navItems` và logic `isActive` cho mục kho học liệu và lộ trình.
- `app/teacher/tests/page.tsx` — Đổi tiêu đề `h1` thành "Quản Lý Lộ Trình & Khóa Học".

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-031-kho-bai-hoc-de-thi/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/learningsystem/.claude/worktrees/drag-drop-exercises-roadmap-fe6c15

 ✓ tests/change-password.test.ts (6 tests) 17004ms
 ✓ tests/profile-slots-grading.test.ts (11 tests) 23539ms

 Test Files  40 passed (40)
      Tests  677 passed (677)
   Start at  14:39:08
   Duration  153.12s (transform 6.20s, setup 0ms, collect 7.27s, tests 1016.07s, environment 11ms, prepare 9.42s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
