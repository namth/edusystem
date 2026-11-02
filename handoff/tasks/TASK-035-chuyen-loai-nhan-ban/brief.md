# TASK-035 — Chuyển qua lại bài học ↔ đề thi (chọn nhiều) và nhân bản bài học / đề thi

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Giáo viên đôi khi nhập nhầm nội dung vào Kho Bài Học thay vì Kho Đề Thi (hoặc ngược lại). Cần:
1. **Chuyển loại**: chọn một hoặc nhiều bài học → chuyển thành đề thi, và ngược lại. Đây là chuyển (bản gốc bị xoá), không phải sao chép.
2. **Nhân bản**: mỗi bài học / đề thi có nút "Nhân bản". Bấm vào thì hiện popup để giáo viên đặt tên mới trước khi tạo bản sao.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 2–4); `docs/14-decisions.md` DEC-002 (bảng lessons riêng, dùng chung bảng questions), DEC-004/005, DEC-023 (subject_id)
- `app/api/teacher/lessons/[id]/route.ts` (DELETE: kiểm lộ trình), `app/api/teacher/exams/[id]/route.ts` (DELETE: kiểm usages)
- `app/api/teacher/questions/route.ts` (định dạng id câu hỏi `q_` + uuid)
- `components/teacher/ExamLibraryPanel.tsx`, `components/teacher/LessonLibraryPanel.tsx`
- Test: `tests/library-convert-duplicate.test.ts` (mới). Toàn bộ test hiện có phải xanh.

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/teacher/library/convert/route.ts` (mới)
- `app/api/teacher/lessons/[id]/duplicate/route.ts` (mới)
- `app/api/teacher/exams/[id]/duplicate/route.ts` (mới)
- `lib/library-ops.ts` (mới, server — logic dùng chung: kiểm usages, sao chép câu hỏi)
- `components/teacher/DuplicateDialog.tsx` (mới, client)
- `components/teacher/ExamLibraryPanel.tsx`, `components/teacher/LessonLibraryPanel.tsx`

**Không được sửa:** mọi file trong `tests.lock`, route API khác, `lib/db-pg.ts`, `docs/`, `package*.json`, migration.

## 4. Đặc tả chi tiết
### 4.1 Quyền chung
`requireRole(["ADMIN","TEACHER"])` trước mọi truy vấn DB. TEACHER chỉ thao tác trên mục `created_by` = mình. ADMIN thao tác mọi mục.

### 4.2 `POST /api/teacher/library/convert`
- Body: `{ from: "lesson" | "exam", ids: string[], duration_minutes?: number }`.
- Trả 400 khi: `from` lạ; `ids` không phải mảng chuỗi, rỗng hoặc > 50 phần tử; `duration_minutes` có mặt nhưng không phải số nguyên ≥ 1.
- Xử lý **từng mục riêng**, mỗi mục trong một transaction (`getPgPool().connect()` → `BEGIN` / `COMMIT` / `ROLLBACK`). Một mục lỗi không ảnh hưởng mục khác.
- Trả 200 `{ success: true, results: [...] }`, đúng thứ tự `ids`. Mỗi phần tử là một trong:
  - `{ id, ok: true, new_id }`
  - `{ id, ok: false, reason, usages? }`, với `reason` là:
    - `NOT_FOUND`: mục không tồn tại;
    - `FORBIDDEN`: TEACHER không phải chủ;
    - `IN_USE`: mục đang được dùng; kèm `usages`;
    - `HAS_STIMULUS`: chỉ áp dụng khi chuyển đề → bài học (xem dưới).
- **Bài học → đề thi:**
  - Chặn `IN_USE` khi bài có dòng `curriculum_items.lesson_id` hoặc `lesson_attempts.lesson_id`. `usages = { curriculum, attempts }`.
  - Tạo `exams` với: id mới theo kiểu id đề hiện có, `title`, `description`, `skills`, `question_ids` (giữ nguyên thứ tự, **không** sao chép câu hỏi), `created_by` **giữ người tạo gốc**, `subject_id`, `duration_minutes` = tham số (mặc định 30), `stimulus_type = 'TEXT_ONLY'`, `created_at = NOW()`.
  - Sau đó xoá bài học.
- **Đề thi → bài học:**
  - Chặn `IN_USE` khi đề có dòng `curriculum_items.exam_id`, `class_assignments.exam_id` hoặc `submissions.exam_id`. `usages = { curriculum, assignments, submissions }`.
  - Chặn `HAS_STIMULUS` khi đề có `stimulus_text` hoặc `stimulus_audio_url` khác rỗng, vì bài học không có ngữ cảnh chung cấp đề nên sẽ mất dữ liệu.
  - Tạo `lessons` với: id `lsn_` + uuid, `title`, `description`, `skills`, `question_ids`, `created_by` gốc, `subject_id`.
  - Sau đó xoá đề.

### 4.3 Nhân bản
- `POST /api/teacher/lessons/[id]/duplicate` và `POST /api/teacher/exams/[id]/duplicate`, body `{ title }`.
- Lỗi:
  - `title` trim rỗng hoặc dài hơn 255 → 400;
  - không tồn tại → 404;
  - TEACHER không phải chủ → 403.
- **Sao chép SÂU câu hỏi.** Câu hỏi được sửa tại chỗ theo id; nếu dùng chung id thì sửa bản sao sẽ sửa luôn bản gốc. Với mỗi id trong `question_ids` (theo thứ tự):
  - tạo dòng `questions` mới: id `q_` + uuid, chép `skill, category, prompt, content, stimulus_text, stimulus_audio_url`, `created_by` = **người đang thao tác**;
  - id không còn tồn tại thì bỏ qua.
- Bản sao: `title` (đã trim), `created_by` = người đang thao tác, `question_ids` là id mới.
  - Bài học: chép `description, skills, subject_id`.
  - Đề thi: chép `description, duration_minutes, skills, passing_score, scoring_standard_id, stimulus_type, stimulus_text, stimulus_audio_url, subject_id`.
- **Không** mang theo lộ trình, giao lớp, lượt làm hay bài nộp.
- Toàn bộ trong một transaction. Trả 201: `{ success, lesson }` hoặc `{ success, exam }`.

### 4.4 Giao diện (token màu `brand-*`, `accent-*`, `ink*`, `line*`; không viết hex trong class)
- **`DuplicateDialog`** (client, dùng chung cho hai panel):
  - props `{ open, kind: "lesson" | "exam", sourceTitle, onClose, onDone(newItem) }`;
  - ô tên điền sẵn `"<tên gốc> (bản sao)"`, focus và bôi đen sẵn;
  - nút "Hủy" / "Nhân bản";
  - kiểm tra rỗng ngay trên form; khi đang gửi thì khoá nút và hiện spinner;
  - lỗi API hiện ngay trong popup; Enter để gửi, Esc để đóng.
- **Mỗi thẻ / hàng** (cả hai panel):
  - thêm nút "Nhân bản" (icon `Copy`) mở popup;
  - nhân bản xong thì tải lại danh sách và báo ngắn "Đã tạo bản sao …".
- **Chọn nhiều:**
  - mỗi thẻ có ô `type="checkbox"`; thêm ô "Chọn tất cả" cho danh sách đang hiển thị;
  - khi có mục được chọn, hiện thanh hành động dính: "Đã chọn N", nút **"Chuyển sang Đề thi"** (panel bài học) hoặc **"Chuyển sang Bài học"** (panel đề), nút "Bỏ chọn".
- **Chuyển loại:**
  - bấm "Chuyển sang …" thì hiện hộp xác nhận, giải thích: bản gốc sẽ chuyển hẳn sang kho kia; mục đang dùng trong lộ trình, đã giao lớp hoặc đã có lượt làm sẽ được bỏ qua;
  - panel bài học thêm ô "Thời gian làm bài (phút)", mặc định 30.
- **Sau khi chuyển:** hiện tóm tắt "Đã chuyển X / N". Liệt kê mục bị bỏ qua kèm lý do tiếng Việt:
  - `IN_USE`: "đang dùng: N mục lộ trình, N lớp giao, N bài nộp / N lượt làm";
  - `HAS_STIMULUS`: "đề có bài đọc chung, không chuyển sang bài học được";
  - `FORBIDDEN`: "không phải của bạn";
  - `NOT_FOUND`: "không còn tồn tại".
  - Sau đó tải lại danh sách và bỏ chọn.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-035`).
- Không dùng chung id câu hỏi khi nhân bản (bẫy chính). Không sao chép câu hỏi khi chuyển loại.
- Mỗi mục chuyển phải nằm trong transaction riêng. Lỗi giữa chừng phải ROLLBACK, không để mất cả hai bản.
- Không N+1 khi đếm usages cho một mục (gộp COUNT vào một truy vấn được thì càng tốt).
- Component client không import `@/lib/library-ops` / `@/lib/db-pg`. Không thêm thư viện.
