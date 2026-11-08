import { queryPg } from "@/lib/db-pg";
import { getAiPricing } from "@/lib/ai-usage";
import { usdToVnd } from "@/lib/ai-pricing";

export type AiPurposeKey = "EXAM_GRADING" | "LESSON_GRADING" | "EXAM_IMPORT" | "OTHER";

export interface AiPurposeStat {
  tokens: number;
  cost_vnd: number;
}

export interface AiUsageTeacherRow {
  teacher_id: string;
  name: string;
  email: string;
  teacher_status: string | null;
  students_used: number;
  slot_limit: number;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_vnd: number;
  by_purpose: Record<AiPurposeKey, AiPurposeStat>;
  revenue_vnd: number;
  margin_vnd: number;
}

export interface AiUsageUnattributed {
  requests: number;
  tokens: number;
  total_tokens?: number;
  cost_vnd: number;
}

export interface AiUsageTeacherList extends Array<AiUsageTeacherRow> {
  find(
    predicate: (value: any, index: number, obj: any[]) => unknown,
    thisArg?: any
  ): AiUsageTeacherRow;
}

export interface AiUsageReport {
  month: string;
  usd_vnd_rate: number;
  teachers: AiUsageTeacherList;
  unattributed: AiUsageUnattributed;
}

const PURPOSES: AiPurposeKey[] = ["EXAM_GRADING", "LESSON_GRADING", "EXAM_IMPORT", "OTHER"];

function currentMonth(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);
}

export async function getAiUsageReport(
  opts?: { month?: string | null }
): Promise<AiUsageReport> {
  const raw = opts?.month?.trim();
  const month = raw ? raw : currentMonth();

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const startIso = `${yearStr}-${monthStr}-01T00:00:00+07:00`;
  const nextYear = m === 12 ? year + 1 : year;
  const nextM = m === 12 ? 1 : m + 1;
  const endIso = `${nextYear}-${String(nextM).padStart(2, "0")}-01T00:00:00+07:00`;

  const pricing = await getAiPricing();
  const rate = pricing.usd_vnd_rate;

  // 1. Danh sách giáo viên + số học sinh đã dùng (BR-S01: DISTINCT học sinh)
  const teacherRes = await queryPg(
    `SELECT u.id, u.name, u.email, u.teacher_status,
            COALESCE(u.slot_limit, 0) AS slot_limit,
            COALESCE(su.used, 0) AS students_used
     FROM users u
     LEFT JOIN (
       SELECT c.teacher_id, COUNT(DISTINCT e.student_id)::int AS used
       FROM enrollments e
       JOIN classes c ON e.class_id = c.id
       GROUP BY c.teacher_id
     ) su ON su.teacher_id = u.id
     WHERE u.role = 'TEACHER'`
  );

  // 2. Log AI trong kỳ, gom theo giáo viên + mục đích
  const usageRes = await queryPg(
    `SELECT teacher_id,
            CASE WHEN purpose IN ('EXAM_GRADING','LESSON_GRADING','EXAM_IMPORT') THEN purpose ELSE 'OTHER' END AS purpose_key,
            COUNT(*)::int AS requests,
            COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
            COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(cost_usd), 0) AS cost_usd
     FROM ai_usage_logs
     WHERE (created_at AT TIME ZONE 'UTC') >= $1::timestamptz
       AND (created_at AT TIME ZONE 'UTC') < $2::timestamptz
     GROUP BY teacher_id, purpose_key`,
    [startIso, endIso]
  );

  // 3. Doanh thu: đơn APPROVED có decided_at trong kỳ
  const revRes = await queryPg(
    `SELECT teacher_id, COALESCE(SUM(total_cost), 0) AS revenue
     FROM slot_requests
     WHERE status = 'APPROVED'
       AND decided_at >= $1::timestamptz AND decided_at < $2::timestamptz
     GROUP BY teacher_id`,
    [startIso, endIso]
  );

  interface Acc {
    requests: number;
    prompt: number;
    completion: number;
    total: number;
    usd: number;
    purposes: Record<AiPurposeKey, { tokens: number; usd: number }>;
  }
  const newAcc = (): Acc => ({
    requests: 0,
    prompt: 0,
    completion: 0,
    total: 0,
    usd: 0,
    purposes: {
      EXAM_GRADING: { tokens: 0, usd: 0 },
      LESSON_GRADING: { tokens: 0, usd: 0 },
      EXAM_IMPORT: { tokens: 0, usd: 0 },
      OTHER: { tokens: 0, usd: 0 },
    },
  });

  const accByTeacher = new Map<string, Acc>();
  const unattributedAcc = newAcc();

  for (const r of usageRes.rows) {
    const acc = r.teacher_id == null ? unattributedAcc : accByTeacher.get(r.teacher_id) ?? newAcc();
    if (r.teacher_id != null) accByTeacher.set(r.teacher_id, acc);
    const key = (PURPOSES as string[]).includes(r.purpose_key) ? (r.purpose_key as AiPurposeKey) : "OTHER";
    const tokens = Number(r.total_tokens) || 0;
    const usd = Number(r.cost_usd) || 0;
    acc.requests += Number(r.requests) || 0;
    acc.prompt += Number(r.prompt_tokens) || 0;
    acc.completion += Number(r.completion_tokens) || 0;
    acc.total += tokens;
    acc.usd += usd;
    acc.purposes[key].tokens += tokens;
    acc.purposes[key].usd += usd;
  }

  const revenueByTeacher = new Map<string, number>();
  for (const r of revRes.rows) {
    revenueByTeacher.set(r.teacher_id, Math.round(Number(r.revenue) || 0));
  }

  const teachers: AiUsageTeacherRow[] = teacherRes.rows.map((t: any) => {
    const acc = accByTeacher.get(t.id) ?? newAcc();
    const cost_vnd = usdToVnd(acc.usd, rate);
    const revenue_vnd = revenueByTeacher.get(t.id) ?? 0;
    const by_purpose = {} as Record<AiPurposeKey, AiPurposeStat>;
    for (const p of PURPOSES) {
      by_purpose[p] = {
        tokens: acc.purposes[p].tokens,
        cost_vnd: usdToVnd(acc.purposes[p].usd, rate),
      };
    }
    return {
      teacher_id: t.id,
      name: t.name,
      email: t.email,
      teacher_status: t.teacher_status ?? null,
      students_used: Number(t.students_used) || 0,
      slot_limit: Number(t.slot_limit) || 0,
      requests: acc.requests,
      prompt_tokens: acc.prompt,
      completion_tokens: acc.completion,
      total_tokens: acc.total,
      cost_vnd,
      by_purpose,
      revenue_vnd,
      margin_vnd: revenue_vnd - cost_vnd,
    };
  });

  teachers.sort((a, b) => b.cost_vnd - a.cost_vnd || a.name.localeCompare(b.name, "vi"));

  return {
    month,
    usd_vnd_rate: rate,
    teachers: teachers as unknown as AiUsageTeacherList,
    unattributed: {
      requests: unattributedAcc.requests,
      tokens: unattributedAcc.total,
      total_tokens: unattributedAcc.total,
      cost_vnd: usdToVnd(unattributedAcc.usd, rate),
    },
  };
}
