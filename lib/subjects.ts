import { queryPg } from "@/lib/db-pg";

export function slugifySubjectCode(name: string): string {
  if (typeof name !== "string") return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export async function canUseSubject(
  user: { userId: string; role: string },
  subjectId: string
): Promise<boolean> {
  if (!subjectId || typeof subjectId !== "string" || !subjectId.trim()) {
    return false;
  }
  const cleanId = subjectId.trim();
  const res = await queryPg(
    "SELECT id, owner_id FROM subjects WHERE id = $1 LIMIT 1",
    [cleanId]
  );
  if (res.rows.length === 0) {
    return false;
  }
  const row = res.rows[0];
  if (user.role === "ADMIN") {
    return true;
  }
  if (user.role === "TEACHER") {
    return row.owner_id === null || row.owner_id === undefined || row.owner_id === user.userId;
  }
  return row.owner_id === null || row.owner_id === undefined;
}
