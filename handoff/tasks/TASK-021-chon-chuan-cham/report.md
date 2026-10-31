# Báo cáo TASK-021

## Đã làm
- Cập nhật API đề thi `POST /api/teacher/exams` và `PUT /api/teacher/exams/[id]`: nhận `scoring_standard_id`, kiểm tra tính hợp lệ và tồn tại trong `scoring_standards`, lưu vào DB; `GET [id]` và phản hồi POST/PUT trả trường này trong `exam`.
- Cập nhật API khóa học `POST /api/teacher/courses` và `PUT /api/teacher/courses`: nhận `default_scoring_standard_id`, kiểm tra tồn tại hoặc null (sai -> 400), lưu vào DB; `GET` trả `default_scoring_standard_id` cho mỗi khóa; hỗ trợ `req?: Request` cho hàm `GET`.
- Cập nhật `components/question-builder/QuestionSetEditor.tsx` (mode `EXAM`):
  + Thêm prop `initialScoringStandardId?: string | null`
  + Nạp danh sách chuẩn chấm từ `GET /api/scoring-standards` và thêm select chọn "Chuẩn chấm điểm" với lựa chọn mặc định "— Theo khóa học / mặc định —" (`null`)
  + Gợi ý chuẩn mặc định của khóa học khi người dùng đổi khóa học mà đề thi chưa chọn chuẩn
  + Bổ sung trường `scoring_standard_id` vào `QuestionSetSavePayload`
- Cập nhật trang tạo/sửa đề thi `app/teacher/tests/create/page.tsx`: lấy `scoring_standard_id` từ `GET /api/teacher/exams/[id]`, truyền `initialScoringStandardId` vào `QuestionSetEditor`, gửi `scoring_standard_id` trong payload khi lưu.
- Cập nhật modal tạo/sửa khóa học tại `app/teacher/tests/page.tsx`: nạp danh sách chuẩn từ `GET /api/scoring-standards`, thêm select "Chuẩn Chấm Mặc Định", gửi `default_scoring_standard_id` khi tạo hoặc cập nhật khóa học.

## File đã tạo/sửa
- `app/api/teacher/exams/route.ts`: Nhận & xác thực `scoring_standard_id` khi POST đề thi, trả `scoring_standard_id` khi GET.
- `app/api/teacher/exams/[id]/route.ts`: Nhận & xác thực `scoring_standard_id` khi PUT đề thi, trả `scoring_standard_id` khi GET.
- `app/api/teacher/courses/route.ts`: Nhận & xác thực `default_scoring_standard_id` khi POST/PUT khóa học, trả trường này khi GET (hỗ trợ tham số `req?: Request`).
- `components/question-builder/QuestionSetEditor.tsx`: Thêm prop `initialScoringStandardId`, nạp chuẩn từ `/api/scoring-standards`, UI chọn chuẩn và gợi ý chuẩn mặc định của khóa, thêm `scoring_standard_id` vào `QuestionSetSavePayload`.
- `app/teacher/tests/create/page.tsx`: Nạp `scoring_standard_id` từ API đề thi, truyền vào editor và gửi khi lưu.
- `app/teacher/tests/page.tsx`: Nạp chuẩn từ `/api/scoring-standards`, thêm select "Chuẩn Chấm Mặc Định" trong modal tạo và sửa khóa học, gửi `default_scoring_standard_id`.

## Kết quả tự kiểm
```
 Test Files  26 passed (26)
      Tests  527 passed (527)
   Start at  15:07:37
   Duration  385.37s (transform 44.00s, setup 0ms, collect 20.61s, tests 2552.65s, environment 21ms, prepare 12.11s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
