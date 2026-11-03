// lib/vietqr-banks.ts — Danh sách ngân hàng VietQR theo chuẩn NAPAS (FEAT-013 §3.1)
// Thuần TypeScript, dùng được ở cả client và server.

export interface VietQrBank {
  bin: string;
  short_name: string;
  name: string;
}

export const VIETQR_BANKS: VietQrBank[] = [
  { bin: "970436", short_name: "Vietcombank", name: "Ngân hàng TMCP Ngoại thương Việt Nam" },
  { bin: "970415", short_name: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam" },
  { bin: "970418", short_name: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { bin: "970405", short_name: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
  { bin: "970422", short_name: "MB", name: "Ngân hàng TMCP Quân đội" },
  { bin: "970407", short_name: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam" },
  { bin: "970416", short_name: "ACB", name: "Ngân hàng TMCP Á Châu" },
  { bin: "970432", short_name: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { bin: "970423", short_name: "TPBank", name: "Ngân hàng TMCP Tiên Phong" },
  { bin: "970403", short_name: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín" },
  { bin: "970437", short_name: "HDBank", name: "Ngân hàng TMCP Phát triển TP.HCM" },
  { bin: "970441", short_name: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { bin: "970443", short_name: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { bin: "970431", short_name: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { bin: "970426", short_name: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam" },
  { bin: "970448", short_name: "OCB", name: "Ngân hàng TMCP Phương Đông" },
  { bin: "970440", short_name: "SeABank", name: "Ngân hàng TMCP Đông Nam Á" },
  { bin: "970449", short_name: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam" },
  { bin: "970428", short_name: "Nam A Bank", name: "Ngân hàng TMCP Nam Á" },
  { bin: "970409", short_name: "Bac A Bank", name: "Ngân hàng TMCP Bắc Á" },
];

export function findBankByBin(bin: string): VietQrBank | null {
  if (!bin) return null;
  return VIETQR_BANKS.find((b) => b.bin === bin) || null;
}
