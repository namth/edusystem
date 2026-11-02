# TASK-036 — Giao diện: đăng nhập mới, đăng ký kiểu phỏng vấn có mascot (học sinh & giáo viên)

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả: `docs/features/dang-ky-phong-van.md` (FEAT-012) §3.1–3.4, §4 · Quyết định DEC-026, DEC-029.
> Dựa trên API của TASK-035 (đã nghiệm thu). Chạy **song song** với TASK-037, không chạm file của task đó.

## 1. Tài liệu bắt buộc đọc
- Đặc tả §3 (kịch bản câu hỏi, lời mascot), §4 (trạng thái giao diện).
- `lib/onboarding.ts`: enum, `validateUsername`, `usernameBaseFromName`, `PLACEHOLDER_EMAIL_DOMAIN`. **Bắt buộc dùng lại**, không chép danh sách.
- Hợp đồng API trong `app/api/auth/register/route.ts`, `register/teacher/route.ts`, `username-available/route.ts`. Lỗi trả về có `field` để quay về đúng màn.
- Ngôn ngữ thiết kế: `components/landing/LandingHero.tsx` (gradient xanh, quầng sáng sau mascot), token trong `app/globals.css`, DEC-022.
- Test: `tests/onboarding-ui.test.ts` (mới), `e2e/onboarding.spec.ts` (mới), `e2e/auth.spec.ts` (đã sửa theo trang đăng nhập mới).

## 2. Phạm vi file
**Được tạo/sửa:**
- `app/login/page.tsx`, `app/register/page.tsx`, `app/register/teacher/page.tsx` (mới)
- `app/teacher/login/page.tsx` (thành chuyển hướng)
- `components/onboarding/*` (mới, ≥ 5 file)
- `context/AuthContext.tsx`, `app/api/auth/me/route.ts`, `app/api/auth/signup-options/route.ts` (mới)
- `app/profile/page.tsx` (chỉ thêm khối email tạm)
- `app/globals.css` (chỉ thêm keyframes và lớp `.mascot-*`)

**Không được sửa:** `tests/**`, `e2e/**`, `tests.lock`, `lib/onboarding.ts`, mọi route `api/` khác ngoài `auth/me` và `auth/signup-options`, `components/TeacherLayout.tsx`, `app/admin/**` (thuộc TASK-037), `package*.json`.

## 3. Đặc tả
### 3.1 `components/onboarding/`
| File | Vai trò |
| :--- | :--- |
| `Mascot.tsx` | `<img src="/brand/kitokit-mark-transparent.png">`, prop `mood: "idle" \| "think" \| "happy" \| "oops" \| "celebrate"` → lớp CSS `mascot-idle`, `mascot-think`, `mascot-happy`, `mascot-oops`, `mascot-celebrate` |
| `SpeechBubble.tsx` | Chữ hiện dần như đang gõ (~25ms/ký tự), bấm vào là hiện hết; có `aria-live="polite"` |
| `InterviewShell.tsx` | Khung chung theo §3.1 đặc tả: thanh tiến độ (`role="progressbar"` có `aria-valuenow`), nút ← Quay lại, mascot + bong bóng thoại, vùng trả lời; bố cục 2 cột trên màn rộng, 1 cột trên màn hẹp (không cuộn ngang ở 375px) |
| `ChoiceChips.tsx` | Chip chọn một hoặc nhiều; dùng `<button type="button" aria-pressed>`; điều hướng được bằng bàn phím |
| `useInterviewDraft.ts` | Lưu và khôi phục câu trả lời ở `sessionStorage` (key `kitokit-signup-student` / `kitokit-signup-teacher`); **bỏ trường `password`** trước khi ghi; mọi lần đọc/ghi bọc `try/catch`; xoá nháp khi đăng ký thành công |
| `Confetti.tsx` | Hiệu ứng confetti bằng CSS/DOM thuần (**không thêm thư viện**), tắt khi `prefers-reduced-motion` |

`globals.css`: thêm keyframes cho nhún / nghiêng / gật / lắc / nhảy, và bọc trong `@media (prefers-reduced-motion: reduce) { .mascot-* { animation: none } }`.

### 3.2 `/register` (học sinh)
- Đúng thứ tự và lời thoại ở §3.2 đặc tả: xưng "mình", gọi "bạn", từ câu 2 gọi theo tên.
- **Mỗi màn đúng một câu hỏi.**
- **Câu 3:** chip lấy từ `GET /api/auth/signup-options` (§3.5); API lỗi thì dùng danh sách dự phòng `english` + "Khác". Câu 3b chỉ hiện khi đã chọn tiếng Anh.
- **Câu 4a (mã lớp):** gọi `GET /api/classes/lookup/<mã>` để hiện tên lớp và giáo viên; mã sai thì mascot báo, cho nhập lại hoặc bỏ qua.
- **Câu 5:** hai nút "Có" / "Không có".
  - Chọn "Không có" → màn tạo tên đăng nhập: điền sẵn `usernameBaseFromName(tên)` cộng 2 số; kiểm tra định dạng tại chỗ bằng `validateUsername`; ngừng gõ 400ms thì gọi `username-available`; có gợi ý thay thế thì hiện thành chip bấm chọn được; hiện dòng `Email tạm của bạn: <u>@kito.io.vn — bạn đổi được sau`.
- **Mật khẩu:** ≥ 6 ký tự, có nút hiện/ẩn, có vạch báo độ mạnh; **không** có ô nhập lại.
- **Nộp** `POST /api/auth/register`:
  - Lỗi có `field` → nhảy về đúng màn đó, mascot đổi sang `oops`.
  - 429 → báo số phút phải chờ.
  - Lỗi mạng → nút "Thử lại", không mất câu trả lời.
- **Màn hoàn tất:** confetti, mascot `celebrate`. Nếu có tên đăng nhập thì hiện to kèm nút "Sao chép" (`navigator.clipboard`, có `try/catch`) và dòng "Nhớ tên đăng nhập này nhé!". Có `enrolled` thì hiện tên lớp; có `enrollError` thì mascot nhắc nhẹ. Nút "Vào học thôi" → `/student/dashboard`.
- Phím: Enter để tiếp (ô nhập chữ), nút Quay lại giữ nguyên câu trả lời đã nhập.
- Có liên kết nhỏ "Đã có tài khoản? Đăng nhập" và "Bạn là giáo viên?" → `/register/teacher`.
- **Mọi ô nhập có `aria-label` hoặc `<label>`.**

### 3.3 `/register/teacher`
- Đúng §3.3 đặc tả (gọi "thầy cô"). Enum lấy từ `lib/onboarding.ts`, môn lấy từ `/api/auth/signup-options`.
- Màn hoàn tất là thẻ tóm tắt giới hạn dùng thử: **1 lớp · 3 bài học/đề · 3 học sinh · mỗi học sinh nộp 1 lần mỗi bài**, kèm dòng "Kito sẽ liên hệ xác minh trong 1–2 ngày làm việc". Nút "Vào không gian dạy học" → `/teacher/classes`.

### 3.4 `/login`
- Theo §3.4 đặc tả:
  - Ô nhập có `placeholder="Email hoặc tên đăng nhập"`, ô mật khẩu có `placeholder="Mật khẩu"`.
  - Nút submit có chữ "Đăng nhập". Có liên kết `/forgot-password`.
  - Hai thẻ dẫn sang `/register` ("Tôi là học sinh") và `/register/teacher` ("Tôi là giáo viên").
- **Không** điền sẵn tài khoản demo.
- Xử lý `?next=`: chỉ nhận chuỗi bắt đầu bằng `/` và **không** bắt đầu bằng `//`. Không hợp lệ thì chuyển theo vai trò: ADMIN → `/admin/requests`, TEACHER → `/teacher/classes`, STUDENT → `/student/dashboard`. Viết thành hàm thuần `safeNextPath(next, role)` export từ `components/onboarding/redirect.ts`.
- Đã đăng nhập mà vào `/login` → chuyển theo vai trò.
- Lỗi hiện trong khung đỏ (giữ thông điệp từ API, vd "không chính xác"), mascot `oops`.

### 3.5 Khác
- **`app/teacher/login/page.tsx`:** Server Component chỉ gọi `redirect("/login")`.
- **`AuthContext`:**
  - Type `User` thêm `teacherStatus?: "TRIAL" | "VERIFIED" | "REJECTED" | null` và `emailIsPlaceholder?: boolean`.
  - Thêm `registerStudent(payload)` và `registerTeacher(payload)`: trả nguyên JSON của API (kể cả `field`, `suggestions`, `enrolled`) và gọi `setUser` khi thành công.
  - Giữ `register` cũ cho nơi khác đang dùng (gọi sang `registerStudent`).
- **`GET /api/auth/signup-options`** (công khai, vì `/api/subjects` cần đăng nhập): `{ success, subjects: [{ id, name }] }`, chỉ môn hệ thống (`owner_id IS NULL`), không trả trường khác; lỗi DB → `{ success:true, subjects:[{ id:'english', name:'Tiếng Anh' }] }`.
- **`GET /api/auth/me`:** trả thêm `username`, `teacherStatus`, `emailIsPlaceholder` (đọc từ DB như các trường hiện có).
- **`app/profile/page.tsx`:** khi `emailIsPlaceholder` thì hiện khối "Bạn đang dùng email tạm `…@kito.io.vn` — thêm email thật để lấy lại mật khẩu khi quên", có ô email và nút lưu gọi `PUT /api/profile` với `{ email }`.

### 3.6 Nhãn cố định cho e2e (bắt buộc giữ đúng chữ)
- **Nút:** "Bắt đầu", "Tiếp", "Quay lại" (`aria-label`), "Có", "Không có", "Có mã lớp", "Chưa có, bỏ qua", "Sao chép", "Vào học thôi", "Vào không gian dạy học", "Đăng nhập".
- **Chip:** chữ hiển thị đúng bằng `label` của enum trong `lib/onboarding.ts` (vd "Lớp 7", "Cambridge"); chip môn hiển thị `name` của môn (vd "Tiếng Anh").
- **`aria-label` ô nhập — học sinh:** "Tên của bạn", "Mã lớp", "Email", "Tên đăng nhập", "Mật khẩu".
- **`aria-label` ô nhập — giáo viên:** "Họ tên", "Tên trường hoặc trung tâm", "Số điện thoại", "Email", "Mật khẩu".
- Tên đăng nhập hợp lệ và còn trống thì hiện chữ "Tên này dùng được".
- Màn hoàn tất của học sinh có chữ "Chào mừng"; của giáo viên có chữ "dùng thử".

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-036` exit 0 (Vitest + tsc + e2e luồng đăng ký/đăng nhập)
- [ ] `report.md` dán nguyên văn output

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.**
- Không thêm thư viện. Màu chỉ dùng token (`tests/brand-tokens.test.ts` cấm mã hex trong class).
- Component `"use client"` không được import `@/lib/db-pg`, `@/lib/auth` (`tests/client-bundle-safety.test.ts`).
- `redirect()` gọi ngoài `try/catch`.
- Không lưu mật khẩu vào `sessionStorage` hay `localStorage`.
- Text tiếng Việt có dấu. Không bịa số liệu.
