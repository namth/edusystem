# Checklist kiểm thử tay trước khi lên production (KitoKit)

Chạy trên **staging** có DB riêng (không dùng chung Supabase dev).
Mỗi dòng đánh dấu kết quả theo trình duyệt: Chrome desktop (**C**), Safari iPhone (**S**), Chrome Android (**A**).
Mỗi trang kiểm đủ 4 trạng thái: đang tải / rỗng / lỗi / có dữ liệu.
Các luồng đã có test e2e (`npm run e2e`) chỉ cần kiểm hiển thị.

Ghi chú: người kiểm tự đăng nhập bằng tài khoản thử nghiệm của staging. Không dùng tài khoản thật.

## 0. Hạ tầng
- [ ] HTTPS và domain chạy; `http://` tự chuyển sang `https://`.
- [ ] `docker compose ps`: nextjs ở trạng thái `healthy`; worker và redis đang chạy.
- [ ] Container khởi động không có lỗi `[env]` trong log.
- [ ] Media `/media/ej/...` trả 200.
- [ ] Backup DB tự động đã chạy ít nhất 1 lần; đã thử khôi phục sang DB tạm.
- [ ] `JWT_SECRET` và `INTERNAL_API_TOKEN` của production khác dev; `.env` production không nằm trong git.

## 1. Chung / Xác thực
- [ ] `/` khi chưa đăng nhập hiện landing. Đã đăng nhập thì chuyển hướng theo vai trò: Admin → `/admin/requests`, GV → `/teacher/classes`, HS → `/student/dashboard`.
- [ ] Đăng ký HS mới → vào dashboard.
- [ ] Đăng nhập sai 10 lần → bị khoá tạm, có thông báo số phút chờ.
- [ ] Tài khoản mật khẩu tạm:
  - bị bắt đổi mật khẩu;
  - gõ thẳng `/teacher/classes` vẫn bị đưa về trang đổi mật khẩu;
  - đổi xong, đăng xuất, đăng nhập bằng mật khẩu **mới** thì vào bình thường.
- [ ] Quên mật khẩu → link đặt lại → đăng nhập bằng mật khẩu mới. Kiểm tra cả token hết hạn (sau 15 phút).
- [ ] Hồ sơ: đổi tên, SĐT; tự đổi mật khẩu thì bắt nhập đúng mật khẩu cũ.
- [ ] Link mời lớp `/join/<mã>`: dùng cho khách (đăng ký rồi vào lớp) và HS đã đăng nhập (vào lớp ngay).
- [ ] Chuông thông báo: hiện số chưa đọc, bấm vào thì đánh dấu đã đọc, link đúng trang.

## 2. Admin
- [ ] Tài khoản: tạo GV, tạo HS, sửa, khoá, xoá. Kiểm tra HS/GV bị xoá không đăng nhập được.
- [ ] Danh sách và trang chi tiết GV/HS (số lớp, slot, bài nộp).
- [ ] Duyệt yêu cầu slot: duyệt thì hạn mức GV tăng; từ chối thì GV thấy trạng thái.
- [ ] Chi tiết GV: nút kiểm tra kết nối AI báo lỗi rõ khi gateway lỗi (không còn "Simulation").
- [ ] Rubric và chuẩn chấm điểm: tạo, sửa, xoá; chuẩn đang dùng thì không xoá được, hoặc có cảnh báo.
- [ ] Cài đặt model AI: lưu được, lần chấm sau dùng model mới.
- [ ] Import đề từ văn bản (`/admin/tests/import`).

## 3. Giáo viên
- [ ] Lớp học: tạo lớp, sao chép mã/link mời, xem thành viên, xoá HS khỏi lớp, gắn khoá học cho lớp.
- [ ] Quản Lý Lộ Trình & Khóa Học:
  - chỉ thấy khoá của mình;
  - tạo, sửa, xoá khoá;
  - kéo bài/đề chưa có lộ trình vào mọi vị trí của cây;
  - sidebar dính khi cuộn;
  - tải lại trang vẫn giữ khoá đang chọn.
- [ ] Mở khoá bài cho lớp và xem tiến độ từng HS.
- [ ] Kho Bài Học & Đề Thi:
  - tab Bài học: tạo, sửa, xem thử bài có ảnh và audio;
  - tab Đề thi: tìm kiếm, tạo, sửa, xem thử;
  - xoá đề đang dùng thì bị chặn kèm số chỗ dùng; xoá đề trống thì được.
- [ ] AI Import đề (DOCX, PDF, ảnh) ra câu hỏi đúng.
- [ ] Giao đề cho lớp, kèm số lượt làm tối đa.
- [ ] Duyệt điểm AI:
  - bài `NEEDS_REVIEW` hiện trong hàng chờ;
  - chấm tay xong thì HS nhận thông báo;
  - sửa điểm bài đã chấm.
- [ ] Mua slot (gửi yêu cầu), tạo tài khoản HS hàng loạt, flashcard.

## 4. Học sinh
- [ ] Dashboard → lớp → lộ trình. Làm xong một bài thì lộ trình **không biến mất** và mục tiếp theo được mở.
- [ ] Làm bài học: stimulus HTML có ảnh hiển thị đúng; audio phát được; nộp thì có điểm.
- [ ] Làm đề:
  - [ ] vào chế độ toàn màn hình;
  - [ ] bảng câu hiện đủ 4 màu (đã làm / đánh dấu / đang làm / trống);
  - [ ] phím tắt 1–4, A–D, ←→ hoạt động;
  - [ ] bài đọc dài hiện chia đôi; trên điện thoại thành 2 tab;
  - [ ] bài nghe có thanh audio cố định;
  - [ ] báo "đã lưu"; tải lại trang vẫn còn đáp án;
  - [ ] rời trang có cảnh báo; hết giờ thì tự nộp.
- [ ] Nộp đề chỉ có trắc nghiệm → điểm hiện ngay.
- [ ] Nộp đề có Writing/Speaking:
  - [ ] màn chờ AI hiện ra;
  - [ ] AI chấm xong thì chuông báo và trang kết quả đủ điểm;
  - [ ] đề hỗn hợp hiện điểm trắc nghiệm trước.
- [ ] Mô phỏng AI lỗi (tắt key AI trên staging):
  - [ ] bài chuyển sang chờ GV chấm;
  - [ ] GV được báo;
  - [ ] HS thấy trạng thái "Giáo viên đang chấm".
- [ ] Xem lại bài (`exam/review`): đáp án đúng/sai và nhận xét AI.
- [ ] Thống kê (analytics) có dữ liệu sau khi làm bài.
- [ ] HS gõ URL trang giáo viên/admin thì bị chặn.

## 5. Phi chức năng
- [ ] Tải thử 100 HS nộp bài cùng lúc: không lỗi 5xx; hàng đợi chấm được xử lý hết; thời gian chấm trung bình được ghi lại.
- [ ] Lighthouse landing ≥ 90 (Performance và SEO) trên mobile.
- [ ] Không có lỗi đỏ trong console ở các trang chính.

Người kiểm: ____ · Ngày: ____ · Kết luận Go/No-Go: ____
