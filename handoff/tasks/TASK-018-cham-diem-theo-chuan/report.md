# Báo cáo TASK-018

## Đã làm
- Đã đưa DDL `docs/db-migration-009-scoring-standards.sql` (bảng `scoring_standards`, các cột mới cho `exams`, `courses`, `submissions`, chỉ mục và seed 4 chuẩn hệ thống) nguyên văn vào cuối khối DDL trong `ensureSchema()` của `lib/db-pg.ts`.
- Đã tạo module thuần `lib/exam-scoring.ts`:
  - `roundToStep`: làm tròn nửa lên tới bội của `step`, khử sai số dấu phẩy động và kẹp trong khoảng `[min, max]`.
  - `scoreSection`: tính điểm từng phần thi theo chuẩn (tuyến tính hoặc bảng tra quy đổi tỉ lệ câu đúng, fallback tuyến tính khi có mục AI, trả về `null` khi không có câu hỏi).
  - `aggregateTotal`: tính điểm tổng theo phương pháp AVERAGE / SUM / WEIGHTED trên các phần có điểm, làm tròn theo `round_step`, xác định `passed` theo `pass_score` và mức sàn `section_min`.
- Đã bổ sung tuỳ chọn thứ 4 `options?: { speaking?: "AI" | "UNSUPPORTED" }` cho `gradeQuestion` trong `lib/grading.ts`: mặc định giữ nguyên UNSUPPORTED cho bài học; khi `{ speaking: "AI" }` và `category` bắt đầu bằng `SPEAKING_` thì trả về kết quả dạng AI (`max: 1`, `earned: 0`, key `speaking`).
- Đã cập nhật `gradeOpenAnswer` trong `lib/lesson-ai-grading.ts` để khi `category` bắt đầu bằng `SPEAKING_` sẽ gọi `evaluateSpeakingWithAudio(answer, prompt)` từ `lib/ai-engine.ts`, kẹp điểm trong khoảng 0–9 và trả về 0 nếu audio rỗng.
- Toàn bộ 23 test file (462 tests) cùng TypeScript compilation (`tsc`) đều pass exit code 0.

## File đã tạo/sửa
- `lib/exam-scoring.ts`: Tạo mới module thuần tính điểm từng phần và điểm tổng theo chuẩn chấm thi.
- `lib/grading.ts`: Thêm tham số tuỳ chọn thứ 4 cho `gradeQuestion` hỗ trợ chấm Speaking bằng AI cho đề thi.
- `lib/lesson-ai-grading.ts`: Tích hợp `evaluateSpeakingWithAudio` khi chấm các câu hỏi Speaking dạng tự do / mở.
- `lib/db-pg.ts`: Bổ sung DDL migration 009 và seed 4 chuẩn chấm thi hệ thống vào `ensureSchema()`.

## Kết quả tự kiểm
```
 Test Files  23 passed (23)
      Tests  462 passed (462)
   Start at  14:35:04
   Duration  39.75s (transform 1.73s, setup 0ms, collect 2.02s, tests 258.23s, environment 4ms, prepare 1.81s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
