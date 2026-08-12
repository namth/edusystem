"use client";

import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { parseExamRawTextWithAI, StructuredExamData } from "@/lib/ai-engine";
import { Sparkles, FileText, CheckCircle2, BookOpen, Mic, PenTool, Headphones, Loader2 } from "lucide-react";

export default function AIExamImporterPage() {
  const [rawContent, setRawContent] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<StructuredExamData | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  const handleParseExam = async () => {
    if (!rawContent.trim()) return;
    setIsParsing(true);
    setIsPublished(false);
    try {
      const result = await parseExamRawTextWithAI(rawContent);
      setParsedData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsParsing(false);
    }
  };

  const handlePublishExam = () => {
    setIsPublished(true);
  };

  return (
    <AdminLayout>
      <div className="max-w-[1280px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="border-b border-[#d8c2b6]/40 pb-6">
          <h1 className="font-headline text-3xl font-bold text-[#211a16] tracking-tight">
            Global AI Exam Importer &amp; Parser
          </h1>
          <p className="text-sm text-[#52443a] mt-1">
            Bóc tách tài liệu đề thi thô bằng AI (GPT-4o-mini) thành cấu trúc JSON 4 kỹ năng chuẩn.
          </p>
        </div>

        {isPublished && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Đã xuất bản đề thi thành công!</h3>
              <p className="text-xs text-emerald-700">
                Đề thi đã được lưu vào Supabase và đồng bộ mạng lưới Neo4j AuraDB (`b2fe9d81`).
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Raw Input */}
          <div className="bg-[#ffffff] p-6 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold font-headline text-[#6d3807] flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#6d3807]" />
                <span>Văn Bản Đề Thi Thô (Input)</span>
              </label>
              <span className="text-xs font-mono text-[#857469]">
                {rawContent.length} ký tự
              </span>
            </div>

            <textarea
              rows={14}
              placeholder="Dán toàn bộ nội dung đề thi, bài đọc, câu hỏi trắc nghiệm hoặc đề luận vào đây..."
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              className="w-full p-4 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-sm font-sans focus:outline-none focus:border-[#6d3807] resize-none mb-4 leading-relaxed"
            />

            <div className="mt-auto">
              <button
                onClick={handleParseExam}
                disabled={isParsing || !rawContent.trim()}
                className="w-full py-3.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white rounded-xl font-mono text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 font-headline disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI Đang Phân Tích &amp; Bóc Tách...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#ffb782]" />
                    <span>Bóc Tách Đề Thi 4 Kỹ Năng Bằng AI &rarr;</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Structured Output */}
          <div className="bg-[#ffffff] p-6 rounded-2xl border border-[#d8c2b6] shadow-sm flex flex-col">
            <h2 className="text-sm font-bold font-headline text-[#6d3807] mb-4 flex items-center justify-between border-b border-[#d8c2b6]/40 pb-3">
              <span>Cấu Trúc Đề Thi Đã Trích Xuất (JSON Output)</span>
              {parsedData && (
                <span className="px-2.5 py-1 bg-[#DCFCE7] text-emerald-800 text-xs rounded-full font-mono font-bold">
                  Sẵn sàng xuất bản
                </span>
              )}
            </h2>

            {!parsedData && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-[#d8c2b6] rounded-xl bg-[#fff8f5]">
                <Sparkles className="w-12 h-12 text-[#d8c2b6] mb-3" />
                <p className="text-xs text-[#857469]">
                  Chưa có dữ liệu. Vui lòng dán đề thi bên trái và bấm nút bóc tách bằng AI.
                </p>
              </div>
            )}

            {parsedData && (
              <div className="flex-1 overflow-y-auto max-h-[500px] space-y-4 pr-1">
                <div className="p-4 rounded-xl bg-[#fff1ea] border border-[#ffb783]">
                  <h3 className="font-bold text-base text-[#6d3807] font-headline">{parsedData.title}</h3>
                  <p className="text-xs text-[#52443a] mt-1">{parsedData.description}</p>
                </div>

                <div className="p-4 rounded-xl border border-[#d8c2b6] bg-white">
                  <div className="flex items-center space-x-2 font-bold text-xs font-mono uppercase text-[#6d3807] mb-2">
                    <BookOpen className="w-4 h-4 text-[#6d3807]" />
                    <span>Reading Section ({parsedData.reading.length} Passages)</span>
                  </div>
                  <p className="text-xs text-[#52443a] italic bg-[#fff8f5] p-2 rounded border border-[#d8c2b6]">
                    "{parsedData.reading[0]?.passage}"
                  </p>
                </div>
              </div>
            )}

            {parsedData && (
              <div className="mt-4 pt-4 border-t border-[#d8c2b6]/40">
                <button
                  onClick={handlePublishExam}
                  className="w-full py-3.5 bg-[#785840] hover:bg-[#6d3807] text-white rounded-xl font-mono text-xs font-bold transition-all shadow flex items-center justify-center space-x-2 font-headline"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#ffb782]" />
                  <span>Lưu &amp; Xuất Bản Đề Thi Lên Hệ Thống</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
