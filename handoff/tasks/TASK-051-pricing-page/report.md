# Báo cáo TASK-051

## Đã làm
- Hoàn thành trang bảng giá công khai `/pricing` (SCR-53, FEAT-015) theo đúng đặc tả:
  - `app/pricing/page.tsx` là Server Component với `dynamic = "force-dynamic"`, đọc đơn giá từ `getSlotPricing()`, hiển thị tiêu đề "Bảng giá KitoKit" và thông điệp giải thích "1 slot = 1 học sinh học 1 tháng trong một lớp."
  - Khi có đơn giá (`unit_price_vnd > 0`): hiển thị thẻ đơn giá định dạng chuẩn vi-VN (ví dụ: `25.000 đ / slot`).
  - Khi chưa cấu hình giá (`unit_price_vnd <= 0`): hiển thị "Liên hệ để nhận báo giá", hotline (link `tel:`) và email liên hệ từ `BRAND`, không hiển thị "0 đ / slot" hay số âm, đồng thời ẩn dòng chi phí ước tính.
  - Xây dựng Client Component `components/pricing/PricingCalculator.tsx` với 2 ô nhập số nguyên cho học sinh (1–1000, mặc định 30) và số tháng (1–24, mặc định 3). Tự động tính số slot cần và chi phí ước tính theo đơn giá; kiểm tra lỗi và hiện thông báo rõ ràng khi nhập ngoài khoảng hoặc không hợp lệ.
  - Hiển thị đầy đủ danh mục "Cách tính ví slot" gồm 6 quy tắc: trừ 1 slot khi học sinh vào lớp, trừ định kỳ hàng tháng theo sĩ số, 7 ngày ân hạn trước khi tạm khoá, không hoàn slot khi xoá học sinh/kết thúc lớp, học 2 lớp tốn 2 slot, và dùng thử miễn phí trong giới hạn (1 lớp, 3 học sinh).
  - Bố trí nút "Đăng ký giáo viên" trỏ tới `/register/teacher` và link phụ "Chính sách thanh toán" tới `/payment-policy`.
  - Bổ sung liên kết điều hướng "Bảng giá" (`/pricing`) vào cả `LandingHeader` và `LandingFooter`, giữ nguyên các liên kết sẵn có.
  - Tuân thủ nghiêm ngặt design system: token màu Tailwind (`brand-*`, `ink`, `line`, `surface`), gradient đồng màu, nhãn nút không có dấu `+` (DEC-035), không gọi API từ client và không hard-code giá.

## File đã tạo/sửa
- `app/pricing/page.tsx`: Mới — Server Component hiển thị trang bảng giá công khai `/pricing`.
- `components/pricing/PricingCalculator.tsx`: Mới — Client Component máy tính chi phí ví slot.
- `components/landing/LandingHeader.tsx`: Sửa — Thêm link "Bảng giá" vào thanh điều hướng header.
- `components/landing/LandingFooter.tsx`: Sửa — Thêm link "Bảng giá" vào mục Khám phá ở footer.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-051-pricing-page/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/agy-worktrees/TASK-051


 ❯ tests/client-bundle-safety.test.ts [queued]

 Test Files 0 passed (4)
      Tests 0 passed (0)
   Start at 13:49:10
   Duration 104ms 

 ❯ tests/client-bundle-safety.test.ts 0/88
 ❯ tests/design-rules.test.ts 0/5
 ❯ tests/docs-sync.test.ts 0/11
 ❯ tests/pricing-page.test.ts 0/29

 Test Files 0 passed (4)
      Tests 0 passed (133)
   Start at 13:49:10
   Duration 209ms 
 ✓ tests/docs-sync.test.ts (11 tests) 51ms
 ✓ tests/design-rules.test.ts (5 tests) 75ms
 ✓ tests/client-bundle-safety.test.ts (88 tests) 79ms


 ❯ tests/pricing-page.test.ts 1/29

 Test Files 3 passed (4)
      Tests 105 passed (133)
   Start at 13:49:10
   Duration 309ms 


 ❯ tests/pricing-page.test.ts 8/29

 Test Files 3 passed (4)
      Tests 112 passed (133)
   Start at 13:49:10
   Duration 511ms 
 ✓ tests/pricing-page.test.ts (29 tests) 291ms

 Test Files  4 passed (4)
      Tests  133 passed (133)
   Start at  13:49:10
   Duration  624ms (transform 192ms, setup 0ms, collect 264ms, tests 496ms, environment 0ms, prepare 241ms)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
