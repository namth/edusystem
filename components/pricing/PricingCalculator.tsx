"use client";

import { useState } from "react";
import { Users, Calendar, Calculator, AlertCircle, Coins } from "lucide-react";

export interface PricingCalculatorProps {
  unitPriceVnd?: number;
  unit_price_vnd?: number;
}

export default function PricingCalculator({
  unitPriceVnd,
  unit_price_vnd,
}: PricingCalculatorProps) {
  const [students, setStudents] = useState<number | string>(30);
  const [months, setMonths] = useState<number | string>(3);

  const priceCandidate = unitPriceVnd ?? unit_price_vnd ?? 0;
  const effectiveUnitPrice = priceCandidate > 0 ? priceCandidate : 0;

  const studentNum =
    typeof students === "number"
      ? students
      : typeof students === "string" && students.trim() !== ""
        ? Number(students)
        : NaN;

  const monthNum =
    typeof months === "number"
      ? months
      : typeof months === "string" && months.trim() !== ""
        ? Number(months)
        : NaN;

  const isStudentValid =
    !Number.isNaN(studentNum) &&
    Number.isInteger(studentNum) &&
    studentNum >= 1 &&
    studentNum <= 1000;

  const isMonthValid =
    !Number.isNaN(monthNum) &&
    Number.isInteger(monthNum) &&
    monthNum >= 1 &&
    monthNum <= 24;

  const studentError = !isStudentValid
    ? "Số học sinh phải là số nguyên từ 1 đến 1000"
    : null;

  const monthError = !isMonthValid
    ? "Số tháng phải là số nguyên từ 1 đến 24"
    : null;

  const isValid = isStudentValid && isMonthValid;
  const totalSlots = isValid ? studentNum * monthNum : 0;
  const totalCost = isValid && effectiveUnitPrice > 0 ? totalSlots * effectiveUnitPrice : 0;

  return (
    <div className="rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-xs">
      <div className="flex items-center gap-3 border-b border-line pb-5 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Calculator className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-ink">Máy tính chi phí ví slot</h3>
          <p className="text-xs text-ink-muted">
            Ước tính số slot và chi phí theo quy mô lớp học thực tế
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="pricing-students"
            className="flex items-center gap-2 text-sm font-semibold text-ink mb-2"
          >
            <Users className="w-4 h-4 text-brand-600" />
            <span>Số học sinh</span>
          </label>
          <input
            type="number"
            id="pricing-students"
            name="students"
            min={1}
            max={1000}
            value={Number.isNaN(studentNum) ? "" : students}
            onChange={(e) => {
              const val = e.target.value;
              setStudents(val === "" ? "" : Number(val));
            }}
            placeholder="Ví dụ: 30"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${
              studentError
                ? "border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-200"
                : "border-line bg-surface text-ink focus:border-brand-500 focus:ring-brand-100"
            }`}
          />
          {studentError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{studentError}</span>
            </p>
          )}
          <p className="mt-1 text-[11px] text-ink-muted">
            Nhập số nguyên từ 1 đến 1000 học sinh trong lớp
          </p>
        </div>

        <div>
          <label
            htmlFor="pricing-months"
            className="flex items-center gap-2 text-sm font-semibold text-ink mb-2"
          >
            <Calendar className="w-4 h-4 text-brand-600" />
            <span>Số tháng</span>
          </label>
          <input
            type="number"
            id="pricing-months"
            name="months"
            min={1}
            max={24}
            value={Number.isNaN(monthNum) ? "" : months}
            onChange={(e) => {
              const val = e.target.value;
              setMonths(val === "" ? "" : Number(val));
            }}
            placeholder="Ví dụ: 3"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 ${
              monthError
                ? "border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-200"
                : "border-line bg-surface text-ink focus:border-brand-500 focus:ring-brand-100"
            }`}
          />
          {monthError && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{monthError}</span>
            </p>
          )}
          <p className="mt-1 text-[11px] text-ink-muted">
            Thời lượng khóa học từ 1 đến 24 tháng
          </p>
        </div>
      </div>

      {isValid && (
        <div className="mt-8 rounded-2xl bg-surface border border-line p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-line">
            <div className="sm:pr-4 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-brand-600" />
                <span>Số slot cần</span>
              </div>
              <div className="text-2xl font-black text-ink">
                {totalSlots.toLocaleString("vi-VN")} slot
              </div>
              <p className="text-xs text-ink-muted">
                Công thức: {studentNum} học sinh × {monthNum} tháng
              </p>
            </div>

            {effectiveUnitPrice > 0 && (
              <div className="pt-4 sm:pt-0 sm:pl-4 space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Chi phí ước tính
                </div>
                <div className="text-2xl font-black text-brand-600">
                  {totalCost.toLocaleString("vi-VN")} đ
                </div>
                <p className="text-xs text-ink-muted">
                  Đã bao gồm đầy đủ tính năng tạo đề, bài học và AI đồng hành
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
