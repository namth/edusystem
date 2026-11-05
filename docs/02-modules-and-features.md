# 02 — Phân hệ, tính năng & ma trận phân quyền

> Cập nhật: 2026-11-03 · Nguồn: menu `components/*Layout.tsx`, `app/**/page.tsx`, `app/api/**` (`requireRole`).

## 1. Phân hệ
| Phân hệ | Đường dẫn | Layout | Mô tả |
| :--- | :--- | :--- | :--- |
| Công khai | `/`, `/login`, `/register`, `/register/teacher`, `/forgot-password`, `/reset-password`, `/join/[classId]` | không | Landing, đăng nhập, đăng ký phỏng vấn, khôi phục mật khẩu, xem trước lớp qua link mời |
| Học sinh | `/student/**` | `StudentLayout` | Trang chủ, lớp học, lộ trình, làm bài học / đề thi, xem lại, analytics |
| Giáo viên | `/teacher/**` | `TeacherLayout` | Lớp học, lộ trình & khoá học, kho bài học & đề, môn học, flashcard, tạo học sinh, slot & đơn hàng, duyệt điểm AI |
| Quản trị | `/admin/**` | `AdminLayout` | Tổng quan, đơn hàng, giáo viên, học sinh, tài khoản, chuẩn chấm, liên hệ, cấu hình AI |
| Dùng chung | `/profile`, `/change-password` | theo vai trò | Hồ sơ, đổi mật khẩu (bắt buộc khi `must_change_password`) |
| Nền | `worker/grading-worker.js` | — | Consumer Redis Streams, gọi API chấm AI nội bộ |

## 2. Tính năng theo phân hệ
### 2.1 Quản trị (menu theo đúng thứ tự trong code)
| Menu | Đường dẫn | Tính năng | FEAT / DEC |
| :--- | :--- | :--- | :--- |
| Tổng quan | `/admin` | Số tổng, số theo tháng (giờ VN), biểu đồ theo ngày, top giáo viên dùng AI | FEAT-013, DEC-034 |
| Đơn hàng (kèm số đơn chờ) | `/admin/orders`, `/admin/orders/[id]` | Lọc, duyệt, từ chối, huỷ đơn mua slot; tab cấu hình thanh toán (ngân hàng, STK, đơn giá) | FEAT-013, DEC-032/033 |
| Quản Lý Giáo Viên | `/admin/teachers`, `/admin/teachers/[id]` | Danh sách, lọc chờ xác minh, xác minh / từ chối, sửa `slot_limit`, tạo đơn mua slot, nhật ký AI | DEC-028, FEAT-013 |
| Quản Lý Học Sinh | `/admin/students`, `/admin/students/[id]` | Danh sách, chi tiết, lớp đang học, điểm | — |
| Quản Lý Tài Khoản | `/admin/accounts` | Tạo / sửa / khoá / xoá tài khoản mọi vai trò | — |
| Chuẩn Chấm Điểm | `/admin/scoring-standards?tab=standards\|rubrics` | Tab Chuẩn chấm (phần thi, quy đổi, tổng) + tab Bộ tiêu chí AI | FEAT-011, DEC-030 |
| Liên Hệ Từ Website | `/admin/leads` | Danh sách liên hệ từ landing, đổi trạng thái | TASK-033 |
| Cấu Hình AI & Hệ Thống | `/admin/settings` | Model AI nhập đề, bảng giá model + tỷ giá | FEAT-009, DEC-034 |
| (không có menu) | `/admin/tests/import` | Nhập đề từ văn bản bằng AI (công cụ cũ) | — |

Trang chuyển hướng: `/admin/requests` → `/admin/orders`, `/admin/rubrics` → `/admin/scoring-standards?tab=rubrics`.

### 2.2 Giáo viên
| Menu | Đường dẫn | Tính năng |
| :--- | :--- | :--- |
| Quản Lý Lớp Học | `/teacher/classes`, `/teacher/classes/[classId]` | Tạo lớp, mã/link mời, thêm học viên, giao đề, cài đặt mở khoá, lộ trình lớp, tiến độ |
| Quản Lý Lộ Trình & Khóa Học | `/teacher/tests`, `/teacher/tests/create` | Khoá học, cây giáo trình kéo-thả (UNIT / LESSON / EXAM), soạn đề 4 kỹ năng |
| Kho Bài Học & Đề Thi | `/teacher/library`, `/teacher/lessons`, `/teacher/lessons/[id]` | Kho dùng chung, soạn bài học, xem trước, nhân bản, chuyển đổi bài học ↔ đề, AI nhập đề |
| Môn Học | `/teacher/subjects` | Môn của giáo viên (`owner_id`) + môn hệ thống |
| Quản Lý Flashcards | `/teacher/flashcards` | Thư viện thẻ dùng chung, upload ảnh/audio |
| Tạo Acc Học Sinh | `/teacher/students/create` | Tạo tài khoản học sinh (kèm lớp) |
| Slot học sinh & đơn hàng | `/teacher/slots`, `/teacher/orders/[id]` | Xem slot đang dùng / tổng, tạo đơn, trang thanh toán VietQR, báo đã chuyển khoản |
| Duyệt Điểm AI → **Chấm & Bảng điểm** (FEAT-014, đang làm) | `/teacher/grading`, `/teacher/grading/[classId]/[kind]/[itemId]` | Hiện tại: xem và sửa điểm bài đã nộp (`grade-override`), chấm tay bài `NEEDS_REVIEW`. Sau FEAT-014: chọn lớp → bài (bài học / đề) → bảng điểm học sinh × điểm, sửa điểm & nhận xét từng câu AI, chốt bảng điểm, tổng kết lớp thang 10 (DEC-037 → DEC-041) |

Giáo viên dùng thử thấy banner tiến độ (`TrialBanner`) và bị giới hạn theo DEC-027.

### 2.3 Học sinh
| Menu | Đường dẫn | Tính năng |
| :--- | :--- | :--- |
| Dashboard / Lớp Học Của Tôi | `/student/dashboard` | Lớp đang học, vào lớp bằng mã, việc cần làm |
| Đề Thi & Bài Tập | `/student/class/[classId]` | Tab lộ trình, đề được giao, kết quả; tab **Bảng điểm** (bài đã chốt, FEAT-014) |
| — | `/student/lesson/[lessonId]` | Làm bài học, xem kết quả từng câu |
| — | `/student/exam/[examId]`, `/student/exam/review/[submissionId]` | Làm đề (giờ theo server, ghi âm Speaking), xem lại |
| Analytics & Báo Cáo | `/student/analytics` | Biểu đồ điểm theo chuẩn |
| — | `/student/landing` | Trang cho học sinh phải đổi mật khẩu / chưa có lớp |

⚠️ Mục "Đề Thi & Bài Tập" trong `StudentLayout` đang trỏ cứng `/student/class/cls_101`. Đây là lỗi tồn đọng, xem `docs/11` §4.

## 3. Ma trận phân quyền (theo `requireRole` trong code)
✓ = được · ◐ = chỉ dữ liệu của mình · — = không · 🔑 = token nội bộ `x-internal-token`

| Nhóm API / hành động | Khách | STUDENT | TEACHER | ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| `auth/*` (login, register, register/teacher, forgot/reset, signup-options, username-available, email-available) | ✓ (giới hạn tần suất) | ✓ | ✓ | ✓ |
| `auth/me`, `auth/logout`, `auth/change-password`, `profile` | — | ◐ | ◐ | ◐ |
| `leads` POST (form landing) | ✓ (giới hạn theo IP) | ✓ | ✓ | ✓ |
| `classes/lookup/[ref]` (xem trước lớp) | ✓ (trường công khai) | ✓ | ✓ | ✓ |
| `student/*` (lớp, ghi danh, lộ trình, làm bài, lượt thi) | — | ◐ | — | — |
| `exams`, `exams/[id]` (đọc), `submissions/[id]` | — | ◐ (không lộ đáp án) | ◐ | ✓ |
| `teacher/*` (lớp, khoá, giáo trình, bài học, đề, câu hỏi, flashcard, kho, slot-requests, trial-usage) | — | — | ◐ (`created_by` / `teacher_id`) | ✓ |
| `subjects` | — | — | ◐ (môn của mình + hệ thống) | ✓ |
| `exam/rubrics`, `scoring-standards` GET/POST | — | — | ✓ đọc / ◐ tạo | ✓ |
| `scoring-standards/[id]` PUT/DELETE | — | — | — | ✓ |
| `exam/grade-override` (bỏ ở FEAT-014) | — | — | ◐ (lớp/đề của mình) | ✓ |
| `teacher/grading/*` (FEAT-014: bảng điểm, sửa điểm, chốt, tổng kết) | — | — | ◐ (chỉ lớp `teacher_id` = mình, DEC-038) | ✓ |
| `student/classes/[classId]/gradebook` (FEAT-014) | — | ◐ (dòng của mình, bài đã chốt) | — | — |
| `orders/[id]`, `report-paid`, `cancel` | — | — | ◐ (đơn khác → 404) | ✓ |
| `notifications`, `notifications/read` | — | ◐ | ◐ | ◐ |
| `uploads` | — | ✓ | ✓ | ✓ |
| `tts` | — | ✓ | ✓ | ✓ |
| `admin/*` (dashboard, orders, users, teachers, verify, leads, settings, classes, create/delete-user, requests, parse-exam-text, test-portkey) | — | — | — | ✓ |
| `exam/grade-async`, `lessons/grade-async` | 🔑 | 🔑 | 🔑 | 🔑 (+ ADMIN/TEACHER gọi thủ công ở `exam/grade-async`) |

**Giới hạn giáo viên dùng thử** (DEC-027, đọc từ DB mỗi request):
- tối đa 1 lớp;
- tối đa 3 nội dung, tính chung bài học và đề thi;
- tối đa 3 học sinh khác nhau;
- mỗi học sinh nộp 1 lần cho mỗi bài/đề trong lớp dùng thử;
- không mua slot được.

**Slot học sinh** (DEC-031): giáo viên đã xác minh bị giới hạn tổng số học sinh khác nhau ≤ `users.slot_limit`. Chủ lớp là ADMIN không bị giới hạn.
