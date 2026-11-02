-- Migration 016: Đơn hàng mua slot & Cấu hình thanh toán VietQR (FEAT-013, DEC-032, DEC-033)

-- Mở rộng bảng slot_requests cho đơn hàng mua slot
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS code VARCHAR(20);
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,0);
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'TEACHER';
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS payment_reported_at TIMESTAMPTZ;
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS decided_by VARCHAR(50);
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(100);

-- Điền mã cho đơn cũ bằng 'KK' || UPPER(SUBSTRING(MD5(id) FROM 1 FOR 8)), đúng 10 ký tự
UPDATE slot_requests SET code = 'KK' || UPPER(SUBSTRING(MD5(id) FROM 1 FOR 8)) WHERE code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_requests_code ON slot_requests (code);

-- Cấu hình hệ thống (system_settings)
INSERT INTO system_settings (key, value, description) VALUES
  ('payment_account', '{"bank_bin":"","bank_name":"","account_no":"","account_name":""}', 'Tài khoản nhận tiền VietQR'),
  ('slot_pricing', '{"unit_price_vnd":0}', 'Đơn giá 1 slot học sinh (VND)')
ON CONFLICT (key) DO NOTHING;
