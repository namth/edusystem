# Báo cáo TASK-032

## Đã làm
- **4.1 Phân quyền `app/api/teacher/courses/route.ts`:**
  - Đặt `const auth = await requireRole(["ADMIN", "TEACHER"]); if (auth.error) return auth.error;` ở đầu cả 4 handler `GET`, `POST`, `PUT`, `DELETE` trước mọi truy vấn DB/Neo4j.
  - Giữ nguyên logic lọc theo chủ sở hữu; đổi mã trả về khi `PUT`/`DELETE` không cập nhật/xoá được dòng nào (`res.rowCount === 0`) từ `403` sang `404` `{ success: false, error: "Không tìm thấy khóa học hoặc bạn không có quyền." }`.
- **4.2 Phân quyền xem đề thi (`app/api/exams/[id]/route.ts`, `app/api/exams/[id]/content/route.ts`):**
  - Kiểm tra đề tồn tại trước (`404` nếu không có).
  - `GET /api/exams/[id]`: `ADMIN` xem mọi đề; `TEACHER` chỉ xem đề có `created_by = userId` hoặc `created_by IS NULL` (đề GV khác → `403`); `STUDENT` nhận `200` chỉ gồm các trường `id, title, description, duration_minutes, skills, passing_score, question_count` (tính từ độ dài `question_ids`, hỗ trợ cả mảng, chuỗi JSON hoặc `null` → `0`). Đã đối chiếu `app/student/exam/[examId]/page.tsx` chỉ dùng `id, title, duration_minutes` ở màn bắt đầu.
  - `GET /api/exams/[id]/content`: `STUDENT` → `403`; `TEACHER`/`ADMIN` theo quy tắc sở hữu đề như trên.
- **4.3 Bỏ điểm AI giả lập & gỡ route chẩn đoán:**
  - Xoá `app/api/admin/test-db/route.ts` và `app/api/admin/test-supabase/route.ts` (cùng thư mục).
  - `lib/portkey.ts`: khi thiếu `PORTKEY_API_KEY` ném `new Error("Chưa cấu hình PORTKEY_API_KEY")`; khi gateway lỗi ném lại lỗi (không fallback điểm giả `Band score 7.5`); bỏ `isSimulated`, bỏ mặc định `"student_01"`, bỏ `dangerouslyAllowBrowser`; chỉ ghi `ai_usage_logs` khi gọi cổng AI thật thành công.
  - `app/api/admin/test-portkey/route.ts`: bỏ `isSimulated` và mặc định `"student_01"`; khi `callPortkeyGrading` ném lỗi trả `502` `{ success: false, error: <message> }`.
  - `app/admin/teachers/[id]/page.tsx`: trong `handleTestPortkeyLive`, bỏ nhánh `isSimulated`, không gửi `studentId` cứng, hiển thị `res.error` qua `setErrorMsg`.
- **4.4 Giới hạn số lần thử (`lib/rate-limit.ts`, `app/api/auth/login/route.ts`, `app/api/auth/forgot-password/route.ts`):**
  - Tạo `lib/rate-limit.ts` cài đặt bộ đếm cửa sổ trượt trong bộ nhớ dùng `Date.now()`, tự dọn các khoá hết hạn, export `resetRateLimits()`, `checkRateLimit()`, `recordRateLimitHit()`, `clearRateLimit()`.
  - `POST /api/auth/login`: khoá `login:<identifier trim+lowercase>`; chặn `429` kèm header `Retry-After` khi đã có ≥ 10 lần đăng nhập sai trong 15 phút; ghi nhận 1 lần sai khi không tìm thấy tài khoản hoặc sai mật khẩu; xoá bộ đếm khi đăng nhập đúng.
  - `POST /api/auth/forgot-password`: khoá `forgot:<email lowercase>`; giới hạn tối đa 5 yêu cầu hợp lệ / 15 phút cho mỗi email, lần thứ 6 trả `429` kèm header `Retry-After`.

## File đã tạo/sửa
- `app/api/teacher/courses/route.ts` — gắn `requireRole(["ADMIN", "TEACHER"])` đầu hàm GET/POST/PUT/DELETE, trả 404 khi PUT/DELETE không khớp dòng nào.
- `app/api/exams/[id]/route.ts` — kiểm quyền sở hữu đề cho TEACHER/ADMIN và lọc trường công khai kèm `question_count` cho STUDENT.
- `app/api/exams/[id]/content/route.ts` — chặn STUDENT (403) và kiểm quyền sở hữu đề cho TEACHER/ADMIN.
- `lib/portkey.ts` — bỏ chế độ giả lập điểm AI, ném lỗi khi thiếu `PORTKEY_API_KEY` hoặc gateway lỗi, chỉ ghi log khi gọi thật thành công.
- `app/api/admin/test-portkey/route.ts` — trả 502 kèm thông báo lỗi khi gọi Portkey thất bại, bỏ `isSimulated` và `student_01`.
- `app/admin/teachers/[id]/page.tsx` — cập nhật `handleTestPortkeyLive` bỏ nhánh Simulation và `student_01`, hiển thị lỗi qua `errorMsg`.
- `app/api/admin/test-db/route.ts` — đã xoá (cùng thư mục `app/api/admin/test-db`).
- `app/api/admin/test-supabase/route.ts` — đã xoá (cùng thư mục `app/api/admin/test-supabase`).
- `lib/rate-limit.ts` — tạo mới bộ đếm rate-limit cửa sổ trượt trong bộ nhớ.
- `app/api/auth/login/route.ts` — áp dụng giới hạn 10 lần sai / 15 phút theo tài khoản.
- `app/api/auth/forgot-password/route.ts` — áp dụng giới hạn 5 yêu cầu / 15 phút theo email.

## Kết quả tự kiểm
Output của `python3 scripts/handoff.py verify TASK-032`:
```text
$ bash handoff/tasks/TASK-032-va-loi-chan-production/verify.sh

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/exam-flow.test.ts > GET /api/exams/[id]/content — đề + câu hỏi + flashcard > câu hỏi theo đúng thứ tự question_ids, bỏ qua id không tồn tại
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ tests/exam-flow.test.ts:81:26
     79|     await loginAs("STUDENT", "s1");
     80|     const json = await (await get("e1")).json();
     81|     expect(json.success).toBe(true);
       |                          ^
     82|     expect(json.exam).toMatchObject({ id: "e1", title: "Đề Một", durat…
     83|     expect(json.questions.map((q: any) => q.id)).toEqual(["q3", "q1", …

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  tests/exam-flow.test.ts > GET /api/exams/[id]/content — đề + câu hỏi + flashcard > không có question_ids → questions rỗng (không trả toàn bộ ngân hàng câu hỏi)
AssertionError: expected undefined to deeply equal []

- Expected: 
[]

+ Received: 
undefined

 ❯ tests/exam-flow.test.ts:90:28
     88|     await loginAs("STUDENT", "s1");
     89|     const json = await (await get("e2")).json();
     90|     expect(json.questions).toEqual([]);
       |                            ^
     91|     expect(json.flashcards).toEqual([]);
     92|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  tests/exam-flow.test.ts > GET /api/exams/[id]/content — đề + câu hỏi + flashcard > flashcards: chỉ các thẻ được câu hỏi FLASHCARD tham chiếu
TypeError: Cannot read properties of undefined (reading 'map')
 ❯ tests/exam-flow.test.ts:97:28
     95|     await loginAs("STUDENT", "s1");
     96|     const json = await (await get("e1")).json();
     97|     expect(json.flashcards.map((f: any) => f.id).sort()).toEqual(["f1"…
       |                            ^
     98|   });
     99| });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯


 Test Files  1 failed | 40 passed (41)
      Tests  3 failed | 702 passed (705)
   Start at  18:57:34
   Duration  236.29s (transform 19.15s, setup 0ms, collect 16.59s, tests 1480.15s, environment 12ms, prepare 17.48s)


KẾT QUẢ: khoá test OK, verify.sh exit 1
```

Kiểm tra riêng `npx tsc --noEmit -p tsconfig.json`:
```text
EXIT: 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
- **Xung đột trực tiếp giữa test mới (`tests/prod-hardening.test.ts`) và test cũ bị khoá (`tests/exam-flow.test.ts`):**
  1. Đặc tả `brief.md` mục 4.2 và `tests/prod-hardening.test.ts` (dòng 92–96) yêu cầu:
     `GET /api/exams/[id]/content`: `STUDENT` → `403` (`expect((await examContent("eMine")).status).toBe(403)` khi `loginAs("STUDENT", "s1")`).
  2. Tuy nhiên, file test cũ `tests/exam-flow.test.ts` (dòng 78–98, thuộc `TASK-005` và đang bị khoá bởi `tests.lock`) cũng gọi `GET /api/exams/e1/content` và `GET /api/exams/e2/content` với `await loginAs("STUDENT", "s1")` nhưng lại kỳ vọng HTTP 200 (`expect(json.success).toBe(true)`, `expect(json.questions)...`).
  3. Ngoài ra, `tests/exam-attempts-api.test.ts` (dòng 177–182) có test `"/api/exams/[id]/content với STUDENT cũng trả bản đã ẩn đáp án"` (hiện vẫn pass vì chỉ kiểm chuỗi trả về không chứa `"correct_answer"`, nhưng ngữ nghĩa gốc là từ trước khi chặn STUDENT ở `/api/exams/[id]/content`).
- Theo Quy tắc 2 trong `.agents/rules/vai-tro-ky-su-thuc-thi.md` (*"Không bao giờ sửa, xoá, đổi tên, hay 'skip' test do trưởng phòng viết — gồm `verify.sh` và mọi file trong `tests.lock`. Test đỏ nghĩa là code sai. Nếu tin rằng test sai, ghi lý do vào `report.md` mục 'câu hỏi' và dừng; không lách test"*), em giữ nguyên code đúng đặc tả TASK-032 (toàn bộ `tests/prod-hardening.test.ts`, `tests/api-auth.test.ts` và 38 file test khác đều đã xanh, `tsc --noEmit` exit 0) và dừng lại báo Trưởng phòng cập nhật `tests/exam-flow.test.ts` (đổi `loginAs("STUDENT", "s1")` thành `loginAs("TEACHER", "t1")` ở dòng 79, 88, 95) cùng `tests.lock`.
