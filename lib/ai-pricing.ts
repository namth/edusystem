export interface ModelPrice {
  input_per_1m: number;
  output_per_1m: number;
} // USD / 1 triệu token

export interface AiPricing {
  usd_vnd_rate: number;
  models: Record<string, ModelPrice>;
}

export const DEFAULT_AI_PRICING: AiPricing = {
  usd_vnd_rate: 26000,
  models: {},
};

export function findModelPrice(model: string, p: AiPricing): ModelPrice | null {
  if (!model || typeof model !== "string" || !p || !p.models || typeof p.models !== "object") {
    return null;
  }
  const trimmed = model.trim();
  if (!trimmed) return null;

  // 1. Khớp chính xác
  if (Object.prototype.hasOwnProperty.call(p.models, trimmed)) {
    return p.models[trimmed];
  }

  // 2. Phần sau "/" cuối (khớp chính xác)
  const slashIdx = trimmed.lastIndexOf("/");
  const afterSlash = slashIdx >= 0 ? trimmed.slice(slashIdx + 1) : trimmed;
  if (afterSlash && Object.prototype.hasOwnProperty.call(p.models, afterSlash)) {
    return p.models[afterSlash];
  }

  // 3. Không phân biệt hoa thường (thử cả chuỗi gốc và phần sau "/")
  const lowerFull = trimmed.toLowerCase();
  const lowerAfterSlash = afterSlash.toLowerCase();
  for (const [key, val] of Object.entries(p.models)) {
    const lk = key.toLowerCase();
    if (lk === lowerFull || (lowerAfterSlash && lk === lowerAfterSlash)) {
      return val;
    }
  }

  return null;
}

export function costUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
  p: AiPricing
): number {
  const price = findModelPrice(model, p);
  if (!price) return 0;

  const inTok = typeof promptTokens === "number" && Number.isFinite(promptTokens) && promptTokens > 0 ? promptTokens : 0;
  const outTok = typeof completionTokens === "number" && Number.isFinite(completionTokens) && completionTokens > 0 ? completionTokens : 0;
  const inRate = typeof price.input_per_1m === "number" && Number.isFinite(price.input_per_1m) && price.input_per_1m > 0 ? price.input_per_1m : 0;
  const outRate = typeof price.output_per_1m === "number" && Number.isFinite(price.output_per_1m) && price.output_per_1m > 0 ? price.output_per_1m : 0;

  return (inTok * inRate + outTok * outRate) / 1_000_000;
}

export function usdToVnd(usd: number, rate: number): number {
  const safeUsd = typeof usd === "number" && Number.isFinite(usd) ? usd : 0;
  const safeRate = typeof rate === "number" && Number.isFinite(rate) ? rate : 0;
  return Math.round(safeUsd * safeRate);
}

export function validateAiPricing(
  x: unknown
): { ok: true; value: AiPricing } | { ok: false; error: string } {
  if (!x || typeof x !== "object" || Array.isArray(x)) {
    return { ok: false, error: "Dữ liệu bảng giá AI không hợp lệ." };
  }

  const obj = x as Record<string, unknown>;
  const rate = obj.usd_vnd_rate;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) {
    return { ok: false, error: "Tỷ giá USD→VND phải là số lớn hơn 0 và không vượt quá 1.000.000." };
  }

  const models = obj.models;
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    return { ok: false, error: "Danh sách bảng giá model phải là một đối tượng hợp lệ." };
  }

  const entries = Object.entries(models as Record<string, unknown>);
  if (entries.length > 100) {
    return { ok: false, error: "Bảng giá chỉ cho phép tối đa 100 model." };
  }

  const cleanModels: Record<string, ModelPrice> = {};
  for (const [rawKey, rawVal] of entries) {
    const key = rawKey.trim();
    if (!key || key.length > 100) {
      return { ok: false, error: "Tên model không được để trống và tối đa 100 ký tự." };
    }
    if (!rawVal || typeof rawVal !== "object" || Array.isArray(rawVal)) {
      return { ok: false, error: `Cấu hình giá của model "${key}" không hợp lệ.` };
    }
    const priceObj = rawVal as Record<string, unknown>;
    const inPrice = priceObj.input_per_1m;
    const outPrice = priceObj.output_per_1m;

    if (
      typeof inPrice !== "number" ||
      !Number.isFinite(inPrice) ||
      inPrice < 0 ||
      inPrice > 10_000
    ) {
      return {
        ok: false,
        error: `Giá input của model "${key}" phải là số từ 0 đến 10.000 USD / 1M token.`,
      };
    }

    if (
      typeof outPrice !== "number" ||
      !Number.isFinite(outPrice) ||
      outPrice < 0 ||
      outPrice > 10_000
    ) {
      return {
        ok: false,
        error: `Giá output của model "${key}" phải là số từ 0 đến 10.000 USD / 1M token.`,
      };
    }

    cleanModels[key] = {
      input_per_1m: inPrice,
      output_per_1m: outPrice,
    };
  }

  return {
    ok: true,
    value: {
      usd_vnd_rate: rate,
      models: cleanModels,
    },
  };
}
