-- Migration 011: Leads (khách hàng tiềm năng từ landing page)
CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  role VARCHAR(20) NOT NULL,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'NEW',
  source VARCHAR(50) DEFAULT 'landing',
  ip VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
