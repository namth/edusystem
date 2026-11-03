import { queryPg } from "@/lib/db-pg";
import { getAiPricing } from "@/lib/ai-usage";
import { findModelPrice, usdToVnd } from "@/lib/ai-pricing";

export interface DashboardTotals {
  teachers_verified: number;
  teachers_trial: number;
  students: number;
  lessons: number;
  exams: number;
}

export interface DashboardMonthly {
  submissions: number;
  ai_graded: number;
  ai_tokens: number;
  ai_cost_vnd: number;
  revenue_vnd: number;
  unpriced_calls: number;
}

export interface DashboardDaily {
  date: string;
  submissions: number;
  ai_cost_vnd: number;
}

export interface DashboardTopTeacher {
  teacher_id: string;
  name: string;
  ai_graded: number;
  tokens: number;
  cost_vnd: number;
}

export interface AdminDashboardResult {
  success: true;
  month: string;
  totals: DashboardTotals;
  pending_orders: number;
  monthly: DashboardMonthly;
  daily: DashboardDaily[];
  top_teachers: DashboardTopTeacher[];
}

export async function getAdminDashboardData(
  monthInput?: string | null
): Promise<AdminDashboardResult> {
  const month =
    monthInput && monthInput.trim() !== ""
      ? monthInput.trim()
      : new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);

  const startIso = `${yearStr}-${monthStr}-01T00:00:00+07:00`;
  const nextYear = m === 12 ? year + 1 : year;
  const nextM = m === 12 ? 1 : m + 1;
  const nextMonthStr = String(nextM).padStart(2, "0");
  const endIso = `${nextYear}-${nextMonthStr}-01T00:00:00+07:00`;

  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const pricing = await getAiPricing();

  // 1. Totals (toàn thời gian)
  const totalsRes = await queryPg(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'TEACHER' AND (teacher_status = 'VERIFIED' OR teacher_status IS NULL)) AS teachers_verified,
      (SELECT COUNT(*) FROM users WHERE role = 'TEACHER' AND teacher_status = 'TRIAL') AS teachers_trial,
      (SELECT COUNT(*) FROM users WHERE role = 'STUDENT') AS students,
      (SELECT COUNT(*) FROM lessons) AS lessons,
      (SELECT COUNT(*) FROM exams) AS exams
  `);
  const totalsRow = totalsRes.rows[0] || {};
  const totals: DashboardTotals = {
    teachers_verified: Number(totalsRow.teachers_verified) || 0,
    teachers_trial: Number(totalsRow.teachers_trial) || 0,
    students: Number(totalsRow.students) || 0,
    lessons: Number(totalsRow.lessons) || 0,
    exams: Number(totalsRow.exams) || 0,
  };

  // 2. Pending orders
  const pendingOrdersRes = await queryPg(
    `SELECT COUNT(*) AS count FROM slot_requests WHERE status = 'PENDING'`
  );
  const pending_orders = Number(pendingOrdersRes.rows[0]?.count) || 0;

  // 3. Monthly submissions (submissions + lesson_attempts trong kỳ)
  const subsCountRes = await queryPg(
    `SELECT
      (SELECT COUNT(*) FROM submissions WHERE submitted_at >= $1::timestamptz AND submitted_at < $2::timestamptz) AS subs,
      (SELECT COUNT(*) FROM lesson_attempts WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz) AS atts`,
    [startIso, endIso]
  );
  const monthlySubmissions =
    (Number(subsCountRes.rows[0]?.subs) || 0) +
    (Number(subsCountRes.rows[0]?.atts) || 0);

  // 4. Monthly AI stats (ai_usage_logs trong kỳ)
  const aiStatsRes = await queryPg(
    `SELECT
      COUNT(DISTINCT submission_id) FILTER (WHERE submission_id IS NOT NULL AND purpose IN ('EXAM_GRADING', 'LESSON_GRADING')) AS distinct_subs,
      COUNT(DISTINCT lesson_attempt_id) FILTER (WHERE lesson_attempt_id IS NOT NULL AND purpose IN ('EXAM_GRADING', 'LESSON_GRADING')) AS distinct_atts,
      COALESCE(SUM(total_tokens), 0) AS ai_tokens,
      COALESCE(SUM(cost_usd), 0) AS ai_cost_usd
    FROM ai_usage_logs
    WHERE (created_at AT TIME ZONE 'UTC') >= $1::timestamptz AND (created_at AT TIME ZONE 'UTC') < $2::timestamptz`,
    [startIso, endIso]
  );
  const aiStatsRow = aiStatsRes.rows[0] || {};
  const ai_graded =
    (Number(aiStatsRow.distinct_subs) || 0) +
    (Number(aiStatsRow.distinct_atts) || 0);
  const ai_tokens = Number(aiStatsRow.ai_tokens) || 0;
  const ai_cost_vnd = usdToVnd(
    Number(aiStatsRow.ai_cost_usd),
    pricing.usd_vnd_rate
  );

  // 5. Revenue VND (slot_requests APPROVED trong kỳ)
  const revenueRes = await queryPg(
    `SELECT COALESCE(SUM(total_cost), 0) AS revenue
     FROM slot_requests
     WHERE status = 'APPROVED'
       AND decided_at >= $1::timestamptz AND decided_at < $2::timestamptz`,
    [startIso, endIso]
  );
  const revenue_vnd = Math.round(Number(revenueRes.rows[0]?.revenue)) || 0;

  // 6. Unpriced AI calls trong kỳ
  const modelsRes = await queryPg(
    `SELECT model, COUNT(*) AS count
     FROM ai_usage_logs
     WHERE (created_at AT TIME ZONE 'UTC') >= $1::timestamptz AND (created_at AT TIME ZONE 'UTC') < $2::timestamptz
     GROUP BY model`,
    [startIso, endIso]
  );
  let unpriced_calls = 0;
  for (const row of modelsRes.rows) {
    if (findModelPrice(row.model, pricing) === null) {
      unpriced_calls += Number(row.count) || 0;
    }
  }

  const monthly: DashboardMonthly = {
    submissions: monthlySubmissions,
    ai_graded,
    ai_tokens,
    ai_cost_vnd,
    revenue_vnd,
    unpriced_calls,
  };

  // 7. Daily breakdown
  const dailyMap = new Map<string, { submissions: number; cost_usd: number }>();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, "0")}`;
    dailyMap.set(dateStr, { submissions: 0, cost_usd: 0 });
  }

  const dailySubsRes = await queryPg(
    `SELECT
       to_char(submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day,
       COUNT(*) AS count
     FROM submissions
     WHERE submitted_at >= $1::timestamptz AND submitted_at < $2::timestamptz
     GROUP BY day`,
    [startIso, endIso]
  );
  for (const r of dailySubsRes.rows) {
    if (r.day) {
      const item = dailyMap.get(r.day);
      if (item) item.submissions += Number(r.count) || 0;
    }
  }

  const dailyAttsRes = await queryPg(
    `SELECT
       to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day,
       COUNT(*) AS count
     FROM lesson_attempts
     WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
     GROUP BY day`,
    [startIso, endIso]
  );
  for (const r of dailyAttsRes.rows) {
    if (r.day) {
      const item = dailyMap.get(r.day);
      if (item) item.submissions += Number(r.count) || 0;
    }
  }

  const dailyLogsRes = await queryPg(
    `SELECT
       to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day,
       COALESCE(SUM(cost_usd), 0) AS cost_usd
     FROM ai_usage_logs
     WHERE (created_at AT TIME ZONE 'UTC') >= $1::timestamptz AND (created_at AT TIME ZONE 'UTC') < $2::timestamptz
     GROUP BY day`,
    [startIso, endIso]
  );
  for (const r of dailyLogsRes.rows) {
    if (r.day) {
      const item = dailyMap.get(r.day);
      if (item) item.cost_usd += Number(r.cost_usd) || 0;
    }
  }

  const daily: DashboardDaily[] = Array.from(dailyMap.entries()).map(
    ([date, data]) => ({
      date,
      submissions: data.submissions,
      ai_cost_vnd: usdToVnd(data.cost_usd, pricing.usd_vnd_rate),
    })
  );

  // 8. Top teachers
  const topTeachersRes = await queryPg(
    `SELECT
      l.teacher_id,
      COALESCE(u.name, 'Giáo viên') AS name,
      COUNT(DISTINCT l.submission_id) FILTER (WHERE l.submission_id IS NOT NULL AND l.purpose IN ('EXAM_GRADING', 'LESSON_GRADING')) AS distinct_subs,
      COUNT(DISTINCT l.lesson_attempt_id) FILTER (WHERE l.lesson_attempt_id IS NOT NULL AND l.purpose IN ('EXAM_GRADING', 'LESSON_GRADING')) AS distinct_atts,
      COALESCE(SUM(l.total_tokens), 0) AS tokens,
      COALESCE(SUM(l.cost_usd), 0) AS total_cost_usd
    FROM ai_usage_logs l
    LEFT JOIN users u ON u.id = l.teacher_id
    WHERE l.teacher_id IS NOT NULL
      AND (l.created_at AT TIME ZONE 'UTC') >= $1::timestamptz AND (l.created_at AT TIME ZONE 'UTC') < $2::timestamptz
    GROUP BY l.teacher_id, u.name`,
    [startIso, endIso]
  );

  const top_teachers: DashboardTopTeacher[] = topTeachersRes.rows
    .map((row) => ({
      teacher_id: row.teacher_id,
      name: row.name,
      ai_graded:
        (Number(row.distinct_subs) || 0) + (Number(row.distinct_atts) || 0),
      tokens: Number(row.tokens) || 0,
      cost_vnd: usdToVnd(Number(row.total_cost_usd), pricing.usd_vnd_rate),
    }))
    .sort((a, b) => b.cost_vnd - a.cost_vnd)
    .slice(0, 10);

  return {
    success: true,
    month,
    totals,
    pending_orders,
    monthly,
    daily,
    top_teachers,
  };
}
