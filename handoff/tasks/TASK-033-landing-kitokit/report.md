# Báo cáo TASK-033

## Đã làm
- Tạo schema và migration `docs/db-migration-011-leads.sql` cho bảng `leads` kèm index `created_at DESC`.
- Hiện thực `lib/leads.ts` với hàm `ensureLeadsTable()` chạy DDL một lần/tiến trình trước truy vấn.
- Hiện thực `lib/landing-stats.ts` với hàm `getLandingStats()` đếm số đề thi, câu hỏi và học sinh từ DB thật; bắt lỗi trả về `null`.
- Hiện thực API công khai `POST /api/leads` kiểm tra giới hạn 5 lần/giờ/IP qua `lib/rate-limit.ts`, bẫy bot honeypot `website`, validate dữ liệu và lưu vào bảng `leads` với trạng thái `NEW`.
- Hiện thực API admin `GET /api/admin/leads` (yêu cầu vai trò ADMIN, trả về tối đa 500 leads mới nhất) và `PATCH /api/admin/leads/[id]` (ADMIN cập nhật trạng thái `NEW|CONTACTED|DONE`).
- Hiện thực giao diện quản trị `/admin/leads` hiển thị danh sách khách hàng tiềm năng, lọc theo trạng thái, cập nhật trạng thái bằng PATCH; thêm mục "Khách hàng tiềm năng" vào `components/AdminLayout.tsx`.
- Chuyển `app/student/landing/page.tsx` thành Server Component chuyển hướng về `/`.
- Xây dựng landing page KitoKit mới tại `/` (`app/page.tsx`) dạng Server Component: khai báo metadata, chuyển hướng người dùng đã đăng nhập theo vai trò, render các section cho khách.
- Xây dựng 8 component section trong `components/landing/`: `LandingHeader`, `LandingHero`, `LandingSubjects`, `LandingFeatures`, `LandingTeachers`, `LandingFaq`, `LandingContact`, `LandingFooter` với đầy đủ các anchor id (`#mon-hoc`, `#tinh-nang`, `#giao-vien`, `#faq`, `#lien-he`), dùng token màu KitoKit, không bịa số liệu, không chứa link `test_01` hay `12.000+`.
- Làm mới nội dung khối giới thiệu bên trái của trang đăng nhập `app/login/page.tsx` và đăng ký `app/register/page.tsx` sang định hướng KitoKit đa môn, loại bỏ số liệu bịa và nội dung riêng IELTS.
- Tự kiểm bằng `python3 scripts/handoff.py verify TASK-033` đạt kết quả xanh: 44/44 test files, 731/731 tests pass và tsc pass.

## File đã tạo/sửa
- `docs/db-migration-011-leads.sql`: Migration tạo bảng `leads` và index `created_at DESC`.
- `lib/leads.ts`: Định nghĩa types và hàm `ensureLeadsTable()`.
- `lib/landing-stats.ts`: Hàm `getLandingStats()` đếm đề, câu hỏi, học sinh từ PostgreSQL.
- `app/api/leads/route.ts`: API công khai tiếp nhận liên hệ và lưu khách hàng tiềm năng.
- `app/api/admin/leads/route.ts`: API danh sách leads cho admin.
- `app/api/admin/leads/[id]/route.ts`: API cập nhật trạng thái lead cho admin.
- `app/admin/leads/page.tsx`: Giao diện quản trị danh sách leads và đổi trạng thái.
- `components/AdminLayout.tsx`: Thêm mục menu "Khách hàng tiềm năng".
- `app/student/landing/page.tsx`: Server Component redirect về `/`.
- `app/page.tsx`: Landing page KitoKit mới tại `/` (Server Component).
- `components/landing/LandingHeader.tsx`: Header dính kèm logo ngang, menu neo và nút đăng nhập/đăng ký.
- `components/landing/LandingHero.tsx`: Section Hero với mascot, tiêu đề, CTA và dải số liệu thật.
- `components/landing/LandingSubjects.tsx`: Lưới môn học với Tiếng Anh nổi bật và các môn đang mở rộng.
- `components/landing/LandingFeatures.tsx`: Quy trình 3 bước và tính năng học sinh.
- `components/landing/LandingTeachers.tsx`: Khu vực dành cho giáo viên và trung tâm.
- `components/landing/LandingFaq.tsx`: Accordion câu hỏi thường gặp.
- `components/landing/LandingContact.tsx`: Form liên hệ gửi thông tin về `/api/leads`.
- `components/landing/LandingFooter.tsx`: Chân trang KitoKit.
- `app/login/page.tsx`: Cập nhật nội dung giới thiệu KitoKit đa môn bên trái.
- `app/register/page.tsx`: Cập nhật nội dung giới thiệu KitoKit đa môn bên trái.

## Kết quả tự kiểm
```
 Test Files  44 passed (44)
      Tests  731 passed (731)
   Start at  20:09:14
   Duration  435.56s (transform 60.21s, setup 0ms, collect 48.21s, tests 2852.67s, environment 37ms, prepare 20.78s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
