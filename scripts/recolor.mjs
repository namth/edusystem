#!/usr/bin/env node
// Đổi mã màu viết cứng (bảng nâu cũ) sang token thương hiệu KitoKit khai báo ở app/globals.css (@theme).
// Chạy lại an toàn (chỉ thay mã hex còn sót). In ra mã hex chưa có trong bảng ánh xạ để xử lý tay.
//   node scripts/recolor.mjs            # ghi file
//   node scripts/recolor.mjs --dry      # chỉ báo cáo
import fs from "fs";
import path from "path";

const ROOTS = ["app", "components"];
const DRY = process.argv.includes("--dry");

// hex (chữ thường) → tên token Tailwind (không có tiền tố utility)
const MAP = {
  "#6d3807": "brand-600", "#8a4f1e": "brand-700", "#85460c": "brand-700",
  "#00236f": "brand-800", "#1e3a8a": "brand-800", "#004d5e": "brand-800",
  "#005049": "brand-900", "#003845": "brand-900", "#003844": "brand-900",
  "#fff1ea": "brand-50", "#f8f9ff": "brand-50", "#f9ebe4": "brand-100", "#ffdcc5": "brand-100",
  "#d3e4fe": "brand-100", "#e5eeff": "brand-100",
  "#fdd1b4": "accent-100", "#ffdbcc": "accent-100", "#ffd426": "accent-400",
  "#211a16": "ink", "#0b1c30": "ink",
  "#52443a": "ink-muted", "#785841": "ink-muted", "#785840": "ink-muted", "#624732": "ink-muted", "#444651": "ink-muted",
  "#857469": "ink-subtle", "#a89588": "ink-subtle", "#a89587": "ink-subtle", "#757682": "ink-subtle",
  "#d8c2b6": "line", "#ede0d9": "line-soft", "#f3e6de": "line-soft", "#f0eae5": "line-soft", "#f0e6e0": "line-soft", "#e4d4cb": "line-soft",
  "#fff8f5": "surface-alt", "#f8f7f6": "surface-alt", "#fffdfc": "surface-alt", "#faf8f6": "surface-alt", "#fffbf9": "surface-alt",
  "#fcfaf9": "surface-alt", "#fcf9f7": "surface-alt", "#faf5f0": "surface-alt", "#fffbff": "surface-alt", "#f8fafc": "surface-alt",
  "#ffffff": "white",
  "#ba1a1a": "red-700", "#ffdad6": "red-100", "#dcfce7": "green-100",
  "#006a61": "emerald-700", "#86f2e4": "teal-200",
};
// Cam nhạt cũ: chữ (thường nằm trên nền tối) → vàng nhấn; viền/nền → xanh nhạt
const PEACH = new Set(["#ffb782", "#ffb783"]);

const RE = /([a-z0-9:-]*?)(-)\[(#[0-9a-fA-F]{3,8})\]/g;
const unknown = new Map();
let changedFiles = 0, replaced = 0;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

for (const file of ROOTS.flatMap((r) => walk(r))) {
  const src = fs.readFileSync(file, "utf8");
  const next = src.replace(RE, (m, prefix, dash, hexRaw) => {
    const hex = hexRaw.toLowerCase();
    let token = MAP[hex];
    if (!token && PEACH.has(hex)) token = /(^|:)text$/.test(prefix) ? "accent-400" : "brand-300";
    if (!token) {
      unknown.set(hex, (unknown.get(hex) || 0) + 1);
      return m;
    }
    replaced++;
    return `${prefix}${dash}${token}`;
  });
  if (next !== src) {
    changedFiles++;
    if (!DRY) fs.writeFileSync(file, next);
  }
}

console.log(`${DRY ? "[dry] " : ""}Đã thay ${replaced} chỗ trong ${changedFiles} file.`);
if (unknown.size) {
  console.log("Mã hex chưa ánh xạ:");
  for (const [hex, n] of [...unknown].sort((a, b) => b[1] - a[1])) console.log(`  ${hex} × ${n}`);
}
