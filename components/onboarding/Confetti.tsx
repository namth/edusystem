"use client";

import { useEffect } from "react";

// Pháo giấy ăn mừng (canvas-confetti): hai ống bắn từ hai góc dưới vọt lên rồi rơi xuống,
// thêm một loạt giữa màn. Màu lấy từ token thương hiệu; tự tắt khi người dùng bật giảm chuyển động.
const TOKENS = ["--color-brand-600", "--color-brand-400", "--color-accent-500", "--color-accent-300", "--color-emerald-400"];

export default function Confetti() {
  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    // Canvas riêng (không dùng canvas toàn cục chạy worker của thư viện — lỗi khi effect chạy hai lần ở dev)
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "60",
    });
    document.body.appendChild(canvas);

    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      const fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
      const style = getComputedStyle(document.documentElement);
      const colors = TOKENS.map((t) => style.getPropertyValue(t).trim()).filter(Boolean);
      const base = {
        colors: colors.length ? colors : undefined,
        ticks: 320,
        gravity: 0.9,
        scalar: 1.1,
      };

      // 3 đợt bắn từ hai góc dưới, chếch lên giữa màn
      [0, 350, 700].forEach((delay) => {
        timers.push(
          window.setTimeout(() => {
            fire({ ...base, particleCount: 70, angle: 60, spread: 55, startVelocity: 70, origin: { x: 0, y: 1 } });
            fire({ ...base, particleCount: 70, angle: 120, spread: 55, startVelocity: 70, origin: { x: 1, y: 1 } });
          }, delay)
        );
      });
      // Một loạt bung từ giữa phía dưới
      timers.push(
        window.setTimeout(() => {
          fire({ ...base, particleCount: 120, angle: 90, spread: 100, startVelocity: 60, origin: { x: 0.5, y: 1 } });
        }, 200)
      );
      // Gỡ canvas khi giấy đã rơi hết
      timers.push(window.setTimeout(() => fire.reset(), 9000));
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      canvas.remove();
    };
  }, []);

  return null;
}
