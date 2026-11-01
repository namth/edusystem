"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TeacherLayout from "@/components/TeacherLayout";
import LessonLibraryPanel from "@/components/teacher/LessonLibraryPanel";
import ExamLibraryPanel from "@/components/teacher/ExamLibraryPanel";
import { BookMarked, FileText, Loader2 } from "lucide-react";

function TeacherLibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab");
  const activeTab: "lessons" | "exams" = tabParam === "exams" ? "exams" : "lessons";

  const handleSelectTab = (tab: "lessons" | "exams") => {
    router.replace(`/teacher/library?tab=${tab}`);
  };

  return (
    <TeacherLayout>
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Page Header + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d8c2b6]/50 pb-5">
          <div>
            <h1 className="font-headline text-2xl sm:text-3xl font-bold text-[#211a16] tracking-tight">
              Kho Bài Học & Đề Thi
            </h1>
            <p className="text-xs sm:text-sm text-[#52443a] mt-1">
              Tập trung quản lý học liệu bài học và bộ đề thi trong một không gian thống nhất
            </p>
          </div>

          <div className="inline-flex p-1 rounded-2xl bg-[#fff1ea] border border-[#d8c2b6] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleSelectTab("lessons")}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "lessons"
                  ? "bg-[#6d3807] text-white shadow-xs"
                  : "text-[#52443a] hover:text-[#6d3807]"
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
                  ? "bg-[#6d3807] text-white shadow-xs"
                  : "text-[#52443a] hover:text-[#6d3807]"
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
          <div className="flex items-center justify-center py-20 text-xs font-bold text-[#6d3807] space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#6d3807]" />
            <span>Đang tải Kho Bài Học &amp; Đề Thi...</span>
          </div>
        </TeacherLayout>
      }
    >
      <TeacherLibraryContent />
    </Suspense>
  );
}
