# Báo cáo TASK-036

## Đã làm
- Xây dựng bộ khung phỏng vấn dùng chung trong `components/onboarding/`:
  - `Mascot.tsx`: hiển thị `/brand/kitokit-mark-transparent.png`, hỗ trợ 5 trạng thái cảm xúc (`idle`, `think`, `happy`, `oops`, `celebrate`) ánh xạ tới lớp CSS `.mascot-*`.
  - `SpeechBubble.tsx`: hiệu ứng hiện chữ dần ~25ms/ký tự, bấm vào hiện toàn bộ ngay, có `aria-live="polite"`, tôn trọng `prefers-reduced-motion`.
  - `InterviewShell.tsx`: thanh tiến độ (`role="progressbar"`, `aria-valuenow`), nút `Quay lại` (`aria-label="Quay lại"`), bố cục 2 cột trên màn rộng và 1 cột trên màn hẹp, không cuộn ngang ở 375px (`overflow-x-hidden`).
  - `ChoiceChips.tsx`: chip chọn một hoặc nhiều dùng `<button type="button" aria-pressed>`, hỗ trợ điều hướng bằng phím mũi tên.
  - `useInterviewDraft.ts`: lưu và khôi phục nháp ở `sessionStorage` (`kitokit-signup-student`, `kitokit-signup-teacher`), luôn loại bỏ trường `password` trước khi lưu, bọc mọi thao tác đọc/ghi/xoá trong `try/catch`, xoá nháp khi đăng ký thành công.
  - `Confetti.tsx`: hiệu ứng confetti bằng CSS/DOM thuần dùng token màu thương hiệu, tự tắt khi `prefers-reduced-motion: reduce`.
  - `redirect.ts`: hàm thuần `safeNextPath(next, role)` chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng `/` (chặn `//` và `/\`), ngược lại chuyển hướng theo vai trò (`ADMIN` → `/admin/requests`, `TEACHER` → `/teacher/classes`, `STUDENT` → `/student/dashboard`).
- Cập nhật `app/globals.css`: thêm `@keyframes mascot-idle`, `mascot-think`, `mascot-happy`, `mascot-oops`, `mascot-celebrate`, các lớp `.mascot-*`, và tắt chuyển động trong `@media (prefers-reduced-motion: reduce)`.
- Tạo `app/api/auth/signup-options/route.ts`: endpoint công khai trả `{ success: true, subjects: [{ id, name }] }` cho các môn hệ thống (`owner_id IS NULL`), có fallback `[{ id: 'english', name: 'Tiếng Anh' }]` khi DB lỗi.
- Cập nhật `app/api/auth/me/route.ts`: trả thêm `username` thật, `teacherStatus`, `emailIsPlaceholder`.
- Cập nhật `context/AuthContext.tsx`: bổ sung `teacherStatus`, `emailIsPlaceholder` vào `User`, thêm `registerStudent(payload)` và `registerTeacher(payload)` trả nguyên JSON của API và cập nhật `user`, giữ `register` cũ tương thích ngược.
- Hiện thực `app/register/page.tsx` (luồng phỏng vấn học sinh):
  - Đúng kịch bản câu hỏi §3.2, mascot xưng "mình" gọi "bạn", từ câu 2 gọi theo tên.
  - Gọi `/api/auth/signup-options`, `/api/classes/lookup/<mã>`, `/api/auth/username-available` (debounce 400ms), kiểm tra tại chỗ bằng `validateUsername`, gợi ý từ `usernameBaseFromName`, hiển thị dòng email tạm `@kito.io.vn`.
  - Ô mật khẩu có nút hiện/ẩn, vạch báo độ mạnh, bẫy bot `website`, xử lý lỗi nhảy về đúng màn theo `field`, 429 và lỗi mạng ("Thử lại").
  - Màn hoàn tất có confetti, mascot `celebrate`, nút "Sao chép" tên đăng nhập (`navigator.clipboard` bọc `try/catch`), hiển thị tên lớp đã ghi danh hoặc lời nhắc nhẹ khi `enrollError`, nút "Vào học thôi" → `/student/dashboard`.
- Hiện thực `app/register/teacher/page.tsx` (luồng phỏng vấn giáo viên dùng thử):
  - Đúng kịch bản §3.3, mascot gọi "thầy cô", dùng các enum từ `lib/onboarding.ts` (`TEACHER_LEVELS`, `WORKPLACE_TYPES`, `STUDENT_COUNTS`, `TEACHER_NEEDS`, `SIGNUP_SOURCES`) và môn học từ `/api/auth/signup-options`.
  - Màn hoàn tất hiển thị thẻ tóm tắt giới hạn dùng thử (`1 lớp · 3 bài học/đề · 3 học sinh · mỗi học sinh nộp 1 lần mỗi bài`), thông báo xác minh trong 1–2 ngày làm việc và nút "Vào không gian dạy học" → `/teacher/classes`.
- Hiện thực `app/login/page.tsx` và `app/teacher/login/page.tsx`:
  - `/login` thiết kế mới, không điền sẵn tài khoản demo, có `placeholder="Email hoặc tên đăng nhập"`, `placeholder="Mật khẩu"`, liên kết `/forgot-password`, 2 thẻ dẫn sang `/register` và `/register/teacher`, xử lý `?next=` qua `safeNextPath`.
  - `/teacher/login` thành Server Component gọi `redirect("/login")`.
- Cập nhật `app/profile/page.tsx`: hiển thị khối nhắc khi `emailIsPlaceholder` đang bật kèm form đổi sang email thật qua `PUT /api/profile`.

## File đã tạo/sửa
- `app/globals.css`: thêm keyframes và lớp `.mascot-*`, tắt khi `prefers-reduced-motion: reduce`.
- `components/onboarding/redirect.ts`: hàm thuần `safeNextPath` và `roleHomePath`.
- `components/onboarding/Mascot.tsx`: component hiển thị mascot Kito với 5 trạng thái cảm xúc.
- `components/onboarding/SpeechBubble.tsx`: bong bóng thoại gõ chữ dần ~25ms/ký tự, `aria-live="polite"`.
- `components/onboarding/ChoiceChips.tsx`: danh sách chip chọn một/nhiều có `aria-pressed` và điều hướng bàn phím.
- `components/onboarding/useInterviewDraft.ts`: hook lưu nháp `sessionStorage` an toàn, loại bỏ `password`.
- `components/onboarding/Confetti.tsx`: hiệu ứng confetti thuần CSS/DOM.
- `components/onboarding/InterviewShell.tsx`: khung bố cục phỏng vấn dùng chung cho học sinh và giáo viên.
- `app/api/auth/signup-options/route.ts`: API công khai lấy danh sách môn hệ thống (`id`, `name`).
- `app/api/auth/me/route.ts`: trả thêm `username`, `teacherStatus`, `emailIsPlaceholder`.
- `context/AuthContext.tsx`: thêm `registerStudent`, `registerTeacher` và mở rộng kiểu `User`.
- `app/teacher/login/page.tsx`: Server Component chuyển hướng về `/login`.
- `app/login/page.tsx`: giao diện đăng nhập mới có mascot, câu chào theo giờ và 2 lối đăng ký.
- `app/register/page.tsx`: luồng đăng ký học sinh kiểu phỏng vấn có mascot.
- `app/register/teacher/page.tsx`: luồng đăng ký giáo viên dùng thử kiểu phỏng vấn.
- `app/profile/page.tsx`: thêm khối cảnh báo và cập nhật email thật khi `emailIsPlaceholder` là `true`.

## Kết quả tự kiểm
Nguyên văn phần cuối output của `python3 scripts/handoff.py verify TASK-036`:
```text
 ✓ tests/onboarding-ui.test.ts (15 tests) 14823ms
   ✓ safeNextPath — chống chuyển hướng ra ngoài > chỉ nhận đường dẫn nội bộ; còn lại theo vai trò  2967ms
   ✓ GET /api/auth/signup-options (công khai) > chỉ trả môn hệ thống, chỉ id + name  1058ms
   ✓ GET /api/auth/signup-options (công khai) > DB lỗi → vẫn trả Tiếng Anh dự phòng  809ms
   ✓ GET /api/auth/me trả trường FEAT-012 > username, teacherStatus, emailIsPlaceholder  981ms
   ✓ Khung phỏng vấn components/onboarding > đủ các thành phần, mascot dùng ảnh nền trong suốt, có 5 cảm xúc  862ms
   ✓ Khung phỏng vấn components/onboarding > có hỗ trợ trợ năng: progressbar, aria-live, aria-pressed  1018ms
   ✓ Khung phỏng vấn components/onboarding > nháp lưu sessionStorage, có try/catch, không bao giờ lưu mật khẩu  780ms
   ✓ Khung phỏng vấn components/onboarding > globals.css có keyframes mascot và tắt khi prefers-reduced-motion  634ms
   ✓ Trang /register và /register/teacher > học sinh: dùng lib/onboarding, gọi đủ API, xưng 'bạn', có câu hỏi email và email tạm  704ms
   ✓ Trang /register và /register/teacher > giáo viên: dùng enum lib/onboarding, gọi registerTeacher, nêu đủ giới hạn dùng thử  797ms
   ✓ Trang /register và /register/teacher > AuthContext có registerStudent/registerTeacher và trường teacherStatus, emailIsPlaceholder  723ms
   ✓ Trang /login > không điền sẵn tài khoản demo; ô 'Email hoặc tên đăng nhập'; 2 lối đăng ký; dùng safeNextPath  775ms
   ✓ Trang /login > /teacher/login chỉ chuyển hướng về /login  978ms
   ✓ Trang /login > trang hồ sơ có khối email tạm gọi PUT /api/profile  811ms
   ✓ Trang /login > chống lách: đủ số ca  920ms

...

 Test Files  47 passed (47)
      Tests  823 passed (823)
   Start at  15:02:54
   Duration  787.05s (transform 63.64s, setup 0ms, collect 34.22s, tests 2917.88s, environment 30ms, prepare 19.59s)


> learningsystem@0.1.0 e2e:db
> docker compose -f docker-compose.e2e.yml -p kitokit-e2e up -d --wait

[+] up 2/2
 ✔ Container kitokit-e2e-e2e-redis-1    Healthy                             0.7s
 ✔ Container kitokit-e2e-e2e-postgres-1 Healthy                             0.7s
[WebServer] ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3000". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
[WebServer] ⚠ "next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.
[WebServer] [env] Thiếu PORTKEY_API_KEY, Thiếu GOOGLE_API_KEY, Thiếu NEXT_PUBLIC_SUPABASE_URL, Thiếu SUPABASE_SERVICE_ROLE_KEY, Thiếu NEO4J_URI

Running 11 tests using 1 worker

      1 …7 › Xác thực › khách vào / thấy trang công khai, không bị đòi đăng nhập
[WebServer] ⚠ metadataBase property in metadata export is not set for resolving social open graph or twitter images, using "http://localhost:3100". See https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase
  ✓   1 … thực › khách vào / thấy trang công khai, không bị đòi đăng nhập (1.5s)      2 …hực › học sinh đăng nhập qua form → vào dashboard; sai mật khẩu báo lỗi
  ✓   2 …ọc sinh đăng nhập qua form → vào dashboard; sai mật khẩu báo lỗi (1.2s)      3 …ts:23:7 › Xác thực › mật khẩu tạm: mọi trang bị đưa về /change-password
  ✓   3 …› Xác thực › mật khẩu tạm: mọi trang bị đưa về /change-password (411ms)      4 …s:29:7 › Xác thực › chưa đăng nhập vào trang giáo viên / admin → /login
  ✓   4 … Xác thực › chưa đăng nhập vào trang giáo viên / admin → /login (559ms)      5 …p bằng mã, quay lại không mất dữ liệu, đăng nhập lại bằng tên đăng nhập
  ✓   5 …mã, quay lại không mất dữ liệu, đăng nhập lại bằng tên đăng nhập (4.5s)      6 …g vấn › tên đăng nhập đã có người dùng → báo trùng và bấm gợi ý để dùng
  ✓   6 …tên đăng nhập đã có người dùng → báo trùng và bấm gợi ý để dùng (667ms)      7 … ký học sinh kiểu phỏng vấn › có email: đăng ký xong vào trang học sinh
  ✓   7 …sinh kiểu phỏng vấn › có email: đăng ký xong vào trang học sinh (793ms)      8 … › Đăng ký giáo viên dùng thử › đi trọn khảo sát → vào /teacher/classes
  ✓   8 … ký giáo viên dùng thử › đi trọn khảo sát → vào /teacher/classes (1.0s)      9 … Trang đăng nhập › có 2 lối đăng ký, không điền sẵn, chặn next ra ngoài
  ✓   9 …ăng nhập › có 2 lối đăng ký, không điền sẵn, chặn next ra ngoài (446ms)     10 …rding.spec.ts:146:7 › Trang đăng nhập › /teacher/login chuyển về /login
  ✓  10 …ec.ts:146:7 › Trang đăng nhập › /teacher/login chuyển về /login (331ms)     11 …hập › màn 375px không cuộn ngang ở /login, /register, /register/teacher
  ✓  11 …n 375px không cuộn ngang ở /login, /register, /register/teacher (675ms)
  11 passed (44.2s)

To open last HTML report run:

  npx playwright show-report


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
