# Báo cáo TASK-058

## Đã làm
- [x] Tách riêng fetch `/api/exams` và `/api/submissions`: Khi `/api/exams` lỗi, trang vẫn hiển thị điểm và biểu đồ năng lực 4 kỹ năng (`Overall Performance`), tên đề dùng fallback "Đề thi" kèm banner cảnh báo nhẹ màu hổ phách (`examsWarning`), không làm trắng trang hay gây error state toàn trang.
- [x] Hiển thị nhận xét AI (`ai_feedback`):
  - Chuỗi thuần: hiển thị nguyên chuỗi.
  - Chuỗi JSON hoặc Object/Array: chuyển đổi và render thành danh sách đọc được theo từng tiêu chí hoặc bullet list, không in JSON thô (`JSON.stringify`), không hiển thị `[object Object]`.
  - Fallback mặc định: "Chưa có nhận xét."
- [x] Nhãn đề thi:
  - Khi API exams hoạt động bình thường nhưng không tìm thấy đề trong `examsMap`: hiển thị "Đề thi đã gỡ".
  - Khi API exams gặp lỗi: hiển thị tên dự phòng "Đề thi".
- [x] Lọc submission: Loại bỏ các bài nộp có `status === "IN_PROGRESS"`, chỉ hiển thị và thống kê số bài đã nộp ("Tests Taken").
- [x] Trạng thái rỗng: Hiển thị thông báo tiếng Việt có dấu "Bạn chưa làm bài thi nào." kèm liên kết về trang chủ học sinh khi danh sách bài nộp sau lọc rỗng.
- [x] Đủ 4 trạng thái giao diện: Đang tải (loading với Loader2), Rỗng (empty state), Lỗi tải dữ liệu (error với nút Thử lại, không in mã HTTP thô), Có dữ liệu (hiển thị đầy đủ danh sách và biểu đồ).

## File đã tạo/sửa
- `app/student/analytics/page.tsx`: Cập nhật xử lý lỗi `/api/exams`, định dạng `ai_feedback` sang danh sách dễ đọc, đặt fallback tên đề "Đề thi đã gỡ" / "Đề thi", lọc bỏ `IN_PROGRESS`, bổ sung banner cảnh báo nhẹ khi tải đề thi thất bại, và tối ưu cú pháp createElement/imports tương thích với standalone TypeScript CLI.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-058-student-analytics-robust/verify.sh
=== TASK-058: Analytics học sinh — chịu lỗi API, nhận xét AI, nhãn đề đã xoá ===
--- Chạy test nghiệm thu TASK-058 ---

 RUN  v3.2.7 /Users/namtran/agy-farm/worktrees/TASK-058


 ❯ tests/student-analytics-robust.test.ts [queued]

 Test Files 0 passed (1)
      Tests 0 passed (0)
   Start at 00:34:26
   Duration 270ms
 ✓ tests/student-analytics-robust.test.ts (26 tests) 14ms
   ✓ 1. Chịu lỗi /api/exams — trang vẫn hiển thị điểm/biểu đồ (5)
     ✓ file app/student/analytics/page.tsx phải tồn tại 1ms
     ✓ fetch /api/exams phải tách riêng khỏi fetch /api/submissions — lỗi exams không throw chung 1ms
     ✓ khi exams lỗi, dùng tên dự phòng 'Đề thi' (không phải 'Đề thi đã gỡ') cho tất cả bài 0ms
     ✓ khi exams lỗi, có hiện cảnh báo nhẹ cho người dùng (không trắng trang) 0ms
     ✓ submissions vẫn hiển thị khi exams fail — setSubmissions KHÔNG bị bỏ qua 0ms
   ✓ 2. Nhận xét AI — hiển thị đúng chuỗi, object, mảng (không JSON thô) (5)
     ✓ khi ai_feedback là object, KHÔNG dùng JSON.stringify trực tiếp để hiển thị 1ms
     ✓ khi ai_feedback là object/mảng, có logic chuyển thành danh sách hoặc đoạn text đọc được 0ms
     ✓ khi ai_feedback là chuỗi thuần, hiển thị nguyên chuỗi 0ms
     ✓ không hiển thị [object Object] trong giao diện 1ms
     ✓ feedback 'Chưa có nhận xét.' vẫn là giá trị mặc định khi không có feedback 0ms
   ✓ 3. Nhãn đề đã xoá và lọc IN_PROGRESS (3)
     ✓ đề không tìm thấy trong danh sách exams hiển thị 'Đề thi đã gỡ' 0ms
     ✓ lọc bỏ submission có status IN_PROGRESS — chỉ hiện bài đã nộp 0ms
     ✓ số bài 'Tests Taken' phản ánh đúng số lượng sau khi lọc IN_PROGRESS 0ms
   ✓ 4. Trạng thái rỗng tiếng Việt khi chưa có bài nào (2)
     ✓ có thông báo rỗng tiếng Việt có dấu 0ms
     ✓ trạng thái rỗng hiển thị khi danh sách submissions rỗng SAU KHI lọc IN_PROGRESS 0ms
   ✓ 5. Đủ 4 trạng thái UI (4)
     ✓ có trạng thái đang tải (loading) 0ms
     ✓ có trạng thái lỗi khi submissions fail, với nút 'Thử lại' 0ms
     ✓ trạng thái lỗi KHÔNG hiện mã HTTP thô (không hiện status code số) 0ms
     ✓ có trạng thái có dữ liệu hiển thị danh sách bài 0ms
   ✓ 6. An toàn — không import DB, không link admin/teacher (3)
     ✓ không import trực tiếp DB/Supabase/mock 0ms
     ✓ không có link dẫn sang /teacher hoặc /admin 0ms
     ✓ không có màu hex viết cứng (tuân thủ DEC-022) 0ms
   ✓ 7. Chống lách — đảm bảo logic thật, không hard-code (4)
     ✓ logic chịu lỗi exams phải thực sự try-catch/handle riêng, không chỉ xoá dòng fetch exams 1ms
     ✓ xử lý ai_feedback phải có ít nhất 3 nhánh: string, object, fallback 1ms
     ✓ 'Đề thi đã gỡ' phải là fallback khi exam_id không có trong examsMap, không phải hard-code tất cả 2ms
     ✓ vẫn là 'use client' component 1ms

 Test Files  1 passed (1)
      Tests  26 passed (26)
   Start at  00:34:26
   Duration  429ms (transform 42ms, setup 0ms, collect 52ms, tests 14ms, environment 0ms, prepare 70ms)

--- TypeScript type-check file phạm vi ---
=== TASK-058: TẤT CẢ ĐẠT ===

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
