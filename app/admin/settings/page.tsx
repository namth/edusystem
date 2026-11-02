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
  Info,
  DollarSign,
  Plus,
  Trash2,
  Tag,
} from "lucide-react";

interface ModelOption {
  id: string;
  name: string;
  provider: "google" | "openai" | "portkey";
  desc: string;
  badge?: string;
}

interface ModelPriceRow {
  model: string;
  input_per_1m: number;
  output_per_1m: number;
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

  // Bảng giá model AI
  const [usdVndRate, setUsdVndRate] = useState<number>(26000);
  const [pricingRows, setPricingRows] = useState<ModelPriceRow[]>([]);
  const [unpricedModels, setUnpricedModels] = useState<string[]>([]);
  const [isPricingLoading, setIsPricingLoading] = useState(true);
  const [isPricingSaving, setIsPricingSaving] = useState(false);
  const [pricingMessage, setPricingMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const loadPricing = async () => {
    setIsPricingLoading(true);
    setPricingMessage(null);
    try {
      const res = await fetch("/api/admin/settings/ai-pricing");
      const data = await res.json();
      if (data.success && data.pricing) {
        setUsdVndRate(data.pricing.usd_vnd_rate || 26000);
        const rows: ModelPriceRow[] = Object.entries(data.pricing.models || {}).map(
          ([model, p]: [string, any]) => ({
            model,
            input_per_1m: p.input_per_1m,
            output_per_1m: p.output_per_1m,
          })
        );
        setPricingRows(rows);
        setUnpricedModels(Array.isArray(data.unpriced_models) ? data.unpriced_models : []);
      }
    } catch (err: any) {
      console.warn("Load pricing error:", err);
    } finally {
      setIsPricingLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadPricing();
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

  const handleAddPricingRow = (initialModel = "") => {
    setPricingRows((prev) => [
      ...prev,
      { model: initialModel, input_per_1m: 0, output_per_1m: 0 },
    ]);
  };

  const handleRemovePricingRow = (index: number) => {
    setPricingRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof ModelPriceRow, value: any) => {
    setPricingRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSelectUnpriced = (modelName: string) => {
    handleAddPricingRow(modelName);
    setUnpricedModels((prev) => prev.filter((m) => m !== modelName));
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPricingSaving(true);
    setPricingMessage(null);

    try {
      const modelsMap: Record<string, { input_per_1m: number; output_per_1m: number }> = {};
      for (const row of pricingRows) {
        const trimmed = row.model.trim();
        if (trimmed) {
          modelsMap[trimmed] = {
            input_per_1m: Number(row.input_per_1m) || 0,
            output_per_1m: Number(row.output_per_1m) || 0,
          };
        }
      }

      const payload = {
        usd_vnd_rate: Number(usdVndRate) || 26000,
        models: modelsMap,
      };

      const res = await fetch("/api/admin/settings/ai-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể lưu bảng giá AI.");
      }

      setPricingMessage({
        type: "success",
        text: "Đã cập nhật thành công bảng giá model AI và tỷ giá USD→VND!",
      });
      await loadPricing();
    } catch (err: any) {
      setPricingMessage({
        type: "error",
        text: err.message || "Đã xảy ra lỗi khi lưu bảng giá.",
      });
    } finally {
      setIsPricingSaving(false);
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
            onClick={() => {
              loadConfig();
              loadPricing();
            }}
            disabled={isLoading || isPricingLoading}
            className="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isPricingLoading ? "animate-spin" : ""}`} />
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

        {/* Khối Bảng Giá Model AI & Tỷ Giá */}
        <div className="bg-white border border-line rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-4">
            <div>
              <h2 className="text-lg font-bold text-brand-600 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-brand-600" />
                <span>Bảng giá model AI & Tỷ giá</span>
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Cấu hình đơn giá token tính bằng USD / 1M token và tỷ giá USD→VND dùng để tính chi phí AI trong hệ thống.
              </p>
            </div>
          </div>

          {pricingMessage && (
            <div
              className={`p-4 rounded-xl border flex items-center space-x-3 shadow-xs animate-in fade-in ${
                pricingMessage.type === "success"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-rose-50 border-rose-300 text-rose-900"
              }`}
            >
              {pricingMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div className="text-xs font-semibold">{pricingMessage.text}</div>
            </div>
          )}

          <form onSubmit={handleSavePricing} className="space-y-6">
            {/* Tỷ giá USD -> VND */}
            <div className="max-w-xs space-y-1.5">
              <label className="block text-xs font-bold text-ink">
                Tỷ giá USD→VND:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={usdVndRate}
                  onChange={(e) => setUsdVndRate(Number(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-line bg-surface-alt text-xs font-semibold focus:outline-none focus:border-brand-600"
                  placeholder="26000"
                  required
                />
                <span className="text-xs font-bold text-ink-muted shrink-0">VND / USD</span>
              </div>
            </div>

            {/* Gợi ý model chưa có giá */}
            {unpricedModels.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Tag className="w-4 h-4 text-amber-700" />
                  <span>Model đã gọi trong log nhưng chưa có giá (bấm để thêm vào bảng):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unpricedModels.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => handleSelectUnpriced(m)}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-400 rounded-lg text-xs font-semibold text-amber-900 transition cursor-pointer"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bảng model */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-brand-800 tracking-wider">
                  Danh sách giá theo model
                </span>
                <button
                  type="button"
                  onClick={() => handleAddPricingRow("")}
                  className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm dòng model</span>
                </button>
              </div>

              {pricingRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-ink-muted border border-dashed border-line rounded-xl bg-surface-alt">
                  Chưa có model nào trong bảng giá. Hãy bấm nút &quot;Thêm dòng model&quot; để thiết lập.
                </div>
              ) : (
                <div className="overflow-x-auto border border-line rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-alt border-b border-line text-ink font-bold">
                      <tr>
                        <th className="p-3">Tên model</th>
                        <th className="p-3">Giá Input / 1M token (USD)</th>
                        <th className="p-3">Giá Output / 1M token (USD)</th>
                        <th className="p-3 w-16 text-center">Xoá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {pricingRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-alt/50">
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={row.model}
                              onChange={(e) => handleRowChange(idx, "model", e.target.value)}
                              placeholder="VD: gemini-2.5-flash"
                              className="w-full p-2 rounded-lg border border-line bg-white text-xs font-semibold focus:outline-none focus:border-brand-600"
                              required
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max="10000"
                              value={row.input_per_1m}
                              onChange={(e) =>
                                handleRowChange(idx, "input_per_1m", parseFloat(e.target.value) || 0)
                              }
                              className="w-full p-2 rounded-lg border border-line bg-white text-xs font-semibold focus:outline-none focus:border-brand-600"
                              required
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max="10000"
                              value={row.output_per_1m}
                              onChange={(e) =>
                                handleRowChange(idx, "output_per_1m", parseFloat(e.target.value) || 0)
                              }
                              className="w-full p-2 rounded-lg border border-line bg-white text-xs font-semibold focus:outline-none focus:border-brand-600"
                              required
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemovePricingRow(idx)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xoá dòng"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Nút lưu bảng giá */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isPricingSaving}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPricingSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Save className="w-4 h-4 text-white" />
                )}
                <span>Lưu Bảng Giá Model AI</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
