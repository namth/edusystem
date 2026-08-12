# DANH MỤC TÍNH NĂNG & NỢ KỸ THUẬT (FEATURE INDEX & TECHNICAL DEBT)
**Dự án:** English Learning & AI Mock Test System  
**Ngày rà soát:** 25/07/2026

---

## 1. Tính năng Đã Hoàn thiện (Completed Features)

### 👨‍🏫 Phân hệ Giáo viên (Teacher)
- [x **Bộ công cụ Tạo Đề thi 4 Kỹ năng (Interactive Exam Creator):**
  - Đóng gói đầy đủ các dạng bài: Listening MC, Reading Passage & Sub-questions, Writing Task 1/2, Flashcard Grid 3 cột, Sentence Ordering, Matching Pairs, Fill-in-the-blank (Dropdown / Option Bank).
  - Tích hợp **AI Voice Generator Realtime** sử dụng Google Gemini 3.1/2.5 Flash TTS (`app/api/tts/route.ts`) phát thử âm thanh trực tiếp với accent tùy chọn (Male / Female, US/UK).
  - Tách rời văn bản bài đọc (`stimulusText`) và văn bản tạo giọng đọc AI (`stimulusAudioText`).
  - Hỗ trợ Chỉnh sửa (Edit) và Xóa (Delete) các câu hỏi phụ/thẻ flashcard trong giao diện preview.
  - Quản lý trạng thái form độc lập khi chuyển đổi giữa các kỹ năng và dạng câu hỏi (`resetCategoryStates`).
- [x] **Quản lý Bài thi & Phân loại Khóa học (Test Manager Dashboard):**
  - Điều hướng dạng Tab theo danh mục Khóa học (Courses).
  - Hiển thị badge số lượng đề thi cho từng khóa học (`app/teacher/tests/page.tsx`).
- [x] **Chấm bài & Nhận xét Bài thi:**
  - Giao diện xem bài làm học sinh, chấm điểm và trả nhận xét (`app/teacher/grading/page.tsx`).

### 👨‍🎓 Phân hệ Học sinh (Student)
- [x] **Giao diện Làm bài thi 4 Kỹ năng (Exam Runner):**
  - Đếm ngược thời gian làm bài, audio player cho kỹ năng Listening, trình soạn thảo bài viết Writing (`app/student/exam/[examId]/page.tsx`).
- [x] **Trang Lớp học & Đăng ký Khóa học:**
  - Xem danh sách lớp học, khóa học đã đăng ký, hiển thị thông tin học phí & mã QR thanh toán chuyển khoản (`app/student/page.tsx`, `app/student/class/[classId]/page.tsx`).
- [x] **Phân tích Kết quả & Tiến độ (Analytics):**
  - Biểu đồ theo dõi sự tiến bộ các kỹ năng IELTS qua các bài mock test (`app/student/analytics/page.tsx`).

### 🛡️ Phân hệ Quản trị viên (Admin)
- [x] **Quản lý Học sinh & Giáo viên:**
  - Danh sách người dùng, xem chi tiết lịch sử học tập và làm bài của học sinh (`app/admin/students/page.tsx`, `app/admin/students/[id]/page.tsx`).
- [x] **Duyệt Đơn Đăng ký & Nạp Slot:**
  - Duyệt đơn mua khóa học và cấp slot tài khoản cho giáo viên (`app/admin/orders/page.tsx`, `app/admin/slots/page.tsx`).

### ⚙️ Hạ tầng Backend & Dữ liệu
- [x] Tích hợp AI Engine (`lib/ai-engine.ts`) qua Portkey AI Gateway / OpenAI.
- [x] Thiết lập Redis Streams & Event Producer (`lib/redis-queue.ts`, `app/api/events/route.ts`).
- [x] Đã cấu hình và kết nối Neo4j Graph DB (`lib/neo4j.ts`) đồng bộ mối quan hệ `HAS_EXAM`.
- [x] Đã thiết lập Schema 7 bảng cơ sở dữ liệu trên PostgreSQL / Supabase (`lib/db-schema.ts`, `lib/db-init.js`).

---

## 2. Tính năng Đang Làm Dở (In-Progress / Partial Features)

- [ ] **Kết nối dữ liệu thực từ Supabase vào Giao diện Frontend:**
  - Hầu hết các trang Dashboard (Student, Teacher, Admin) đang đọc từ dữ liệu giả lập `lib/mock-data.ts` thay vì query trực tiếp qua Supabase Client `lib/supabase.ts`.
- [ ] **Worker xử lý Redis Streams tự động:**
  - API Producer `/api/events` đã đẩy sự kiện thành công vào Redis Stream, nhưng cần background worker chạy liên tục (daemon process) để tiêu thụ tin nhắn thay vì gọi hàm trực tiếp.
- [ ] **Chấm bài Nói (Speaking Auto-Grading) với Realtime Audio Recording:**
  - Giao diện Speaking hiện mới chỉ hỗ trợ xem đề câu hỏi, chưa có bộ thu âm trực tiếp WebRTC/MediaRecorder trên giao diện làm bài của học sinh.

---

## 3. Rà soát Nợ Kỹ thuật (Technical Debt & Mock Data Audit)

| Vị trí / File | Loại Nợ (Type) | Chi Tiết & Rủi Ro | Hướng Khắc Phục Khuyên Dùng |
| :--- | :--- | :--- | :--- |
| `lib/mock-data.ts` | **Hardcoded / Mock Data** | Chứa toàn bộ dữ liệu tĩnh về Khóa học, Bài thi, Lớp học, Đơn hàng (`INITIAL_COURSES`, `INITIAL_TESTS`, `INITIAL_CLASSES`). | Chuyển đổi các Server Components / API Routes sang truy vấn PostgreSQL (Supabase) hoặc Neo4j. |
| `app/student/page.tsx` | **Mock UI** | Đang dùng ảnh QR tĩnh từ Unsplash cho mục thanh toán chuyển khoản học phí. | Tích hợp thư viện VietQR / SePay để sinh mã QR động theo đúng số tiền và cú pháp chuyển khoản. |
| `lib/ai-engine.ts` (Dòng 4) | **Hardcoded API Key Fallback** | Key Portkey AI fallback đang được hardcode trực tiếp trong source code nếu thiếu `.env`. | Xóa bỏ fallback hardcode, bắt buộc đọc từ `process.env.PORTKEY_API_KEY` để đảm bảo bảo mật. |
| `app/teacher/grading/page.tsx` | **Mock Data Logic** | Đang hardcode tên bài thi `sub.exam_id === "test_01" ? "IELTS Mock Standard #01" : "Đề Thi Khác"`. | Join bảng `exams` trên Supabase để lấy tiêu đề chính xác theo `exam_id`. |
| `app/student/exam/[examId]/page.tsx` | **Mock State** | Khi học sinh nộp bài, kết quả đang được lưu vào Local State / Session tạm thời. | Đẩy dữ liệu câu trả lời vào bảng `submissions` trên Supabase qua API `/api/submissions`. |
