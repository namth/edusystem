"use client";

import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Sparkles,
  Cpu,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Zap,
  Info,
  Server
} from "lucide-react";

interface ModelOption {
  id: string;
  name: string;
  provider: "google" | "openai" | "portkey";
  desc: string;
  badge?: string;
}

const PRESET_MODELS: ModelOption[] = [
  {
    id: "gemini-2.5-flash",
    name: "Google Gemini 2.5 Flash",
    provider: "google",
    desc: "Mô hình Multimodal Vision siêu nhanh, tiết kiệm chi phí, hỗ trợ context window lên tới 1 triệu tokens.",
    badge: "Khuyên dùng (Mặc định)",
  },
  {
    id: "gemini-2.5-pro",
    name: "Google Gemini 2.5 Pro",
    provider: "google",
    desc: "Mô hình cao cấp với khả năng suy luận sâu và trích xuất tài liệu học thuật phức tạp với độ chính xác cao nhất.",
    badge: "Độ chính xác cao",
  },
  {
    id: "gpt-4o",
    name: "OpenAI GPT-4o (Omni)",
    provider: "openai",
    desc: "Mô hình đa phương thức hàng đầu của OpenAI, phân tích hình ảnh và bài thi tiếng Anh cực kỳ chuẩn mực.",
  },
  {
    id: "gpt-4o-mini",
    name: "OpenAI GPT-4o Mini",
    provider: "openai",
    desc: "Phiên bản tinh gọn, phản hồi nhanh chóng và tối ưu ngân sách.",
  },
];

export default function AdminSettingsPage() {
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [selectedProvider, setSelectedProvider] = useState<"google" | "openai" | "portkey">("google");
  const [temperature, setTemperature] = useState(0.1);
  const [maxTokens, setMaxTokens] = useState(8192);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch current config on load
  const loadConfig = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/admin/settings/ai-model");
      const data = await res.json();
      if (data.success && data.config) {
        setSelectedModel(data.config.model || "gemini-2.5-flash");
        setSelectedProvider(data.config.provider || "google");
        setTemperature(data.config.temperature ?? 0.1);
        setMaxTokens(data.config.max_tokens ?? 8192);
      }
    } catch (err: any) {
      console.warn("Load config error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSelectModel = (preset: ModelOption) => {
    setSelectedModel(preset.id);
    setSelectedProvider(preset.provider);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/settings/ai-model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          provider: selectedProvider,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể cập nhật cấu hình.");
      }

      setStatusMessage({
        type: "success",
        text: `Đã cập nhật thành công mô hình AI sang "${selectedModel}". Các yêu cầu bóc tách tiếp theo của giáo viên sẽ áp dụng ngay lập tức mà không cần khởi động lại máy chủ!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Đã xảy ra lỗi khi lưu cấu hình.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6 font-sans text-ink">
        {/* Header */}
        <div className="bg-white border border-line rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-brand-800 uppercase tracking-wider mb-1">
              <Cpu className="w-4 h-4 text-brand-800" />
              <span>Quản Trị Hệ Thống • Dynamic AI Config</span>
            </div>
            <h1 className="text-2xl font-bold text-brand-600 tracking-tight">
              Cấu Hình Mô Hình AI Bóc Tách Đề Thi
            </h1>
            <p className="text-xs md:text-sm text-ink-muted mt-1">
              Thay đổi mô hình AI xử lý tài liệu DOCX/PDF/Ảnh mà không cần can thiệp mã nguồn hay deploy lại hệ thống.
            </p>
          </div>
          <button
            onClick={loadConfig}
            disabled={isLoading}
            className="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Tải Lại Cấu Hình</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center space-x-3 shadow-xs animate-in fade-in ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : "bg-rose-50 border-rose-300 text-rose-900"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div className="text-xs font-semibold">{statusMessage.text}</div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Preset Model Selection Cards */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span>1. Chọn Mô Hình AI Mặc Định</span>
              </h2>
              <span className="text-xs text-ink-muted">
                Đang kích hoạt: <strong className="text-brand-600">{selectedModel}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESET_MODELS.map((preset) => {
                const isSelected = selectedModel === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectModel(preset)}
                    className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? "border-brand-600 bg-surface-alt shadow-xs"
                        : "border-line bg-surface-alt hover:border-brand-600 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Radio circle with crisp white inner background */}
                        <input
                          type="radio"
                          name="ai_model"
                          checked={isSelected}
                          onChange={() => handleSelectModel(preset)}
                          className="w-4 h-4 text-brand-600 bg-white border border-line focus:ring-brand-600 cursor-pointer shrink-0"
                          style={{ accentColor: "#1453e0", backgroundColor: "#ffffff", colorScheme: "light" }}
                        />
                        <span className="font-bold text-sm text-ink">{preset.name}</span>
                      </div>
                      {preset.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-300 shrink-0">
                          {preset.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed pl-6">{preset.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Custom Model Input */}
            <div className="pt-2 border-t border-line/40">
              <label className="block text-xs font-bold uppercase text-brand-600 mb-1">
                Hoặc Nhập Tên Mô Hình Tùy Chỉnh (Custom Model ID):
              </label>
              <input
                type="text"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder="VD: gemini-2.5-flash, gpt-4o, claude-3-7-sonnet..."
                className="w-full p-2.5 rounded-xl border border-line bg-surface-alt text-xs font-semibold focus:outline-none focus:border-brand-600"
              />
            </div>
          </div>

          {/* Hyperparameters Config */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-600" />
              <span>2. Tham Số Kỹ Thuật (Hyperparameters)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-ink">
                  <span>Temperature (Độ ngẫu nhiên):</span>
                  <span className="font-mono text-brand-600">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-brand-600 cursor-pointer"
                />
                <p className="text-[11px] text-ink-muted">
                  Khuyên dùng giá trị thấp (0.0 - 0.2) để việc bóc tách đề thi chính xác 100%, không bị bịa đặt nội dung.
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-ink">
                  <span>Max Output Tokens:</span>
                  <span className="font-mono text-brand-600">{maxTokens}</span>
                </div>
                <input
                  type="number"
                  min="1024"
                  max="16384"
                  step="512"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 8192)}
                  className="w-full p-2 rounded-xl border border-line bg-surface-alt text-xs font-semibold focus:outline-none focus:border-brand-600"
                />
                <p className="text-[11px] text-ink-muted">
                  8192 tokens đủ để xuất 40 - 50 câu hỏi IELTS kèm 3 bài đọc trong 1 lần gọi duy nhất.
                </p>
              </div>
            </div>
          </div>

          {/* Architecture Rationale Box */}
          <div className="p-4 rounded-2xl bg-surface-alt border border-brand-300 flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="text-xs text-ink-muted leading-relaxed">
              <strong className="text-brand-600 block mb-0.5">Cơ chế Zero-Downtime Hot-Swapping:</strong>
              Cấu hình được lưu trực tiếp vào bảng <code className="bg-white px-1.5 py-0.5 rounded border border-line font-mono text-[11px]">system_settings</code> của PostgreSQL. 
              Các server worker và route API giáo viên sẽ tự động tải lại cấu hình mới trong vòng tối đa 30 giây mà không cần khởi động lại dịch vụ hoặc can thiệp mã nguồn.
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Save className="w-4 h-4 text-white" />
              )}
              <span>Lưu Cấu Hình Mô Hình AI</span>
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
