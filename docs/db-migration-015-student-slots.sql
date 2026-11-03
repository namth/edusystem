-- Migration 015: 1 slot = 1 học sinh (FEAT-013, DEC-031)
-- CHẠY TAY MỘT LẦN khi deploy bản có TASK-039. KHÔNG đưa vào lib/db-pg.ts ensureSchema():
-- chạy lại mỗi lần khởi động sẽ ghi đè việc admin chủ động hạ slot_limit.
-- Trước đây mỗi lần AI chấm bài trừ 1 slot → trả lại: slot_limit ≥ 250 (mức khi xác minh) + tổng slot đã mua được duyệt.

UPDATE users u
SET slot_limit = GREATEST(
  COALESCE(u.slot_limit, 0),
  250 + COALESCE((SELECT SUM(r.requested_slots) FROM slot_requests r WHERE r.teacher_id = u.id AND r.status = 'APPROVED'), 0)
)
WHERE u.role = 'TEACHER' AND u.teacher_status = 'VERIFIED';
