"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TeacherLayout from "@/components/TeacherLayout";
import GradingItemHeader from "@/components/teacher/grading/GradingItemHeader";
import GradingItemTable, {
  type TableColumns,
  type StudentRowItem,
} from "@/components/teacher/grading/GradingItemTable";
import GradingDrawer from "@/components/teacher/grading/GradingDrawer";
import GradingFinalizeModal from "@/components/teacher/grading/GradingFinalizeModal";
import GradingToast from "@/components/teacher/grading/GradingToast";
import { AlertCircle, RefreshCw, Loader2, ArrowLeft } from "lucide-react";

export default function TeacherGradingItemDetailPage() {
  const params = useParams();
  const router = useRouter();

  const classId = (params?.classId || "") as string;
  const kind = (params?.kind || "lesson") as "lesson" | "exam";
  const itemId = (params?.itemId || "") as string;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [is404or403, setIs404or403] = useState(false);

  // Data states
  const [itemInfo, setItemInfo] = useState<any | null>(null);
  const [columns, setColumns] = useState<TableColumns | null>(null);
  const [rows, setRows] = useState<StudentRowItem[]>([]);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);

  // Drawer state
  const [selectedStudentRow, setSelectedStudentRow] = useState<StudentRowItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Finalize confirmation modal
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [unreviewedCount, setUnreviewedCount] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [gradingPendingStudents, setGradingPendingStudents] = useState<string[] | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
  };

  // Fetch bảng điểm của bài
  const fetchItemGradebook = useCallback(async () => {
    if (!classId || !itemId) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      setIs404or403(false);
      setGradingPendingStudents(null);

      const res = await fetch(
        `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}`
      );

      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          setIs404or403(true);
          throw new Error("Không tìm thấy bài trong lớp của bạn");
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể tải dữ liệu bảng điểm.");
      }

      const data = await res.json();
      setItemInfo(data.item);
      setColumns(data.columns);
      setRows(data.rows || []);
      setFinalizedAt(data.finalized_at || null);

      // Nếu đang mở drawer cho một học sinh, cập nhật lại dòng dữ liệu mới nhất
      if (selectedStudentRow) {
        const fresh = (data.rows || []).find(
          (r: StudentRowItem) => r.student.id === selectedStudentRow.student.id
        );
        if (fresh) setSelectedStudentRow(fresh);
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Lỗi tải bảng điểm.");
    } finally {
      setLoading(false);
    }
  }, [classId, kind, itemId, selectedStudentRow]);

  useEffect(() => {
    fetchItemGradebook();
  }, [classId, kind, itemId]);

  // Cập nhật ô học sinh (lượt tính / điểm nhập tay / ghi chú)
  const handleUpdateStudent = async (
    studentId: string,
    payload: { chosen_attempt_id?: string | null; manual_score10?: number | null; note?: string }
  ): Promise<boolean> => {
    try {
      const res = await fetch(
        `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}/students/${studentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể cập nhật học sinh.");
      }

      showToast("Cập nhật thông tin học sinh thành công!", "success");
      await fetchItemGradebook();
      return true;
    } catch (e: any) {
      showToast(e.message || "Lỗi cập nhật", "error");
      return false;
    }
  };

  // Mở Drawer chấm điểm
  const handleOpenDrawer = (row: StudentRowItem) => {
    setSelectedStudentRow(row);
    setIsDrawerOpen(true);
  };

  // Chốt bảng điểm bài
  const handleFinalize = async (confirmUnreviewed = false) => {
    setIsFinalizing(true);
    setGradingPendingStudents(null);

    try {
      const res = await fetch(
        `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmUnreviewed }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          if (data.code === "UNREVIEWED") {
            setUnreviewedCount(data.count || 1);
            setShowFinalizeModal(true);
            return;
          }
          if (data.code === "GRADING_PENDING") {
            setGradingPendingStudents(data.students || []);
            throw new Error(
              "Không thể chốt: Còn bài làm đang chấm hoặc cần chấm tay (GRADING_PENDING)."
            );
          }
        }
        throw new Error(data.error || "Không thể chốt bảng điểm.");
      }

      setShowFinalizeModal(false);
      setFinalizedAt(data.finalized_at);
      showToast("Đã chốt bảng điểm thành công! Điểm đã được lưu chính thức.", "success");
      await fetchItemGradebook();
    } catch (e: any) {
      showToast(e.message || "Lỗi khi chốt bảng điểm", "error");
    } finally {
      setIsFinalizing(false);
    }
  };

  // Mở chốt bảng điểm bài
  const handleReopen = async () => {
    if (!confirm("Bạn có chắc chắn muốn mở chốt để tiếp tục sửa điểm không?")) return;

    setIsReopening(true);
    try {
      const res = await fetch(
        `/api/teacher/grading/classes/${classId}/items/${kind}/${itemId}/reopen`,
        {
          method: "POST",
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Không thể mở chốt bảng điểm.");
      }

      setFinalizedAt(null);
      showToast("Đã mở chốt bảng điểm thành công!", "success");
      await fetchItemGradebook();
    } catch (e: any) {
      showToast(e.message || "Lỗi mở chốt", "error");
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="space-y-6 font-sans">
        {/* Toast */}
        <GradingToast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />

        {/* Modal xác nhận chốt điểm */}
        <GradingFinalizeModal
          isOpen={showFinalizeModal}
          onClose={() => setShowFinalizeModal(false)}
          onConfirm={() => handleFinalize(true)}
          unreviewedCount={unreviewedCount}
          isConfirming={isFinalizing}
        />

        {/* Ngăn chấm Drawer */}
        <GradingDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          kind={kind}
          classId={classId}
          itemId={itemId}
          studentRow={selectedStudentRow}
          finalizedAt={finalizedAt}
          onAttemptSaved={fetchItemGradebook}
          onStudentUpdated={fetchItemGradebook}
          showToast={showToast}
        />

        {/* 4 Trạng thái UI */}
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-6 bg-white rounded-lg w-1/4 border border-line"></div>
            <div className="h-32 bg-white rounded-3xl border border-line"></div>
            <div className="h-64 bg-white rounded-3xl border border-line"></div>
          </div>
        ) : errorMessage ? (
          <div className="p-8 bg-white rounded-3xl border border-line text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink">
                {is404or403 ? "Không tìm thấy bài trong lớp của bạn" : "Đã xảy ra lỗi"}
              </h3>
              <p className="text-xs text-rose-700">{errorMessage}</p>
            </div>
            <div className="flex justify-center items-center space-x-3 pt-2">
              <Link
                href={`/teacher/grading?class=${classId}`}
                className="px-4 py-2 border border-line text-ink-muted hover:text-ink rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Về hub chấm điểm
              </Link>
              <button
                onClick={fetchItemGradebook}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white" />
                <span>Thử lại</span>
              </button>
            </div>
          </div>
        ) : !itemInfo || !columns ? (
          <div className="bg-white rounded-3xl border border-line p-12 text-center space-y-3">
            <p className="text-xs text-ink-muted">Không tìm thấy bài trong lớp của bạn</p>
            <button
              onClick={fetchItemGradebook}
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-white" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : (
          <>
            {/* Cảnh báo học sinh đang chấm (GRADING_PENDING) */}
            {gradingPendingStudents && gradingPendingStudents.length > 0 && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1.5">
                <div className="font-bold flex items-center space-x-1.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Không thể chốt: Còn học sinh đang chấm hoặc cần chấm tay:</span>
                </div>
                <div className="font-mono text-[11px] pl-5">
                  {gradingPendingStudents.join(", ")}
                </div>
              </div>
            )}

            {/* Header trang SCR-51 */}
            <GradingItemHeader
              classId={classId}
              item={itemInfo}
              finalizedAt={finalizedAt}
              onFinalize={() => handleFinalize(false)}
              onReopen={handleReopen}
              isFinalizing={isFinalizing}
              isReopening={isReopening}
            />

            {/* Bảng điểm học sinh */}
            <GradingItemTable
              columns={columns}
              rows={rows}
              finalizedAt={finalizedAt}
              onOpenDrawer={handleOpenDrawer}
              onUpdateStudent={handleUpdateStudent}
            />
          </>
        )}
      </div>
    </TeacherLayout>
  );
}
