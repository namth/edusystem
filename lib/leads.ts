import { queryPg } from "@/lib/db-pg";

export type LeadRole = "PARENT" | "STUDENT" | "TEACHER" | "CENTER";
export type LeadStatus = "NEW" | "CONTACTED" | "DONE";

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: LeadRole;
  message: string | null;
  status: LeadStatus;
  source: string;
  ip: string | null;
  created_at: string;
}

let tableInitialized = false;

export async function ensureLeadsTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await queryPg(`
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
    `);
    tableInitialized = true;
  } catch (err) {
    console.warn("Failed to ensure leads table:", err);
  }
}
