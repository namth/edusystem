# 11 — Kế hoạch, task & tồn đọng

> Cập nhật: 2026-11-03.
> - Trạng thái task lấy từ `python3 scripts/handoff.py list`; brief, test và báo cáo từng task nằm ở `handoff/tasks/TASK-NNN-*/`.
> - Tiến độ chi tiết theo ngày ghi ở `handoff/KE-HOACH.md`.
> - Từ nay mã task thống nhất là `TASK-NNN` (bỏ dạng `TSK-NN` của khung cũ).

## 1. Milestone
| Mốc | Nội dung | Task | Trạng thái |
| :--- | :--- | :--- | :--- |
| M0 Nền móng | Vitest, CONTEXT.md, sửa `.gitignore` | — | ✅ |
| M1 Bảo mật | `requireRole` toàn bộ API; gỡ bí mật và mật khẩu plaintext | TASK-001, 002 | ✅ |
| M2 Dữ liệu thật | Chuyển học sinh, giáo viên, admin sang API pg; bỏ Supabase client và mock-data | TASK-003 → 005, 015, 017, 023 → 026 | ✅ |
| M3 Kho bài học & lộ trình (FEAT-010) | Migration 006, chấm khách quan server, kho bài học, lộ trình lớp, LessonPlayer | TASK-006 → 014, 016 | ✅ |
| M4 Chấm đề phía server (FEAT-011) | Chuẩn chấm, lượt thi, chấm AI nền, xem lại, thông báo | TASK-018 → 022, 027 → 030 | ✅ |
| M5 Sẵn sàng production | Vá lỗi chặn, landing, đa môn, chuyển đổi / nhân bản | TASK-031 → 034, 035 (chuyển loại) | ✅ |
| M6 Đăng ký & dùng thử (FEAT-012) | Đăng ký phỏng vấn, giáo viên dùng thử, xác minh | TASK-035 (đăng ký API), 036, 037 | ✅ |
| M7 Quản trị (FEAT-013) | Token và chi phí AI, slot = học sinh, gộp tiêu chí, đơn hàng + VietQR, tổng quan | TASK-038 → 043 | ✅ đã deploy 03/11 (`docs/15` §6) |
| M8 Chấm & Bảng điểm (FEAT-014) | Migration 017, lõi bảng điểm, API chấm theo lớp, UI giáo viên, tab Bảng điểm học sinh | TASK-044 → 047 | ✅ 06/11, chưa deploy |

⚠️ Có 2 thư mục cùng mã TASK-035 (`TASK-035-chuyen-loai-nhan-ban`, `TASK-035-dang-ky-api`), do đánh số trùng khi hai task chạy song song. Không đổi tên để giữ lịch sử.

## 2. Danh sách task (đều `accepted`)
| Task | Tiêu đề |
| :--- | :--- |
| 001 | Bắt buộc xác thực & phân quyền cho toàn bộ API route |
| 002 | Gỡ bí mật viết cứng & luồng mật khẩu plaintext |
| 003 | API học sinh trên PostgreSQL: lớp, ghi danh, bài giao, bài nộp |
| 004 | Trang học sinh dùng API pg, bỏ Supabase client và dữ liệu giả |
| 005 | Trang làm bài, xem lại bài, tham gia lớp qua link dùng API pg |
| 006 | Cây lộ trình: API đầy đủ, cập nhật tại chỗ, sửa lỗi kéo thả |
| 007 | Migration 006 + `lib/grading.ts`: chấm khách quan phía server, ẩn đáp án |
| 008 | API câu hỏi dùng chung, Kho bài học, lộ trình nhận `lesson_id` |
| 009 | Cài đặt lớp, mở/khoá mục lộ trình, tiến độ học sinh |
| 010 | Tách `QuestionSetEditor` dùng chung, API ghi đề thi |
| 011 | API học sinh: lộ trình lớp, nội dung bài ẩn đáp án, nộp bài, chấm AI nền |
| 012 | Giao diện tab Lộ trình lớp |
| 013 | Giao diện Kho bài học, soạn bài, chọn bài trong lộ trình |
| 014 | Trang làm bài học (LessonPlayer + kết quả + chờ AI) |
| 015 | API thư viện flashcard + upload qua server |
| 016 | Xem trước bài học như học sinh |
| 017 | Khu admin chuyển sang API pg |
| 018 | Migration 009 + `lib/exam-scoring` + chấm Speaking bằng AI |
| 019 | API chuẩn chấm + trang admin + rubric-resolver bằng pg |
| 020 | Lượt thi do server quản lý, `grade-async` / `grade-override` bằng pg |
| 021 | Chọn chuẩn chấm khi soạn đề, chuẩn mặc định của khoá |
| 022 | Trang làm đề mới (giờ server, ghi âm Speaking) và xem lại |
| 023 | Lớp học của giáo viên qua API pg |
| 024 | Hồ sơ, mua slot, trang chấm bài qua API pg |
| 025 | Trang chủ học sinh: bỏ bán khoá học |
| 026 | Rubric bằng pg, xoá route chết |
| 027 | Hiển thị điểm theo chuẩn chấm |
| 028 | Bố cục trang làm bài tự chọn theo nội dung |
| 029 | Sửa luồng chấm đề + màn kết quả từng phần |
| 030 | Thông báo trong ứng dụng |
| 031 | Gom Kho Bài Học & Đề Thi (2 tab) |
| 032 | Vá lỗi chặn production |
| 033 | Landing KitoKit, form liên hệ |
| 034 | Nền tảng đa môn |
| 035 | Chuyển bài học ↔ đề, nhân bản · Đăng ký không cần email, giáo viên dùng thử (API) |
| 036 | Giao diện đăng nhập mới, đăng ký phỏng vấn có mascot |
| 037 | Giới hạn giáo viên dùng thử, banner, admin xác minh |
| 038 | Ghi nhận token & chi phí AI theo model |
| 039 | Slot = học sinh |
| 040 | Gộp Bộ tiêu chí AI vào Chuẩn chấm |
| 041 | Đơn hàng mua slot & VietQR (server) |
| 042 | Đơn hàng mua slot (giao diện) |
| 043 | Tổng quan admin & sắp lại menu |

**FEAT-014 (đều `accepted` 06/11, chi tiết + DoD ở `docs/features/cham-diem-bang-diem.md` §9):**

| Task | Tiêu đề | Phụ thuộc | DoD |
| :--- | :--- | :--- | :--- |
| 044 | Migration 017 + `lib/gradebook.ts` + grade-async ghi `ai_score`, bài học `NEEDS_REVIEW` | — | TC-B03, 04, 06, 07, 12, 13 |
| 045 | API `/teacher/grading/**`, gradebook học sinh, thông báo, sửa `members`, bỏ API cũ | 044 | TC-B01, 02, 05, 08–11, 14, 15; docs/07 cập nhật |
| 046 | UI giáo viên: hub, bảng điểm bài + ngăn chấm, tổng kết; trang lớp bỏ Sổ điểm | 045 | TC-B16 |
| 047 | UI học sinh: tab Bảng điểm, hiển thị điểm/nhận xét giáo viên | 045 | test UI học sinh |

**Đợt vận hành 08/11 (đều `accepted`; bối cảnh: rà soát thu tiền, `docs/11` D11–D12):**

| Task | Tiêu đề | Phụ thuộc | DoD |
| :--- | :--- | :--- | :--- |
| 048 | Gửi email qua Resend: quên mật khẩu, đơn hàng, thông báo admin | — | `brief.md` §5 |
| 049 | Cấp lại mật khẩu tạm: admin cho mọi tài khoản, giáo viên cho học sinh lớp mình | — | `brief.md` §5 |
| 050 | Báo cáo token & chi phí AI theo giáo viên, sửa số liệu trang chi tiết GV | — | `brief.md` §5 |

**FEAT-015 Ví slot học sinh-tháng (đều `accepted` 08/11; chi tiết + DoD ở `docs/features/vi-slot-hoc-sinh-thang.md` §9):**

| Task | Tiêu đề | Phụ thuộc | DoD |
| :--- | :--- | :--- | :--- |
| 051 | Trang `/pricing` + link landing/footer | — | TC-W16 |
| 052 | Migration 018/018b + `lib/slot-wallet.ts` + cron + đường ghi danh trừ ví (HIGH, nhạy cảm) | merge 048 | TC-W01–07, 09, 11, 12, 14, 15, 17 |
| 053 | Khoá lớp LOCKED/ENDED ở nộp bài & AI; API ví, `billing`, `end`, `slot-adjust` | 052 | TC-W08, 10, 12, 13 |
| 054 | UI Ví slot, cài đặt/banner lớp, ví ở chi tiết GV admin, banner HS | 053, merge 049/050 | 4 trạng thái UI |
| 055 | Khung học sinh: menu cls_101, điều hướng mobile, bỏ ô tìm kiếm chết, nhãn "Học sinh" | — | `brief.md` §5 |
| 056 | Dashboard học sinh: bỏ streak giả, lỗi theo khối, "Đang làm dở", badge billing | — | `brief.md` §5 |
| 057 | Trang làm bài/đề thi học sinh: bỏ `alert()`, khung CLASS_LOCKED, lỗi 403/409 thân thiện | — | `brief.md` §5 |
| 058 | Analytics học sinh: chịu lỗi API, hiển thị `ai_feedback` đúng | — | `brief.md` §5 |
| 059 | Dọn lối vào học sinh: `/student`, `/student/landing` → dashboard, nhãn vai trò hồ sơ | — | `brief.md` §5 |
| 060 | Siết API lớp học sinh: STUDENT-only, whitelist cột, `checkLessonAccess` trước `assertClassOpen` (HIGH, nhạy cảm) | — | `brief.md` §5 |

**Lệnh xác minh chung** cho mọi task (ngoài `verify.sh` riêng):
```bash
npx vitest run && npx tsc --noEmit && npx next build
```

## 3. Việc tiếp theo (chưa giao)
| # | Việc | Ghi chú |
| :--- | :--- | :--- |
| N1 | Sau deploy FEAT-013: nhập cấu hình thanh toán (`/admin/orders`) và bảng giá model (`/admin/settings`); kiểm trình duyệt các trang mới. (Đã deploy, timezone UTC; migration 015 không cần — không đổi giá trị nào) | Người dùng |
| N2 | Thử AI nhập đề với file DOCX/PDF thật trên server | Từ kế hoạch 31/10 |
| N3 | Webhook ngân hàng tự duyệt đơn (SePay / Casso) | Gọi `approveOrder(id, "WEBHOOK", ref)` |
| N4 | Dump lại `e2e/schema.sql` từ DB thật sau khi deploy | Bản hiện tại là ngày 01/11 |

## 4. Tồn đọng: lệch giữa code và tài liệu / lỗi đã biết (phát hiện khi dựng lại docs 03/11)
| # | Mức | Vấn đề | Chỗ | Đề xuất |
| :--- | :--- | :--- | :--- | :--- |
| D1 | Cao | Menu học sinh "Đề Thi & Bài Tập" trỏ cứng `/student/class/cls_101` | `components/StudentLayout.tsx` | Trỏ về lớp đầu tiên hoặc danh sách lớp |
| D2 | TB | `users.password DEFAULT '123456'` trong DDL | `lib/db-pg.ts` `ensureSchema` | Migration mới bỏ DEFAULT (`ALTER COLUMN password DROP DEFAULT`) |
| D3 | TB | 4 tài khoản học sinh trên server còn mật khẩu plaintext | DB server | Đặt lại mật khẩu |
| D4 | Thấp | `ai_usage_logs.created_at` là TIMESTAMP không có múi giờ (server đã kiểm 03/11: Postgres chạy UTC → dashboard đúng) | migration 014 | Đổi sang TIMESTAMPTZ khi có dịp |
| D5 | Thấp | `e2e/schema.sql` thiếu migration 011–016 | `e2e/` | N4 |
| D6 | Thấp | Code / bảng di sản: `lib/kafka.ts`, `lib/db-schema.ts`, `lib/db-init.js`, bảng `exam_categories`, `lesson_exams`, `course_exams`, `orders` | `lib/`, DB | Xoá file; migration dọn bảng (hỏi người dùng) |
| D7 | ✅ 03/11 | ~~Tài liệu ngoài chuẩn~~ đã chuyển vào `docs/archive/`, README viết lại: `README.md` (mặc định create-next-app), `FEATURE_INDEX.md`, `SYSTEM_ARCHITECTURE.md`, `USERS.md`, `task.md`, `docs/ADR_AUTH.md`, `docs/ADR-001-…`, `docs/SCORING.md` (mô tả Supabase Auth / luồng chấm cũ) | gốc repo, `docs/` | Gộp phần còn đúng vào 01–14 rồi xoá hoặc chuyển vào `docs/archive/` |
| D8 | Thấp | Rác: `scratch/`, `scratch_inspect_neo4j.cjs` | gốc repo | Xoá |
| D10 | Cao | Tab "Sổ điểm" trang lớp gọi `grade-override` thiếu `section_scores` → luôn 400, đọc cột cũ (`final_score`, `ai_score`); `members` tính điểm từ bài nộp mọi lớp; AI bài học lỗi → 0 điểm; người tạo đề thấy bài lớp khác | `app/teacher/classes/[classId]/page.tsx`, `app/api/teacher/classes/[classId]/members/route.ts`, `app/api/lessons/grade-async/route.ts`, `app/api/teacher/submissions/route.ts` | ✅ Đã sửa trong FEAT-014 (TASK-044 → 046) |
| D11 | Nghiêm trọng | `forgot-password` trả `resetUrl` (kèm token) trong response và log ra console → ai biết email cũng đặt lại được mật khẩu người khác; thông điệp khác nhau giữa email có/không tồn tại | `app/api/auth/forgot-password/route.ts` | ✅ Đã sửa 08/11 (BR-A06, `tests/forgot-password-security.test.ts`) |
| D13 | TB | `/payment-policy` hứa "tự động gạch nợ, cấp slot ngay", cổng thẻ/ví và email hoá đơn tự động — chưa có; đơn giá 0 vẫn cho tạo đơn | `app/payment-policy/page.tsx`, `lib/slot-orders.ts` | ✅ 08/11: sửa câu chữ theo duyệt tay (kích hoạt trong giờ làm việc, hoá đơn theo yêu cầu), thêm BR-O10 |
| D12 | TB | Chưa có dịch vụ gửi email (quên mật khẩu, xác thực email, xác nhận đơn/hoá đơn mà `/payment-policy` đã hứa) và admin chưa có chức năng cấp lại mật khẩu người dùng | `lib/`, `app/admin/` | Tính năng mới qua `/grill-feature` |
| D9 | Thấp | File lớn: `components/question-builder/QuestionSetEditor.tsx` khoảng 2.860 dòng | — | Tách theo dạng câu hỏi khi có dịp |
