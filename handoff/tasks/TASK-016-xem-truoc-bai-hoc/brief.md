# TASK-016 — Xem trước bài học như học sinh cho giáo viên (SCR-L3)

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Trong trang soạn bài `/teacher/lessons/[id]`, nút "Xem trước như học sinh" mở modal làm bài bằng đúng trình làm bài của học sinh (`LessonPlayer`, TASK-014) với nội dung **đã ẩn đáp án**; nộp thử → chấm khách quan ngay, **không lưu** lần làm.

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 4 (SCR-L3)
- `lib/grading.ts`, `app/api/student/lessons/[lessonId]/route.ts` và `…/attempts/route.ts` (cách sanitize + chấm — làm tương tự nhưng không ghi DB)
- `app/api/teacher/lessons/[id]/route.ts` (quyền với bài học), `components/lesson-player/LessonPlayer.tsx` (props), `lib/lesson-player.ts`
- `app/teacher/lessons/[id]/page.tsx` (TASK-013)
- Test: `tests/lesson-preview.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/teacher/lessons/[id]/preview/route.ts` (mới: GET, POST)
- `app/teacher/lessons/[id]/page.tsx` (thêm nút + modal xem trước)

**Không được sửa:**
- Mọi file trong `tests.lock`, `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/**`, các route/trang/component khác (kể cả `LessonPlayer`, `QuestionSetEditor`)
- `stitch_english_mock_exam_portal/`

## 4. Đặc tả chi tiết
### 4.1 `app/api/teacher/lessons/[id]/preview/route.ts`
- `requireRole(["ADMIN","TEACHER"])` dòng đầu, trước `await params`. Bài học không có → 404; TEACHER mà `created_by ≠ userId` → 403.
- **GET** → `200 { success, lesson: { id, title, description }, questions, flashcards }` — câu hỏi theo thứ tự `question_ids`, mỗi câu qua `sanitizeQuestionForStudent`; flashcard được câu `*FLASHCARD*` tham chiếu, qua `sanitizeFlashcardForStudent`.
- **POST** `{ answers }` (`answers` phải là object, không phải mảng/null → 400) → chấm từng câu bằng `gradeQuestion(q, answers[q.id], flashcardsMap)` (map bản đầy đủ), `summarizeResults`, `score_percent = computeScorePercent(objE, objM, 0, aiMax)` → `200 { success, results, objective_earned, objective_max, ai_max, score_percent }`. **Không ghi DB, không trừ slot, không gọi AI.**

### 4.2 Trang soạn bài
- Chỉ hiện nút "Xem trước như học sinh" khi bài học đã có id (không phải `new`).
- Bấm → modal toàn màn hình: tải `GET …/preview`, render `LessonPlayer` (state `answers` khởi tạo bằng `emptyAnswerFor`), nút "Chấm thử" → `POST …/preview` → truyền `results` vào `LessonPlayer`, hiện `score_percent` và ghi chú "Phần tự luận chỉ được AI chấm khi học sinh làm bài". Nút "Làm lại" và "Đóng".
- Đủ trạng thái đang tải / lỗi + "Thử lại" trong modal.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-016`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Dùng lại hàm của `lib/grading.ts`, không viết lại logic chấm/ẩn đáp án.
- Không thêm thư viện mới.
