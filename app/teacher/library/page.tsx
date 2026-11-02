"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TeacherLayout from "@/components/TeacherLayout";
import LessonLibraryPanel from "@/components/teacher/LessonLibraryPanel";
import ExamLibraryPanel from "@/components/teacher/ExamLibraryPanel";
import { BookMarked, FileText, Loader2 } from "lucide-react";

function TeacherLibraryContent() {
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab: "lessons" | "exams" = tabParam === "exams" ? "exams" : "lessons";

  // router.replace không đổi URL khi trang được mở sẵn ?tab=… (Next 16) → dùng History API, Next tự đồng bộ useSearchParams
  const handleSelectTab = (tab: "lessons" | "exams") => {
    window.history.replaceState(null, "", `/teacher/library?tab=${tab}`);
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Page Header + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line/50 pb-5">
          <div>
            <h1 className="font-headline text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Kho Bài Học & Đề Thi
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              Tập trung quản lý học liệu bài học và bộ đề thi trong một không gian thống nhất
            </p>
          </div>

          <div className="inline-flex p-1 rounded-2xl bg-brand-50 border border-line self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleSelectTab("lessons")}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "lessons"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-ink-muted hover:text-brand-600"
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span>Bài học</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab("exams")}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "exams"
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-ink-muted hover:text-brand-600"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Đề thi</span>
            </button>
          </div>
        </div>

        {/* Tab Panels */}
        {activeTab === "lessons" ? <LessonLibraryPanel /> : <ExamLibraryPanel />}
      </div>
    </TeacherLayout>
  );
}

export default function TeacherLibraryPage() {
  return (
    <Suspense
      fallback={
        <TeacherLayout>
          <div className="flex items-center justify-center py-20 text-xs font-bold text-brand-600 space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            <span>Đang tải Kho Bài Học &amp; Đề Thi...</span>
          </div>
        </TeacherLayout>
      }
    >
      <TeacherLibraryContent />
    </Suspense>
  );
}
