# 01 — Tổng quan dự án KitoKit

> Cập nhật: 2026-11-03 · Dựng lại từ code (nhánh sau FEAT-013). Khi mâu thuẫn, `docs/14-decisions.md` thắng; tài liệu lệch code thì sửa tài liệu theo code.

## 1. Sản phẩm
**KitoKit** là cổng bài học và đề thi đa môn cho trung tâm và giáo viên. Học sinh vào lớp, học theo lộ trình, làm bài học và đề thi, xem kết quả và tiến độ (DEC-023, DEC-024).
- **Tiếng Anh:** đủ 4 kỹ năng Reading / Listening / Writing / Speaking. Writing và Speaking do AI chấm nền.
- **Môn khác:** chỉ có câu trắc nghiệm và câu khách quan, server chấm ngay.

## 2. Nỗi đau giải quyết
| Đối tượng | Nỗi đau | KitoKit giải quyết |
| :--- | :--- | :--- |
| Giáo viên / trung tâm | Soạn đề, chấm Writing/Speaking tốn thời gian; quản lý lớp rời rạc | Kho bài học & đề dùng chung, AI nhập đề từ DOCX/PDF/ảnh (FEAT-009), AI chấm nền theo chuẩn (FEAT-011), lộ trình lớp có mở khoá (FEAT-010) |
| Học sinh / phụ huynh | Không biết tiến độ, đề luyện không sát chuẩn | Lộ trình theo lớp, điểm quy đổi theo chuẩn IELTS/TOEIC/HSK…, thông báo khi có điểm |
| Vận hành (admin) | Không thấy chi phí AI, duyệt mua slot thủ công | Dashboard tổng quan, đơn hàng slot có VietQR, theo dõi token/chi phí AI (FEAT-013) |

## 3. Vai trò
| Vai trò | Mô tả |
| :--- | :--- |
| `ADMIN` | Quản trị toàn hệ thống. Làm được mọi việc của `TEACHER`. |
| `TEACHER` | Tạo khoá học, bài học, đề thi của mình; quản lý lớp; chấm hoặc sửa điểm; mua slot học sinh. Tự đăng ký thì ở chế độ **dùng thử** (`teacher_status = 'TRIAL'`) cho tới khi admin xác minh (DEC-027, DEC-028). |
| `STUDENT` | Vào lớp bằng mã hoặc link mời, học, làm bài, xem kết quả. Có thể không có email, khi đó đăng nhập bằng tên đăng nhập (DEC-026). |

## 4. Phạm vi hiện tại (đã có trong code)
| Mã | Tính năng | Đặc tả |
| :--- | :--- | :--- |
| FEAT-009 | AI nhập đề từ DOCX / PDF / ảnh | `docs/features/ai-exam-ingestion.md` |
| FEAT-010 | Kho bài học & học theo lộ trình lớp | `docs/features/lesson-library.md` |
| FEAT-011 | Chấm đề thi phía server theo chuẩn chấm | `docs/features/exam-server-grading.md` |
| FEAT-012 | Đăng nhập mới, đăng ký kiểu phỏng vấn, giáo viên dùng thử | `docs/features/dang-ky-phong-van.md` |
| FEAT-013 | Tổng quan admin, đơn hàng slot + VietQR, chi phí AI, slot = học sinh | `docs/features/quan-tri-he-thong.md` |
| FEAT-014 | Chấm & Bảng điểm theo lớp: bảng điểm từng bài, sửa điểm từng câu AI, chốt, tổng kết lớp (DONE 06/11) | `docs/features/cham-diem-bang-diem.md` |

Không có mã FEAT riêng nhưng đã có trong code: landing `/` và form liên hệ (TASK-033); nền tảng đa môn (TASK-034); thông báo trong app (TASK-030); thương hiệu và token màu (DEC-022).

## 5. Ngoài phạm vi (đã chốt)
- Học sinh tự mua khoá học trên app. Thu học phí ngoài app (DEC-019).
- Email/Zalo thông báo. Đăng nhập Google/Zalo. Xác minh email OTP.
- Webhook ngân hàng tự duyệt đơn (đã chuẩn bị `approveOrder`, chưa nối).
- Dark mode (token đã sẵn, chưa định nghĩa lại).
- Thi đầu vào không cần tài khoản, heartbeat, storybook: tính năng của server cũ, chưa khôi phục.

## 6. Bản đồ tài liệu
| File | Nội dung |
| :--- | :--- |
| `CONTEXT.md` | Bối cảnh siêu ngắn, bất biến, bản đồ |
| `docs/02` | Phân hệ, tính năng, ma trận phân quyền |
| `docs/03` | Kiểm kê màn hình SCR-NN, điều hướng, 4 trạng thái UI |
| `docs/04` | Luồng người dùng |
| `docs/05` | Kiến trúc, hạ tầng |
| `docs/06` | Schema DB |
| `docs/07` | Hợp đồng API |
| `docs/08` | Tích hợp bên thứ ba |
| `docs/09` | Quy ước code |
| `docs/10` | Biến môi trường & bảo mật |
| `docs/11` | Kế hoạch, task, tồn đọng |
| `docs/12` | Quy tắc nghiệp vụ BR-NN, máy trạng thái |
| `docs/13` | Test & QA |
| `docs/14` | Sổ quyết định DEC-NN |
| `docs/15` | Vận hành: deploy, migration chạy tay, cấu hình sau deploy, sao lưu / rollback, nhật ký phát hành |
| `docs/features/` | Đặc tả từng FEAT |
| `docs/qa/` | Checklist & báo cáo QA |
| `docs/archive/` | Tài liệu cũ, không còn là chuẩn |
| `handoff/` | Giao việc Claude ↔ Antigravity, `KE-HOACH.md` tiến độ |
