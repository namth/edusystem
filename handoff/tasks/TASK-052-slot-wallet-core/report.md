# Báo cáo TASK-052

## Đã làm
- Hoàn thành Migration 018 (`docs/db-migration-018-slot-wallet.sql`) và tích hợp vào `ensureSchema` trong `lib/db-pg.ts`.
- Hoàn thành Migration 018b (`docs/db-migration-018b-slot-wallet-data.sql`) hỗ trợ chạy idempotent không cộng trùng số dư.
- Xây dựng module lõi `lib/slot-wallet.ts` với đầy đủ các hàm: `todayVN`, `toDateStr`, `addMonths`, `monthsBetween`, `getBalance`, `applyDelta` (hỗ trợ `FOR UPDATE`, xử lý unique duplicate), `chargeEnrollment`, `runBillingCycle`, `retryOverdueClasses`, `adjustBalance`.
- Cập nhật toàn bộ các luồng ghi danh (5 vị trí: `lib/enrollment.ts`, `app/api/teacher/classes/[classId]/students/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/api/admin/create-user/route.ts`, và `app/api/auth/register/route.ts`) chuyển sang dùng giao dịch atomic với `chargeEnrollment`, tuân thủ thứ tự kiểm tra BR-S04 (quyền -> dùng thử -> ví -> max_slots) và rollback toàn diện nếu lỗi giữa chừng.
- Cập nhật `getStudentSlotUsage` trong `lib/student-slots.ts` trả về used là tổng sĩ số các lớp và limit là `slot_balance`.
- Cập nhật `approveOrder` trong `lib/slot-orders.ts` cộng số dư ví bằng `applyDelta` (PURCHASE), commit giao dịch, release kết nối rồi mới gọi `retryOverdueClasses` và gửi thông báo.
- Tạo API route `/api/cron/slot-billing` xác thực Bearer token bảo mật với `CRON_SECRET` bằng `crypto.timingSafeEqual`, gọi `runBillingCycle()` trả kết quả JSON.
- Cập nhật `worker/grading-worker.js` gọi cron định kỳ mỗi giờ và 1 lần khi khởi động.
- Cập nhật `POST /api/teacher/classes` khởi tạo `start_date`, `billing_period = 0`, `billing_status = 'ACTIVE'`, `next_charge_at` theo trạng thái GV (TRIAL -> NULL, VERIFIED -> +1 tháng).
- Cập nhật `POST /api/admin/teachers/[id]/verify` bỏ cấp 250 slot, cập nhật các lớp hiện có của GV sang `start_date = todayVN`, `next_charge_at = start_date`.
- Thêm các loại thông báo mới vào `NotificationType` (`SLOT_CHARGED`, `SLOT_GRACE`, `CLASS_LOCKED`, `SLOT_POLICY_CHANGED`) và danh sách gửi kèm email (`SLOT_GRACE`, `CLASS_LOCKED`, `SLOT_POLICY_CHANGED`).
- Đạt toàn bộ 27 test case trong `tests/slot-wallet.test.ts` (TC-W01 -> TC-W07, TC-W09, TC-W11, TC-W12, TC-W14, TC-W15, TC-W17).

## File đã tạo/sửa
- `docs/db-migration-018-slot-wallet.sql`: DDL thêm cột ví slot, chu kỳ lớp và bảng `slot_ledger`.
- `docs/db-migration-018b-slot-wallet-data.sql`: Script chuyển đổi dữ liệu ví slot cũ sang ví mới chạy tay idempotent.
- `lib/db-pg.ts`: Tích hợp DDL 018 vào `ensureSchema`.
- `lib/slot-wallet.ts`: Module lõi quản lý ví slot học sinh-tháng, chu kỳ tính phí, mở lại lớp nợ và điều chỉnh số dư.
- `lib/student-slots.ts`: Cập nhật `getStudentSlotUsage` và `assertStudentSlotAvailable` theo `slot_balance`.
- `lib/slot-orders.ts`: Cập nhật `approveOrder` cộng `slot_balance` qua `applyDelta` và kích hoạt `retryOverdueClasses`.
- `lib/enrollment.ts`: Tích hợp `chargeEnrollment` vào luồng ghi danh bằng mã lớp.
- `lib/notifications.ts`: Bổ sung notification types và danh sách gửi email liên quan ví slot.
- `app/api/cron/slot-billing/route.ts`: Route POST thực thi chu kỳ tính phí định kỳ với `CRON_SECRET`.
- `app/api/teacher/classes/route.ts`: Khởi tạo thông tin chu kỳ tính phí khi tạo lớp mới.
- `app/api/teacher/classes/[classId]/students/route.ts`: Thêm học sinh vào lớp với giao dịch atomic cùng `chargeEnrollment`.
- `app/api/admin/users/[id]/route.ts`: Thêm lớp cho học sinh phía admin với `chargeEnrollment`.
- `app/api/admin/create-user/route.ts`: Tạo tài khoản và ghi danh học sinh với `chargeEnrollment`.
- `app/api/admin/teachers/[id]/verify/route.ts`: Xác minh giáo viên và cập nhật chu kỳ các lớp hiện có.
- `worker/grading-worker.js`: Định kỳ kích hoạt cron slot-billing mỗi giờ và khi khởi động.
- `tests/helpers/pg-fake.ts`: Khai báo bảng `lessons` trong `BASE_SCHEMA` để hỗ trợ môi trường fake test.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-052-slot-wallet-core/verify.sh
 ✓ tests/slot-wallet.test.ts (27 tests) 11650ms
   ✓ lib/slot-wallet.ts — tiện ích thời gian > TC-W06: addMonths xử lý đúng ngày cuối tháng, năm nhuận, qua năm  929ms
   ✓ lib/slot-wallet.ts — tiện ích thời gian > todayVN trả về ngày YYYY-MM-DD theo múi giờ Asia/Ho_Chi_Minh (UTC+7)  431ms
   ✓ lib/slot-wallet.ts — getBalance & applyDelta (BR-W03) > getBalance đọc đúng slot_balance của người dùng  412ms
   ✓ lib/slot-wallet.ts — getBalance & applyDelta (BR-W03) > applyDelta cộng số dư (PURCHASE), ghi đúng balance_after và dòng ledger  412ms
   ✓ lib/slot-wallet.ts — getBalance & applyDelta (BR-W03) > applyDelta trừ số dư thành công và balance_after khớp users.slot_balance  390ms
   ✓ lib/slot-wallet.ts — getBalance & applyDelta (BR-W03) > applyDelta trừ quá số dư -> trả về INSUFFICIENT, không ghi ledger, không âm số dư  387ms
   ✓ lib/slot-wallet.ts — getBalance & applyDelta (BR-W03) > applyDelta bắt lỗi unique constraint (23505) và trả về code DUPLICATE mà không ném  388ms
   ✓ lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10) > TC-W01: Thêm HS khi số dư 1 -> trừ 1, charged=true; số dư 0 -> 409 NO_SLOT, không ghi ledger  380ms
   ✓ lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10) > TC-W02: Rời rồi vào lại cùng lớp trong cùng kỳ -> không trừ lại; kỳ sau vào lại -> trừ  377ms
   ✓ lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10) > TC-W03: HS học 2 lớp của cùng một GV -> tốn 2 slot (mỗi lớp 1 slot)  386ms
   ✓ lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10) > TC-W04: Hai request ghi danh đồng thời khi số dư 1 -> đúng 1 thành công, số dư về 0  385ms
   ✓ lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10) > TC-W17: Lớp có chủ là ADMIN không tính phí ghi danh  388ms
   ✓ lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10) > Lớp của giáo viên TRIAL hoặc REJECTED không tính phí ghi danh  379ms
   ✓ lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10) > Lớp LOCKED trả về 409 CLASS_LOCKED, lớp ENDED trả về 409 CLASS_ENDED  400ms
   ✓ lib/slot-wallet.ts — chargeEnrollment (BR-W01, BR-W02, BR-W06, BR-W08..10) > Ghi danh lỗi giữa chừng (lớp đủ max_slots) -> rollback: số dư không đổi, không có ledger  455ms
   ✓ lib/slot-wallet.ts — runBillingCycle (BR-W04, BR-W05, BR-W12) > TC-W05: Đến kỳ, đủ slot -> 1 dòng CYCLE, billing_period +1, next_charge_at +1 tháng; chạy lại cùng ngày -> không trừ thêm  416ms
   ✓ lib/slot-wallet.ts — runBillingCycle (BR-W04, BR-W05, BR-W12) > Sĩ số 0 khi đến kỳ -> không trừ slot nhưng vẫn sang kỳ mới (billing_period +1, next_charge_at +1 tháng)  399ms
   ✓ lib/slot-wallet.ts — runBillingCycle (BR-W04, BR-W05, BR-W12) > TC-W07: Thiếu slot -> GRACE + 7 ngày + báo SLOT_GRACE; quá hạn ngày 8 -> LOCKED + báo CLASS_LOCKED  419ms
   ✓ lib/slot-wallet.ts — runBillingCycle (BR-W04, BR-W05, BR-W12) > Không trừ trong cron cho lớp TRIAL, lớp ADMIN, hoặc lớp đã ENDED  576ms
   ✓ lib/slot-orders.ts & retryOverdueClasses (TC-W09, BR-W07) > TC-W09: Admin duyệt đơn -> PURCHASE + số dư tăng; lớp LOCKED đủ slot -> ACTIVE ngay; duyệt lần 2 -> 409  458ms
   ✓ lib/slot-orders.ts & retryOverdueClasses (TC-W09, BR-W07) > retryOverdueClasses mở lại theo thứ tự next_charge_at cũ nhất trước khi số dư chỉ đủ 1 lớp  397ms
   ✓ lib/slot-wallet.ts — adjustBalance (TC-W12) > TC-W12: Trừ tay làm số dư âm -> 409; thiếu note -> 400; delta=0 -> 400; cộng thì tăng và gọi retry  409ms
   ✓ app/api/cron/slot-billing/route.ts (TC-W14) > TC-W14: Không có secret hoặc sai secret -> 401; đúng Bearer secret -> 200 JSON  385ms
   ✓ Tạo lớp & Xác minh giáo viên (TC-W11, BR-W09) > Tạo lớp mới: start_date=todayVN, billing_period=0, next_charge_at=addMonths(1); TRIAL -> next_charge_at=NULL  420ms
   ✓ Tạo lớp & Xác minh giáo viên (TC-W11, BR-W09) > TC-W11: Xác minh giáo viên (VERIFIED): không tặng 250 slot; lớp hiện có start_date=today, next_charge_at=start_date (cron trừ kỳ 0)  429ms
   ✓ Migration 018b — docs/db-migration-018b-slot-wallet-data.sql (TC-W15) > TC-W15: Chuyển dữ liệu: slot_balance = tổng đơn APPROVED, bỏ 250; lớp cũ next_charge_at=hôm nay; chạy lại không cộng trùng  419ms
   ✓ lib/student-slots.ts — getStudentSlotUsage > getStudentSlotUsage trả về used là sĩ số hiện tại và limit là slot_balance  421ms

 Test Files  1 passed (1)
      Tests  27 passed (27)
   Start at  14:36:03
   Duration  11.95s (transform 165ms, setup 0ms, collect 84ms, tests 11.65s, environment 0ms, prepare 56ms)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
