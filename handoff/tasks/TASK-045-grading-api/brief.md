# TASK-045 — API chấm & bảng điểm theo lớp, gradebook học sinh, bỏ API chấm cũ

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** HIGH
**Nhạy cảm:** có <!-- phân quyền theo lớp, điểm chính thức -->

## 1. Mục tiêu
Làm toàn bộ phần server của FEAT-014 dựa trên lõi `lib/gradebook.ts` (TASK-044, đã merge):
- API giáo viên: hub lớp, bảng điểm từng bài, xem và sửa lượt, chọn lượt, chốt, mở chốt, tổng kết;
- API bảng điểm cho học sinh;
- thông báo `GRADEBOOK_FINALIZED`;
- vá lỗi rò điểm ở API `members`;
- bỏ `GET /api/teacher/submissions` và `PUT /api/exam/grade-override`.

## 2. Tài liệu bắt buộc đọc
- `docs/features/cham-diem-bang-diem.md`:
  - §2 phân quyền;
  - §6 hợp đồng API, **là nguồn chính**;
  - §7 BR-B01 → BR-B11;
  - §8 TC-B01, 02, 05, 08–11, 14, 15.
- `lib/gradebook.ts`: dùng các hàm có sẵn, không viết lại logic.
- `docs/07-api-contracts.md` §1 (quy ước phản hồi), §2.3; `docs/06-database-schema.md` §2.4–2.5.
- `CONTEXT.md` mục 3 (bất biến: `requireRole`, không tin `student_id` từ body…).

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/gradebook-data.ts` (mới: các truy vấn DB; hàm thuần giữ nguyên ở `lib/gradebook.ts`)
- `app/api/teacher/grading/` (mới, toàn bộ route ở §6 của đặc tả)
- `app/api/student/classes/` (mới: `[classId]/gradebook/route.ts`)
- `app/api/teacher/classes/` (sửa: `[classId]/members/route.ts`)
- `lib/notifications.ts`
- `app/api/teacher/submissions/route.ts` (xoá)
- `app/api/exam/grade-override/route.ts` (xoá)
- `docs/07-api-contracts.md`: chuyển đoạn "Dự kiến FEAT-014" thành các dòng bảng có đường dẫn đầy đủ; xoá 2 dòng route đã bỏ
- `docs/02-modules-and-features.md`: chỉ sửa ma trận phân quyền, bỏ dòng `exam/grade-override`

**Không được sửa:**
- Mọi file trong `tests.lock`
- `lib/gradebook.ts` (chỉ được thêm export nếu thiếu, không đổi hành vi)
- `app/teacher/**`, `app/student/**`, `components/**` (UI thuộc TASK-046/047)
- `stitch_english_mock_exam_portal/`

## 4. Đặc tả chi tiết + blueprint
Đường dẫn route đúng như §6 của đặc tả. Trong code, `kind` là `lesson|exam` và ánh xạ sang `item_kind` `LESSON|EXAM`.

**Guard dùng chung** `assertClassAccess(auth, classId)`:
- lớp không tồn tại → 404;
- TEACHER mà `teacher_id` của lớp khác mình → 403;
- ADMIN được mọi lớp.

Mọi route `/api/teacher/grading/**` dùng `requireRole(["ADMIN","TEACHER"])`.

**Bài thuộc lớp** (BR-B01): lấy mục lộ trình từ `curriculum_items` của `classes.course_id` (như `lib/roadmap-data.ts` đang làm) và `class_assignments`, rồi gọi `mergeClassItems`. Bài không có trong tập này → 404.

**Lượt** (BR-B02):
- đề: `submissions WHERE exam_id=$item AND class_ref=$class AND status<>'IN_PROGRESS'`;
- bài học: `lesson_attempts WHERE lesson_id=$item AND class_id=$class`.

Ánh xạ sang `AttemptLite`:
- `has_ai` = trong `results` có mục `kind==="AI"`;
- `score` = `total_score` (đề) hoặc `score_percent` (bài học).

**Ô điểm:** dùng `pickCountedAttempt` với `class_grades.chosen_attempt_id` và `manual_score10`. Thang 10 tính bằng `examScore10` hoặc `lessonScore10`. Nếu bài đã chốt thì trả **ảnh chụp** trong `class_grades`, không tính lại.

**GET lượt** `attempts/[kind]/[attemptId]`:
- kiểm quyền qua lớp của lượt (`class_ref` hoặc `class_id`), lượt không thuộc lớp nào → 404;
- trả câu hỏi theo thứ tự `question_ids` của đề hoặc bài học, kèm `content` (có đáp án, vì người xem là giáo viên), `answers[qid]` và `result`;
- `locked` = bài đã chốt **và** mốc nộp của lượt ≤ `finalized_at`.

**PUT lượt:**
- lượt đang `IN_PROGRESS`/`GRADING` → 409; `locked` → 409 `GRADEBOOK_FINALIZED`;
- gọi `applyExamTeacherEdits` hoặc `applyLessonTeacherEdits` (`GradebookError` đổi thành status/code tương ứng), `feedback` tối đa 2000 ký tự;
- UPDATE `results`, điểm, `teacher_feedback`, `reviewed_at = NOW()`, `reviewed_by`. Lượt `NEEDS_REVIEW` mà `allAiScored` đúng thì chuyển `GRADED` và đặt `graded_at`;
- đề mà kết quả là `GRADED` thì gọi `notifyExamGraded(id)`.

**PUT ô** `students/[studentId]`:
- học sinh phải ghi danh lớp, nếu không → 404;
- `chosen_attempt_id` phải là lượt của đúng học sinh, bài và lớp đó, nếu không → 400;
- `manual_score10` phải nằm trong [0, 10], nếu không → 400;
- `note` tối đa 2000 ký tự;
- UPSERT `class_grades` (id `cgr_` + uuid). Bài đã chốt → 409.

**POST finalize:**
1. Gọi `checkFinalize` trên các dòng của mọi học sinh ghi danh. Gặp `GRADING_PENDING` hoặc `UNREVIEWED` → 409 với `{ success:false, code, students|count }`. Bài đã chốt → 409 `ALREADY_FINALIZED`.
2. Trong **một giao dịch** (`BEGIN`/`COMMIT` trên cùng client pg; xem cách `lib/db-pg.ts` hoặc route `ai-import` dùng transaction):
   - UPSERT `class_grade_items` với `finalized_at = NOW()`, `finalized_by`;
   - UPSERT `class_grades` của mọi học sinh, ghi ảnh chụp `attempt_id`, `raw_score`, `raw_max`, `score10`, `passed`, `finalized_at`. Ô rỗng thì các trường điểm là NULL;
   - đặt `reviewed_at`/`reviewed_by` cho `markReviewedIds`.
3. Sau COMMIT, gọi `notifyGradebookFinalized(gradeItemId)` cho học sinh có `score10` khác NULL:
   - type `GRADEBOOK_FINALIZED`, `ref_id` = `class_grade_items.id`;
   - link `/student/class/<classId>?tab=gradebook`;
   - chốt lại thì cập nhật đúng dòng cũ (`createNotification` đã ON CONFLICT).

`raw_score`/`raw_max`:
- đề: `total_score` và `submissionScore().max`;
- bài học: `score_percent` và 100;
- nhập tay: `score10` và 10.

**POST reopen:** bài chưa chốt → 409. Ngược lại đặt `finalized_at = NULL`, `reopened_at = NOW()`. Giữ nguyên `chosen_attempt_id`, `manual_score10`, `note`.

**GET summary:** các bài **đã chốt** (theo thứ tự BR-B01) × học sinh ghi danh, lấy ảnh chụp `class_grades`. `average10` của từng học sinh và `item_averages` tính bằng `average10`.

**GET `classes`:** các lớp của giáo viên, ADMIN thì mọi lớp. Mỗi lớp kèm `student_count`, `pending_review` (BR-B05), `needs_review`.

**Học sinh** `GET /api/student/classes/[classId]/gradebook`:
- `requireRole(["STUDENT"])`, chưa ghi danh → 403;
- chỉ trả ảnh chụp của chính `auth.user.userId` ở các bài có `finalized_at IS NOT NULL`, kèm `note` và `average10`;
- **không** nhận `studentId` từ query hay body.

**`members`:** cả `submission_count` và điểm mới nhất chỉ tính `submissions` có `class_ref = classId`.

**`EXAM_NEEDS_REVIEW`:** có `class_ref` thì link `/teacher/grading/<class_ref>/exam/<exam_id>`; bài luyện tự do giữ `/teacher/grading`. Test cũ `tests/notifications-lib.test.ts` mong link `/teacher/grading` cho bài của lớp. Tài khoản kiểm chéo sẽ cập nhật ca đó theo đặc tả; coder không tự sửa.

**Xoá route cũ:** test cũ dùng `grade-override` hoặc `teacher/submissions` (`api-auth`, `exam-attempts-api`, `notifications-api`, `profile-slots-grading`) sẽ được tài khoản kiểm chéo thay bằng ca tương đương trên route mới. Coder không sửa các file đó.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0 (vitest toàn bộ + tsc + `tests/docs-sync.test.ts`)
- [ ] TC-B01: TEACHER khác lớp → 403 ở **mọi** route `/api/teacher/grading/**`; người tạo đề không thấy bài lớp khác; STUDENT → 403; không có phiên → 401
- [ ] TC-B02: danh sách bài = lộ trình ∪ đề giao, không trùng; bài nộp luyện tự do không xuất hiện; bài ngoài lớp → 404
- [ ] TC-B05: PUT lượt đề lưu `teacher_score`, giữ `ai_score`, tính lại `section_scores`/`total_score`, đặt `reviewed_at`, cập nhật đúng 1 dòng thông báo `EXAM_GRADED`
- [ ] PUT lượt bài học tính lại `score_percent`; lượt `NEEDS_REVIEW` chấm đủ thì `GRADED`, chấm thiếu thì vẫn `NEEDS_REVIEW`
- [ ] TC-B08: finalize trả 409 `GRADING_PENDING` / 409 `UNREVIEWED`; khi có `confirmUnreviewed` thì 200, các lượt được đặt `reviewed_at`, và có ảnh chụp cho **mọi** học sinh ghi danh
- [ ] TC-B09: sau chốt, PUT ô → 409; PUT lượt nộp trước mốc → 409; lượt nộp sau mốc → 200 và ảnh chụp không đổi; reopen thì học sinh không còn thấy bài
- [ ] TC-B10/B11: summary và gradebook học sinh tính trung bình đúng (bỏ ô rỗng, tính ô nhập tay 0); học sinh chỉ thấy dòng của mình; lớp chưa ghi danh → 403
- [ ] TC-B14: `members` không đếm bài nộp lớp khác
- [ ] TC-B15: `GRADEBOOK_FINALIZED` chỉ gửi học sinh có điểm; chốt lại không tạo dòng thứ hai
- [ ] `/api/teacher/submissions` và `/api/exam/grade-override` không còn file route; `docs/07` liệt kê đủ route mới (docs-sync xanh)

## 6. Ràng buộc & bẫy cần tránh
- Không tin `studentId`/`teacherId` từ body cho quyền; quyền luôn qua `auth.user` và lớp.
- Không tính lại điểm từ lượt khi bài đã chốt: đọc ảnh chụp.
- Finalize phải nằm trong giao dịch; gửi thông báo sau COMMIT.
- Không lộ đáp án cho học sinh. Route học sinh chỉ trả ảnh chụp điểm và `note`.
- Không viết lại logic có sẵn trong `lib/gradebook.ts`, `lib/exam-attempts.ts`, `lib/score-display.ts`.
- Không thêm link từ dữ liệu giáo viên sang `/student/*` hay `/admin/*`. Thông báo học sinh trỏ trang học sinh là đúng.
