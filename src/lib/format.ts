export const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return VND.format(Number.isFinite(n) ? n : 0);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("vi-VN").format(Number.isFinite(n) ? n : 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  dang_tra_gop: "Đang trả góp",
  da_hoan_thanh: "Đã hoàn thành",
  qua_han: "Quá hạn",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  tien_mat: "Tiền mặt",
  chuyen_khoan: "Chuyển khoản",
};

export function addMonths(dateISO: string, months: number): string {
  const d = new Date(dateISO);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

/** Số tiền phải đóng mỗi tháng = (Tổng giá trị - Trả trước)/Số tháng + lãi/tháng */
export function monthlyPayment(
  total: number,
  down: number,
  months: number,
  interestRate = 0,
): number {
  if (!months || months <= 0) return 0;
  const principal = Math.max(total - down, 0);
  return Math.round(principal / months + (principal * interestRate) / 100);
}

export function makeCode(prefix: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  tra_gop: "Trả góp",
  tra_thang: "Trả thẳng (100%)",
};
