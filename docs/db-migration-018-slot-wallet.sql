-- Migration 018: Ví slot học sinh-tháng (FEAT-015, DEC-042 -> DEC-047)

ALTER TABLE users   ADD COLUMN IF NOT EXISTS slot_balance INT NOT NULL DEFAULT 0;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS billing_status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS next_charge_at DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS billing_period INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS slot_ledger (
  id VARCHAR(50) PRIMARY KEY,
  teacher_id VARCHAR(50) NOT NULL,
  delta INT NOT NULL,
  balance_after INT NOT NULL,
  reason VARCHAR(20) NOT NULL,
  class_id VARCHAR(50),
  student_id VARCHAR(50),
  order_id VARCHAR(50),
  period INT,
  student_count INT,
  student_ids TEXT[],
  note TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slot_ledger_teacher ON slot_ledger (teacher_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_ledger_cycle  ON slot_ledger (class_id, period) WHERE reason = 'CYCLE';
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_ledger_enroll ON slot_ledger (class_id, student_id, period) WHERE reason = 'ENROLL';
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_ledger_order  ON slot_ledger (order_id) WHERE reason = 'PURCHASE';

UPDATE classes SET start_date = created_at::date WHERE start_date IS NULL;
