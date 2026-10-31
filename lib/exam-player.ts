import { emptyAnswerFor } from "@/lib/lesson-player";

export function emptyExamAnswerFor(q: { category?: string; content?: any; [k: string]: unknown }): unknown {
  if (q?.category?.startsWith("SPEAKING_")) {
    return "";
  }
  return emptyAnswerFor(q as any);
}

const SKILL_ORDER = ["Listening", "Reading", "Writing", "Speaking"];

export function groupQuestionsBySkill(questions: any[]): { skill: string; questions: any[] }[] {
  if (!Array.isArray(questions)) return [];
  const map = new Map<string, any[]>();
  for (const q of questions) {
    const skill = q?.skill || "Khác";
    if (!map.has(skill)) {
      map.set(skill, []);
    }
    map.get(skill)!.push(q);
  }

  const result: { skill: string; questions: any[] }[] = [];
  for (const s of SKILL_ORDER) {
    if (map.has(s)) {
      result.push({ skill: s, questions: map.get(s)! });
      map.delete(s);
    }
  }

  for (const [skill, qs] of map.entries()) {
    result.push({ skill, questions: qs });
  }

  return result;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
