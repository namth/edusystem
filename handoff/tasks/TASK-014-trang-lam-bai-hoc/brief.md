# TASK-014 — Trang làm bài học của học sinh (LessonPlayer + kết quả + chờ AI)

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
SCR-L7 của FEAT-010: học sinh mở bài học từ tab Lộ trình (`/student/lesson/[lessonId]?classId=…`), làm các khối bài tập (15 dạng câu, nội dung **đã ẩn đáp án**), nộp → xem kết quả từng câu kèm đáp án; phần tự luận hiện "AI đang chấm" và tự cập nhật; làm lại không giới hạn; xem lịch sử các lần làm. Backend đã có ở TASK-011.

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 4 (SCR-L7), mục 6 (phần **Học sinh**), mục 7 (BR-L06 → BR-L11, máy trạng thái)
- `lib/grading.ts` — **bảng định dạng câu trả lời** (`gradeQuestion`) và hình dạng câu hỏi sau `sanitizeQuestionForStudent` (`passage_parts`, `gap_count`, `items`, `left`/`right`, `starting_cue`…)
- `app/api/student/lessons/[lessonId]/route.ts`, `…/attempts/route.ts`, `app/api/student/attempts/[id]/route.ts` — hình dạng phản hồi
- `app/student/exam/[examId]/page.tsx` — tham khảo cách hiện các dạng câu, audio, flashcard của trang làm đề (giữ phong cách giao diện)
- Test: `tests/lesson-player.test.ts`

## 3. Phạm vi file
**Được tạo (tất cả mới):**
- `lib/lesson-player.ts` (hàm thuần)
- `components/lesson-player/LessonPlayer.tsx`
- `components/lesson-player/*` (được tách thêm tối đa 4 file con: renderer theo nhóm dạng câu, khung kết quả…)
- `app/student/lesson/[lessonId]/page.tsx`

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, mọi file đã có (`lib/**` ngoài file mới, route API, trang khác, `components/question-builder/**`)
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)

## 4. Đặc tả chi tiết

### 4.1 `lib/lesson-player.ts` — hàm thuần (không React/DOM)
```ts
export function emptyAnswerFor(q: { category: string; content: any }): unknown; // câu đã sanitize
export function setAnswerPart<T>(answer: T, key: string | number, value: unknown): T; // trả bản sao
export function countAnswered(questions: { id: string; category: string; content: any }[], answers: Record<string, unknown>): number;
```
- `emptyAnswerFor`: `*_MC`, `*_MATCHING`, `*_FLASHCARD_SET`, `WRITING_SHORT_ANSWER` → `{}`; `*_FILL_IN`, `WRITING_FREE_TYPING_BLANKS` → mảng `""` dài `content.gap_count`; `*_ORDERING` → `[]`; `WRITING_SENTENCE_REWRITE`, `WRITING_ESSAY` → `""`; dạng khác → `null`.
- `setAnswerPart`: mảng → bản sao với phần tử `key` thay bằng `value`; object → `{ ...answer, [key]: value }`. Không đổi đầu vào.
- `countAnswered`: câu tính là đã trả lời khi: chuỗi `trim()` khác rỗng; mảng có ít nhất một phần tử khác rỗng (sau `trim` nếu là chuỗi); object có ít nhất một giá trị chuỗi khác rỗng.

### 4.2 `components/lesson-player/LessonPlayer.tsx`
```ts
"use client";
props: {
  questions: any[];            // đã sanitize, theo thứ tự
  flashcards: any[];           // đã sanitize (id, vietnamese_name, image_url, audio_url, options)
  answers: Record<string, unknown>;
  onChange: (questionId: string, answer: unknown) => void;
  results?: any[] | null;      // GradeResult[] sau khi nộp → chế độ xem kết quả (chỉ đọc)
  disabled?: boolean;
}
```
- Khởi tạo câu trả lời bằng `emptyAnswerFor`, cập nhật bằng `setAnswerPart` (import từ `@/lib/lesson-player`).
- Mỗi khối hiển thị: số thứ tự, kỹ năng, `prompt` (chỉ dẫn), ngữ cảnh `stimulus_text` (văn bản) và/hoặc `stimulus_audio_url` (`<audio controls>`), rồi phần trả lời theo dạng:
  | Dạng | Giao diện | Câu trả lời |
  | :--- | :--- | :--- |
  | `*_MC` | từng câu con: `text`, 4 lựa chọn A–D (`option_a…d`), audio câu con nếu có `audio_url` | `{ [subId]: "A".."D" }` |
  | `*_FILL_IN` | ghép `passage_parts` xen kẽ ô trống: `INLINE_SELECT` → `<select>` từ `inline_options_per_gap[i].options`; `OPTION_BANK` → hiện ngân hàng từ `option_bank`, mỗi ô chọn/kéo một từ; `FREE_TYPING` → input | `string[]` theo chỉ số ô |
  | `*_ORDERING` | các mảnh `items`; bấm mảnh để thêm vào dòng đáp án, bấm lại để gỡ | `string[]` theo thứ tự chọn |
  | `*_MATCHING` | cột trái `left[]`, mỗi dòng có `<select>` chọn từ `right[]` | `{ [left.id]: rightText }` |
  | `*_FLASHCARD_SET` | thẻ theo `content.flashcard_ids` (tra trong `flashcards`): ảnh, nghĩa tiếng Việt, audio; `READING_*` chọn từ `options`, `WRITING_*` gõ tự do | `{ [flashcardId]: word }` |
  | `WRITING_FREE_TYPING_BLANKS` | `passage_parts` xen input | `string[]` |
  | `WRITING_SENTENCE_REWRITE` | câu gốc `original_sentence`, ô nhập có tiền tố `starting_cue` | `string` |
  | `WRITING_ESSAY` | textarea + đếm từ (so `min_words`) | `string` |
  | `WRITING_SHORT_ANSWER` | từng câu con: `text` + input (giới hạn `max_words`) | `{ [subId]: string }` |
  | khác | ghi chú "Dạng câu hỏi chưa hỗ trợ" | — |
- Có `results`: khoá nhập liệu, mỗi mục tô xanh/đỏ theo `items[].correct`, hiện `expected` (đáp án đúng) cạnh câu sai; mục `kind === "AI"`: nếu chưa có `band` → "AI đang chấm…", có `band` → "Band x/9".

### 4.3 `app/student/lesson/[lessonId]/page.tsx`
- Đọc `classId` từ query (bọc `Suspense` cho `useSearchParams`). Thiếu `classId` → thông báo lỗi.
- Tải `GET /api/student/lessons/${lessonId}?classId=` và `GET /api/student/lessons/${lessonId}/attempts?classId=` song song. `403` → hiện `json.error` (vd "Bài học chưa được mở") + link về `/student/class/${classId}`; `404` → "Không tìm thấy bài học"; lỗi khác → "Thử lại".
- Thanh trên: tiêu đề, mô tả, "Đã trả lời x/y" (`countAnswered`), nút "Nộp bài" (xác nhận nếu còn câu trống).
- Nộp: `POST /api/student/lessons/${lessonId}/attempts { classId, answers }` → hiện kết quả: điểm `score_percent`% (hoặc "Đang chấm phần tự luận…" khi `GRADING`), so với ngưỡng lớp nếu có; `AI_SKIPPED` → ghi chú "Phần tự luận chưa được chấm (giáo viên hết lượt AI)".
- Khi `status === "GRADING"`: hỏi lại `GET /api/student/attempts/${id}` mỗi 3 giây đến khi khác `GRADING`; dọn timer khi rời trang/khi xong.
- Nút "Làm lại" → xoá câu trả lời (về `emptyAnswerFor`), ẩn kết quả. Lịch sử các lần làm (thời gian `vi-VN`, điểm, trạng thái); bấm một lần cũ → xem kết quả lần đó (chỉ đọc).
- Nút "← Về lộ trình lớp" → `/student/class/${classId}`.
- Bọc layout học sinh như các trang học sinh khác.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Làm, nộp, xem kết quả, chờ AI, làm lại chạy trọn luồng
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách kiểm tra chuỗi.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-014`). `npx`, `git`, `find`, `ls`, `rm` đều bị từ chối quyền — đọc/ghi file bằng công cụ file.
- Định dạng câu trả lời phải **đúng bảng 4.2** (khớp `lib/grading.ts`), nếu không bài sẽ bị chấm sai.
- Không gọi API nào trả đáp án trước khi nộp; không tự chấm ở trình duyệt.
- Không import `@/lib/grading` vào component client nếu không cần (module thuần, import được, nhưng không dùng để chấm).
- Không thêm thư viện mới (kéo thả dùng thao tác bấm, không cần thư viện DnD).
