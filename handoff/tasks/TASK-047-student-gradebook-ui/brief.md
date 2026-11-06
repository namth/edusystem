# TASK-047 — UI học sinh: tab Bảng điểm, điểm/nhận xét giáo viên, bài học chờ chấm

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

## 1. Mục tiêu
Phần học sinh của FEAT-014, gồm 3 việc:
- thêm tab "Bảng điểm" trong lớp để học sinh xem điểm chính thức các bài đã chốt;
- hiển thị điểm và nhận xét giáo viên khi xem lại đề và kết quả bài học;
- hiển thị trạng thái bài học `NEEDS_REVIEW`.

## 2. Tài liệu bắt buộc đọc
- `docs/features/cham-diem-bang-diem.md` §4 (SCR-11, SCR-14 / bài học), §5 (khoá JSON `ai_score`, `teacher_score`, `teacher_feedback`; `score` là điểm hiệu lực), §6 (`GET /api/student/classes/[classId]/gradebook`)
- `docs/03-screens-and-ui.md` §3, §4; DEC-022, DEC-035 trong `docs/14-decisions.md`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/student/class/[classId]/page.tsx` (thêm tab `gradebook`)
- `components/student/ClassGradebook.tsx` (mới)
- `app/student/exam/review/[submissionId]/page.tsx`
- `app/student/lesson/[lessonId]/page.tsx`
- `components/lesson-player/` (chỉ những file hiển thị kết quả từng câu)
- `docs/03-screens-and-ui.md` (chỉ sửa ghi chú SCR-11, SCR-12, SCR-14)

**Không được sửa:**
- Mọi file trong `tests.lock`
- `app/api/**`, `lib/**`, `app/teacher/**`, `middleware.ts`
- `stitch_english_mock_exam_portal/`

## 4. Đặc tả chi tiết
- **Tab Bảng điểm:**
  - Thêm `"gradebook"` vào kiểu `activeTab`. Đọc và ghi `?tab=gradebook` qua `router.replace`, để link trong thông báo `GRADEBOOK_FINALIZED` mở đúng tab.
  - Dữ liệu lấy từ `GET /api/student/classes/[classId]/gradebook`.
  - Bảng gồm các cột: Bài, Loại (Bài học / Đề thi), Điểm (`raw_score/raw_max`; bài học hiện dạng `%`), Thang 10, Nhận xét (`note`), Ngày chốt.
  - Dòng cuối là "Trung bình" (`average10`, null thì hiện "—").
  - Rỗng: "Giáo viên chưa chốt bài nào". Có đủ 4 trạng thái.
- **Xem lại đề:**
  - Mỗi câu AI hiện điểm hiệu lực `score`.
  - Có `teacher_score` thì thêm nhãn "Giáo viên chấm" và nhận xét `teacher_feedback`.
  - Nhận xét AI (`ai_feedback ?? feedback`) vẫn hiện, ghi rõ "Nhận xét AI".
  - `teacher_feedback` của cả bài hiện như hiện tại.
- **Kết quả bài học:**
  - Mỗi mục AI hiện `band` (điểm hiệu lực), nhãn "Giáo viên chấm" và `teacher_feedback` nếu có. Nhận xét chung lấy từ `teacher_feedback` của lượt, nếu API attempt trả về.
  - Kiểu `status` thêm `"NEEDS_REVIEW"`. Lượt ở trạng thái này hiện "Đang chờ giáo viên chấm phần tự luận" và **không** polling (polling chỉ chạy khi `GRADING`).
  - API attempt hiện chưa trả `teacher_feedback` thì chỉ hiển thị khi có, không sửa API.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0 (vitest + tsc + `next build` + docs-sync)
- [ ] `/student/class/[id]?tab=gradebook` mở đúng tab; đổi tab giữ tham số URL
- [ ] Bảng điểm hiển thị đúng `raw_score/raw_max`, thang 10, ghi chú, trung bình; rỗng có đúng câu; có đủ 4 trạng thái
- [ ] Xem lại đề có nhãn "Giáo viên chấm" và nhận xét giáo viên khi có `teacher_score`; không có thì giữ như cũ
- [ ] Bài học `NEEDS_REVIEW` hiện đúng câu và không gọi lại API định kỳ
- [ ] Không có link tới `/teacher` hay `/admin` trong file đã sửa

## 6. Ràng buộc & bẫy cần tránh
- Chế độ chạy ngầm chỉ cho chạy lệnh `python3` (grep/sed/find/ls/git/npx bị từ chối): đọc file bằng công cụ đọc file, kiểm tra bằng `python3 scripts/handoff.py verify <ID> --quiet`.
- Học sinh không bao giờ thấy dòng của học sinh khác. Chỉ dùng dữ liệu API trả về, không tự gọi API giáo viên.
- Token màu theo DEC-022, nút theo DEC-035.
- Không phá các tab cũ (`roadmap`, `pending`, `graded`, `practice`) và test `class-roadmap-ui`, `student-pages`.
