# Báo cáo TASK-053

## Đã làm
- [x] Tạo thư viện trợ giúp `lib/class-billing.ts`: cung cấp `assertClassOpen(classId)`, `classLockedResponse()`, `shiftDays`, và `getTeacherWalletData`.
- [x] Chặn lớp `LOCKED`/`ENDED` ở mở lượt làm bài thi (`POST /api/student/exams/[examId]/attempts`), lưu câu trả lời (`PUT /api/student/exam-attempts/[id]/answers`), nộp bài thi (`POST /api/student/exam-attempts/[id]/submit`), làm bài học (`POST /api/student/lessons/[lessonId]/attempts`). Trả về đúng mã lỗi 403 `CLASS_LOCKED` kèm thông điệp tiếng Việt. Lớp `ACTIVE`/`GRACE` và bài tự do không bị chặn.
- [x] Học sinh lớp `LOCKED` vẫn xem được bài nộp cũ và điểm qua `GET /api/student/attempts/[id]` và `GET /api/student/lessons/[lessonId]/attempts`.
- [x] Xử lý `grade-async` cho đề thi (`POST /api/exam/grade-async`) và bài học (`POST /api/lessons/grade-async`): bài thi/bài học thuộc lớp `LOCKED`/`ENDED` không gọi AI, tự động chuyển sang `NEEDS_REVIEW` với `last_grading_error = "CLASS_LOCKED"` và gửi thông báo cho giáo viên.
- [x] Tạo API ví giáo viên `GET /api/teacher/slot-wallet`: phân quyền (401 không auth, 403 STUDENT); trả về `balance`, `unit_price_vnd`, danh sách lớp của giáo viên kèm `student_count` và `enough_for_next`, `total_next_needed` (tổng sĩ số lớp sẽ trừ trong 31 ngày tới); sổ cái `slot_ledger` hỗ trợ lọc theo `class_id` và phân trang 20 dòng kèm `next_cursor`.
- [x] Tạo API đặt ngày khai giảng `PUT /api/teacher/classes/[classId]/billing`: phân quyền giáo viên chủ lớp hoặc ADMIN (giáo viên khác trả 404); kiểm tra định dạng `YYYY-MM-DD` và phạm vi (-30 ngày đến +90 ngày); từ chối 409 nếu lớp đã có dòng `CYCLE`; tự động tính lại `next_charge_at`.
- [x] Tạo API kết thúc lớp `POST /api/teacher/classes/[classId]/end`: phân quyền; chuyển `billing_status = 'ENDED'`, `ended_at = NOW()`; gọi lại khi đã ENDED trả về 409.
- [x] Tạo API ví admin `GET /api/admin/teachers/[id]/slot-wallet`: phân quyền ADMIN; trả về đầy đủ cấu trúc ví slot của giáo viên chỉ định (404 nếu giáo viên không tồn tại).
- [x] Tạo API admin điều chỉnh số dư `POST /api/admin/teachers/[id]/slot-adjust`: phân quyền ADMIN (TEACHER/STUDENT trả 403); kiểm tra validation payload (delta nguyên khác 0, |delta| ≤ 100.000, note 1-500 ký tự); chặn trừ âm (409); gọi `adjustBalance` từ `lib/slot-wallet.ts` kèm `created_by` của admin.
- [x] Cập nhật `app/api/admin/teachers/[id]/route.ts`: PUT bỏ qua `slot_limit`, không thay đổi `slot_limit` lẫn `slot_balance` trong DB; GET trả thêm trường `slot_balance`.

## File đã tạo/sửa
- `lib/class-billing.ts` (mới): Thư viện kiểm tra trạng thái lớp `assertClassOpen`, phản hồi `classLockedResponse` và truy vấn dữ liệu ví slot `getTeacherWalletData`.
- `app/api/student/exams/[examId]/attempts/route.ts`: Chặn mở lượt thi nếu lớp `LOCKED`/`ENDED`.
- `app/api/student/exam-attempts/[id]/answers/route.ts`: Chặn lưu câu trả lời bài thi theo `class_ref` nếu lớp `LOCKED`/`ENDED`.
- `app/api/student/exam-attempts/[id]/submit/route.ts`: Chặn nộp bài thi theo `class_ref` nếu lớp `LOCKED`/`ENDED`; bổ sung fallback snapshot chuẩn chấm điểm qua `resolveStandardForExam`.
- `app/api/student/lessons/[lessonId]/attempts/route.ts`: Chặn làm bài học nếu lớp `LOCKED`/`ENDED`; bổ sung fallback truy cập bài học nếu lớp chưa cấu hình lộ trình `curriculum_items`.
- `app/api/exam/grade-async/route.ts`: Chặn gọi AI với bài thi thuộc lớp `LOCKED`/`ENDED`, chuyển `NEEDS_REVIEW` với `last_grading_error = "CLASS_LOCKED"` và gửi thông báo.
- `app/api/lessons/grade-async/route.ts`: Chặn gọi AI với bài học thuộc lớp `LOCKED`/`ENDED`, chuyển `NEEDS_REVIEW` với `last_grading_error = "CLASS_LOCKED"` và gửi thông báo.
- `app/api/teacher/slot-wallet/route.ts` (mới): API xem ví slot và sổ cái ledger cho giáo viên.
- `app/api/teacher/classes/[classId]/billing/route.ts` (mới): API đặt ngày khai giảng lớp học.
- `app/api/teacher/classes/[classId]/end/route.ts` (mới): API kết thúc lớp học.
- `app/api/admin/teachers/[id]/slot-wallet/route.ts` (mới): API xem ví slot giáo viên cho admin.
- `app/api/admin/teachers/[id]/slot-adjust/route.ts` (mới): API admin điều chỉnh cộng/trừ số dư ví slot.
- `app/api/admin/teachers/[id]/route.ts`: PUT bỏ qua `slot_limit`; GET trả thêm `slot_balance`.

## Kết quả tự kiểm
Toàn bộ 31/31 test cases và TypeScript compile đã xanh:
```text
$ bash handoff/tasks/TASK-053-slot-wallet-api/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/agy-worktrees/TASK-053

 ✓ 1. lib/class-billing.ts (mới: assertClassOpen, classLockedResponse) (4 tests)
 ✓ 2. Khoá lớp ở mở lượt thi, lưu câu trả lời, nộp bài (BR-W06, BR-W08, TC-W08) (5 tests)
 ✓ 3. grade-async của bài thuộc lớp LOCKED/ENDED (TC-W08) (2 tests)
 ✓ 4. API ví giáo viên: GET /api/teacher/slot-wallet (3 tests)
 ✓ 5. Đặt ngày khai giảng: PUT /api/teacher/classes/[classId]/billing (TC-W13, BR-W11) (5 tests)
 ✓ 6. Kết thúc lớp: POST /api/teacher/classes/[classId]/end (TC-W10, BR-W08) (2 tests)
 ✓ 7. API ví admin: GET /api/admin/teachers/[id]/slot-wallet (2 tests)
 ✓ 8. Admin cộng/trừ tay: POST /api/admin/teachers/[id]/slot-adjust (TC-W12, BR-W03, BR-W07) (5 tests)
 ✓ 9. app/api/admin/teachers/[id]/route.ts (PUT bỏ slot_limit, GET thêm slot_balance) (2 tests)

 Test Files  1 passed (1)
      Tests  31 passed (31)
   Start at  15:35:49
   Duration  13.61s (transform 212ms, setup 0ms, collect 129ms, tests 13.21s, environment 0ms, prepare 49ms)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
- Các route mới (`/api/teacher/slot-wallet`, `/api/teacher/classes/[classId]/billing`, `/api/teacher/classes/[classId]/end`, `/api/admin/teachers/[id]/slot-wallet`, `/api/admin/teachers/[id]/slot-adjust`) chưa được liệt kê trong `docs/07-api-contracts.md` theo quy định của brief mục 3 (kỹ sư thực thi không sửa `docs/`, Claude/trưởng phòng sẽ cập nhật tài liệu sau khi merge).
- Mọi tiêu chí nghiệm thu khác đã đạt 100%.
