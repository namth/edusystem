-- Migration 018b: Chuyển dữ liệu ví slot học sinh-tháng (FEAT-015, DEC-047)
-- CHẠY TAY MỘT LẦN khi triển khai (sau khi app đã khởi động để ensureSchema tạo cột/bảng 018).
-- Chạy lặp an toàn: mỗi giáo viên chỉ được chuyển đổi một lần (dấu là dòng slot_ledger reason = 'MIGRATION'),
-- số dư được CỘNG THÊM (không ghi đè) nên không xoá giao dịch đã phát sinh sau deploy.

BEGIN;

-- 1. Số dư ví = tổng slot các đơn APPROVED (bỏ 250 slot tặng cũ). Giáo viên không có đơn vẫn có dòng
--    MIGRATION delta 0 để làm dấu đã chuyển đổi.
WITH t AS (
  SELECT u.id,
         COALESCE(SUM(r.requested_slots) FILTER (WHERE r.status = 'APPROVED'), 0)::int AS total
  FROM users u
  LEFT JOIN slot_requests r ON r.teacher_id = u.id
  WHERE u.role = 'TEACHER'
    AND (u.teacher_status = 'VERIFIED' OR u.teacher_status IS NULL)
    AND NOT EXISTS (SELECT 1 FROM slot_ledger l WHERE l.teacher_id = u.id AND l.reason = 'MIGRATION')
  GROUP BY u.id
),
upd AS (
  UPDATE users u
  SET slot_balance = COALESCE(u.slot_balance, 0) + t.total
  FROM t
  WHERE u.id = t.id
  RETURNING u.id, t.total, u.slot_balance
)
INSERT INTO slot_ledger (id, teacher_id, delta, balance_after, reason, note, created_at)
SELECT 'mig_' || upd.id, upd.id, upd.total, upd.slot_balance, 'MIGRATION',
       'Chuyển đổi số dư ví slot từ đơn hàng đã duyệt (bỏ 250 slot tặng cũ)', NOW()
FROM upd
ON CONFLICT (id) DO NOTHING;

-- 2. Lớp hiện có của giáo viên đã xác minh, chưa được khởi tạo tính phí:
--    khai giảng = hôm nay (giờ VN), kỳ 0 sẽ được cron trừ ngay theo sĩ số (thiếu → ân hạn).
UPDATE classes c
SET start_date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
    billing_period = 0,
    next_charge_at = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
FROM users u
WHERE c.teacher_id = u.id
  AND u.role = 'TEACHER'
  AND (u.teacher_status = 'VERIFIED' OR u.teacher_status IS NULL)
  AND c.next_charge_at IS NULL
  AND COALESCE(c.billing_status, 'ACTIVE') <> 'ENDED'
  AND NOT EXISTS (SELECT 1 FROM slot_ledger l WHERE l.class_id = c.id);

-- 3. Lớp của giáo viên TRIAL/REJECTED: không tính phí cho tới khi được xác minh (BR-W09).
UPDATE classes c
SET next_charge_at = NULL
FROM users u
WHERE c.teacher_id = u.id
  AND (u.teacher_status = 'TRIAL' OR u.teacher_status = 'REJECTED')
  AND c.next_charge_at IS NOT NULL;

COMMIT;
