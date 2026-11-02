# TASK-015 — API thư viện flashcard + upload qua server; gỡ Supabase trình duyệt cho flashcard/upload

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Ba chỗ còn dùng Supabase **từ trình duyệt** (vi phạm CONTEXT bất biến 9): trang `/teacher/flashcards`, `components/question-builder/QuestionSetEditor.tsx` (đọc/ghi flashcard, upload audio), `lib/audio-storage.ts` (upload audio bài nói, được trang làm đề gọi). Task này:
1. API thư viện flashcard (dùng chung — DEC-003) có quyền sở hữu (migration 008).
2. API `POST /api/uploads` — server nhận file và đẩy lên Supabase Storage bằng service role.
3. Chuyển 3 chỗ trên sang gọi API.
4. Sửa lỗi TASK-010: lưu thất bại giữa chừng rồi lưu lại sẽ tạo trùng câu hỏi mới.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 2, 4, 9), `docs/14-decisions.md` DEC-003
- `docs/db-migration-008-flashcard-owner.sql`
- `lib/api-auth.ts`, `lib/supabase-server.ts` (`getServerSupabaseClient` — service role, chỉ chạy server)
- Hiện trạng: `app/teacher/flashcards/page.tsx`, `components/question-builder/QuestionSetEditor.tsx` (các chỗ `supabase.from("flashcards")`, `supabase.storage`, khối lưu câu hỏi `dbQuestionIds`), `lib/audio-storage.ts`
- Test: `tests/flashcards-uploads-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/teacher/flashcards/route.ts` (mới: GET, POST), `app/api/teacher/flashcards/[id]/route.ts` (mới: PUT, DELETE)
- `app/api/uploads/route.ts` (mới: POST)
- `lib/db-pg.ts` (chỉ thêm DDL migration 008 vào `ensureSchema`)
- `app/teacher/flashcards/page.tsx`, `components/question-builder/QuestionSetEditor.tsx`, `lib/audio-storage.ts`

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`, `docs/db-migration-00*.sql`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, các route/trang khác, `lib/supabase*.ts`
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)

## 4. Đặc tả chi tiết
Route: `requireRole` dòng đầu (trước `await params`/`formData`), SQL tham số hoá, lỗi `{ success: false, error }`.

### 4.1 Flashcard — `requireRole(["ADMIN","TEACHER"])`
Quyền sửa/xoá: ADMIN mọi thẻ; TEACHER nếu `created_by = userId` **hoặc** `created_by IS NULL` (thẻ chung cũ); thẻ của giáo viên khác → 403.
- `GET /api/teacher/flashcards?q=` → `200 { flashcards }`: **mọi** thẻ (thư viện dùng chung), `q` lọc `vietnamese_name ILIKE` hoặc `correct_english_word ILIKE` (không phân biệt hoa thường, kể cả tiếng Việt có dấu viết hoa), sắp `created_at DESC`; mỗi thẻ thêm `can_edit: boolean` theo quyền trên.
- `POST` `{ vietnamese_name, correct_english_word, options?, image_url?, audio_url? }` → 400 nếu `vietnamese_name`/`correct_english_word` sau `trim` rỗng; `options` = mảng chuỗi đã `trim`, bỏ rỗng/trùng, **luôn chứa** `correct_english_word`; `image_url`/`audio_url` rỗng → `null` (không ảnh mặc định); `id = "fc_" + crypto.randomUUID()`, `created_by = userId`. `201 { success, flashcard }`.
- `PUT [id]` → 404/403 như trên; chỉ cập nhật trường gửi lên (validate như POST). `200 { success, flashcard }`.
- `DELETE [id]` → 404/403; thẻ đang được câu hỏi tham chiếu (`content->'flashcard_ids' ? id` hoặc `content->'flashcardIds' ? id`) → `409 { success: false, error, question_ids }`; ngược lại xoá → `200 { success: true }`.

### 4.2 `POST /api/uploads` — multipart `{ kind, file }`
| `kind` | Vai trò được phép | Bucket | Loại file | Tối đa |
| :--- | :--- | :--- | :--- | :--- |
| `audio` | ADMIN, TEACHER | `audio-assets` | `audio/*` (mp3, wav, webm, ogg, m4a) | 15 MB |
| `image` | ADMIN, TEACHER | `flashcard-assets` | `image/png`, `image/jpeg`, `image/webp`, `image/gif` | 5 MB |
| `speaking` | STUDENT, ADMIN, TEACHER | `speaking-recordings` | `audio/*` | 15 MB |
- Chưa đăng nhập → 401; vai trò không được phép với `kind` → 403; `kind` lạ / thiếu file / sai loại / quá dung lượng → 400 (không upload).
- Tên file trên Storage do **server** sinh: `` `${userId}/${Date.now()}_${crypto.randomUUID()}.${ext}` `` (ext lấy từ MIME, chỉ chữ/số) — không dùng tên file client.
- Upload bằng `getServerSupabaseClient().storage.from(bucket).upload(path, Buffer, { contentType, upsert: false })`; lỗi → **502**. Thành công → `201 { success: true, url: <getPublicUrl>, path }`.

### 4.3 Chuyển phía trình duyệt sang API
- `app/teacher/flashcards/page.tsx`: tải/tìm qua `GET /api/teacher/flashcards`, thêm/sửa qua `POST`/`PUT`, xoá qua `DELETE` (409 → thông báo "Thẻ đang được dùng trong N câu hỏi"); ẩn nút sửa/xoá khi `can_edit === false`; upload ảnh qua `POST /api/uploads` (`kind: "image"`); lỗi upload → hiện lỗi (không còn chuyển ảnh sang base64). Bỏ ảnh Unsplash mặc định.
- `QuestionSetEditor.tsx`: mọi chỗ đọc/ghi `flashcards` → `/api/teacher/flashcards`; upload audio → `POST /api/uploads` (`kind: "audio"`). Bỏ import `@/lib/supabase`.
- `lib/audio-storage.ts` (`uploadAudioToSupabaseStorage(audioData, submissionId, questionId)`): giữ chữ ký; chuỗi `http(s)://` trả nguyên; `data:audio/...;base64,...` → dựng `Blob` → `POST /api/uploads` (`kind: "speaking"`) → trả `url`; lỗi → trả lại `audioData` gốc như hành vi cũ. Bỏ import `@/lib/supabase`.

### 4.4 Sửa lỗi tạo trùng câu hỏi trong `QuestionSetEditor`
Trong vòng lưu câu hỏi: khi `POST /api/teacher/questions` thành công cho một câu có id cục bộ, ghi nhận ánh xạ id cục bộ → id DB (vd `savedIdByLocalId`) **và** cập nhật state câu hỏi (`setQuestions(prev => …)`) sang id DB, để lần lưu sau (khi `onSave` thất bại và người dùng bấm lưu lại) dùng `PUT` thay vì tạo mới.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Không còn `@/lib/supabase` / `supabase.` trong 3 file phía trình duyệt nêu trên
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách kiểm tra chuỗi.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-015`). `npx`, `git`, `find`, `ls`, `rm` đều bị từ chối quyền — đọc/ghi file bằng công cụ file.
- `getServerSupabaseClient` chỉ được import trong route server, không bao giờ trong file `"use client"` hay `lib/audio-storage.ts`.
- Không tin MIME/tên file từ client cho đường dẫn lưu; luôn kiểm tra cả MIME và dung lượng.
- Chỉ sửa đúng các chỗ flashcard/upload/lưu câu hỏi trong `QuestionSetEditor` — không định dạng lại file 2.700 dòng.
- Không thêm thư viện mới.
