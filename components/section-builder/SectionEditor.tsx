"use client";
// FEAT-017 TASK-058 — trình soạn đề / bài học theo Phần (SCR-23, SCR-25). DEC-054, prototype đã duyệt 24/11.
// Cột phải: Cấu trúc bài (kéo thả phần). Vùng trái: soạn phần đang chọn; mỗi câu là một thẻ sửa tại chỗ.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, BookOpen, Check, Copy, GripVertical, Loader2, Music, Pencil, Plus, Sparkles, Trash2,
} from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import AiExamIngestionStudio from "@/components/teacher/AiExamIngestionStudio";
import QuestionForm, { type FlashcardInfo } from "./QuestionForm";
import {
  ADD_TYPES, canHost, categoryLabel, changeSkill, fromTree, moveItem, moveQuestionTo, newQuestion, newSection, numbering,
  questionProblem, questionSummary, rangeLabel, sectionSummary, toPayload, type EdQuestion, type EdSection,
} from "@/lib/section-editor";
import { validateTree, type Skill, type TreeIssue, type TreeSection } from "@/lib/exam-structure";

export interface SectionEditorMeta {
  title: string;
  description: string;
  duration_minutes: number;
  course_id: string | null;
  scoring_standard_id: string | null;
}
export interface SectionEditorSavePayload {
  meta: SectionEditorMeta & { updated_at: string | null };
  sections: TreeSection[];
}
export type SaveResult =
  | { ok: true; sections?: TreeSection[]; version?: string | null }
  | { ok: false; error: string; status?: number; errors?: TreeIssue[] };

export interface SectionEditorProps {
  mode: "EXAM" | "LESSON";
  initialMeta?: Partial<SectionEditorMeta>;
  initialSections?: TreeSection[];
  initialFlashcards?: FlashcardInfo[];
  version?: string | null;
  attemptCount?: number;
  isLoading?: boolean;
  onSave: (payload: SectionEditorSavePayload) => Promise<SaveResult>;
  onReload?: () => void;
  previewSlot?: React.ReactNode;
  initialCreationMode?: "manual" | "ai-ingest";
  aiIngestProps?: { initialDestinationType?: "standalone" | "curriculum"; initialCourseId?: string; initialUnitId?: string };
}

const SKILLS: Skill[] = ["Reading", "Listening", "Writing", "Speaking"];
const SKILL_VI: Record<Skill, string> = { Reading: "Reading", Listening: "Listening", Writing: "Writing", Speaking: "Speaking" };
const lbl = "text-xs font-semibold uppercase tracking-wide text-ink-muted";
const fld = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const btn = "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-medium text-ink hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60";
const btnPri = "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60";

function Seg<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: [T, string][]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-xl bg-line-soft p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={`cursor-pointer rounded-lg px-3.5 py-2 text-sm ${value === v ? "bg-white font-semibold text-brand-700 shadow-xs" : "font-medium text-ink-muted hover:text-ink"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

export default function SectionEditor(props: SectionEditorProps) {
  const { mode, isLoading = false, onSave } = props;
  const isExam = mode === "EXAM";
  const [creationMode, setCreationMode] = useState<"manual" | "ai-ingest">(props.initialCreationMode || "manual");
  const [meta, setMeta] = useState<SectionEditorMeta>({
    title: "", description: "", duration_minutes: 60, course_id: null, scoring_standard_id: null, ...props.initialMeta,
  });
  const [sections, setSections] = useState<EdSection[]>(() => (props.initialSections?.length ? fromTree(props.initialSections) : [newSection()]));
  const [version, setVersion] = useState<string | null>(props.version ?? null);
  const [selected, setSelected] = useState<string>(() => "");
  const [openQ, setOpenQ] = useState<string>("");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [issues, setIssues] = useState<TreeIssue[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flashcards, setFlashcards] = useState<Record<string, FlashcardInfo>>(() =>
    Object.fromEntries((props.initialFlashcards || []).map((f) => [f.id, f]))
  );
  const [courses, setCourses] = useState<{ id: string; title: string; default_scoring_standard_id?: string | null }[]>([]);
  const [standards, setStandards] = useState<{ id: string; name: string }[]>([]);
  const dragRef = useRef<{ kind: "section" | "question"; key: string } | null>(null);
  const [dropKey, setDropKey] = useState<string>("");

  // Dữ liệu ban đầu chỉ đọc khi mount: trang cha render trình soạn sau khi tải xong, đổi `key` để nạp lại.
  useEffect(() => {
    if (!isExam) return;
    fetch("/api/teacher/courses").then((r) => r.json()).then((j) => j?.success && Array.isArray(j.courses) && setCourses(j.courses)).catch(() => undefined);
    fetch("/api/scoring-standards").then((r) => r.json()).then((j) => Array.isArray(j?.standards) && setStandards(j.standards)).catch(() => undefined);
  }, [isExam]);

  const nb = useMemo(() => numbering(sections), [sections]);
  const total = nb.reduce((a, s) => a + s.questions.reduce((b, q) => b + q.count, 0), 0);
  const idx = Math.max(0, sections.findIndex((s) => s.key === selected));
  const cur = sections[idx];
  const curNb = nb[idx];
  const totalLabel = `Tổng: ${total} câu · ${sections.length} phần`;
  const issueOf = (si: number) => issues.find((i) => i.section_index === si);

  const updSection = (key: string, patch: Partial<EdSection>) => {
    setSavedAt(null);
    setSections((arr) => arr.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };
  const updQuestion = (sKey: string, q: EdQuestion) => {
    setSavedAt(null);
    setSections((arr) => arr.map((s) => (s.key === sKey ? { ...s, questions: s.questions.map((x) => (x.key === q.key ? q : x)) } : s)));
  };

  const uploadAudio = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("kind", "audio");
    fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) {
      alert("Lỗi tải audio: " + (data?.error || res.statusText));
      return null;
    }
    return data.url as string;
  };

  const doSave = async () => {
    setSaveError(null);
    const payload = toPayload(sections);
    const local = validateTree(isExam ? "exam" : "lesson", payload);
    sections.forEach((s, si) => s.questions.forEach((q, qi) => {
      const p = questionProblem(q);
      if (p) local.push({ section_index: si, question_index: qi, message: `Phần ${si + 1}, ${rangeLabel(nb[si].questions[qi].start, nb[si].questions[qi].start + nb[si].questions[qi].count - 1).toLowerCase()}: ${p}` });
    }));
    if (!meta.title.trim()) local.unshift({ section_index: -1, message: isExam ? "Nhập tên đề thi." : "Nhập tên bài học." });
    setIssues(local);
    if (local.length) return;
    setSaving(true);
    try {
      const r = await onSave({ meta: { ...meta, updated_at: version }, sections: payload });
      if (r.ok) {
        if (r.sections) setSections(fromTree(r.sections).length ? fromTree(r.sections) : [newSection()]);
        if (r.version !== undefined) setVersion(r.version ?? null);
        setOpenQ("");
        setSavedAt(new Date().toLocaleTimeString("vi-VN"));
      } else if (r.status === 409) {
        setConflict(true);
      } else {
        setSaveError(r.error);
        if (r.errors?.length) setIssues(r.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  // ───── kéo thả ─────
  const onDragStart = (kind: "section" | "question", key: string) => (e: React.DragEvent) => {
    dragRef.current = { kind, key };
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", key); } catch { /* bỏ qua */ }
  };
  const onDragEnd = () => { dragRef.current = null; setDropKey(""); };
  const dropOnSection = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const d = dragRef.current;
    setDropKey("");
    if (!d) return;
    if (d.kind === "section") {
      const from = sections.findIndex((s) => s.key === d.key);
      const to = sections.findIndex((s) => s.key === targetKey);
      setSections(moveItem(sections, from, to));
    } else {
      const next = moveQuestionTo(sections, d.key, targetKey);
      if (next) { setSections(next); setSelected(targetKey); }
    }
    dragRef.current = null;
  };
  const overSection = (targetKey: string) => (e: React.DragEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === "question") {
      const q = sections.flatMap((s) => s.questions).find((x) => x.key === d.key);
      const target = sections.find((s) => s.key === targetKey);
      if (!q || !target || !canHost(target, q.category)) return; // BR-P04: không nhận câu khác kỹ năng
    }
    e.preventDefault();
    if (dropKey !== targetKey) setDropKey(targetKey);
  };
  const dropOnQuestion = (sKey: string, toIndex: number) => (e: React.DragEvent) => {
    const d = dragRef.current;
    if (!d || d.kind !== "question") return;
    const sec = sections.find((s) => s.key === sKey)!;
    const from = sec.questions.findIndex((q) => q.key === d.key);
    if (from < 0) return;
    e.preventDefault();
    e.stopPropagation();
    updSection(sKey, { questions: moveItem(sec.questions, from, toIndex) });
    onDragEnd();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-16 animate-pulse rounded-2xl bg-line-soft" />
        <div className="flex flex-wrap gap-5">
          <div className="h-96 min-w-0 flex-[999_1_560px] animate-pulse rounded-3xl bg-line-soft" />
          <div className="h-96 flex-[1_1_300px] animate-pulse rounded-3xl bg-line-soft" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {isExam && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
          <button type="button" onClick={() => setCreationMode("manual")} className={creationMode === "manual" ? btnPri : btn}>
            <BookOpen className={`h-4 w-4 ${creationMode === "manual" ? "text-white" : ""}`} /> Soạn đề thủ công
          </button>
          <button type="button" onClick={() => setCreationMode("ai-ingest")} className={creationMode === "ai-ingest" ? btnPri : btn}>
            <Sparkles className={`h-4 w-4 ${creationMode === "ai-ingest" ? "text-white" : "text-accent-400"}`} /> Upload đề thi / bài tập
          </button>
        </div>
      )}

      {isExam && creationMode === "ai-ingest" ? (
        <AiExamIngestionStudio
          initialDestinationType={props.aiIngestProps?.initialDestinationType || "standalone"}
          initialCourseId={props.aiIngestProps?.initialCourseId}
          initialUnitId={props.aiIngestProps?.initialUnitId}
        />
      ) : (
        <>
          {/* Thanh trên: thông tin đề / bài học */}
          <div className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-64 flex-[3_1_320px] flex-col gap-1.5">
                <span className={lbl}>{isExam ? "Tên đề thi" : "Tên bài học"}</span>
                <input aria-label={isExam ? "Tên đề thi" : "Tên bài học"} className={`${fld} font-display text-lg font-bold`} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
              </label>
              {isExam && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className={lbl}>Thời gian (phút)</span>
                    <input type="number" min={1} className={`${fld} w-28`} value={meta.duration_minutes} onChange={(e) => setMeta({ ...meta, duration_minutes: Math.max(1, Number(e.target.value) || 1) })} />
                  </label>
                  <label className="flex min-w-52 flex-[1_1_220px] flex-col gap-1.5">
                    <span className={lbl}>Khóa học</span>
                    <select className={fld} value={meta.course_id || ""} onChange={(e) => setMeta({ ...meta, course_id: e.target.value || null })}>
                      <option value="">— Đề độc lập (không thuộc khóa học) —</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </label>
                  <label className="flex min-w-52 flex-[1_1_220px] flex-col gap-1.5">
                    <span className={lbl}>Chuẩn chấm điểm</span>
                    <select className={fld} value={meta.scoring_standard_id || ""} onChange={(e) => setMeta({ ...meta, scoring_standard_id: e.target.value || null })}>
                      <option value="">Theo khóa học / mặc định</option>
                      {standards.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </label>
                </>
              )}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={lbl}>Mô tả (tuỳ chọn)</span>
              <input className={fld} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[13px] text-ink-muted">{totalLabel}</span>
              <div className="flex-1" />
              {props.previewSlot}
              <button type="button" onClick={doSave} disabled={saving} className={btnPri}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Check className="h-4 w-4 text-white" />}
                {isExam ? "Lưu đề" : "Lưu bài học"}
              </button>
            </div>
          </div>

          {(props.attemptCount || 0) > 0 && (
            <div role="status" className="flex items-center gap-2 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-sm text-accent-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{isExam ? "Đề" : "Bài học"} đã có <b>{props.attemptCount} lượt làm</b>. Câu / phần bị xoá vẫn hiện trong bài cũ; sửa đáp án không chấm lại bài cũ.</span>
            </div>
          )}
          {(issues.length > 0 || saveError) && (
            <div role="alert" className="flex flex-col gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <b>Chưa lưu được — sửa các chỗ sau:</b>
              {saveError && !issues.length && <span>• {saveError}</span>}
              {issues.map((i, k) => <span key={k}>• {i.message}</span>)}
            </div>
          )}
          {savedAt && !issues.length && (
            <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">Đã lưu lúc {savedAt} · {totalLabel}</div>
          )}

          <div className="flex flex-wrap items-start gap-5">
            {/* ───── Vùng soạn phần đang chọn ───── */}
            <section aria-label="Soạn phần đang chọn" className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 rounded-3xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-2xl font-bold leading-tight">Phần {idx + 1}</h2>
                <span className="rounded-full bg-line-soft px-3 py-1 text-sm text-ink-muted">
                  {cur.questions.length === 0 ? "Chỉ đọc · không có câu" : rangeLabel(curNb.start, curNb.end)}
                </span>
                <div className="flex-1" />
                <button type="button" className={btn} onClick={() => {
                  const copy: EdSection = { ...cur, key: `${cur.key}_c${Date.now()}`, id: undefined, questions: cur.questions.map((q) => ({ ...q, key: `${q.key}_c${Date.now()}`, id: undefined, content: { ...q.content } })) };
                  const arr = sections.slice(); arr.splice(idx + 1, 0, copy); setSections(arr); setSelected(copy.key);
                }}>
                  <Copy className="h-4 w-4" /> Nhân bản phần
                </button>
                <button type="button" className={`${btn} text-rose-700`} onClick={() => setConfirmDelete(true)} disabled={sections.length <= 1}>
                  <Trash2 className="h-4 w-4" /> Xoá phần
                </button>
              </div>

              {issueOf(idx) && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">{issueOf(idx)!.message}</div>}

              <div className="flex flex-col gap-2">
                <span className={lbl}>Kỹ năng của phần</span>
                <Seg ariaLabel="Kỹ năng" value={cur.skill} options={SKILLS.map((s) => [s, SKILL_VI[s]])} onChange={(v) => {
                  const r = changeSkill(cur, v);
                  if (!r.ok) return setSkillError(r.error);
                  setSkillError(null);
                  updSection(cur.key, { skill: v, ...(v === "Listening" && cur.stimulus_type === "NONE" ? { stimulus_type: "AUDIO_ONLY" as const } : {}) });
                }} />
                {skillError && <span className="text-[13px] text-rose-700">{skillError}</span>}
              </div>

              <label className="flex flex-col gap-2">
                <span className={lbl}>Lời dẫn</span>
                <textarea rows={2} className={fld} value={cur.instruction} onChange={(e) => updSection(cur.key, { instruction: e.target.value })} placeholder="Ví dụ: Read the passage and answer the questions." />
              </label>

              <div className="flex flex-col gap-2.5">
                <span className={lbl}>Ngữ cảnh (tuỳ chọn)</span>
                <Seg ariaLabel="Loại ngữ cảnh" value={cur.stimulus_type}
                  options={[["NONE", "Không có"], ["TEXT_ONLY", "Chữ / ảnh"], ["AUDIO_ONLY", "Audio"], ["COMBINED", "Cả hai"]]}
                  onChange={(v) => updSection(cur.key, { stimulus_type: v })} />
                {(cur.stimulus_type === "TEXT_ONLY" || cur.stimulus_type === "COMBINED") && (
                  <RichTextEditor value={cur.stimulus_text} onChange={(v) => updSection(cur.key, { stimulus_text: v })} placeholder="Dán bài đọc, bảng hoặc hình ảnh…" />
                )}
                {(cur.stimulus_type === "AUDIO_ONLY" || cur.stimulus_type === "COMBINED") && (
                  <AudioBox section={cur} onChange={(p) => updSection(cur.key, p)} onUpload={uploadAudio} />
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline gap-2.5">
                  <span className={lbl}>Câu hỏi trong phần</span>
                  <span className="text-[13px] text-ink-muted">{cur.questions.length} câu · chiếm {curNb.questions.reduce((a, q) => a + q.count, 0)} số</span>
                </div>
                {cur.questions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-line bg-surface-alt p-4 text-sm leading-relaxed text-ink-muted">
                    Phần này chưa có câu hỏi. Học sinh sẽ đọc lời dẫn / ngữ cảnh rồi bấm <b>Tiếp tục</b>. Thêm câu nếu cần.
                  </div>
                )}
                {cur.questions.map((q, qi) => {
                  const n = curNb.questions[qi];
                  const open = openQ === q.key;
                  const problem = issues.some((i) => i.section_index === idx && i.question_index === qi);
                  const sameSkill = sections.filter((s) => s.key !== cur.key && s.skill === cur.skill);
                  return (
                    <article key={q.key} draggable={!open} onDragStart={onDragStart("question", q.key)} onDragEnd={onDragEnd}
                      onDragOver={(e) => { if (dragRef.current?.kind === "question") e.preventDefault(); }} onDrop={dropOnQuestion(cur.key, qi)}
                      className={`rounded-2xl border bg-white ${problem ? "border-rose-300" : open ? "border-brand-300 ring-2 ring-brand-50" : "border-line"}`}>
                      <div className="flex items-center gap-2 py-2.5 pl-1.5 pr-2.5">
                        <span aria-hidden="true" className="cursor-grab text-ink-subtle"><GripVertical className="h-4 w-4" /></span>
                        <span className="min-w-20 text-sm font-semibold">{rangeLabel(n.start, n.start + n.count - 1)}</span>
                        <span className="whitespace-nowrap rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                          {categoryLabel(q.category)}{n.count > 1 ? ` (${n.count})` : ""}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{questionSummary(q) || "(chưa có nội dung)"}</span>
                        <button type="button" aria-label="Lên" onClick={() => updSection(cur.key, { questions: moveItem(cur.questions, qi, qi - 1) })} className="cursor-pointer rounded-lg p-2 text-ink-muted hover:bg-line-soft"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" aria-label="Xuống" onClick={() => updSection(cur.key, { questions: moveItem(cur.questions, qi, qi + 1) })} className="cursor-pointer rounded-lg p-2 text-ink-muted hover:bg-line-soft"><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" aria-label="Sửa câu" aria-expanded={open} onClick={() => setOpenQ(open ? "" : q.key)} className="cursor-pointer rounded-lg p-2 text-ink-muted hover:bg-line-soft"><Pencil className="h-4 w-4" /></button>
                        <button type="button" aria-label="Xoá câu" onClick={() => { updSection(cur.key, { questions: cur.questions.filter((x) => x.key !== q.key) }); if (open) setOpenQ(""); }} className="cursor-pointer rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      {open && (
                        <div className="flex flex-col gap-3.5 border-t border-line-soft p-4">
                          <QuestionForm question={q} numberFrom={n.start} isListeningSection={cur.skill === "Listening"} flashcards={flashcards}
                            onFlashcard={(f) => setFlashcards((m) => ({ ...m, [f.id]: f }))} onChange={(nq) => updQuestion(cur.key, nq)} onUploadAudio={uploadAudio} />
                          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-2.5">
                            <span className="text-[13px] text-ink-muted">Chuyển sang phần:</span>
                            {sameSkill.length === 0 && <span className="text-[13px] text-ink-muted">không có phần khác cùng kỹ năng</span>}
                            {sameSkill.map((s) => (
                              <button key={s.key} type="button" className={`${btn} min-h-8 text-[13px]`} onClick={() => {
                                const next = moveQuestionTo(sections, q.key, s.key);
                                if (next) { setSections(next); setSelected(s.key); }
                              }}>
                                Phần {sections.indexOf(s) + 1}
                              </button>
                            ))}
                            <div className="flex-1" />
                            <button type="button" className={`${btnPri} min-h-8`} onClick={() => setOpenQ("")}>Xong</button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}

                <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-3.5">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700"><Plus className="h-4 w-4" /> Thêm câu vào Phần {idx + 1} ({cur.skill})</span>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                    {ADD_TYPES[cur.skill].map((t) => (
                      <button key={t.category} type="button" onClick={() => {
                        const q = newQuestion(t.category);
                        updSection(cur.key, { questions: [...cur.questions, q] });
                        setOpenQ(q.key);
                      }} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-brand-200 bg-white px-3 text-center text-sm font-semibold text-brand-800 hover:border-brand-400">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
                <span className="text-[13px] text-ink-muted">{totalLabel}</span>
                <div className="flex-1" />
                {props.previewSlot}
                <button type="button" onClick={doSave} disabled={saving} className={btnPri}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Check className="h-4 w-4 text-white" />}
                  {isExam ? "Lưu đề" : "Lưu bài học"}
                </button>
              </div>
            </section>

            {/* ───── Cấu trúc bài ───── */}
            <aside aria-label="Cấu trúc bài" className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-3 rounded-3xl border border-line bg-white p-4 lg:max-w-[360px]">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-bold">Cấu trúc bài</h2>
                <span className="text-[13px] text-ink-muted">{totalLabel}</span>
              </div>
              {sections.map((s, si) => {
                const on = si === idx;
                const err = !!issueOf(si);
                const n = nb[si];
                return (
                  <div key={s.key} draggable onDragStart={onDragStart("section", s.key)} onDragEnd={onDragEnd} onDragOver={overSection(s.key)} onDragLeave={() => dropKey === s.key && setDropKey("")} onDrop={dropOnSection(s.key)}
                    className={`flex items-start gap-1.5 rounded-2xl border py-2.5 pl-2.5 pr-1.5 ${dropKey === s.key ? "border-accent-400 bg-accent-50" : err ? "border-rose-300 bg-rose-50" : on ? "border-brand-300 bg-brand-50" : "border-line bg-white"}`}>
                    <button type="button" aria-current={on} onClick={() => { setSelected(s.key); setOpenQ(""); setSkillError(null); }} className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left">
                      <GripVertical aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-ink-subtle" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <b className="text-sm">Phần {si + 1}</b>
                          <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink-muted">{s.skill}</span>
                          {err && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">Lỗi</span>}
                        </span>
                        <span className="truncate text-[13px] text-ink-muted">{sectionSummary(s)}</span>
                        <span className={`text-[13px] font-medium ${s.questions.length ? "text-brand-700" : "text-ink-muted"}`}>
                          {s.questions.length ? rangeLabel(n.start, n.end) : "Chỉ đọc · không có câu"}
                        </span>
                      </span>
                    </button>
                    <div className="flex flex-col">
                      <button type="button" aria-label="Đưa phần lên" onClick={() => setSections(moveItem(sections, si, si - 1))} className="cursor-pointer rounded-md p-1 text-ink-muted hover:bg-line-soft"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Đưa phần xuống" onClick={() => setSections(moveItem(sections, si, si + 1))} className="cursor-pointer rounded-md p-1 text-ink-muted hover:bg-line-soft"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                );
              })}
              <button type="button" className={`${btn} justify-center border-dashed text-brand-700`} onClick={() => {
                const s = newSection(cur.skill);
                setSections([...sections, s]);
                setSelected(s.key);
                setOpenQ("");
              }}>
                <Plus className="h-4 w-4" /> Thêm phần
              </button>
              <p className="text-xs leading-relaxed text-ink-muted">Kéo thả để sắp xếp phần, hoặc kéo một câu thả vào phần khác cùng kỹ năng. Số câu tự tính lại: đoạn điền 5 ô chiếm 5 số.</p>
            </aside>
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="sec-del" className="flex w-full max-w-md flex-col gap-3.5 rounded-3xl bg-white p-6">
            <h3 id="sec-del" className="text-lg font-bold">Xoá Phần {idx + 1}?</h3>
            <p className="text-sm leading-relaxed text-ink-muted">
              {cur.questions.length
                ? `Phần này có ${cur.questions.length} câu hỏi (chiếm ${curNb.questions.reduce((a, q) => a + q.count, 0)} số). Các câu cũng bị xoá${(props.attemptCount || 0) > 0 ? ", nhưng vẫn hiện trong bài làm cũ." : "."}`
                : "Phần này không có câu hỏi."}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setConfirmDelete(false)}>Huỷ</button>
              <button type="button" className="inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700" onClick={() => {
                const rest = sections.filter((s) => s.key !== cur.key);
                setSections(rest);
                setSelected(rest[Math.max(0, idx - 1)].key);
                setConfirmDelete(false);
                setOpenQ("");
              }}>Xoá</button>
            </div>
          </div>
        </div>
      )}
      {conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="sec-conflict" className="flex w-full max-w-md flex-col gap-3.5 rounded-3xl bg-white p-6">
            <h3 id="sec-conflict" className="text-lg font-bold">{isExam ? "Đề" : "Bài học"} đã được sửa ở nơi khác</h3>
            <p className="text-sm leading-relaxed text-ink-muted">Có người (hoặc một tab khác) vừa lưu. Tải lại để xem bản mới nhất rồi sửa tiếp — thay đổi của bạn chưa được ghi.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setConflict(false)}>Để sau</button>
              <button type="button" className={btnPri} onClick={() => { setConflict(false); props.onReload?.(); }}>Tải lại</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AudioBox({ section: s, onChange, onUpload }: { section: EdSection; onChange: (p: Partial<EdSection>) => void; onUpload: (f: File) => Promise<string | null> }) {
  const [mode, setMode] = useState<"UPLOAD" | "TTS">(s.stimulus_audio_text && !s.stimulus_audio_url ? "TTS" : s.stimulus_audio_url.startsWith("/api/tts") ? "TTS" : "UPLOAD");
  const ttsUrl = (text: string, gender: string) => `/api/tts?text=${encodeURIComponent(text)}&gender=${gender}`;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-dashed border-brand-200 bg-brand-50 p-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Music className="h-5 w-5 text-brand-600" />
        <Seg ariaLabel="Nguồn audio" value={mode} options={[["UPLOAD", "Tải audio lên"], ["TTS", "Đọc bằng giọng AI"]]} onChange={setMode} />
      </div>
      {mode === "UPLOAD" ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {s.stimulus_audio_url && !s.stimulus_audio_url.startsWith("/api/tts") ? <audio controls src={s.stimulus_audio_url} className="h-9" /> : <span className="text-sm text-ink-muted">Chưa có audio</span>}
          <input type="file" accept="audio/*" aria-label="Tải audio của phần" className="text-sm" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const url = await onUpload(f);
            if (url) onChange({ stimulus_audio_url: url, stimulus_audio_text: "" });
          }} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea rows={3} className={fld} value={s.stimulus_audio_text} placeholder="Nội dung để AI đọc…"
            onChange={(e) => onChange({ stimulus_audio_text: e.target.value, stimulus_audio_url: e.target.value.trim() ? ttsUrl(e.target.value.trim(), s.stimulus_audio_gender) : "" })} />
          <div className="flex flex-wrap items-center gap-2.5">
            <Seg ariaLabel="Giọng đọc" value={s.stimulus_audio_gender} options={[["Female", "Giọng nữ"], ["Male", "Giọng nam"]]}
              onChange={(g) => onChange({ stimulus_audio_gender: g, stimulus_audio_url: s.stimulus_audio_text.trim() ? ttsUrl(s.stimulus_audio_text.trim(), g) : "" })} />
            {s.stimulus_audio_url && <audio controls src={s.stimulus_audio_url} className="h-9" />}
          </div>
        </div>
      )}
    </div>
  );
}
