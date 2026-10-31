# Báo cáo TASK-007

## Đã làm
- Đưa toàn bộ DDL migration 006 từ `docs/db-migration-006-lessons.sql` vào `ensureSchema()` trong `lib/db-pg.ts` sau phần migration 005 và sau `CREATE TABLE IF NOT EXISTS curriculum_items`.
- Hiện thực module thuần `lib/grading.ts` không import DB, React hay `next/*`:
  - `gradeQuestion`: chấm khách quan 15 dạng câu hỏi phía server (MC, điền ô trống 3 dạng, sắp xếp câu/từ, nối cặp, flashcard, điền tự do, viết lại câu), phân loại `OBJECTIVE`, `AI` (tự luận, trả lời ngắn) và `UNSUPPORTED` (Speaking và dạng khác).
  - `sanitizeQuestionForStudent`: ẩn đáp án theo danh sách trắng (bỏ `correct_answer(s)`, `passage` thay bằng `passage_parts` + `gap_count`, `correct_text` thay bằng `items` sắp xếp, `pairs` tách thành `left` và `right` sắp xếp, v.v.), không thay đổi đối tượng đầu vào.
  - `sanitizeFlashcardForStudent`: trả đúng `{ id, vietnamese_name, image_url, audio_url, options }` với options sắp xếp theo chuẩn quy định.
  - `summarizeResults` và `computeScorePercent`: tổng hợp điểm và tính phần trăm làm tròn 1 chữ số thập phân, mẫu số bằng 0 trả về 100%.
- Tự kiểm bằng `verify.sh` đạt kết quả exit 0: toàn bộ 10 test suite với 275 unit test và kiểm tra kiểu TypeScript (`tsc --noEmit`) đều thành công.

## File đã tạo/sửa
- `lib/grading.ts` (mới): Module thuần chấm khách quan phía server và ẩn đáp án câu hỏi cho học sinh.
- `lib/db-pg.ts` (sửa): Bổ sung DDL migration 006 vào cuối khối DDL trong `ensureSchema()`.

## Kết quả tự kiểm
```
 Test Files  10 passed (10)
      Tests  275 passed (275)
   Start at  11:48:25
   Duration  30.88s (transform 378ms, setup 0ms, collect 412ms, tests 59.68s, environment 1ms, prepare 431ms)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
