# 03 — Màn hình & giao diện

> Cập nhật: 2026-11-03 · Nguồn: `app/**/page.tsx`. Code status: `DONE` có trong code và test; `PARTIAL` có trong code nhưng còn tồn đọng (xem `docs/11` §4); `REDIRECT` là trang chỉ chuyển hướng.
> Design status: `APPROVED` (đã duyệt mock / prototype) · `CODE-ONLY` (làm thẳng trong code, chưa có mock duyệt).

## 1. Kiểm kê màn hình
### Công khai
| SCR | Đường dẫn | Mô tả | Design | Code |
| :--- | :--- | :--- | :--- | :--- |
| SCR-01 | `/` | Landing (Server Component, SEO); đã đăng nhập → chuyển theo vai trò | CODE-ONLY | DONE |
| SCR-02 | `/login` | Đăng nhập bằng email hoặc tên đăng nhập | APPROVED (PR #2/#3) | DONE |
| SCR-03 | `/register` | Đăng ký học sinh kiểu phỏng vấn, mascot Kito | APPROVED | DONE |
| SCR-04 | `/register/teacher` | Đăng ký giáo viên dùng thử + khảo sát | APPROVED | DONE |
| SCR-05 | `/forgot-password`, `/reset-password` | Khôi phục mật khẩu; chưa gửi email nên sau khi gửi yêu cầu hiện liên hệ hỗ trợ (BR-A06) | CODE-ONLY | DONE |
| SCR-06 | `/join/[classId]` | Xem trước lớp qua link mời, đăng nhập / đăng ký rồi vào lớp | CODE-ONLY | DONE |
| SCR-07 | `/change-password` | Đổi mật khẩu (bắt buộc khi `must_change_password`) | CODE-ONLY | DONE |
| SCR-52 | `/about`, `/terms`, `/privacy`, `/payment-policy` | Trang pháp lý Bộ Công Thương: giới thiệu pháp nhân, điều khoản, bảo mật, chính sách thanh toán & hoàn tiền (thông tin từ `lib/brand.ts`) | CODE-ONLY | DONE |
| SCR-08 | `/profile` | Hồ sơ cá nhân | CODE-ONLY | DONE |
| — | `/teacher/login` | Chuyển về `/login` | — | REDIRECT |

### Học sinh
| SCR | Đường dẫn | Mô tả | Design | Code |
| :--- | :--- | :--- | :--- | :--- |
| SCR-10 | `/student/dashboard` | Trang chủ học sinh: lớp, việc cần làm, vào lớp bằng mã | CODE-ONLY | DONE |
| SCR-11 | `/student/class/[classId]` | Lớp: lộ trình (khoá / mở / hoàn thành), đề được giao; tab Bảng điểm (`?tab=gradebook`) xem điểm chính thức các bài đã chốt | CODE-ONLY | PARTIAL (menu trỏ cứng `cls_101`) |
| SCR-12 | `/student/lesson/[lessonId]` | Làm bài học, kết quả từng câu (điểm/nhận xét GV nếu có), trạng thái `NEEDS_REVIEW`, làm lại | CODE-ONLY | DONE |
| SCR-13 | `/student/exam/[examId]` | Làm đề: bố cục LISTENING / SPLIT / FOCUS (DEC-020), giờ server, ghi âm | CODE-ONLY | DONE |
| SCR-14 | `/student/exam/review/[submissionId]` | Xem lại bài, điểm theo chuẩn, điểm/nhận xét GV câu AI và chung bài, phần "đang chấm" | CODE-ONLY | DONE |
| SCR-15 | `/student/analytics` | Biểu đồ điểm | CODE-ONLY | DONE |
| SCR-16 | `/student/landing` | Trang chờ (đổi mật khẩu / chưa có lớp) | CODE-ONLY | DONE |
| — | `/student` | Chuyển hướng | — | REDIRECT |

### Giáo viên
| SCR | Đường dẫn | Mô tả | Design | Code |
| :--- | :--- | :--- | :--- | :--- |
| SCR-20 | `/teacher/classes` | Danh sách lớp, tạo / sửa lớp | CODE-ONLY | DONE |
| SCR-21 | `/teacher/classes/[classId]` | Chi tiết lớp: học viên, tab Đề giao, lộ trình lớp, mở khoá, tiến độ, nút "Mở bảng điểm" → `/teacher/grading?class=` | CODE-ONLY | DONE |
| SCR-22 | `/teacher/tests` | Khoá học + cây giáo trình kéo-thả | CODE-ONLY | DONE |
| SCR-23 | `/teacher/tests/create` | Soạn đề 4 kỹ năng (file lớn) | CODE-ONLY | DONE |
| SCR-24 | `/teacher/library` | Kho bài học & đề, AI nhập đề, nhân bản, chuyển đổi | CODE-ONLY | DONE |
| SCR-25 | `/teacher/lessons`, `/teacher/lessons/[id]` | Kho bài học, soạn bài học, xem trước | CODE-ONLY | DONE |
| SCR-26 | `/teacher/subjects` | Môn học | CODE-ONLY | DONE |
| SCR-27 | `/teacher/flashcards` | Thư viện flashcard | CODE-ONLY | DONE |
| SCR-28 | `/teacher/students/create` | Tạo tài khoản học sinh | CODE-ONLY | DONE |
| SCR-29 | `/teacher/slots` | Slot đang dùng / tổng, tạo đơn, danh sách đơn | CODE-ONLY | DONE |
| SCR-30 | `/teacher/orders/[id]` | Trang thanh toán VietQR, báo đã chuyển khoản, huỷ | CODE-ONLY | DONE |
| SCR-31 | `/teacher/grading` | Hub chấm điểm & bảng điểm theo lớp: chọn lớp, lọc bài, bảng bài và tổng kết lớp (`?class=`, `?tab=summary`) | CODE-ONLY | DONE (FEAT-014) |
| SCR-51 | `/teacher/grading/[classId]/[kind]/[itemId]` | Bảng điểm một bài (học sinh × điểm), ngăn chấm từng câu AI, chốt / mở chốt (FEAT-014) | CODE-ONLY | DONE (FEAT-014) |

### Quản trị
| SCR | Đường dẫn | Mô tả | Design | Code |
| :--- | :--- | :--- | :--- | :--- |
| SCR-40 | `/admin` | Tổng quan: thẻ số liệu, chọn tháng, biểu đồ, top giáo viên | CODE-ONLY | DONE |
| SCR-41 | `/admin/orders` | Đơn hàng (lọc, duyệt / từ chối / huỷ) + tab Cấu hình thanh toán | CODE-ONLY | DONE |
| SCR-42 | `/admin/orders/[id]` | Trang thanh toán + duyệt / từ chối | CODE-ONLY | DONE |
| SCR-43 | `/admin/teachers` | Danh sách giáo viên, lọc chờ xác minh (`?status=TRIAL`) | CODE-ONLY | DONE |
| SCR-44 | `/admin/teachers/[id]` | Chi tiết, khảo sát, xác minh, `slot_limit`, tạo đơn, nhật ký AI | CODE-ONLY | DONE |
| SCR-45 | `/admin/students`, `/admin/students/[id]` | Học sinh | CODE-ONLY | DONE |
| SCR-46 | `/admin/accounts` | Tài khoản mọi vai trò | CODE-ONLY | DONE |
| SCR-47 | `/admin/scoring-standards` | 2 tab: Chuẩn chấm / Bộ tiêu chí AI (`components/admin/RubricManager.tsx`) | CODE-ONLY | DONE |
| SCR-48 | `/admin/leads` | Liên hệ từ website | CODE-ONLY | DONE |
| SCR-49 | `/admin/settings` | Model AI nhập đề, bảng giá model + tỷ giá | CODE-ONLY | DONE |
| SCR-50 | `/admin/tests/import` | Nhập đề từ văn bản (công cụ cũ, không có menu) | CODE-ONLY | DONE |
| — | `/admin/requests` → `/admin/orders`; `/admin/rubrics` → `/admin/scoring-standards?tab=rubrics` | 308 | — | REDIRECT |

## 2. Điều hướng
- `middleware.ts` chặn các đường dẫn sau:
  - `/admin/*` chỉ cho `ADMIN`;
  - `/teacher/*` cho `TEACHER` và `ADMIN`;
  - `/student/*` cho người đã đăng nhập, trừ `/student/landing`;
  - token còn cờ `mcp` (bắt buộc đổi mật khẩu) thì chuyển về `/change-password`.
- Trang đích sau khi đăng nhập (`components/onboarding/redirect.ts` `roleHomePath`):

  | Vai trò | Trang đích |
  | :--- | :--- |
  | ADMIN | `/admin` |
  | TEACHER | `/teacher/classes` |
  | STUDENT | `/student/dashboard` |

  Tham số `next` chỉ được nhận đường dẫn nội bộ (`safeNextPath`).
- Liên kết trong thông báo:
  - học sinh: `/student/exam/review/<id>`;
  - giáo viên: `/teacher/grading/<classId>/<kind>/<itemId>` (`EXAM_NEEDS_REVIEW` của bài lớp, `LESSON_NEEDS_REVIEW`), `/teacher/grading` (bài luyện tự do), `/teacher/orders/<id>`;
  - học sinh (chốt bảng điểm): `/student/class/<classId>?tab=gradebook` (`GRADEBOOK_FINALIZED`);
  - admin: `/admin/teachers?status=TRIAL`, `/admin/orders?q=<mã đơn>`.

## 3. Quy tắc giao diện (bắt buộc, có test)
| Quy tắc | Nguồn | Test |
| :--- | :--- | :--- |
| Màu chỉ qua token Tailwind v4 `brand-*`, `accent-*`, `ink*`, `line*`, `surface*`; trạng thái dùng emerald / amber / rose; không viết mã hex trong class | DEC-022 | `tests/brand-tokens.test.ts` |
| Gradient chỉ một dải màu, đậm → nhạt; không pha xanh với cam | DEC-022 | `tests/design-rules.test.ts` |
| Nhãn nút không có dấu `+` ở đầu; icon trên nền `bg-brand-500…900` dùng `text-white` | DEC-035 | `tests/design-rules.test.ts` |
| Font thân Lexend, tiêu đề `font-display` (Baloo 2); logo và mascot ở `public/brand/` | DEC-022 | — |
| Trang dùng `useSearchParams` phải bọc `<Suspense>` (Next 16) | — | `next build` |

## 4. Bốn trạng thái UI
Mỗi trang hoặc khối dữ liệu đều phải có đủ:
1. **Đang tải**: skeleton hoặc `Loader2`.
2. **Rỗng**: câu hướng dẫn và nút hành động chính.
3. **Lỗi**: thông điệp tiếng Việt lấy từ `error` của API, kèm nút Thử lại.
4. **Có dữ liệu.**

Lỗi phân quyền: 401 thì về `/login`, 403 thì báo "không có quyền", 404 thì báo "không tìm thấy". Riêng đơn hàng của giáo viên khác trả 404 để không lộ đơn có tồn tại.

## 5. Validate phía client
Client chỉ kiểm để hiện lỗi sớm; server luôn kiểm lại và là nguồn đúng (`docs/12`). Không gửi số tiền hay điểm do client tự tính.
