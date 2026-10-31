# TASK-022 — Trang làm đề mới (giờ theo server, LessonPlayer + ghi âm Speaking) và trang xem lại

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
FEAT-011 SCR-E4/E5: viết lại trang làm đề `/student/exam/[examId]` (hiện ~2.500 dòng, tự chấm ở trình duyệt, đếm giờ ở trình duyệt) theo luồng lượt thi do server quản lý (TASK-020), dùng `LessonPlayer` để hiển thị câu hỏi, thêm ghi âm Speaking; cập nhật trang xem lại hiển thị điểm theo chuẩn chấm.

## 2. Tài liệu bắt buộc đọc
- `docs/features/exam-server-grading.md` mục 3, 4 (SCR-E4, SCR-E5), 6 (phần **Học sinh**), 7 (BR-E05, BR-E07, BR-E08)
- API (TASK-020): `app/api/student/exams/[examId]/attempts/route.ts`, `…/content/route.ts`, `app/api/student/exam-attempts/[id]/answers/route.ts`, `…/submit/route.ts`, `app/api/submissions/[id]/route.ts`
- `components/lesson-player/LessonPlayer.tsx`, `lib/lesson-player.ts`, `lib/grading.ts` (`sanitizeQuestionForStudent` — thuần, dùng được ở client), `app/student/lesson/[lessonId]/page.tsx` (mẫu trang làm bài học)
- Test: `tests/exam-runner-ui.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:** `lib/exam-player.ts` (mới), `components/lesson-player/SpeakingRecorder.tsx` (mới), `components/lesson-player/LessonPlayer.tsx` (thêm prop `allowSpeaking` + render Speaking), `app/student/exam/[examId]/page.tsx` (viết lại), `app/student/exam/review/[submissionId]/page.tsx`.

**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, `lib/**` khác, mọi route API, trang khác, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả chi tiết
### 4.1 `lib/exam-player.ts` (thuần)
- `emptyExamAnswerFor(q)`: `category` bắt đầu `SPEAKING_` → `""`; còn lại → `emptyAnswerFor(q)` của `lib/lesson-player`.
- `groupQuestionsBySkill(questions)` → `{ skill, questions }[]` theo thứ tự `Listening, Reading, Writing, Speaking`, rồi kỹ năng khác theo thứ tự xuất hiện; giữ thứ tự câu.
- `formatRemaining(ms)`: `ms ≤ 0` → `"00:00"`; dưới 1 giờ `"mm:ss"`; từ 1 giờ `"h:mm:ss"`.

### 4.2 `SpeakingRecorder.tsx` (client)
Props `{ value: string; onChange(url: string): void; disabled?; prepSeconds?; speakingSeconds?; readAloudText?; topicHints? }`. Hiện văn bản đọc / gợi ý chủ đề; đếm thời gian chuẩn bị rồi ghi âm bằng `MediaRecorder` (tự dừng sau `speakingSeconds`); khi dừng → `POST /api/uploads` (FormData `kind = "speaking"`, `file`) → `onChange(json.url)`; có nút ghi lại, nghe lại (`<audio src={value}>`); lỗi micro/upload → thông báo.

### 4.3 `LessonPlayer`
Prop mới `allowSpeaking?: boolean` (mặc định `false` — bài học giữ nguyên "chưa hỗ trợ"). Khi `true` và `category` bắt đầu `SPEAKING_`: render `SpeakingRecorder` với `content.prep_time_seconds`, `content.speaking_time_seconds`, `content.read_aloud_text`, `content.topic_hints`; câu trả lời là URL chuỗi. Ở chế độ kết quả: hiện audio đã nộp + điểm AI (`items[0].score`) nếu có.

### 4.4 Trang làm đề `app/student/exam/[examId]/page.tsx` (< 700 dòng, bọc layout học sinh, `Suspense` cho `useSearchParams`)
- `classId` tuỳ chọn từ query.
- **Màn hình bắt đầu**: tiêu đề, thời gian, ghi chú "Đồng hồ tính theo máy chủ, tải lại trang không dừng giờ". Nút "Bắt đầu làm bài" → `POST /api/student/exams/${examId}/attempts { classId }`; `403` → thông báo không được làm đề; `409` → "Bạn đã hết lượt làm đề này"; hiện `remaining_attempts` nếu có. Nếu API trả lượt đang làm (200) → vào thẳng khung thi.
- **Khung thi**: `GET …/content`; khởi tạo câu trả lời từ `attempt.answers` hoặc `emptyExamAnswerFor`; tab theo `groupQuestionsBySkill`; mỗi tab render `LessonPlayer` (`allowSpeaking`); thanh trên: đồng hồ `formatRemaining(deadline_at − now)` cập nhật mỗi giây, "Đã trả lời x/y" (`countAnswered`), nút "Nộp bài" (xác nhận nếu còn câu trống).
- **Lưu tạm** mỗi 30 giây và khi đổi tab: `PUT /api/student/exam-attempts/${id}/answers`.
- **Hết giờ** → tự động nộp (auto-submit) đúng một lần. Dọn mọi timer khi rời trang.
- **Nộp**: `POST …/submit { answers }` → màn hình kết quả: bảng điểm từng phần (`section_scores[skill].score` / thang từ `standard.sections`), tổng `total_score`, `passed` (Đạt / Chưa đạt nếu khác null), nhãn "Nộp trễ" nếu `is_late`; `GRADING` → "Đang chấm Writing/Speaking…" và hỏi lại `GET /api/submissions/${id}` mỗi 5 giây tới khi khác `GRADING`; `NEEDS_REVIEW` → "Chờ giáo viên chấm phần tự luận". Nút "Xem chi tiết" → `/student/exam/review/${id}`.
- Bỏ toàn bộ logic cũ: tự chấm, `auto_graded_score`, đọc đáp án, `@/lib/supabase`, `@/lib/audio-storage`.

### 4.5 Trang xem lại
Từ `GET /api/submissions/${id}`: hiện `section_scores`, `total_score`, `passed`, `is_late`, trạng thái; danh sách câu: dựng bằng `sanitizeQuestionForStudent(q)` rồi render `LessonPlayer` ở chế độ kết quả với `submission.results` (và `allowSpeaking`). Giữ xử lý 403/404 hiện có.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Làm đề trọn luồng: bắt đầu → tải lại trang vẫn giữ giờ → nộp → kết quả → xem lại
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-022`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Không import module chỉ chạy server vào client (có test chặn); `lib/grading.ts`, `lib/lesson-player.ts`, `lib/exam-player.ts` là thuần nên được import.
- Không thêm thư viện mới.
