"use client";

import { useState } from "react";
import {
  Users,
  Award,
  ChevronRight,
  Edit2,
  Check,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";

export interface StudentAttemptItem {
  id: string;
  status: string;
  score: any;
  score10: number | null;
  submitted_at: string;
  has_ai: boolean;
  reviewed_at: string | null;
  after_finalize: boolean;
}

export interface StudentRowItem {
  student: {
    id: string;
    name: string;
  };
  attempts: StudentAttemptItem[];
  counted_attempt_id: string | null;
  chosen_attempt_id: string | null;
  manual_score10: number | null;
  note: string | null;
  cell: {
    attempt_id: string | null;
    source: string;
    state: string;
    raw_score: number | null;
    raw_max: number | null;
    score10: number | null;
    passed: boolean | null;
    sections?: Record<string, any>;
  };
}

export type TableColumns =
  | {
      kind: "exam";
      sections: { skill: string; min: number; max: number; step: number }[];
    }
  | {
      kind: "lesson";
      fields: string[];
    };

interface ItemTableProps {
  columns: TableColumns;
  rows: StudentRowItem[];
  finalizedAt: string | null;
  onOpenDrawer: (row: StudentRowItem) => void;
  onUpdateStudent: (
    studentId: string,
    payload: { chosen_attempt_id?: string | null; manual_score10?: number | null; note?: string }
  ) => Promise<boolean>;
}

export default function GradingItemTable({
  columns,
  rows,
  finalizedAt,
  onOpenDrawer,
  onUpdateStudent,
}: ItemTableProps) {
  const isFinalized = !!finalizedAt;
  const isExam = columns.kind === "exam";

  // State cho việc nhập tay điểm cho học sinh chưa nộp
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [manualScoreInput, setManualScoreInput] = useState<string>("");
  const [noteInput, setNoteInput] = useState<string>("");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const startEditManual = (row: StudentRowItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFinalized) return;
    setEditingStudentId(row.student.id);
    setManualScoreInput(
      row.manual_score10 !== null && row.manual_score10 !== undefined
        ? String(row.manual_score10)
        : ""
    );
    setNoteInput(row.note || "");
    setManualError(null);
  };

  const handleSaveManual = async (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setManualError(null);

    let val: number | null = null;
    if (manualScoreInput.trim() !== "") {
      const num = Number(manualScoreInput);
      if (isNaN(num) || num < 0 || num > 10) {
        setManualError("Điểm thang 10 phải từ 0 đến 10");
        return;
      }
      val = Math.round(num * 10) / 10;
    }

    if (noteInput.length > 2000) {
      setManualError("Ghi chú tối đa 2000 ký tự");
      return;
    }

    setIsSavingManual(true);
    const ok = await onUpdateStudent(studentId, {
      manual_score10: val,
      note: noteInput.trim() || undefined,
    });
    setIsSavingManual(false);

    if (ok) {
      setEditingStudentId(null);
    }
  };

  const renderStateBadge = (row: StudentRowItem) => {
    const st = row.cell.state;
    if (st === "NOT_SUBMITTED") {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-surface-alt text-ink-muted border border-line">
          Chưa nộp
        </span>
      );
    }
    if (st === "GRADING") {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          Đang chấm
        </span>
      );
    }
    if (st === "NEEDS_REVIEW") {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
          Cần chấm tay
        </span>
      );
    }
    if (row.attempts.some((a) => a.has_ai && !a.reviewed_at && a.status === "GRADED")) {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Chưa xem
        </span>
      );
    }
    if (row.attempts.some((a) => a.reviewed_at)) {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Đã duyệt
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
        Khách quan
      </span>
    );
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-line p-12 text-center space-y-3 font-sans">
        <Users className="w-12 h-12 text-brand-600 mx-auto opacity-30" />
        <p className="text-xs font-medium text-ink-muted">Lớp chưa có học sinh</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-line shadow-2xs overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-surface-alt border-b border-line text-ink-muted font-bold">
              <th className="p-3.5 pl-5 border-r border-line/60 min-w-[180px]">Học sinh</th>

              {isExam ? (
                <>
                  {columns.sections.map((sec) => (
                    <th
                      key={sec.skill}
                      className="p-3.5 text-center border-r border-line/60 min-w-[100px]"
                    >
                      {sec.skill}
                    </th>
                  ))}
                  <th className="p-3.5 text-center border-r border-line/60 min-w-[90px]">
                    Tổng
                  </th>
                  <th className="p-3.5 text-center border-r border-line/60 min-w-[90px]">
                    Đạt / Chưa
                  </th>
                </>
              ) : (
                <>
                  <th className="p-3.5 text-center border-r border-line/60 min-w-[100px]">
                    Khách quan %
                  </th>
                  <th className="p-3.5 text-center border-r border-line/60 min-w-[100px]">
                    AI %
                  </th>
                  <th className="p-3.5 text-center border-r border-line/60 min-w-[100px]">
                    Tổng %
                  </th>
                </>
              )}

              <th className="p-3.5 text-center border-r border-line/60 min-w-[110px] bg-brand-50/40 text-brand-900">
                Thang 10 (score10)
              </th>
              <th className="p-3.5 text-center border-r border-line/60 min-w-[80px]">Số lượt</th>
              <th className="p-3.5 text-center border-r border-line/60 min-w-[120px]">
                Trạng thái
              </th>
              <th className="p-3.5 pr-5 text-right min-w-[100px]">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {rows.map((row) => {
              const isNotSubmitted = row.cell.state === "NOT_SUBMITTED";
              const isEditing = editingStudentId === row.student.id;
              const hasAfterFinalize = row.attempts.some((a) => a.after_finalize);

              return (
                <tr
                  key={row.student.id}
                  onClick={() => onOpenDrawer(row)}
                  className="hover:bg-brand-50/30 transition-colors cursor-pointer group"
                >
                  {/* Học sinh */}
                  <td className="p-3.5 pl-5 border-r border-line/60">
                    <div className="font-bold text-ink group-hover:text-brand-600 transition-colors">
                      {row.student.name}
                    </div>
                    <div className="text-[10px] text-ink-subtle font-mono">{row.student.id}</div>
                  </td>

                  {/* Cột theo loại bài (Exam hoặc Lesson) */}
                  {isExam ? (
                    <>
                      {columns.sections.map((sec) => {
                        const secVal = row.cell.sections?.[sec.skill];
                        const sScore =
                          typeof secVal === "number" ? secVal : secVal?.score ?? null;
                        return (
                          <td
                            key={sec.skill}
                            className="p-3.5 text-center border-r border-line/60 font-mono"
                          >
                            {sScore !== null && sScore !== undefined ? (
                              <span className="font-bold text-ink">{sScore}</span>
                            ) : (
                              <span className="text-ink-subtle">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3.5 text-center border-r border-line/60 font-mono font-bold">
                        {row.cell.raw_score !== null && row.cell.raw_score !== undefined
                          ? row.cell.raw_score
                          : "—"}
                      </td>
                      <td className="p-3.5 text-center border-r border-line/60">
                        {row.cell.passed === true ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Đạt
                          </span>
                        ) : row.cell.passed === false ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            Chưa
                          </span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3.5 text-center border-r border-line/60 font-mono">
                        {row.cell.raw_score !== null ? `${row.cell.raw_score}%` : "—"}
                      </td>
                      <td className="p-3.5 text-center border-r border-line/60 font-mono">
                        {row.cell.raw_score !== null ? `${row.cell.raw_score}%` : "—"}
                      </td>
                      <td className="p-3.5 text-center border-r border-line/60 font-mono font-bold">
                        {row.cell.raw_score !== null ? `${row.cell.raw_score}%` : "—"}
                      </td>
                    </>
                  )}

                  {/* Thang 10 (score10 / manual_score10) */}
                  <td className="p-3.5 text-center border-r border-line/60 font-mono bg-brand-50/20">
                    {isEditing ? (
                      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={manualScoreInput}
                            onChange={(e) => setManualScoreInput(e.target.value)}
                            placeholder="0-10"
                            className="w-16 p-1 border border-brand-300 rounded text-center text-xs font-bold text-brand-600 focus:outline-none"
                          />
                          <button
                            onClick={(e) => handleSaveManual(row.student.id, e)}
                            disabled={isSavingManual}
                            className="p-1 bg-brand-600 text-white rounded hover:bg-brand-700 cursor-pointer"
                          >
                            {isSavingManual ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder="Ghi chú..."
                          className="w-28 p-1 border border-line rounded text-[10px] focus:outline-none"
                        />
                        {manualError && (
                          <div className="text-[10px] text-rose-600">{manualError}</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-1.5">
                        {row.cell.score10 !== null && row.cell.score10 !== undefined ? (
                          <span className="font-bold text-xs text-brand-800 px-2 py-0.5 rounded bg-brand-100">
                            {row.cell.score10}
                          </span>
                        ) : (
                          <span className="text-ink-subtle italic text-[11px]">Chưa nộp</span>
                        )}

                        {!isFinalized && isNotSubmitted && (
                          <button
                            onClick={(e) => startEditManual(row, e)}
                            className="p-1 rounded text-ink-subtle hover:text-brand-600 hover:bg-surface-alt cursor-pointer"
                            title="Nhập tay điểm 10 và ghi chú"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Số lượt */}
                  <td className="p-3.5 text-center border-r border-line/60 font-mono text-ink">
                    {row.attempts.length}
                  </td>

                  {/* Trạng thái */}
                  <td className="p-3.5 text-center border-r border-line/60">
                    <div className="flex flex-col items-center gap-1">
                      {renderStateBadge(row)}
                      {hasAfterFinalize && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          nộp sau chốt
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Thao tác */}
                  <td className="p-3.5 pr-5 text-right">
                    <div className="flex items-center justify-end space-x-1 text-brand-600 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span className="text-xs">Chấm bài</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
