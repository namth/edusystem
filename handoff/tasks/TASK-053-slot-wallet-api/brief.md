# TASK-053 — Khoá lớp LOCKED/ENDED ở nộp bài & AI; API ví slot, ngày khai giảng, kết thúc lớp, admin cộng/trừ

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** có (phân quyền, tiền)

**Phụ thuộc:** TASK-052 và TASK-050 đã merge (dùng `lib/slot-wallet.ts`; TASK-050 cũng sửa `app/api/admin/teachers/[id]/route.ts`).

## 1. Mục tiêu
Nối lõi ví (TASK-052) vào các luồng còn lại: lớp tạm khoá/kết thúc thì học sinh không mở lượt làm bài, nộp bài được và AI không chấm; giáo viên/admin xem được ví; đặt được ngày khai giảng, kết thúc lớp; admin cộng/trừ tay số dư.

## 2. Tài liệu bắt buộc đọc
- `docs/features/vi-slot-hoc-sinh-thang.md` §2, §6, §7 (BR-W06, W08, W11), §8 (TC-W08, 10, 12, 13)
- `lib/slot-wallet.ts` (TASK-052), `lib/api-auth.ts`, `lib/teacher-trial.ts` (`trialLimitResponse` làm mẫu mã lỗi)

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/class-billing.ts` (mới): `assertClassOpen(classId)`, `classLockedResponse()`
- `app/api/student/exams/[examId]/attempts/route.ts`, `app/api/student/exam-attempts/[id]/submit/route.ts`, `app/api/student/exam-attempts/[id]/answers/route.ts`, `app/api/student/lessons/[lessonId]/attempts/route.ts`, `app/api/student/attempts/[id]/route.ts`
- `app/api/exam/grade-async/route.ts`, `app/api/lessons/grade-async/route.ts`
- `app/api/teacher/slot-wallet/route.ts`, `app/api/teacher/classes/[classId]/billing/route.ts`, `app/api/teacher/classes/[classId]/end/route.ts` (mới)
- `app/api/admin/teachers/[id]/slot-wallet/route.ts`, `app/api/admin/teachers/[id]/slot-adjust/route.ts` (mới)
- `app/api/admin/teachers/[id]/route.ts` (bỏ nhận `slot_limit` ở PUT; GET trả thêm `slot_balance`)
- `tests/slot-wallet-api.test.ts` (mới, nếu tài khoản kiểm chéo chưa viết)

**Không được sửa:** mọi file trong `tests.lock`; `lib/slot-wallet.ts` (báo trong report nếu thiếu hàm); UI `app/**/page.tsx`; `docs/`

## 4. Đặc tả chi tiết
- **Khoá lớp (BR-W06/W08):** mở lượt làm bài, lưu câu trả lời, nộp bài của lớp có `billing_status IN ('LOCKED','ENDED')` → **403** `{ success:false, code:"CLASS_LOCKED", error:"Lớp đang tạm khoá hoặc đã kết thúc, chưa làm bài được. Vui lòng liên hệ giáo viên." }`. Bài luyện tự do (không gắn lớp) không bị ảnh hưởng. Xem bài/điểm cũ (GET) vẫn được.
- **grade-async** của bài thuộc lớp LOCKED/ENDED: không gọi AI, chuyển `NEEDS_REVIEW` với `last_grading_error = "CLASS_LOCKED"`, báo giáo viên như luồng hiện có.
- **API ví, ngày khai giảng, kết thúc lớp, cộng/trừ tay:** đúng bảng §6 của đặc tả (payload, quyền, mã lỗi). Bổ sung:
  - `GET /api/teacher/slot-wallet`: mỗi lớp `enough_for_next = balance ≥ student_count` của lớp đó; thêm `total_next_needed` = tổng sĩ số các lớp sẽ trừ trong 31 ngày tới. Ledger trả `{ id, delta, balance_after, reason, class_id, class_name, period, student_count, note, created_at }`, 20 dòng/trang, `next_cursor`.
  - Giáo viên chỉ xem/sửa lớp `teacher_id = mình`; lớp khác → 404.
  - `slot-adjust` gọi `adjustBalance` của `lib/slot-wallet.ts`; ghi `created_by` = admin.
- **PUT `/api/admin/teachers/[id]`**: body có `slot_limit` → bỏ qua (không lỗi), các trường khác giữ nguyên.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0; `tests/docs-sync.test.ts` xanh hoặc chỉ đỏ vì route mới chưa có trong docs/07 (ghi report, Claude bổ sung)
- [ ] TC-W08, W10, W12, W13 (§8 đặc tả) có test và xanh
- [ ] Lớp ACTIVE và GRACE vẫn mở lượt làm bài và nộp bài bình thường
- [ ] Học sinh lớp LOCKED vẫn GET được bài đã nộp và điểm
- [ ] Giáo viên A gọi `billing`/`end`/xem ví lớp của giáo viên B → 404; STUDENT → 403; chưa đăng nhập → 401
- [ ] `slot-adjust` cộng cho giáo viên có lớp LOCKED đủ slot → lớp về ACTIVE trong cùng lời gọi
- [ ] PUT admin teacher với `slot_limit: 999` không đổi `slot_limit` lẫn `slot_balance`

## 6. Ràng buộc & bẫy cần tránh
- Kiểm `billing_status` từ DB theo lớp của bài, không tin `classId` client gửi.
- Không đổi số dư ngoài `lib/slot-wallet.ts`.
- Chỉ chạy lệnh `python3` (`python3 scripts/handoff.py verify TASK-053`).
