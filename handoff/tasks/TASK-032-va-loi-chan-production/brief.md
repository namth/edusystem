# TASK-032 — Vá lỗi chặn production: quyền khoá học/đề, bỏ điểm AI giả, gỡ route chẩn đoán, giới hạn đăng nhập

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Chuẩn bị lên production (thương hiệu KitoKit). Khảo sát phát hiện 4 lỗ hổng phải vá trước khi kiểm thử toàn hệ thống:
1. `app/api/teacher/courses` chỉ kiểm "đã đăng nhập" → học sinh đọc/sửa/xoá được khoá học.
2. `GET /api/exams/[id]` và `/content` cho mọi người đã đăng nhập xem mọi đề (GV xem được đề + đáp án của GV khác; HS nhận cả `question_ids`, `stimulus_text`…).
3. `lib/portkey.ts` trả **điểm giả "Band score 7.5"** khi thiếu key hoặc gateway lỗi; còn route chẩn đoán `admin/test-db`, `admin/test-supabase`.
4. Không giới hạn số lần thử ở `auth/login` và `auth/forgot-password`.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến); `lib/api-auth.ts` (`requireRole`)
- Test: `tests/prod-hardening.test.ts` (mới), `tests/api-auth.test.ts` (đã thêm 4 dòng `teacher/courses`, bỏ test-db/test-supabase). Toàn bộ test hiện có phải tiếp tục xanh.

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/teacher/courses/route.ts`
- `app/api/exams/[id]/route.ts`, `app/api/exams/[id]/content/route.ts`
- `lib/portkey.ts`, `app/api/admin/test-portkey/route.ts`, `app/admin/teachers/[id]/page.tsx` (chỉ hàm `handleTestPortkeyLive` + chỗ hiển thị kết quả)
- Xoá: `app/api/admin/test-db/route.ts`, `app/api/admin/test-supabase/route.ts` (cả thư mục)
- `lib/rate-limit.ts` (mới), `app/api/auth/login/route.ts`, `app/api/auth/forgot-password/route.ts`

**Không được sửa:** mọi file trong `tests.lock`, `docs/`, `package*.json`, route/lib khác.

## 4. Đặc tả chi tiết
### 4.1 teacher/courses
Cả GET/POST/PUT/DELETE: dòng đầu là `const auth = await requireRole(["ADMIN","TEACHER"]); if (auth.error) return auth.error;` — **trước mọi truy vấn DB/Neo4j** (test kiểm không chạm DB khi 401/403). Giữ nguyên logic lọc theo chủ sở hữu hiện có, nhưng PUT/DELETE khi không cập nhật/xoá được dòng nào (không tồn tại hoặc TEACHER không phải chủ) → **404** `{ success:false, error:"Không tìm thấy khóa học hoặc bạn không có quyền." }` thay cho 403 hiện tại (test phân quyền dùng 403 để nhận diện "bị chặn vì vai trò").

### 4.2 Đề thi
Quy tắc "được xem đề": ADMIN mọi đề; TEACHER khi `exams.created_by` = mình **hoặc** `created_by IS NULL`; còn lại 403. Đề không tồn tại → 404 (kiểm tồn tại trước quyền).
- `GET /api/exams/[id]`:
  - TEACHER/ADMIN theo quy tắc trên, trả `exam` như cũ.
  - STUDENT: 200, `exam` **chỉ gồm** `id, title, description, duration_minutes, skills, passing_score, question_count` (`question_count` = độ dài `question_ids`, xử lý cả JSON chuỗi/null → 0). Trang `app/student/exam/[examId]/page.tsx` chỉ dùng các trường này cho màn bắt đầu — kiểm lại, không sửa trang.
- `GET /api/exams/[id]/content`: STUDENT → 403; TEACHER/ADMIN theo quy tắc trên.

### 4.3 Portkey
- `callPortkeyGrading`: thiếu `PORTKEY_API_KEY` → `throw new Error("Chưa cấu hình PORTKEY_API_KEY")`; gateway lỗi → ném lại lỗi. Không còn biến/nhánh `isSimulated`, không chuỗi điểm giả, không mặc định `"student_01"` (bỏ `studentId` mặc định, cho phép `undefined`). Chỉ ghi `ai_usage_logs` khi gọi thật thành công. Bỏ `dangerouslyAllowBrowser`.
- `POST /api/admin/test-portkey`: bắt lỗi → 502 `{ success:false, error: <message> }`. Thành công → như cũ nhưng không có `isSimulated`.
- Trang admin chi tiết GV: bỏ nhánh "Simulation"; gửi body không có `studentId` cứng; lỗi → hiển thị `res.error`.

### 4.4 Giới hạn số lần thử — `lib/rate-limit.ts`
Bộ đếm cửa sổ trượt **trong bộ nhớ** (một container web; ghi chú trong file), dùng `Date.now()` (test dùng fake Date). Export tối thiểu `resetRateLimits()` (cho test) + hàm tuỳ bạn đặt. Không import module chỉ chạy trên server ngoài Node chuẩn; dọn khoá hết hạn để không rò bộ nhớ.
- **login:** khoá = `login:<identifier đã trim+lowercase>` (không theo IP). Trước khi so mật khẩu: nếu ≥ 10 lần **sai** trong 15 phút → 429 `{ success:false, error:"Bạn đã thử sai quá nhiều lần. Vui lòng thử lại sau N phút." }` + header `Retry-After` (giây, > 0). Sai mật khẩu hoặc không có tài khoản → ghi 1 lần sai. Đăng nhập đúng → xoá bộ đếm.
- **forgot-password:** khoá = `forgot:<email lowercase>`; tối đa 5 yêu cầu / 15 phút (đếm mọi yêu cầu hợp lệ, kể cả email không tồn tại) → lần 6 trả 429 cùng dạng.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-032`); `npx`, `git`, `find`, `ls`, `rm` bị từ chối — xoá file bằng cách khác qua công cụ sửa file của bạn.
- Không nhánh riêng cho test (vd kiểm `NODE_ENV==="test"`), không hard-code id.
- Không thêm thư viện, không dùng Redis cho rate limit (để test chạy không cần Redis).
