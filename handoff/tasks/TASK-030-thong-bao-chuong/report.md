# Báo cáo TASK-030

## Đã làm
- [x] Tạo API `GET /api/notifications?limit=N` (mặc định 20): yêu cầu đăng nhập (`requireRole()`), trả về danh sách thông báo và số lượng chưa đọc của chính người dùng (`listNotifications(userId, limit)`).
- [x] Tạo API `POST /api/notifications/read` body `{ ids?: string[] }`: kiểm tra xác thực, validate mảng `ids` (trả 400 nếu sai kiểu chuỗi), đánh dấu thông báo đã đọc theo danh sách hoặc tất cả nếu không gửi `ids` (`markNotificationsRead(userId, ids)`).
- [x] Cập nhật API `PUT /api/exam/grade-override`: tự động gọi `await notifyExamGraded(submissionId)` sau khi cập nhật trạng thái bài thi thành `GRADED` để gửi thông báo cho học sinh kèm điểm số và liên kết xem lại bài làm.
- [x] Xây dựng client component `NotificationBell` (`"use client"`):
  - Hiển thị nút chuông và huy hiệu số lượng chưa đọc (ẩn khi = 0, hiển thị `9+` khi > 9).
  - Tải dữ liệu ban đầu và thiết lập chu kỳ làm mới mỗi 60 giây (`setInterval` và dọn `clearInterval`), bỏ qua khi tab ẩn.
  - Dropdown mở danh sách thông báo, tự đóng khi click ra ngoài hoặc nhấn phím `Escape`.
  - Mỗi mục thông báo hiển thị tiêu đề, nội dung rút gọn, thời gian tương đối ("5 phút trước", "Vừa xong"...), nhấn nổi bật nếu chưa đọc; khi bấm vào sẽ đánh dấu đã đọc (`POST /api/notifications/read`) và chuyển trang theo `item.link`.
  - Nút "Đánh dấu đã đọc tất cả" và trạng thái rỗng "Chưa có thông báo".
  - Giữ an toàn bundle: không import trực tiếp module phía server (`@/lib/notifications`, `@/lib/db-pg`), chỉ giao tiếp qua API route.
- [x] Tích hợp `NotificationBell` vào thanh điều hướng đầu trang của `components/StudentLayout.tsx` và `components/TeacherLayout.tsx`.
- [x] Tự kiểm tra với bộ kiểm thử `python3 scripts/handoff.py verify TASK-030`: toàn bộ 36 test files (619 tests) đạt và `tsc` exit 0.

## File đã tạo/sửa
- `app/api/notifications/route.ts`: API GET lấy danh sách thông báo và số chưa đọc cho người dùng đã đăng nhập.
- `app/api/notifications/read/route.ts`: API POST đánh dấu thông báo đã đọc theo id hoặc toàn bộ.
- `components/NotificationBell.tsx`: Client component chuông thông báo, badge số chưa đọc, dropdown danh sách và tự động làm mới mỗi 60s.
- `app/api/exam/grade-override/route.ts`: Thêm gọi `await notifyExamGraded(submissionId)` sau khi giáo viên cập nhật điểm bài thi thành `GRADED`.
- `components/StudentLayout.tsx`: Thay nút chuông trang trí tĩnh bằng component `NotificationBell`.
- `components/TeacherLayout.tsx`: Thay nút chuông trang trí tĩnh bằng component `NotificationBell`.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-030-thong-bao-chuong/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/agy-worktrees/TASK-030

 ✓ tests/notifications-api.test.ts (10 tests) 19826ms
   ✓ GET /api/notifications > chưa đăng nhập → 401  5803ms
   ✓ GET /api/notifications > trả thông báo của chính mình (mới nhất trước) + số chưa đọc; mọi vai trò dùng được  1550ms
   ✓ GET /api/notifications > ?limit=N giới hạn số mục  1861ms
   ✓ POST /api/notifications/read > chưa đăng nhập 401; ids sai kiểu → 400  1448ms
   ✓ POST /api/notifications/read > đánh dấu theo ids (chỉ của mình) hoặc tất cả khi không gửi ids  1395ms
   ✓ Giáo viên chấm tay xong → học sinh nhận thông báo > lượt NEEDS_REVIEW được GV chấm qua grade-override → GRADED + thông báo EXAM_GRADED cho học sinh  1531ms
   ✓ Chuông thông báo — components/NotificationBell.tsx > client component gọi API, kiểm tra mỗi 60 giây và dọn interval  1750ms
   ✓ Chuông thông báo — components/NotificationBell.tsx > huy hiệu số chưa đọc (quá 9 → 9+), danh sách mở trang theo link, có 'Đánh dấu đã đọc tất cả' và trạng thái rỗng  1465ms
   ✓ Chuông thông báo — components/NotificationBell.tsx > không import module chỉ chạy server  1411ms
   ✓ Chuông thông báo — components/NotificationBell.tsx > StudentLayout và TeacherLayout dùng NotificationBell thay nút chuông trang trí  1608ms
 ✓ tests/notifications-lib.test.ts (6 tests) 6023ms
   ✓ notifyExamGraded > tạo thông báo cho học sinh kèm điểm, đạt và link xem lại  2104ms
   ✓ notifyExamGraded > gọi lại (chấm lại) không nhân đôi, cập nhật nội dung và đặt lại chưa đọc  1728ms
   ✓ notifyExamGraded > bài chưa GRADED hoặc không tồn tại → không tạo; lỗi DB không ném ra ngoài  891ms
   ✓ notifyNeedsReview > bài của lớp → giáo viên lớp; bài luyện tập → người tạo đề; kèm tên học sinh, link /teacher/grading  482ms
   ✓ listNotifications / markNotificationsRead > chỉ thấy của mình, mới nhất trước, đếm chưa đọc; đánh dấu theo id hoặc tất cả, không đụng của người khác  442ms
   ✓ listNotifications / markNotificationsRead > giới hạn số lượng 1–100  376ms

 Test Files  36 passed (36)
      Tests  619 passed (619)
   Start at  13:15:51
   Duration  71.60s (transform 3.19s, setup 0ms, collect 3.37s, tests 475.36s, environment 4ms, prepare 3.48s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
