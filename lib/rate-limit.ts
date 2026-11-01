/**
 * Bộ đếm giới hạn số lần thử theo cửa sổ trượt (sliding window) lưu trong bộ nhớ tiến trình.
 * Ghi chú triển khai: Phù hợp với mô hình triển khai một container web hiện tại.
 * Sử dụng Date.now() để tương thích với fake timers khi kiểm thử.
 */

const buckets = new Map<string, number[]>();

function cleanupExpiredKeys(now: number, windowMs: number): void {
  for (const [key, timestamps] of buckets.entries()) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      buckets.delete(key);
    } else if (valid.length !== timestamps.length) {
      buckets.set(key, valid);
    }
  }
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  cleanupExpiredKeys(now, windowMs);

  const timestamps = buckets.get(key) || [];
  if (timestamps.length >= maxAttempts) {
    const oldest = timestamps[0];
    const remainingMs = Math.max(1000, windowMs - (now - oldest));
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordRateLimitHit(key: string, windowMs: number): void {
  const now = Date.now();
  const timestamps = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  buckets.set(key, timestamps);
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
