# Báo cáo TASK-039

## Đã làm
- Tạo `lib/student-slots.ts` triển khai `getStudentSlotUsage` (đếm số học sinh phân biệt trên mọi lớp của GV, lấy `slot_limit`) và `assertStudentSlotAvailable` (ADMIN luôn ok, học sinh đã học lớp khác của cùng GV luôn ok, còn lại chặn khi used >= limit kèm mã 409 và thông báo tiếng Việt có chứa "slot"). Nếu không tìm thấy giáo viên trong bảng users thì không giới hạn slot.
- Cập nhật `lib/enrollment.ts` (`enrollStudentByCode`): kiểm tra quyền → giới hạn dùng thử (giữ nguyên) → slot học sinh (409) → sĩ số lớp (`max_slots`).
- Cập nhật `app/api/teacher/classes/[classId]/students/route.ts`: chặn 409 khi hết slot cho cả học sinh có sẵn (không ghi enrollments) và học sinh mới (chặn trước khi INSERT users, không tạo tài khoản mồ côi).
- Cập nhật `app/api/admin/create-user/route.ts`: kiểm tra slot mọi lớp của các giáo viên tương ứng trước khi tạo user; trả về 409 nếu hết slot.
- Cập nhật `app/api/admin/users/[id]/route.ts`: kiểm tra slot với mỗi lớp mới thêm qua `assertStudentSlotAvailable`; nếu bị chặn trả về 409 mà không xoá/thay ghi danh cũ.
- Bỏ trừ slot và bỏ hoàn slot khi chấm AI:
  - `app/api/student/exam-attempts/[id]/submit/route.ts`: bài có AI luôn chuyển sang `GRADING` và đẩy sự kiện chấm; đẩy sự kiện lỗi thì chuyển `NEEDS_REVIEW` báo GV, không trừ/hoàn `slot_limit`.
  - `app/api/student/lessons/[lessonId]/attempts/route.ts`: bài có tự luận luôn chuyển sang `GRADING` và đẩy `LESSON_GRADING_REQUESTED`, bỏ trừ slot và bỏ trạng thái `AI_SKIPPED`.
  - `app/api/exam/grade-async/route.ts`: xoá hoàn toàn hàm `refundSlotAndNotify`, không cộng `slot_limit + 1` ở cả nhánh AI lỗi và nhánh `giveUp`.
  - `worker/grading-worker.js`: bỏ chú thích `(hoàn slot)`.
  - Đảm bảo trong toàn bộ `app/`, `lib/`, `worker/` không còn xuất hiện `slot_limit - 1`, `slot_limit + 1`, hay `hoàn slot`.
- Cập nhật số slot thật cho giáo viên:
  - `app/api/teacher/slot-requests/route.ts`: GET trả thêm `usage: { used, limit }` từ `getStudentSlotUsage`.
  - `app/teacher/slots/page.tsx`: bỏ `useState(218)` / `useState(250)` viết cứng, hiển thị "Đang dùng {used} / {limit} slot học sinh" từ `usage`, giải thích rõ quy tắc 1 slot = 1 học sinh (học sinh học nhiều lớp của thầy cô chỉ tính 1).

## File đã tạo/sửa
- `lib/student-slots.ts`: logic đếm và kiểm tra slot học sinh của giáo viên.
- `lib/enrollment.ts`: tích hợp kiểm tra slot trong `enrollStudentByCode`.
- `app/api/teacher/classes/[classId]/students/route.ts`: kiểm tra slot trước khi ghi danh hoặc tạo tài khoản học sinh mới.
- `app/api/admin/create-user/route.ts`: kiểm tra slot cho các lớp được gán trước khi tạo user.
- `app/api/admin/users/[id]/route.ts`: kiểm tra slot cho các lớp mới được gán.
- `app/api/student/exam-attempts/[id]/submit/route.ts`: bỏ trừ và hoàn slot khi nộp bài thi có phần tự luận AI.
- `app/api/student/lessons/[lessonId]/attempts/route.ts`: bỏ trừ slot và bỏ `AI_SKIPPED` khi làm bài học có tự luận.
- `app/api/exam/grade-async/route.ts`: xoá hoàn slot khi AI chấm bài thi thất bại hoặc worker give up.
- `worker/grading-worker.js`: cập nhật chú thích worker không còn hoàn slot.
- `app/api/teacher/slot-requests/route.ts`: bổ sung trường `usage` trong response GET.
- `app/teacher/slots/page.tsx`: hiển thị số liệu slot thực tế và quy tắc 1 slot = 1 học sinh.

## Kết quả tự kiểm
```
 Test Files  51 passed (51)
      Tests  896 passed (896)
   Start at  23:40:11
   Duration  1455.46s (transform 151.77s, setup 0ms, collect 70.33s, tests 5569.00s, environment 108ms, prepare 31.76s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
