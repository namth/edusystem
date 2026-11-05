# Báo cáo TASK-046

## Đã làm
- **SCR-31 Hub Chấm & Bảng điểm (`/teacher/grading`)**:
  - Chọn lớp qua dropdown, đồng bộ URL `?class=<classId>&tab=items|summary` với `router.replace`.
  - Bọc phần đọc `useSearchParams` trong `<Suspense>` theo đúng yêu cầu Next.js client component.
  - Tab "Danh sách bài": lọc loại (Tất cả / Bài học / Đề thi), checkbox "Chỉ bài còn việc", hiển thị số bài đã nộp kèm trạng thái `KQ` và `AI`. Điều hướng sang SCR-51 bằng `router.push('/teacher/grading/${classId}/${kind}/${itemId}')`.
  - Tab "Tổng kết lớp": hiển thị ma trận học sinh × bài đã chốt, cột Điểm trung bình (`average10`), ô rỗng hiển thị text "Chưa nộp".
  - Đầy đủ 4 trạng thái UI: Skeleton loading, Empty state ("Bạn chưa có lớp nào", "Lớp chưa có bài học/đề nào trong lộ trình hoặc được giao"), Error state có nút "Thử lại".
- **SCR-51 Bảng điểm một bài (`/teacher/grading/[classId]/[kind]/[itemId]`)**:
  - Header hiển thị tên bài, thông tin lớp, nút quay lại hub, trạng thái chốt/chưa chốt điểm.
  - Quy trình Chốt bảng điểm: gọi POST `.../finalize`. Bắt mã lỗi 409 `UNREVIEWED` để hiển thị `GradingFinalizeModal` với câu hỏi xác nhận: `Còn ${unreviewedCount} bài AI chưa xem. Vẫn chốt theo điểm hiện tại?`. Bắt mã lỗi 409 `GRADING_PENDING` hiển thị toast cảnh báo AI đang chấm. Khi xác nhận thì gọi lại POST `.../finalize` với `confirmUnreviewed: true`.
  - Nút "Mở chốt" gọi POST `.../reopen`, hiển thị băng thông báo "Đã chốt dd/mm — mở chốt để sửa".
  - Bảng điểm hiển thị danh sách học sinh theo `columns`, trạng thái nộp, điểm 10 (`score10`), số câu đúng, trạng thái AI, nút mở ngăn chấm.
  - Nhập điểm tay cho học sinh chưa nộp: ô nhập số `manual_score10` (0-10) và ghi chú `manual_note`, tự động lưu qua PUT `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}/students/${studentId}`.
- **Ngăn chấm `GradingDrawer`**:
  - Lựa chọn lượt nộp (attempt), đánh dấu `★` cho lượt đang được tính điểm, nút "Tính lượt này" và nút "Bỏ chọn" (đặt `score_attempt_id` thành `null`).
  - Hiển thị bài làm học sinh, audio player speaking với thẻ `<audio`, audio flashcard.
  - Form chấm câu AI: ô điểm giáo viên với kiểm tra min, max, step và nhận xét tối đa 2000 ký tự.
  - Nút "Lưu & đánh dấu đã duyệt" gọi PUT `/api/teacher/grading/attempts/${kind}/${attemptId}` với payload `{ teacher_overrides, teacher_feedback, mark_reviewed: true }`.
- **SCR-21 Trang lớp (`app/teacher/classes/[classId]/page.tsx`)**:
  - Gỡ bỏ hoàn toàn tab "Sổ điểm" cũ và modal duyệt bài (`openSubmissionReviewModal`, `handleSaveTeacherReview`, `/api/exam/grade-override`).
  - Thêm tab "Đề giao" và nút "Mở bảng điểm" dẫn tới `/teacher/grading?class=${classId}`.
- **Menu điều hướng**: Cập nhật nhãn sidebar trong `components/TeacherLayout.tsx` thành "Chấm & Bảng điểm".
- **Tài liệu**: Cập nhật `docs/03-screens-and-ui.md` chuyển trạng thái SCR-31, SCR-51, SCR-21 sang `DONE`.
- **Quy chuẩn mã nguồn**: Tất cả file mới và component đều tách nhỏ (< 450 dòng), không dùng mã màu hex, nhãn nút không bắt đầu bằng `+ `.

## File đã tạo/sửa
- `app/teacher/grading/page.tsx`: Màn hình SCR-31 Hub Chấm & Bảng điểm (sửa).
- `app/teacher/grading/[classId]/[kind]/[itemId]/page.tsx`: Màn hình SCR-51 Bảng điểm bài học/đề thi (tạo mới).
- `components/teacher/grading/GradingToast.tsx`: Component thông báo trạng thái toast (tạo mới).
- `components/teacher/grading/GradingFinalizeModal.tsx`: Hộp thoại xác nhận chốt bảng điểm khi còn bài AI chưa duyệt (tạo mới).
- `components/teacher/grading/GradingDrawer.tsx`: Ngăn kéo chấm điểm và duyệt bài làm (tạo mới).
- `components/teacher/grading/GradingQuestionItem.tsx`: Hiển thị chi tiết từng câu hỏi khách quan/AI/speaking trong drawer (tạo mới).
- `components/teacher/grading/GradingItemHeader.tsx`: Thanh tiêu đề và các thao tác Chốt/Mở chốt cho SCR-51 (tạo mới).
- `components/teacher/grading/GradingItemTable.tsx`: Bảng danh sách học sinh và điểm số của từng cột cho SCR-51 (tạo mới).
- `components/teacher/grading/GradingHubItemsTab.tsx`: Bảng danh sách bài học và đề thi của lớp cho SCR-31 (tạo mới).
- `components/teacher/grading/GradingHubSummaryTab.tsx`: Bảng ma trận tổng kết lớp cho SCR-31 (tạo mới).
- `components/TeacherLayout.tsx`: Cập nhật nhãn sidebar menu thành "Chấm & Bảng điểm" (sửa).
- `app/teacher/classes/[classId]/page.tsx`: Cập nhật SCR-21 gỡ bỏ sổ điểm cũ, thêm tab Đề giao và nút Mở bảng điểm (sửa).
- `docs/03-screens-and-ui.md`: Cập nhật trạng thái SCR-31, SCR-51, SCR-21 thành DONE (sửa).
- `app/teacher/tests/page.tsx`: Đổi đường dẫn `href="/admin/tests/import"` sang `href="/teacher/library"` để bảo đảm cách ly vai trò giáo viên (sửa).
- `next.config.ts`: Cấu hình `outputFileTracingRoot` để Turbopack hỗ trợ symlink `node_modules` trong git worktree (sửa).
- `tests/profile-slots-grading.test.ts`: Đồng bộ test case di sản kiểm tra trang grading sau khi bỏ endpoint `/api/teacher/submissions` (sửa).

## Kết quả tự kiểm
```
Test Files  60 passed (60)
     Tests  1115 passed (1115)
  Start at  02:57:09
  Duration  132.89s (transform 3.86s, setup 0ms, collect 3.78s, tests 514.88s, environment 8ms, prepare 3.51s)

▲ Next.js 16.2.10 (Turbopack)

⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
  Creating an optimized production build ...
✓ Compiled successfully in 7.3s
  Finished TypeScript in 8.1s    ✓ Finished TypeScript in 8.1s 
⚡ [Redis Streams] Connected to Redis Queue Server.
⚡ [Redis Streams] Connected to Redis Queue Server.
⚡ [Redis Streams] Connected to Redis Queue Server.
  Collecting page data using 7 workers in 625ms    ✓ Collecting page data using 7 workers in 625ms 
⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3000". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
✓ Generating static pages using 7 workers (90/90) in 335ms
  Finalizing page optimization in 488ms    ✓ Finalizing page optimization in 488ms 

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
- **Test di sản `tests/profile-slots-grading.test.ts`**: Test cũ kiểm tra `app/teacher/grading/page.tsx` có chứa string `"/api/teacher/submissions"`. Do TASK-045 đã thay thế endpoint này bằng `/api/teacher/grading/classes` và test contract `tests/teacher-grading-ui.test.ts` của TASK-046 bắt buộc `not.toContain("/api/teacher/submissions")`, test case di sản đã được cập nhật sang kiểm tra `/api/teacher/grading/classes`.
- **Cách ly vai trò giáo viên**: Trong `app/teacher/tests/page.tsx` có một thẻ `<Link href="/admin/tests/import">` trỏ sang admin, vi phạm test case `teacher pages must not link to /admin`. Đã cập nhật link này sang `/teacher/library`.
- **Next.js Turbopack trong worktree**: Worktree được cấu hình symlink `node_modules` trỏ ra ngoài project root, khiến Turbopack panic `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. Đã bổ sung cấu hình chuẩn `outputFileTracingRoot: path.resolve(__dirname, "../../")` trong `next.config.ts` để Turbopack nhận diện đúng root của workspace.
