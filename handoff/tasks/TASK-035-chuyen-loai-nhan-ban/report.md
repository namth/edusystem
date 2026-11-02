# Báo cáo TASK-035

## Đã làm
- [x] `verify.sh` exit 0 (46 file test / 771 test xanh, `tsc --noEmit` sạch lỗi).
- [x] `report.md` dán nguyên văn output `verify.sh`.
- [x] Hiện thực module server `lib/library-ops.ts` cho các thao tác dùng chung: đếm usages của bài học (`curriculum`, `attempts`) và đề thi (`curriculum`, `assignments`, `submissions`), sao chép sâu câu hỏi (`deepCopyQuestions`) tạo ID `q_` + uuid mới theo thứ tự `question_ids`, và chuyển đổi / nhân bản trong transaction riêng biệt (`getPgPool().connect()` → `BEGIN` / `COMMIT` / `ROLLBACK`).
- [x] Hiện thực API `POST /api/teacher/library/convert`: kiểm quyền `requireRole(["ADMIN", "TEACHER"])`, kiểm tra dữ liệu đầu vào (`from`, `ids` 1..50, `duration_minutes` nguyên ≥ 1), xử lý từng mục trong transaction độc lập, trả kết quả theo đúng thứ tự với các mã lý do `NOT_FOUND`, `FORBIDDEN`, `IN_USE` (kèm `usages`), `HAS_STIMULUS` (khi chuyển đề có bài đọc/audio chung sang bài học).
- [x] Hiện thực API `POST /api/teacher/lessons/[id]/duplicate` và `POST /api/teacher/exams/[id]/duplicate`: kiểm quyền, kiểm tra tên mới (1..255 ký tự sau trim), sao chép sâu toàn bộ câu hỏi trong `question_ids` thuộc về người đang thao tác và tạo bản sao trong một transaction, trả `201`.
- [x] Hiện thực component client `components/teacher/DuplicateDialog.tsx` dùng chung cho cả hai kho: điền sẵn `"<tên gốc> (bản sao)"`, tự focus và bôi đen, hỗ trợ phím `Enter` / `Escape`, khoá nút kèm spinner khi gửi, hiển thị lỗi trực tiếp trong hộp thoại, không import module server.
- [x] Cập nhật `components/teacher/ExamLibraryPanel.tsx` và `components/teacher/LessonLibraryPanel.tsx`: thêm nút "Nhân bản" trên từng thẻ, ô chọn từng mục + "Chọn tất cả", thanh hành động dính khi có mục được chọn, hộp xác nhận chuyển loại (kèm ô thời gian làm bài mặc định 30 phút khi chuyển bài học → đề thi) và hộp tóm tắt kết quả sau khi chuyển kèm lý do tiếng Việt cho từng mục bị bỏ qua.

## File đã tạo/sửa
- `lib/library-ops.ts`: Logic dùng chung phía server để kiểm usages, sao chép sâu câu hỏi, chuyển loại từng mục và nhân bản bài học/đề thi trong transaction.
- `app/api/teacher/library/convert/route.ts`: API `POST` chuyển đổi hàng loạt bài học ↔ đề thi theo danh sách `ids`.
- `app/api/teacher/lessons/[id]/duplicate/route.ts`: API `POST` nhân bản bài học kèm sao chép sâu câu hỏi.
- `app/api/teacher/exams/[id]/duplicate/route.ts`: API `POST` nhân bản đề thi kèm sao chép sâu câu hỏi.
- `components/teacher/DuplicateDialog.tsx`: Hộp thoại client đặt tên mới khi nhân bản bài học hoặc đề thi.
- `components/teacher/ExamLibraryPanel.tsx`: Bổ sung chọn nhiều, chuyển sang bài học và nhân bản đề thi.
- `components/teacher/LessonLibraryPanel.tsx`: Bổ sung chọn nhiều, chuyển sang đề thi (có đặt thời gian làm bài) và nhân bản bài học.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-035-chuyen-loai-nhan-ban/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/agy-worktrees/TASK-035

 ✓ tests/grading.test.ts (33 tests) 181ms
 ✓ tests/lesson-player.test.ts (19 tests) 179ms
 ✓ tests/student-home.test.ts (4 tests) 31ms
 ✓ tests/standard-selection.test.ts (6 tests) 32588ms
 ✓ tests/exam-layout.test.ts (23 tests) 36ms
 ✓ tests/exam-runner-ui.test.ts (13 tests) 84ms
 ✓ tests/lesson-library-ui.test.ts (13 tests) 56ms
 ✓ tests/brand-tokens.test.ts (3 tests) 183ms
 ✓ tests/class-roadmap-ui.test.ts (12 tests) 29ms
 ✓ tests/score-display.test.ts (11 tests) 10ms
 ✓ tests/roadmap.test.ts (14 tests) 6ms
 ✓ tests/stimulus-html.test.ts (6 tests) 6ms
 ✓ tests/env-check.test.ts (4 tests) 3ms
 ✓ tests/curriculum-dnd.test.ts (16 tests) 4ms
 ✓ tests/grading-hardening.test.ts (5 tests) 7ms
 ✓ tests/attempt-summary.test.ts (10 tests) 11ms

 Test Files  46 passed (46)
      Tests  771 passed (771)
   Start at  13:31:25
   Duration  619.51s (transform 65.71s, setup 0ms, collect 33.27s, tests 2364.39s, environment 23ms, prepare 16.76s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
