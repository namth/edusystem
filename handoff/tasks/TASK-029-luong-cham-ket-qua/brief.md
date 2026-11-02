# TASK-029 — Sửa luồng chấm đề + màn kết quả báo điểm từng phần (DEC-021)

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Rà soát luồng nộp → chấm → xem kết quả phát hiện: bài kẹt "đang chấm" vĩnh viễn (đẩy sự kiện trước khi lưu `GRADING`), học sinh lấy được đáp án khi đang làm qua `GET /api/submissions/[id]`, AI lỗi thì cho điểm min, worker không thử lại, mất nhận xét AI; màn kết quả chưa tách phần đã chấm / phần chờ. Sửa theo DEC-021. **TASK-030 chạy song song** (API + chuông thông báo, `grade-override`) — không chạm file của nó.

## 2. Tài liệu bắt buộc đọc
- `docs/14-decisions.md` DEC-016, DEC-018, DEC-021; `CONTEXT.md` mục 3
- `lib/notifications.ts` (đã có: `notifyExamGraded`, `notifyNeedsReview` — không ném lỗi), `docs/db-migration-010-notifications.sql`
- `lib/exam-attempts.ts` (`tallyAndScoreSections`, `formatAttemptResponse`), `lib/exam-ai-grading.ts`, `lib/ai-engine.ts` (kết quả có `feedback`)
- Test: `tests/exam-attempts-api.test.ts` (đã cập nhật), `tests/attempt-summary.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/student/exam-attempts/[id]/submit/route.ts`
- `app/api/exam/grade-async/route.ts`
- `app/api/submissions/[id]/route.ts`
- `lib/exam-ai-grading.ts`
- `lib/attempt-summary.ts` (mới, **không import module server** — trang client dùng)
- `worker/grading-worker.js`
- `app/student/exam/[examId]/page.tsx` (chỉ pha `result`)
- `app/student/exam/review/[submissionId]/page.tsx`

**Không được sửa:** mọi file trong `tests.lock`, `lib/notifications.ts`, `lib/exam-attempts.ts`, `app/api/exam/grade-override/**`, `app/api/notifications/**`, `components/**Layout.tsx`, `components/NotificationBell.tsx`, `docs/`, `package*.json`.

## 4. Đặc tả chi tiết
1. **submit:** có mục AI + còn slot → `UPDATE … status='GRADING'` (lưu answers/results/section_scores) **rồi mới** `pushGradingEvent`. Đẩy lỗi → cập nhật `NEEDS_REVIEW`, **hoàn slot** (`slot_limit + 1` cho đúng giáo viên đã trừ), `notifyNeedsReview`, vẫn trả 200. Hết slot → `NEEDS_REVIEW` + `notifyNeedsReview`. Bài toàn khách quan: giữ nguyên (GRADED ngay, **không** tạo thông báo).
2. **`gradeExamOpenAnswer`** trả `{ score: number, feedback: string | null }` (feedback lấy từ kết quả AI, cắt ≤ 2000 ký tự).
3. **grade-async:** lưu `r.score` và `r.feedback` vào từng mục AI của `results`. Mục nào lỗi đủ 3 lần → **không** gán điểm: giữ `score` chưa có, lưu `last_grading_error`, chuyển `NEEDS_REVIEW` (section_scores tính lại bằng `tallyAndScoreSections` → phần AI `score: null`, phần khách quan giữ), `total_score`/`passed` = NULL, hoàn slot cho giáo viên (cùng cách xác định như submit: GV lớp `class_ref`, không thì người tạo đề), `notifyNeedsReview`. Tất cả thành công → `GRADED` như cũ + `notifyExamGraded`.
4. **`GET /api/submissions/[id]`:** `STUDENT` + `status = 'IN_PROGRESS'` → 409 `{ success:false, error }`, không trả `questions`. Các trường hợp khác giữ nguyên.
5. **worker:** chỉ `XACK` khi `res.ok` và `json.success !== false`; lỗi thì để tin ở pending. Định kỳ (vd mỗi 60 giây) `XAUTOCLAIM` tin treo > 60 giây để xử lý lại; quá `MAX_DELIVERIES = 5` lần giao (đếm theo XPENDING/`times_delivered` hoặc bộ đếm trong bộ nhớ) → `XACK` + log lỗi để không lặp vô hạn. Giữ hai loại sự kiện hiện có.
6. **`lib/attempt-summary.ts` → `summarizeAttemptResult(attempt)`** trả `{ state, graded: {skill, score, earned, max}[], pending: string[], total, passed }` đúng như test (thứ tự theo `standard_snapshot.sections`, `total` ép số).
7. **Màn kết quả (pha `result`)** dùng `summarizeAttemptResult`:
   - `FINAL`: tổng điểm, Đạt/Chưa đạt, điểm từng phần.
   - `PARTIAL`: khối "Đã chấm" (điểm phần + `earned/max` câu đúng) và khối "AI đang chấm" liệt kê đúng tên phần trong `pending` (không hiện "0/1"); tổng ghi "Chờ phần …"; ghi chú "Có điểm, hệ thống sẽ báo ở mục Thông báo (chuông trên thanh đầu trang)".
   - `WAITING_AI`: thông báo đang chấm + cùng ghi chú.
   - `WAITING_TEACHER`: "Giáo viên sẽ chấm phần …", vẫn hiện phần đã chấm.
   - Giữ polling 5 giây khi `GRADING` (dừng khi đổi trạng thái, dọn interval).
8. **Trang xem lại:** khối tóm tắt dùng `summarizeAttemptResult` (cùng 4 trạng thái); câu AI đã chấm hiện điểm + `feedback` (nhận xét AI) dưới câu trả lời.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-029`); `npx`, `git`, `find`, `ls`, `rm` bị từ chối.
- Không thêm thư viện, không migration mới.
- Hoàn slot đúng một lần, đúng giáo viên đã bị trừ; không hoàn khi chưa từng trừ.
- Lỗi thông báo không được làm hỏng chấm bài (các hàm `notify*` đã tự nuốt lỗi — chỉ cần `await`).
- `lib/attempt-summary.ts` không import `@/lib/db-pg`, `@/lib/exam-attempts`… (`tests/client-bundle-safety.test.ts`).
