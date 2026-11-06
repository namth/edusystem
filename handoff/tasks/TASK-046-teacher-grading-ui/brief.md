# TASK-046 — UI giáo viên: hub Chấm & Bảng điểm, bảng điểm từng bài, ngăn chấm, tổng kết lớp

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** HIGH
**Nhạy cảm:** không

## 1. Mục tiêu
Dựng giao diện giáo viên của FEAT-014 trên các API của TASK-045 (đã merge), gồm 4 việc:
- viết lại SCR-31 `/teacher/grading` thành hub;
- làm mới SCR-51 `/teacher/grading/[classId]/[kind]/[itemId]` (bảng điểm một bài, kèm ngăn chấm);
- ở SCR-21, bỏ tab "Sổ điểm" (đang lỗi) và thêm nút "Mở bảng điểm";
- đổi nhãn menu thành "Chấm & Bảng điểm".

## 2. Tài liệu bắt buộc đọc
- `docs/features/cham-diem-bang-diem.md` §4 (SCR-31, SCR-51, SCR-21, có đủ 4 trạng thái UI và validate), §6 (hợp đồng API), §8 TC-B16
- `docs/03-screens-and-ui.md` §3 (quy tắc giao diện, có test), §4 (4 trạng thái UI); `docs/14-decisions.md` DEC-022 (token màu), DEC-035 (quy tắc nút)
- Mẫu bố cục giáo viên: `components/TeacherLayout.tsx`, `app/teacher/slots/page.tsx`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/teacher/grading/page.tsx` (viết lại)
- `app/teacher/grading/[classId]/[kind]/[itemId]/page.tsx` (mới)
- `components/teacher/grading/` (mới: bảng bài, bảng điểm, ngăn chấm, tổng kết, hộp xác nhận chốt)
- `app/teacher/classes/[classId]/page.tsx` (chỉ bỏ tab Sổ điểm, modal duyệt và state liên quan; thêm tab "Đề giao" và nút "Mở bảng điểm")
- `components/TeacherLayout.tsx` (chỉ đổi nhãn menu)
- `docs/03-screens-and-ui.md` (đổi SCR-31, SCR-51, SCR-21 thành `Code: DONE`)

**Không được sửa:**
- Mọi file trong `tests.lock`
- `app/api/**`, `lib/**` (API đã xong ở TASK-045; thiếu dữ liệu thì ghi vào `report.md` mục câu hỏi, không tự sửa API)
- `app/student/**`, `components/teacher/StudentPreviewModal.tsx`, `middleware.ts`
- `stitch_english_mock_exam_portal/`

## 4. Đặc tả chi tiết
- **Hub:**
  - Trạng thái trang nằm trên URL: `?class=<id>&tab=items|summary`. Đổi lớp hoặc tab thì `router.replace` để giữ tham số. Tải lại trang thì giữ nguyên lựa chọn.
  - Dữ liệu lấy từ `GET /api/teacher/grading/classes`, sau đó là `GET /api/teacher/grading/classes/[classId]` hoặc `.../summary`.
  - Bộ lọc loại và ô "Chỉ bài còn việc" lọc ở phía client.
  - Bấm một dòng bài thì `router.push('/teacher/grading/<classId>/<kind>/<itemId>')`.
- **Bảng điểm một bài:**
  - Cột hiển thị lấy theo `columns` mà API trả về.
  - Bấm một dòng học sinh thì mở drawer. Drawer có:
    - danh sách lượt (★ cho lượt đang tính; nút "Tính lượt này" / "Bỏ chọn" gọi PUT `.../students/[studentId]`);
    - bài làm lấy từ `GET /api/teacher/grading/attempts/[kind]/[attemptId]`;
    - ô điểm và nhận xét cho từng câu AI, ô nhận xét chung;
    - nút "Lưu & đánh dấu đã duyệt" gọi PUT `/api/teacher/grading/attempts/[kind]/[attemptId]`.
  - Học sinh "Chưa nộp" có ô nhập tay điểm thang 10 và ghi chú.
  - Lưu xong thì tải lại dòng đó và hiện toast.
- **Câu khách quan:** chỉ xem đáp án học sinh, đáp án đúng và dấu đúng/sai. Câu Speaking có ghi âm thì phát bằng `<audio>`, link lấy từ `answers`.
- **Validate client:** điểm phải là số, nằm trong [min, max] và đúng bước (đề lấy thang từ `standard_snapshot`; bài học là 0–9, bước 0.5). Nhận xét tối đa 2000 ký tự. Sai thì báo dưới ô và không gửi.
- **Chốt:**
  - Bấm "Chốt bảng điểm" gọi POST finalize.
  - Nhận 409 `UNREVIEWED` thì mở hộp xác nhận "Còn N bài AI chưa xem. Vẫn chốt theo điểm hiện tại?". Đồng ý thì gửi lại với `confirmUnreviewed: true`.
  - Nhận 409 `GRADING_PENDING` thì hiện danh sách học sinh đang chấm hoặc cần chấm tay.
  - Bài đã chốt: hiện băng "Đã chốt dd/mm — mở chốt để sửa"; ô và nút sửa bị khoá (kể cả lượt có `locked: true`); nút "Mở chốt" gọi POST reopen.
- **Tổng kết lớp:** bảng học sinh × bài đã chốt, mỗi ô hiện `label` cùng thang 10. Có cột trung bình và hàng trung bình từng bài.
- **4 trạng thái trên mọi khối:**
  - đang tải: skeleton;
  - rỗng: dùng đúng câu trong đặc tả §4;
  - lỗi: hộp đỏ kèm nút "Thử lại" (403/404 thì ghi "Không tìm thấy bài trong lớp của bạn");
  - thành công.
- **SCR-21:**
  - Xoá toàn bộ ma trận "Sổ điểm", modal duyệt bài nộp (`openSubmissionReviewModal`, `handleSaveTeacherReview`, đọc `final_score`/`ai_score`/`ai_feedback`) và các state liên quan.
  - Giữ chức năng giao đề, gỡ đề, xem đề, chuyển chúng sang tab "Đề giao".
  - Thêm nút "Mở bảng điểm" trỏ `/teacher/grading?class=<classId>`.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0 (vitest + tsc + `next build` + `tests/docs-sync.test.ts`)
- [ ] Hub giữ `?class=` và `?tab=` khi đổi lựa chọn và khi tải lại; mặc định là lớp đầu tiên
- [ ] Lọc loại và lọc "Chỉ bài còn việc" đúng; bấm bài thì sang đúng URL SCR-51
- [ ] Drawer gửi đúng payload PUT (cả `item_key` cho bài học); validate chặn điểm sai thang và sai bước; lưu xong dòng cập nhật
- [ ] Chốt: xử lý đủ 409 `UNREVIEWED` (hộp xác nhận, gửi lại có `confirmUnreviewed: true`) và 409 `GRADING_PENDING`; bài đã chốt thì khoá ô và có nút Mở chốt
- [ ] Mọi khối dữ liệu có đủ 4 trạng thái
- [ ] Trang lớp không còn tab Sổ điểm, không gọi `/api/exam/grade-override`, không đọc `final_score` hay `ai_feedback`; có link `/teacher/grading?class=`
- [ ] Không file nào trong `app/teacher/**` và `components/teacher/grading/**` chứa link hay `router.push` tới `/student` hoặc `/admin`
- [ ] Menu ghi "Chấm & Bảng điểm"

## 6. Ràng buộc & bẫy cần tránh
- Chế độ chạy ngầm chỉ cho chạy lệnh `python3` (grep/sed/find/ls/git/npx bị từ chối): đọc file bằng công cụ đọc file, kiểm tra bằng `python3 scripts/handoff.py verify <ID> --quiet`.
- Chỉ dùng token màu `brand-*`, `accent-*`, `ink`, `line`, `surface-*` (DEC-022). Nhãn nút không có dấu `+` ở đầu (DEC-035). Test `design-rules` và `brand-tokens` phải xanh.
- Không tự tính điểm ở client: điểm, thang 10 và trung bình đều lấy từ API.
- Không sửa API. API thiếu trường thì ghi câu hỏi vào report.
- Không đụng `StudentPreviewModal.tsx` và `middleware.ts` (thuộc phiên khác, chưa commit).
- Mỗi file component nên dưới khoảng 400 dòng; tách theo khối.
