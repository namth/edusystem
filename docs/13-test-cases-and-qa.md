# 13 — Test case & tiêu chuẩn QA

> Cập nhật: 2026-11-23.
> - Bộ test tự động là đặc tả có thể chạy được. Mỗi file `tests/*.test.ts` mở đầu bằng mã task và mục đặc tả mà nó khoá.
> - Hiện có 71 file với 1269 test, tất cả xanh sau FEAT-015/016 và TASK-054, 055 (23/11/2026).
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
| Bảng điểm (BR-B, FEAT-014) | `gradebook` (lõi, TASK-044), `teacher-grading-api` (TASK-045), `teacher-grading-ui`, `student-gradebook-ui` (TASK-046/047). Ca TC-B01 → TC-B16 ở `docs/features/cham-diem-bang-diem.md` §8 |
| Chuyển dạng câu nhập đề (BR-I, FEAT-015) | `question-conversion` (TASK-051), `ai-import`, `document-parser-html` (TASK-052), `ai-studio-ui`, `lesson-player` (TASK-053), `grading` (đáp án thay thế, TASK-054), `question-editor-mapping` (sửa câu nhập AI, kho từ bấm-điền, TASK-055). Ca TC-I01 → TC-I33 ở `docs/features/chuyen-doi-dang-cau-nhap-de.md` §8 |
| Bài học & đề theo Phần (BR-P, FEAT-017, dự kiến) | `exam-structure` (TASK-056), `exams-api`, `lessons-api`, `exam-attempts-api`, `student-lessons-api`, `library-convert-duplicate` (TASK-057), `section-editor` (TASK-058), `exam-layout` (TASK-059), `ai-import` (TASK-060), `migrate-sections` (TASK-061). Ca TC-P01 → TC-P20 ở `docs/features/phan-bai-hoc-de-thi.md` §8 |
| Cảnh báo admin (BR-W, FEAT-016) | `admin-alerts`, `server-error`, `env-check` (TASK-048), `server-error-coverage` (TASK-049), `admin-alerts-api`, `admin-alerts-ui`, `admin-dashboard` (thứ tự menu) (TASK-050). Ca TC-W01 → TC-W14 ở `docs/features/canh-bao-admin.md` §8 |
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
| TC-B01 | Giáo viên không phải chủ lớp / người tạo đề lớp khác / học sinh gọi API chấm → 403 | BR-B01, DEC-038 | `teacher-grading-api` |
| TC-B08 | Chốt khi còn `GRADING`/`NEEDS_REVIEW` → 409; còn chưa xem → 409 tới khi xác nhận | BR-B08 | `teacher-grading-api` |
| TC-B11 | Học sinh chỉ thấy dòng của mình, bài đã chốt | BR-B11 | `teacher-grading-api` |
| TC-B12 | AI bài học lỗi 3 lần → `NEEDS_REVIEW`, không 0 điểm | BR-B12 | `gradebook`, `student-lessons-api` |
| TC-D01 | Ranh giới tháng theo giờ VN (mốc 00:30 và 23:30) | BR-D01 | `admin-dashboard` |
| TC-T01 | Dùng thử: lớp thứ 2, nội dung thứ 4, học sinh thứ 4 → bị chặn | BR-T02 | `teacher-trial` |
| TC-I02 | Câu cloze nhập bằng AI: chuyển đổi → ẩn đáp án → chấm với câu trả lời đúng được điểm tối đa (không còn "(25)" làm đáp án) | BR-I03, BR-I06 | `question-conversion` |
| TC-I09 | Câu nhập thiếu đáp án không bao giờ thành "A"; nhập khi còn thiếu → 400 | BR-I07 | `question-conversion`, `ai-import` |
| TC-P07 | Lưu cả cây: đổi thứ tự phần, chuyển câu giữa phần, thêm / bỏ câu → đúng `position`, `section_id`; lỗi giữa chừng → rollback | BR-P07 | `exams-api`, `lessons-api` |
| TC-P09 | Hai tab sửa cùng đề: `updated_at` cũ → 409, DB không đổi | BR-P08 | `exams-api` |
| TC-P10 | Đề đã có bài nộp: bỏ câu → xoá mềm; học sinh mới không thấy; xem lại bài cũ vẫn thấy câu và điểm | BR-P09, BR-P10 | `exams-api`, `exam-attempts-api` |
| TC-P12 | Nội dung học sinh theo phần không lộ đáp án, không có câu xoá mềm | BR-P10, BR-E08 | `exam-attempts-api`, `student-lessons-api` |
| TC-W04 | 25 lỗi khác nhau trong 1 giờ → tối đa 20 tin Telegram + 1 tin chạm trần, DB đủ 25 dòng | BR-W04 | `admin-alerts` |
| TC-W06 | Email, SĐT, JWT, mật khẩu trong lỗi bị làm sạch trước khi ghi DB / gửi Telegram | BR-W06 | `admin-alerts` |
| TC-W09 | Không route nào trả 500 mà không qua `serverError` | BR-W08 | `server-error-coverage` |

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
