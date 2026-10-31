# Báo cáo TASK-015

## Đã làm
- [x] `verify.sh` chạy exit 0 (18/18 test files passed, 392/392 tests passed; `tsc --noEmit` đạt).
- [x] Không còn `@/lib/supabase` / `supabase.` trong 3 file phía trình duyệt (`app/teacher/flashcards/page.tsx`, `components/question-builder/QuestionSetEditor.tsx`, `lib/audio-storage.ts`).
- [x] Tạo đầy đủ API thư viện flashcard (`GET`, `POST` tại `/api/teacher/flashcards` và `PUT`, `DELETE` tại `/api/teacher/flashcards/[id]`) có phân quyền sở hữu theo migration 008, kiểm tra ràng buộc 409 khi thẻ đang được câu hỏi tham chiếu.
- [x] Tạo API `POST /api/uploads` nhận multipart `{ kind, file }` đẩy lên Supabase Storage qua service role server, phân quyền theo role/kind, sinh tên file phía server và kiểm tra MIME/dung lượng tối đa.
- [x] Chuyển đổi 3 vị trí trình duyệt sang dùng API mới, bỏ ảnh Unsplash mặc định, xử lý hiển thị lỗi upload trực tiếp thay vì fallback sang base64.
- [x] Sửa triệt để lỗi tạo trùng câu hỏi trong `QuestionSetEditor`: ghi nhận `savedIdByLocalId` và đồng bộ lại state `setQuestionsList` cùng `dbQuestionIds.current` để các lần lưu tiếp theo tự động dùng `PUT`.

## File đã tạo/sửa
- `lib/db-pg.ts`: Bổ sung DDL migration 008 (`ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS created_by`, tạo index) vào `ensureSchema()`.
- `app/api/teacher/flashcards/route.ts`: API GET (lấy flashcards dùng chung, lọc theo từ/nghĩa qua `q`, gắn cờ `can_edit`) và POST (tạo flashcard mới, validate và gán `created_by = userId`).
- `app/api/teacher/flashcards/[id]/route.ts`: API PUT (cập nhật flashcard theo quyền) và DELETE (kiểm tra tham chiếu câu hỏi qua `content->'flashcard_ids' ? id` / `content->'flashcardIds' ? id` trước khi xoá, trả 409 nếu đang được dùng).
- `app/api/uploads/route.ts`: API POST multipart xử lý upload file qua service role server cho `audio`, `image`, `speaking`.
- `lib/audio-storage.ts`: Cập nhật hàm `uploadAudioToSupabaseStorage` sang gọi `POST /api/uploads` (`kind: "speaking"`), gỡ bỏ hoàn toàn `@/lib/supabase`.
- `app/teacher/flashcards/page.tsx`: Gỡ bỏ Supabase trực tiếp từ trình duyệt, chuyển sang gọi `/api/teacher/flashcards` và `/api/uploads`, ẩn nút sửa/xoá khi `can_edit === false`, thông báo 409, bỏ ảnh Unsplash mặc định.
- `components/question-builder/QuestionSetEditor.tsx`: Gỡ bỏ `@/lib/supabase`, chuyển đọc/ghi flashcard sang `/api/teacher/flashcards`, upload audio sang `/api/uploads`, ghi nhận `savedIdByLocalId` và cập nhật state để tránh trùng câu hỏi khi lưu lại.

## Kết quả tự kiểm
```
 Test Files  18 passed (18)
      Tests  392 passed (392)
   Start at  13:18:36
   Duration  39.84s (transform 1.46s, setup 0ms, collect 1.58s, tests 256.29s, environment 3ms, prepare 1.46s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
