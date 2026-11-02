# Báo cáo TASK-010

## Đã làm
- [x] Thêm API tạo đề thi `POST /api/teacher/exams` với phân quyền `requireRole(["ADMIN", "TEACHER"])`, kiểm tra tính hợp lệ của câu hỏi và khóa học, tính toán `skills` từ danh sách câu hỏi, đồng bộ quan hệ sang Neo4j (`syncCourseExam`) và phát sự kiện `EXAM_CREATED` vào Redis Stream.
- [x] Thêm API chi tiết và cập nhật đề thi `GET/PUT /api/teacher/exams/[id]` với phân quyền kiểm tra trước `await params`, giữ nguyên đáp án câu hỏi cho giáo viên, hydrate flashcards liên quan và lấy `course_id` từ đồ thị Neo4j. PUT cho phép cập nhật từng trường, tính toán lại `skills` và cập nhật lại quan hệ `HAS_EXAM` trên Neo4j.
- [x] Tách toàn bộ UI và logic soạn câu hỏi sang component dùng chung `components/question-builder/QuestionSetEditor.tsx`, hỗ trợ hai chế độ `mode: "EXAM" | "LESSON"`. Chế độ `LESSON` ẩn thời gian làm bài, chọn khóa học và tab AI Ingest, đổi nhãn "Tên đề thi" thành "Tên bài học".
- [x] Lưu câu hỏi độc lập qua `PUT /api/teacher/questions/{id}` (cho câu đã có trong DB) và `POST /api/teacher/questions` (cho câu mới), nạp danh sách khóa học qua API `GET /api/teacher/courses`.
- [x] Thu gọn `app/teacher/tests/create/page.tsx` thành lớp vỏ mỏng (163 dòng, < 400 dòng), tải dữ liệu đề qua API khi sửa (`editId`), gọi API khi lưu và xử lý lỗi tải/thử lại.
- [x] Loại bỏ toàn bộ việc ghi trực tiếp vào Supabase (`from("questions")`, `from("exams")`), không import `@/lib/neo4j` hay dữ liệu giả `@/lib/mock-data`, không dùng ID cứng `usr_teacher_01`.
- [x] Phần quản lý thư viện flashcard và upload audio (`supabase.storage`) vẫn được giữ nguyên cách cũ trong `QuestionSetEditor` theo đúng đặc tả của task (sẽ chuyển ở task sau).
- [x] Tự kiểm tự động bằng `python3 scripts/handoff.py verify TASK-010` đạt exit 0 (toàn bộ 15 test files / 344 vitest tests pass và `tsc --noEmit` pass không có lỗi type).

## File đã tạo/sửa
- `app/api/teacher/exams/route.ts`: Bổ sung endpoint `POST` tạo đề thi, giữ nguyên endpoint `GET`.
- `app/api/teacher/exams/[id]/route.ts`: Endpoint mới `GET` (lấy chi tiết đề thi kèm câu hỏi, flashcards, course_id) và `PUT` (cập nhật đề thi, Neo4j mapping).
- `components/question-builder/QuestionSetEditor.tsx`: Component soạn câu hỏi dùng chung hỗ trợ `EXAM` và `LESSON`, lưu câu qua API questions, lấy khóa học qua API courses.
- `app/teacher/tests/create/page.tsx`: Thu gọn thành vỏ mỏng (163 dòng), gọi API `/api/teacher/exams` để load và lưu đề.

## Kết quả tự kiểm
```
 Test Files  15 passed (15)
      Tests  344 passed (344)
   Start at  12:40:42
   Duration  160.43s (transform 11.95s, setup 0ms, collect 7.58s, tests 1073.93s, environment 8ms, prepare 4.82s)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
