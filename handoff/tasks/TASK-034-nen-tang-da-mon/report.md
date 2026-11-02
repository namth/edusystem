# Báo cáo TASK-034

## Đã làm
- Tạo migration `docs/db-migration-012-subjects.sql` và đồng bộ cùng DDL vào `ensureSchema()` trong `lib/db-pg.ts`: tạo bảng `subjects`, unique index `uq_subjects_owner_code` trên `(COALESCE(owner_id, ''), LOWER(code))`, seed môn mặc định `'english'` (`LANGUAGE`), thêm cột `subject_id` (mặc định `'english'`) + backfill + index cho 3 bảng `courses`, `exams`, `lessons`.
- Tạo `lib/subjects.ts` với `slugifySubjectCode(name)` (bỏ dấu tiếng Việt kể cả `đ`→`d`, thường hoá, chuẩn hoá `-`, tối đa 60 ký tự) và `canUseSubject(user, subjectId)` (kiểm tra quyền dùng môn học cho ADMIN và TEACHER).
- Hiện thực API `/api/subjects` (`GET`, `POST`) và `/api/subjects/[id]` (`PUT`, `DELETE`) tuân thủ đầy đủ phân quyền theo vai trò (`STUDENT`, `TEACHER`, `ADMIN`), kiểm tra trùng code theo phạm vi chủ sở hữu (`409`), tính `usage_count` trong một truy vấn SQL duy nhất (không N+1), chặn xoá môn `'english'` hoặc môn đang được sử dụng (`409` kèm `usages: { courses, exams, lessons }`).
- Cập nhật 5 route giáo viên (`app/api/teacher/courses/route.ts`, `app/api/teacher/exams/route.ts`, `app/api/teacher/exams/[id]/route.ts`, `app/api/teacher/lessons/route.ts`, `app/api/teacher/lessons/[id]/route.ts`): nhận và kiểm tra `subject_id` qua `canUseSubject` khi tạo/sửa, trả `subject_id` và hỗ trợ lọc `?subject_id=` khi lấy danh sách.
- Tạo trang quản lý môn học `/teacher/subjects` (`app/teacher/subjects/page.tsx`, client component dùng `TeacherLayout`) với đầy đủ trạng thái tải / lỗi ("Thử lại") / rỗng ("Chưa có môn học riêng — bấm Tạo môn"), danh sách thẻ môn, tạo/sửa/bật-tắt/xoá môn kèm hộp thoại báo lỗi `409` chi tiết.
- Cập nhật `components/TeacherLayout.tsx` (thêm mục menu "Môn Học" ngay sau "Kho Bài Học & Đề Thi"), `app/teacher/tests/page.tsx` (chọn môn học trong modal tạo/sửa khoá học và hiển thị chip môn trên danh sách khoá), `components/teacher/ExamLibraryPanel.tsx` và `components/teacher/LessonLibraryPanel.tsx` (bộ lọc theo môn học `subject_id=`).

## File đã tạo/sửa
- `docs/db-migration-012-subjects.sql` — Tạo mới migration 012 cho bảng `subjects` và cột `subject_id` trên `courses`, `exams`, `lessons`.
- `lib/db-pg.ts` — Bổ sung DDL của migration 012 vào `ensureSchema()`.
- `lib/subjects.ts` — Tạo mới helper server `slugifySubjectCode` và `canUseSubject`.
- `app/api/subjects/route.ts` — Tạo mới route `GET` và `POST` danh mục môn học.
- `app/api/subjects/[id]/route.ts` — Tạo mới route `PUT` và `DELETE` môn học theo ID.
- `app/api/teacher/courses/route.ts` — Hỗ trợ `subject_id` khi `GET` (lọc `?subject_id=`), `POST`, `PUT` khoá học.
- `app/api/teacher/exams/route.ts` — Hỗ trợ `subject_id` khi `GET` (lọc `?subject_id=` kết hợp `?q=`) và `POST` đề thi.
- `app/api/teacher/exams/[id]/route.ts` — Hỗ trợ trả và cập nhật `subject_id` cho đề thi.
- `app/api/teacher/lessons/route.ts` — Hỗ trợ `subject_id` khi `GET` (lọc `?subject_id=`) và `POST` bài học.
- `app/api/teacher/lessons/[id]/route.ts` — Hỗ trợ trả và cập nhật `subject_id` cho bài học.
- `app/teacher/subjects/page.tsx` — Tạo mới trang quản lý môn học cho giáo viên/admin.
- `components/TeacherLayout.tsx` — Thêm mục menu `{ href: "/teacher/subjects", label: "Môn Học", icon: GraduationCap }`.
- `app/teacher/tests/page.tsx` — Thêm chọn môn học trong modal tạo/sửa khoá học và hiển thị chip tên môn ở danh sách khoá học.
- `components/teacher/ExamLibraryPanel.tsx` — Thêm bộ lọc theo môn học (`subject_id=`).
- `components/teacher/LessonLibraryPanel.tsx` — Thêm bộ lọc theo môn học (`subject_id=`).

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-034-nen-tang-da-mon/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/agy-worktrees/TASK-034

 ✓ tests/subjects.test.ts (16 tests) 111011ms
   ✓ Migration 012 > tạo môn hệ thống 'english' (LANGUAGE) và gán toàn bộ dữ liệu cũ vào tiếng Anh  5474ms
   ✓ Migration 012 > chạy lại nhiều lần không lỗi, không nhân đôi môn english  2092ms
   ✓ API /api/subjects > chưa đăng nhập 401; STUDENT GET chỉ thấy môn hệ thống đang bật, không tạo được (403)  2637ms
   ✓ API /api/subjects > TEACHER tạo môn của mình (mode luôn SIMPLE, code tự sinh không dấu); thấy môn hệ thống + môn của mình, không thấy môn GV khác  3016ms
   ✓ API /api/subjects > ADMIN tạo môn hệ thống (owner_id NULL), được chọn mode; ADMIN thấy tất cả  9186ms
   ✓ API /api/subjects > tên rỗng / > 100 ký tự / mode lạ → 400; trùng code trong cùng phạm vi → 409  5149ms
   ✓ API /api/subjects > môn tắt (is_active=false) vẫn hiện với chủ, ẩn với STUDENT; ?active=1 chỉ lấy môn bật  5619ms
   ✓ API /api/subjects/[id] > TEACHER sửa môn của mình 200; môn GV khác / môn hệ thống 403; không có 404; TEACHER không đổi được mode  4936ms
   ✓ API /api/subjects/[id] > DELETE: môn english không xoá được (409); môn đang dùng → 409 kèm usages; môn trống → 200  8643ms
   ✓ API /api/subjects/[id] > GET /api/subjects trả usage_count (số khoá + đề + bài học dùng môn)  7318ms
   ✓ subject_id trên khoá học / đề / bài học > courses: POST nhận subject_id (thiếu → english), GET trả subject_id và lọc ?subject_id=; môn không được phép → 400  6872ms
   ✓ subject_id trên khoá học / đề / bài học > courses: PUT đổi subject_id  9714ms
   ✓ subject_id trên khoá học / đề / bài học > exams: POST nhận subject_id, GET trả + lọc; PUT đổi được  7699ms
   ✓ subject_id trên khoá học / đề / bài học > lessons: POST nhận subject_id (thiếu → english), GET trả + lọc; PUT đổi được  10402ms
   ✓ Giao diện > trang /teacher/subjects (client): gọi API, tạo / sửa / bật-tắt / xoá có xử lý 409, đủ trạng thái  9205ms
   ✓ Giao diện > menu giáo viên có mục Môn Học; trang lộ trình chọn môn khi tạo/sửa khoá; kho đề/bài học lọc theo môn  13004ms

 Test Files  44 passed (44)
      Tests  729 passed (729)
   Start at  20:03:11
   Duration  343.98s (transform 33.62s, setup 0ms, collect 17.76s, tests 2310.57s, environment 25ms, prepare 14.80s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
