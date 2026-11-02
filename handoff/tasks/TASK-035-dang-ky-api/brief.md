# TASK-035 — API đăng ký mới: học sinh không cần email, giáo viên dùng thử, đăng nhập bằng tên đăng nhập

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả gốc: `docs/features/dang-ky-phong-van.md` (FEAT-012) §5, §7, §8 · Quyết định: DEC-026 → DEC-028.
> Task này **chỉ làm phần server**. Giao diện là TASK-036, giới hạn dùng thử là TASK-037 — không làm trước phần của hai task đó.

## 1. Tài liệu bắt buộc đọc
- `CONTEXT.md` §3 (bất biến), `docs/features/dang-ky-phong-van.md` §3.2–3.3 (nội dung câu hỏi), §5 (dữ liệu/API), §7.
- Dùng lại: `lib/auth.ts` (`hashPassword`, `setAuthCookie`), `lib/rate-limit.ts`, `lib/api-auth.ts`, `lib/notifications.ts`, `app/api/leads/route.ts` (mẫu lấy IP + bẫy bot).
- Test: `tests/onboarding-api.test.ts` (mới). Các test cũ phải tiếp tục xanh, đặc biệt `tests/secrets-password.test.ts`, `tests/prod-hardening.test.ts`, `tests/change-password.test.ts`.

## 2. Phạm vi file
**Được tạo/sửa:**
- `docs/db-migration-013-onboarding.sql`
- `lib/db-pg.ts` (chỉ thêm DDL 013 vào `ensureSchema()`)
- `lib/onboarding.ts`, `lib/enrollment.ts`
- `lib/notifications.ts` (chỉ thêm loại `TEACHER_SIGNUP`)
- `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`, `app/api/auth/register/teacher/route.ts`, `app/api/auth/username-available/route.ts`, `app/api/auth/forgot-password/route.ts`
- `app/api/profile/route.ts`, `app/api/student/enroll/route.ts`

**Không được sửa:** `tests/**`, `tests.lock`, mọi file `.tsx` (giao diện thuộc TASK-036), `context/AuthContext.tsx`, `middleware.ts`, các route `teacher/*` và `admin/*` (thuộc TASK-037), `package*.json`.

## 3. Đặc tả
### 3.1 Migration 013
Lấy đúng SQL ở §5.1 của đặc tả, thêm `idx_users_teacher_status`. Chạy được nhiều lần. Chép cùng DDL vào `ensureSchema()`.

### 3.2 `lib/onboarding.ts` (không import module server nào → UI của TASK-036 import được)
- `PLACEHOLDER_EMAIL_DOMAIN = "kito.io.vn"`, `placeholderEmail(u)`, `isPlaceholderEmail(email)` (không phân biệt hoa thường).
- `USERNAME_RE = /^[a-z][a-z0-9._]{3,29}$/`, `RESERVED_USERNAMES` (tối thiểu: `admin, administrator, root, support, kitokit, kito, teacher, student, system, null, undefined`).
- `normalizeUsername(s)`: trim rồi đổi sang chữ thường.
- `validateUsername(s): string | null`: trả thông điệp lỗi tiếng Việt, hợp lệ thì trả `null`.
- `usernameBaseFromName(name)`: bỏ dấu tiếng Việt (cả `đ` → `d`), ghép bằng dấu chấm theo dạng `<tên>.<họ>`. Ví dụ "Nguyễn Văn An" → `an.nguyen`.
- `suggestUsernames(base, count)`: thêm 2–4 chữ số ngẫu nhiên, mọi kết quả phải qua được `validateUsername`.
- Các hằng enum để UI dùng chung, export dạng `readonly` array mã + nhãn tiếng Việt:
  - `GRADE_LEVELS`: `G1`…`G12`, `UNIVERSITY`, `WORKING`
  - `ENGLISH_GOALS`: `SCHOOL`, `CAMBRIDGE`, `IELTS`, `TOEIC`, `GRADE10`, `UNSURE`
  - `TEACHER_LEVELS`: `PRESCHOOL`, `PRIMARY`, `LOWER_SECONDARY`, `UPPER_SECONDARY`, `CERTIFICATE`, `UNIVERSITY`, `ADULT`
  - `WORKPLACE_TYPES`: `PUBLIC_SCHOOL`, `PRIVATE_SCHOOL`, `CENTER`, `FREELANCE`
  - `STUDENT_COUNTS`: `LT10`, `R10_50`, `R50_200`, `GT200`
  - `TEACHER_NEEDS`: `AI_GRADING`, `AUTHORING`, `AI_IMPORT`, `CLASS_MGMT`, `PROGRESS`
  - `SIGNUP_SOURCES`: `FACEBOOK`, `ZALO`, `REFERRAL`, `GOOGLE`, `OTHER`
- `TRIAL_SLOT_LIMIT = 9`.

### 3.3 `lib/enrollment.ts`
- Chuyển logic của `POST /api/student/enroll` thành hàm `enrollStudentByCode(studentId, code)`, trả về `{ ok: true, class, alreadyEnrolled }` hoặc `{ ok: false, status: 400|404|409, error }`. Hàm vẫn giữ đồng bộ Neo4j trong `try/catch`.
- Route enroll gọi hàm này, hành vi giữ nguyên. TASK-037 sẽ gắn kiểm tra giới hạn dùng thử vào đây.

### 3.4 Đăng nhập — `POST /api/auth/login`
- `identifier` khớp `LOWER(email) = $1 OR LOWER(username) = $1 OR id = $1`.
- Phản hồi `user` có thêm `username: row.username || row.id`, `teacherStatus: row.teacher_status ?? null`, `emailIsPlaceholder: !!row.email_is_placeholder`.
- Giữ nguyên rate-limit và thông điệp lỗi chung.

### 3.5 `GET /api/auth/username-available?u=`
- Công khai, giới hạn 30 lần/phút/IP (quá thì 429).
- Trả `{ success:true, available, error?: string, suggestions: string[] }`:
  - Sai định dạng hoặc tên cấm: `available:false` kèm `error`.
  - Đã có người dùng: `available:false` kèm ≥ 3 gợi ý **chưa ai dùng**.
  - Còn trống: `available:true`, `suggestions: []`.

### 3.6 `POST /api/auth/register` (học sinh)
**Body:**
```
{ name, gradeLevel?, goals?: { subjects?: string[], englishGoal?, targetScore? },
  hasEmail?, email?, username?, password, phone?, classCode?, website? }
```

**Thứ tự xử lý:**
1. **Giới hạn tần suất:** key `register:student:<ip>`, 5 lần/giờ, đếm **trước** khi validate → 429 kèm `Retry-After`.
2. **Bẫy bot:** có `website` → 200 `{success:true}`, không ghi DB, không đặt cookie.
3. **Validate.** Lỗi → 400 `{ success:false, error, field }`, `field` là tên trường lỗi để UI quay về đúng màn:
   - `name`: 2–100 ký tự.
   - `password`: ≥ 6 ký tự.
   - `gradeLevel`, `goals.englishGoal`: nếu có thì phải thuộc enum.
   - `goals.subjects`: tối đa 10 chuỗi, mỗi chuỗi ≤ 50 ký tự.
   - `targetScore`: ≤ 20 ký tự.
4. **Xác định email và tên đăng nhập:**
   - Có `email` (hoặc `hasEmail !== false` mà có `email`): email hợp lệ, **không** có đuôi `@kito.io.vn`. `username` tự sinh từ phần trước `@` (lọc về ký tự hợp lệ; ngắn hoặc sai định dạng thì lấy `hs` + số), trùng thì thêm số.
   - `hasEmail === false`: `username` bắt buộc, phải qua `validateUsername` và chưa ai dùng (trùng → 400, `field:"username"`, kèm `suggestions`). Email lấy bằng `placeholderEmail(username)`, `email_is_placeholder = true`.
   - Email đã tồn tại → 400, `field:"email"`.
5. **Ghi dữ liệu:**
   - `INSERT INTO users` **một lệnh**, `role = 'STUDENT'`, gồm cả `phone`. Test cũ `secrets-password` dò tham số của lệnh này.
   - `grade_level`, `learning_goals` (JSONB), `target_band` = `"IELTS <điểm>"` / `"TOEIC <điểm>"` khi mục tiêu là IELTS/TOEIC và có điểm; còn lại `NULL`. **Bỏ** giá trị cứng `'IELTS 6.5'`.
   - Id: `usr_student_<random>`.
6. **Ghi danh lớp:** có `classCode` thì gọi `enrollStudentByCode`. Ghi danh lỗi **không** làm hỏng việc đăng ký.
7. Đặt cookie bằng `setAuthCookie({ userId, email, role: "STUDENT" })`.
8. Trả 201 `{ success:true, user:{ id, name, email, username, role, emailIsPlaceholder }, username, enrolled: { classId, className } | null, enrollError?: string }`.

**Body có `role` thì bỏ qua.**

### 3.7 `POST /api/auth/register/teacher`
**Body:**
```
{ name, subjects: string[], levels: string[], workplaceType, workplaceName?,
  studentCount, needs: string[], source?, phone, email, password, website? }
```
- **Giới hạn tần suất:** key `register:teacher:<ip>`, 5 lần/giờ. Bẫy bot xử lý giống route học sinh.
- **Validate:**
  - `subjects`: 1–10 chuỗi, mỗi chuỗi ≤ 50 ký tự.
  - `levels`, `needs`: ≥ 1 phần tử, mọi phần tử thuộc enum.
  - `workplaceType`, `studentCount`: thuộc enum. `source`: không bắt buộc, có thì thuộc enum. `workplaceName`: ≤ 150 ký tự.
  - `phone`: bỏ khoảng trắng, dấu chấm, gạch rồi phải khớp `^(\+84|0)\d{9,10}$`.
  - `email`: bắt buộc, hợp lệ, không có đuôi placeholder.
  - `password`: ≥ 8 ký tự.
- **Ghi dữ liệu:** tạo `users` (`role='TEACHER'`, `teacher_status='TRIAL'`, `slot_limit = TRIAL_SLOT_LIMIT`, `username` tự sinh từ email, id `usr_teacher_<random>`) **và** `teacher_profiles.answers` trong **một câu SQL** (CTE `WITH u AS (INSERT … RETURNING id) INSERT INTO teacher_profiles …`), để không bao giờ có user mà thiếu hồ sơ.
  - `answers` lưu đúng các khoá: `subjects, levels, workplace_type, workplace_name, student_count, needs, source`.
- **Thông báo:** sau khi tạo, gửi `createNotification` cho **mọi** user `ADMIN`:
  - `type:"TEACHER_SIGNUP"`, `refId` = id giáo viên, `title` có tên giáo viên, `link:"/admin/teachers?status=TRIAL"`.
  - Lỗi gửi thông báo chỉ log, không làm hỏng đăng ký.
- Đặt cookie (`role:"TEACHER"`), trả 201 `{ success:true, user:{ …, teacherStatus:"TRIAL" } }`.

### 3.8 Quên mật khẩu, hồ sơ
- **`forgot-password`:** tài khoản có `email_is_placeholder = true` → không tạo token, nhưng trả **đúng** phản hồi như khi email không tồn tại.
- **`PUT /api/profile`:**
  - Nhận thêm `email`: hợp lệ, không có đuôi placeholder (→ 400), chưa ai dùng (→ 400). Đổi xong đặt `email_is_placeholder = false`.
  - Câu `SELECT` / `RETURNING` của route có thêm `username, email_is_placeholder`.

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-035` exit 0
- [ ] `report.md` dán nguyên văn output của verify

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.**
- Không thêm thư viện. Băm mật khẩu bằng `hashPassword` (scrypt). Không ghi log mật khẩu.
- Vai trò chỉ lấy từ route, không bao giờ từ body.
- Đặt `setAuthCookie` **sau** khi INSERT thành công. Thông báo lỗi bằng tiếng Việt.
- `queryPg` không có giao dịch nhiều câu, nên giáo viên và hồ sơ phải tạo bằng **một** câu CTE như mục 3.7.
- Thông điệp quên mật khẩu không được để lộ tài khoản có tồn tại hay không.
