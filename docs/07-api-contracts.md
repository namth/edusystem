# 07 — Hợp đồng API

> Cập nhật: 2026-11-03 · Nguồn: `app/api/**/route.ts`. Hợp đồng chi tiết (payload, mã lỗi từng nhánh) được khoá bằng test trong `tests/*.test.ts` (cột "Test"). Test thắng nếu tài liệu này thiếu.

## 1. Quy ước chung
- **Xác thực:** cookie httpOnly `auth_token` (JWT HS256, `lib/jwt.ts`). Payload gồm `userId`, `email`, `role`, và `mcp` khi bắt buộc đổi mật khẩu. Danh tính luôn lấy từ token, không bao giờ lấy từ body hay query.
- **Phân quyền:** `requireRole([...])` chạy trước mọi truy vấn. Không có phiên trả **401**, sai vai trò trả **403**.
- **Route công khai có chủ đích:** `auth/*` (có giới hạn tần suất), `leads` POST (giới hạn theo IP), `classes/lookup/[ref]` (chỉ trả trường công khai).
- **Gọi máy – máy:** `exam/grade-async`, `lessons/grade-async` dùng header `x-internal-token` = `INTERNAL_API_TOKEN`.
- **Dạng phản hồi:** thành công là `{ success: true, ... }`, lỗi là `{ success: false, error: "<tiếng Việt>" }`.

  | Mã | Ý nghĩa |
  | :--- | :--- |
  | 400 | Dữ liệu sai |
  | 404 | Không có, hoặc không phải của mình |
  | 409 | Xung đột trạng thái / giới hạn |
  | 410 | Route đã khoá |
  | 429 | Quá tần suất |
  | 500 | Lỗi hệ thống |

- **Tiền:** số nguyên VND, do server tính. **Điểm:** do server tính.

## 2. Danh mục endpoint

> **FEAT-015 (SPEC_APPROVED, chưa code):** API ví slot, tính phí theo kỳ, cron, cộng/trừ tay của admin và các thay đổi ở đường ghi danh/nộp bài — xem `docs/features/vi-slot-hoc-sinh-thang.md` §6. Đường dẫn được thêm vào bảng dưới khi task code xong (docs-sync chặn route chưa tồn tại).
### 2.1 Xác thực & hồ sơ
| Method | Route | Vai trò | Ghi chú | Test |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | công khai | `{ identifier (email/username), password }`, đặt cookie, giới hạn tần suất | `secrets-password`, `onboarding-api` |
| POST | `/api/auth/register` | công khai | Tạo STUDENT; có thể kèm mã lớp → `enrolled` hoặc `enrollError` | `onboarding-api` |
| POST | `/api/auth/register/teacher` | công khai | Tạo TEACHER `TRIAL` + `teacher_profiles`, báo admin | `onboarding-api` |
| GET | `/api/auth/signup-options` | công khai | Môn / cấp học cho form đăng ký | `landing` |
| GET | `/api/auth/username-available` | công khai | `?u=` | `onboarding-api` |
| GET | `/api/auth/email-available` | công khai | `?e=` → `{ available, error? }`; báo email trùng ngay khi gõ ở form đăng ký; giới hạn theo IP | `onboarding-api` |
| POST | `/api/auth/forgot-password` | công khai | Có email thật thì lưu `reset_token` (15 phút). Phản hồi **luôn** `{ success, message }` giống nhau dù email có tồn tại hay không; không bao giờ trả token/link, không log ra console (BR-A06). Chỉ khi `NODE_ENV ≠ production` và `ALLOW_DEV_RESET_LINK=1` mới kèm `resetUrl` | `forgot-password-security`, `onboarding-api` |
| POST | `/api/auth/reset-password` | công khai | Đặt mật khẩu mới bằng email + token còn hạn | `secrets-password` |
| GET / POST | `/api/auth/me`, `/api/auth/logout`, `/api/auth/change-password` | đã đăng nhập | Đổi xong cấp cookie mới, bỏ `mcp` | `change-password` |
| GET / PUT | `/api/profile` | mọi vai trò | Không đổi được `password`, `email`, `role`, `slot_limit` | `profile-slots-grading` |

### 2.2 Học sinh
| Method | Route | Ghi chú | Test |
| :--- | :--- | :--- | :--- |
| GET | `/api/student/classes`, `/api/student/classes/[classId]` | Lớp đã ghi danh (403 nếu chưa vào, 404 nếu không có) | `student-api` |
| POST | `/api/student/enroll` | `{ code }`, 409 nếu đủ chỗ / hết slot / giới hạn dùng thử | `student-api`, `student-slots` |
| GET | `/api/student/classes/[classId]/roadmap` | Trạng thái mục lộ trình | `class-roadmap-api` |
| GET | `/api/student/lessons/[lessonId]` | Nội dung bài học, đã bỏ đáp án | `student-lessons-api` |
| GET / POST | `/api/student/lessons/[lessonId]/attempts` | Nộp bài học, chấm ngay câu khách quan; có câu AI thì `GRADING` | `student-lessons-api` |
| GET | `/api/student/attempts/[id]` | Kết quả lượt bài học | `student-lessons-api` |
| POST | `/api/student/exams/[examId]/attempts` | Bắt đầu lượt thi (`classId?`), 409 nếu hết lượt | `exam-attempts-api` |
| GET | `/api/student/exams/[examId]/content` | Nội dung đề, không có đáp án | `exam-attempts-api` |
| PUT | `/api/student/exam-attempts/[id]/answers` | Lưu nháp; sau hạn → 409 | `exam-attempts-api` |
| POST | `/api/student/exam-attempts/[id]/submit` | Nộp và chấm; nộp lần hai → 409 | `exam-attempts-api` |
| GET | `/api/submissions/[id]` | Đang làm → 409 với học sinh; GV/ADMIN xem được | `exam-attempts-api` |
| POST | `/api/submissions` | **410** (đường nộp cũ đã khoá) | `exam-attempts-api` |

### 2.3 Giáo viên (`TEACHER` chỉ dữ liệu của mình; `ADMIN` mọi dữ liệu)
| Method | Route | Ghi chú | Test |
| :--- | :--- | :--- | :--- |
| GET / POST | `/api/teacher/classes` | Tạo lớp (dùng thử: tối đa 1, `max_slots` ≤ 3) | `teacher-classes-api`, `teacher-trial` |
| GET / PUT / DELETE | `/api/teacher/classes/[classId]` | | `teacher-classes-api` |
| PUT | `/api/teacher/classes/[classId]/settings` | `unlock_mode`, `pass_percent`, `course_id` | `class-roadmap-api` |
| POST | `/api/teacher/classes/[classId]/students` | Thêm học sinh có sẵn hoặc tạo mới; 409 nếu đủ chỗ / hết slot; 403 `TRIAL_LIMIT` | `teacher-classes-api`, `student-slots` |
| GET | `/api/teacher/classes/[classId]/members`, `/api/teacher/classes/[classId]/progress`, `/api/teacher/classes/[classId]/roadmap` | | `class-roadmap-api` |
| POST / DELETE | `/api/teacher/classes/[classId]/unlocks`, `/api/teacher/classes/[classId]/assignments` | Mở khoá mục; giao đề (`max_attempts`) | `class-roadmap-api`, `teacher-trial` |
| GET / POST / PUT / DELETE | `/api/teacher/courses`, `/api/teacher/curriculum` | Khoá học, cây giáo trình | `curriculum-api` |
| GET / POST / PUT / DELETE | `/api/teacher/lessons`, `/api/teacher/lessons/[id]`, `/api/teacher/lessons/[id]/duplicate`, `/api/teacher/lessons/[id]/preview` | Xoá bài học đang gắn lộ trình → 409 | `lessons-api`, `lesson-preview` |
| GET / POST / PUT / DELETE | `/api/teacher/exams`, `/api/teacher/exams/[id]`, `/api/teacher/exams/[id]/duplicate`, `/api/teacher/exams/[id]/preview` | `preview`: GET nội dung đã ẩn đáp án, POST chấm thử không tạo lượt làm (dùng chung `lib/teacher-preview.ts` với bài học) | `exams-api`, `library-convert-duplicate`, `teacher-preview-isolation` |
| POST | `/api/teacher/exams/ai-parse` | multipart `file` (docx/pdf/ảnh ≤ 15MB) → bản xem trước; ghi log AI `EXAM_IMPORT` | `ai-import`, `ai-usage` |
| POST | `/api/teacher/exams/ai-import` | Lưu đề từ bản xem trước (một giao dịch) | `ai-import` |
| POST / PUT | `/api/teacher/questions`, `/api/teacher/questions/[id]` | | `lessons-api` |
| GET / POST / PUT / DELETE | `/api/teacher/flashcards`, `/api/teacher/flashcards/[id]` | | `flashcards-uploads-api` |
| POST | `/api/teacher/library/convert` | Bài học ↔ đề | `library-convert-duplicate` |
| GET | `/api/teacher/trial-usage` | `{ status, limits, used, reviewNote }`; đã xác minh → `limits: null` | `teacher-trial` |
| GET / POST | `/api/teacher/slot-requests` | GET: `{ slot_requests, usage: { used, limit } }`. POST: `{ requested_slots }` → đơn (giá theo `slot_pricing`, bỏ qua `total_cost` client gửi); giáo viên dùng thử → 403 | `student-slots`, `slot-orders-api` |
| GET / POST / PUT / DELETE | `/api/exam/rubrics` | Bộ tiêu chí AI | `rubrics-pg` |
| GET / POST | `/api/scoring-standards` | ADMIN / TEACHER đọc; tạo | `scoring-standards-api` |
| PUT / DELETE | `/api/scoring-standards/[id]` | Chỉ ADMIN; chuẩn đang dùng → 409 | `scoring-standards-api` |
| GET / POST / PUT / DELETE | `/api/subjects`, `/api/subjects/[id]` | Môn của mình + hệ thống | `subjects` |
| GET | `/api/exams`, `/api/exams/[id]`, `/api/exams/[id]/content` | Học sinh chỉ thấy trường hiển thị (DEC-025) | `prod-hardening` |

**Chấm & Bảng điểm theo lớp (FEAT-014).** Hợp đồng đầy đủ ở `docs/features/cham-diem-bang-diem.md` §6. Mọi route dùng `requireRole(["ADMIN","TEACHER"])`; TEACHER không phải chủ lớp → 403, lớp không có → 404, `kind` ngoài `lesson|exam` → 400, bài không thuộc lớp → 404. `GET /api/teacher/classes/[classId]/members` chỉ tính bài nộp có `class_ref = classId`. Đã bỏ route GET api/teacher/submissions và PUT api/exam/grade-override.

| Method | Route | Ghi chú | Test |
| :--- | :--- | :--- | :--- |
| GET | `/api/teacher/grading/classes` | Lớp của giáo viên (ADMIN: mọi lớp) kèm `student_count`, `pending_review`, `needs_review` | `teacher-grading-api` |
| GET | `/api/teacher/grading/classes/[classId]` | Hub lớp: các bài (lộ trình ∪ đề giao) + số liệu chấm | `teacher-grading-api` |
| GET | `/api/teacher/grading/classes/[classId]/summary` | Học sinh × bài đã chốt (ảnh chụp), trung bình thang 10 | `teacher-grading-api` |
| GET | `/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]` | Bảng điểm một bài | `teacher-grading-api` |
| PUT | `/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/students/[studentId]` | `{ chosen_attempt_id?, manual_score10?, note? }`; bài đã chốt → 409 `GRADEBOOK_FINALIZED` | `teacher-grading-api` |
| POST | `/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/finalize` | `{ confirmUnreviewed? }`; 409 `GRADING_PENDING` / `UNREVIEWED` / `ALREADY_FINALIZED` | `teacher-grading-api` |
| POST | `/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/reopen` | Mở chốt; chưa chốt → 409 | `teacher-grading-api` |
| GET / PUT | `/api/teacher/grading/attempts/[kind]/[attemptId]` | GET: lượt + câu hỏi kèm đáp án. PUT: sửa điểm/nhận xét câu AI, tính lại điểm | `teacher-grading-api` |
| GET | `/api/student/classes/[classId]/gradebook` | STUDENT: ảnh chụp điểm của chính mình ở bài đã chốt; chưa ghi danh → 403 | `teacher-grading-api` |

### 2.4 Đơn hàng (FEAT-013)
| Method | Route | Vai trò | Ghi chú |
| :--- | :--- | :--- | :--- |
| GET | `/api/orders/[id]` | TEACHER (của mình, đơn khác → 404) / ADMIN | `{ order, payment: { configured, bank_bin, bank_name, account_no, account_name, amount, add_info, qr_payload } }`; `qr_payload` = null khi chưa cấu hình hoặc đơn không còn PENDING |
| POST | `/api/orders/[id]/report-paid` | TEACHER chủ đơn / ADMIN | Chỉ khi PENDING; lặp lại không đổi gì; báo mọi admin |
| POST | `/api/orders/[id]/cancel` | TEACHER chủ đơn / ADMIN | Chỉ khi PENDING (khác → 409) |
| GET | `/api/admin/orders?status=&source=&q=` | ADMIN | `{ orders, counts }`; PENDING đã báo chuyển khoản lên đầu; giá trị lọc lạ → 400 |
| POST | `/api/admin/orders` | ADMIN | `{ teacher_id, requested_slots, total_cost?, note? }` → 201; giá khác giá chuẩn mà thiếu `note` → 400; không phải giáo viên → 404 |
| POST | `/api/admin/orders/[id]/approve` | ADMIN | Giao dịch: PENDING → APPROVED, cộng `slot_limit`; đã xử lý → 409 |
| POST | `/api/admin/orders/[id]/reject` | ADMIN | `{ reason }` bắt buộc (1–500 ký tự) |
| GET / PUT | `/api/admin/settings/payment` | ADMIN | `{ payment_account, slot_pricing }`; BIN 6 số, STK 6–19 số, đơn giá nguyên 0–100.000.000 |
| GET / PUT | `/api/admin/requests`, `/api/admin/requests/[id]` | ADMIN | Route cũ, giữ để tương thích; đi qua `lib/slot-orders.ts` |

Test: `slot-orders-api`, `admin-api`.

### 2.5 Quản trị khác
| Method | Route | Ghi chú | Test |
| :--- | :--- | :--- | :--- |
| GET | `/api/admin/dashboard?month=YYYY-MM` | `{ month, totals, pending_orders, monthly, daily, top_teachers }`; tháng theo giờ VN; `month` sai → 400 | `admin-dashboard` |
| GET | `/api/admin/users?role=&teacherStatus=` | | `admin-api`, `teacher-trial` |
| GET / PUT | `/api/admin/users/[id]` | Sửa thông tin, `class_ids` (409 nếu hết slot) | `admin-api`, `student-slots` |
| GET / PUT | `/api/admin/teachers/[id]` | Kèm `profile`, nhật ký AI, `slot_limit` | `admin-api` |
| POST | `/api/admin/teachers/[id]/verify` | `{ decision: VERIFIED\|REJECTED, note? }` | `teacher-trial` |
| POST | `/api/admin/create-user`, `/api/admin/delete-user` | Tạo kèm `classIds` (409 nếu hết slot, không tạo user) | `admin-api`, `student-slots` |
| GET | `/api/admin/classes` | | `admin-api` |
| GET / PATCH | `/api/admin/leads`, `/api/admin/leads/[id]` | Đổi trạng thái `NEW` / `CONTACTED` / `DONE` | `landing` |
| GET / PUT | `/api/admin/settings/ai-model` | Model AI nhập đề | `ai-import` |
| GET / PUT | `/api/admin/settings/ai-pricing` | `{ pricing, unpriced_models }` | `ai-usage` |
| POST | `/api/admin/parse-exam-text`, `/api/admin/test-portkey` | Công cụ AI (ghi log) | — |

### 2.6 Dùng chung & nội bộ
| Method | Route | Vai trò | Ghi chú | Test |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/notifications` | đã đăng nhập | `{ items, unread }` | `notifications-api` |
| POST | `/api/notifications/read` | đã đăng nhập | `{ ids? }`, bỏ trống = đánh dấu tất cả | `notifications-api` |
| POST | `/api/uploads` | mọi vai trò | Upload qua server lên Supabase Storage | `flashcards-uploads-api` |
| GET | `/api/tts` | mọi vai trò | Google TTS | — |
| POST | `/api/leads` | công khai | Form landing; bẫy bot; 5 lần / giờ / IP | `landing` |
| GET | `/api/classes/lookup/[ref]` | công khai | Xem trước lớp qua link mời | `exam-flow` |
| POST | `/api/exam/grade-async` | 🔑 nội bộ | `{ submissionId, giveUp? }` | `exam-attempts-api`, `ai-usage` |
| POST | `/api/lessons/grade-async` | 🔑 nội bộ | `{ attemptId }` (FEAT-014 thêm `giveUp?`; AI lỗi → `NEEDS_REVIEW` thay vì 0) | `student-lessons-api`, `ai-usage` |
