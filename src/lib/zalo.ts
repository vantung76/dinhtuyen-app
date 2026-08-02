import { addMonths, formatDate, formatNumber } from "./format";

/** Chuẩn hoá số điện thoại Việt Nam về dạng 84xxxxxxxxx cho link Zalo */
export function normalizeVnPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^0-9+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("84")) return p;
  if (p.startsWith("0")) return `84${p.slice(1)}`;
  if (p.length >= 9) return `84${p}`;
  return null;
}

export function zaloLink(phone: string | null | undefined): string | null {
  const p = normalizeVnPhone(phone);
  return p ? `https://zalo.me/${p}` : null;
}

/** Ngày đến hạn đóng tiền kỳ tiếp theo */
export function nextDueDate(
  startDate: string,
  paymentsCount: number,
  months: number,
): string {
  const period = Math.min(paymentsCount + 1, Math.max(months, 1));
  return addMonths(startDate, period);
}

export type ReminderInput = {
  customerName: string;
  machineBrand?: string | null;
  machineName?: string | null;
  serialNumber?: string | null;
  dueDate: string;
  monthlyAmount: number | string;
};

export function buildReminderMessage(input: ReminderInput): string {
  const brand = input.machineBrand || input.machineName || "máy photocopy";
  const serial = input.serialNumber || "(chưa cập nhật)";
  return `Kính gửi quý khách hàng ${input.customerName}, công ty Định Tuyến xin thông báo: Hợp đồng trả góp máy photocopy ${brand} - Số seri: ${serial} của quý khách sẽ đến hạn thanh toán kỳ tiếp theo vào ngày ${formatDate(
    input.dueDate,
  )}. Số tiền cần thanh toán là: ${formatNumber(input.monthlyAmount)}đ. Quý khách vui lòng thanh toán vào tài khoản:

Chủ TK : Công Ty TNHH TM DV SX TIN HỌC & ĐIỆN TỬ ĐỊNH TUYẾN

Số TK : 11420177402010

Ngân Hàng Techcombank – Chi Nhánh Chợ Lớn

Hoặc nhân viên Định Tuyến sẽ qua thu nhé. Xin cảm ơn quý khách!`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
