# TASK-021 — Chọn chuẩn chấm khi soạn đề và chuẩn mặc định của khóa học

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
FEAT-011 SCR-E2/E3 (DEC-014): giáo viên chọn chuẩn chấm cho đề khi soạn; khóa học có chuẩn mặc định cho các đề trong khóa.

## 2. Tài liệu bắt buộc đọc
- `docs/features/exam-server-grading.md` mục 4 (SCR-E2, SCR-E3), 6, 7 (BR-E01)
- `app/api/scoring-standards/route.ts` (GET danh sách chuẩn), `app/api/teacher/exams/route.ts` + `[id]/route.ts`, `app/api/teacher/courses/route.ts`
- `components/question-builder/QuestionSetEditor.tsx` (props, `QuestionSetSavePayload`), `app/teacher/tests/create/page.tsx`, `app/teacher/tests/page.tsx` (modal tạo/sửa khóa)
- Test: `tests/standard-selection.test.ts`

## 3. Phạm vi file
**Được sửa:** `app/api/teacher/exams/route.ts`, `app/api/teacher/exams/[id]/route.ts`, `app/api/teacher/courses/route.ts`, `components/question-builder/QuestionSetEditor.tsx`, `app/teacher/tests/create/page.tsx`, `app/teacher/tests/page.tsx` (chỉ modal khóa học).

**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, `lib/**`, các route/trang khác, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả chi tiết
- **Đề thi**: `POST /api/teacher/exams` và `PUT /api/teacher/exams/[id]` nhận `scoring_standard_id` (chuỗi id có trong `scoring_standards`, hoặc `null` để bỏ; không tồn tại → 400, không ghi). Lưu cột `exams.scoring_standard_id`. `GET [id]` và phản hồi POST/PUT trả trường này (trong `exam`). Giữ nguyên mọi hành vi khác.
- **Khóa học**: `POST`/`PUT /api/teacher/courses` nhận `default_scoring_standard_id` (tồn tại hoặc `null`; sai → 400). `GET` trả trường này cho mỗi khóa. Giữ nguyên kiểm quyền hiện có.
- **QuestionSetEditor** (chỉ `mode === "EXAM"`): prop mới `initialScoringStandardId?: string | null`; select "Chuẩn chấm điểm" lấy từ `GET /api/scoring-standards` (hiện `name` + nhãn khung), lựa chọn "— Theo khóa học / mặc định —" = `null`; thêm `scoring_standard_id` vào `QuestionSetSavePayload`. Khi đổi khóa học trong editor mà đề chưa chọn chuẩn, hiện gợi ý chuẩn mặc định của khóa (chỉ hiển thị, không ép).
- **Trang tạo đề**: truyền `initialScoringStandardId` từ `GET /api/teacher/exams/[id]`, gửi `scoring_standard_id` trong POST/PUT.
- **Modal khóa học** ở `/teacher/tests`: select "Chuẩn chấm mặc định" từ `GET /api/scoring-standards`, gửi `default_scoring_standard_id`.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-021`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Chỉ chèn đúng phần cần thiết vào các file lớn, không định dạng lại.
- Không import module server (`@/lib/db-pg`, `@/lib/ai-engine`…) vào component client (có test chặn).
- Không thêm thư viện mới.
