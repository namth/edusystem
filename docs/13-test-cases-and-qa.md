# 13 — Test case & tiêu chuẩn QA

> Cập nhật: 2026-11-03.
> - Bộ test tự động là đặc tả có thể chạy được. Mỗi file `tests/*.test.ts` mở đầu bằng mã task và mục đặc tả mà nó khoá.
> - Hiện có 56 file với 997 test, tất cả xanh ở nhánh FEAT-013.
> - Test case chi tiết theo từng tính năng (TC-E…, TC-L…) nằm trong mục "Test case" của `docs/features/*`.

## 1. Bản đồ test theo miền
| Miền / quy tắc | File test (Vitest) |
| :--- | :--- |
| Phân quyền API, phiên, bí mật | `api-auth`, `secrets-password`, `env-check`, `prod-hardening`, `client-bundle-safety`, `change-password` |
| Tài khoản, đăng ký, dùng thử (BR-A, BR-T) | `onboarding-api`, `onboarding-ui`, `teacher-trial`, `profile-slots-grading` |
| Slot học sinh (BR-S) | `student-slots`, `teacher-classes-api`, `student-api` |
| Đơn hàng & VietQR (BR-O) | `slot-orders-api`, `orders-ui`, `admin-api` (route cũ `/api/admin/requests`) |
| Bài học & lộ trình (BR-L) | `lessons-api`, `student-lessons-api`, `lesson-library-ui`, `lesson-player`, `lesson-preview`, `roadmap`, `class-roadmap-api`, `class-roadmap-ui`, `curriculum-api`, `curriculum-dnd`, `migration-006`, `grading`, `grading-hardening` |
| Đề thi, chuẩn chấm, lượt thi (BR-E) | `exam-scoring`, `exam-attempts-api`, `exam-flow`, `exam-layout`, `exam-runner-ui`, `exams-api`, `exam-library`, `standard-selection`, `scoring-standards-api`, `scoring-rubrics-merge`, `rubrics-pg`, `score-display`, `attempt-summary`, `stimulus-html` |
| Chấm AI & chi phí (BR-G) | `ai-usage`, `ai-import`, `exam-attempts-api` (grade-async / giveUp) |
| Thông báo (BR-N) | `notifications-api`, `notifications-lib` |
| Tổng quan admin (BR-D) | `admin-dashboard` |
| Kho, chuyển đổi, nhân bản, flashcard, upload | `library-convert-duplicate`, `flashcards-uploads-api`, `subjects` |
| Trang học sinh / landing | `student-pages`, `student-home`, `landing` |
| Quy tắc giao diện (DEC-022, DEC-035) | `brand-tokens`, `design-rules` |
| Tài liệu khớp code (DEC-036) | `docs-sync` |

E2E (Playwright, `e2e/`): `auth`, `rbac`, `onboarding`, `student-exam`, `teacher`, `admin`, `responsive`.

## 2. Ca kiểm bắt buộc theo rủi ro
| TC | Ca kiểm | Quy tắc | Test |
| :--- | :--- | :--- | :--- |
| TC-SEC01 | Mọi route không công khai: không có phiên → 401, sai vai trò → 403 | bất biến 2 | `api-auth`, từng file API |
| TC-SEC02 | Học sinh không nhận đáp án trước khi nộp (đề và bài học) | BR-L09, BR-E08 | `exam-attempts-api`, `student-lessons-api`, `prod-hardening` |
| TC-SEC03 | `student_id` trong body bị bỏ qua | bất biến 3 | `student-lessons-api` |
| TC-S01 | Hết slot → 409, không tạo user; học sinh đã có ở lớp khác → được vào | BR-S02, BR-S03 | `student-slots` |
| TC-S02 | Nộp bài có AI khi `slot_limit = 0` → vẫn `GRADING`, slot không đổi | BR-S06 | `exam-attempts-api`, `student-lessons-api` |
| TC-O01 | Duyệt đơn hai lần chỉ cộng slot một lần, lần hai trả 409 | BR-O04 | `slot-orders-api` |
| TC-O02 | Giáo viên gửi `total_cost` bị bỏ qua; admin đổi giá mà thiếu `note` → 400 | BR-O01, BR-O02 | `slot-orders-api` |
| TC-O03 | Payload VietQR đúng tag và CRC16 (bộ đọc TLV độc lập trong test) | BR-O08 | `slot-orders-api` |
| TC-G01 | AI lỗi 3 lần → `NEEDS_REVIEW`, không cho điểm thấp nhất | BR-G01 | `exam-attempts-api` |
| TC-G02 | Log AI ghi token thật, đúng ngữ cảnh route, không có số bịa | BR-G04 | `ai-usage` |
| TC-D01 | Ranh giới tháng theo giờ VN (mốc 00:30 và 23:30) | BR-D01 | `admin-dashboard` |
| TC-T01 | Dùng thử: lớp thứ 2, nội dung thứ 4, học sinh thứ 4 → bị chặn | BR-T02 | `teacher-trial` |

## 3. Tiêu chuẩn bàn giao (Definition of Done)
Một task hoặc PR chỉ được coi là xong khi:
1. `npx vitest run` xanh toàn bộ; test của task bị khoá trong `tests.lock` và không bị sửa (`python3 scripts/handoff.py verify <ID>`).
2. `npx tsc --noEmit` sạch.
3. `npx next build` thành công, với mọi thay đổi trang.
4. Tài liệu đã cập nhật chéo theo DEC-036 (`docs/09` §5), `tests/docs-sync.test.ts` xanh.
5. Thay đổi UI đi qua `docs/03` §3, có đủ 4 trạng thái.
6. Trước khi deploy: chạy `npm run e2e` và đi checklist `docs/qa/checklist-production.md`.

## 4. Báo cáo QA
- Báo cáo đặt ở `docs/qa/reports/QA-REPORT-YYYYMMDD-HHMM.md`. Hiện có `QA-REPORT-20261006-DOCX.md` (AI nhập DOCX).
- Mỗi báo cáo ghi: phạm vi, môi trường (local / server, commit), ca đã kiểm (TC-…), lỗi tìm thấy (mức độ, cách tái hiện), kết luận.
- **Chưa kiểm bằng trình duyệt sau FEAT-013:** trang `/admin`, `/admin/orders`, trang thanh toán QR (quét bằng app ngân hàng thật), tab Chuẩn chấm. Cần một báo cáo QA trước khi deploy.
