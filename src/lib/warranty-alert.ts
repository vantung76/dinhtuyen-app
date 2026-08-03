import { formatDate, formatNumber } from "./format";
import { computeWarranty, type WarrantyInfo } from "./warranty";
import type { Machine } from "./types";

export const DAYS_THRESHOLD = 30;
export const COPIES_THRESHOLD = 5000;

export type MachineWithCustomer = Machine & {
  customer_name: string | null;
  customer_phone: string | null;
};

export type WarrantyAlert = {
  machine: MachineWithCustomer;
  info: WarrantyInfo;
  daysLeft: number | null;
  copiesLeft: number;
  /** true khi lý do chính là sắp hết bản chụp */
  byCopies: boolean;
  reason: string;
};

export function daysUntil(dateISO: string | null, now: Date = new Date()): number | null {
  if (!dateISO) return null;
  const end = new Date(`${dateISO}T23:59:59`).getTime();
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

/** Máy "sắp hết hạn": còn ≤ 30 ngày HOẶC còn ≤ 5.000 bản chụp (và chưa hết hạn hẳn) */
export function buildWarrantyAlerts(
  machines: MachineWithCustomer[],
  now: Date = new Date(),
): WarrantyAlert[] {
  const alerts: WarrantyAlert[] = [];

  for (const machine of machines) {
    if (!machine.warranty_start_date) continue;
    const info = computeWarranty(machine, now);
    if (info.state === "chua_kich_hoat") continue;

    const daysLeft = daysUntil(info.endDate, now);
    const copiesLeft = info.copiesLeft;
    const hasCopyLimit = Number(machine.warranty_copies ?? 0) > 0;

    const timeAlert = daysLeft !== null && daysLeft <= DAYS_THRESHOLD;
    const copyAlert = hasCopyLimit && copiesLeft <= COPIES_THRESHOLD;
    if (!timeAlert && !copyAlert) continue;

    // Lý do nào chạm hạn trước thì hiển thị trước
    const timeRatio = timeAlert && daysLeft !== null ? daysLeft / DAYS_THRESHOLD : Infinity;
    const copyRatio = copyAlert ? copiesLeft / COPIES_THRESHOLD : Infinity;
    const byCopies = copyRatio < timeRatio;

    let reason: string;
    if (info.state === "het_thoi_gian") reason = "Đã hết hạn bảo hành";
    else if (info.state === "het_ban_chup") reason = "Đã vượt số bản chụp bảo hành";
    else if (byCopies) reason = `Còn ${formatNumber(copiesLeft)} bản chụp`;
    else reason = `Còn ${daysLeft} ngày`;

    alerts.push({ machine, info, daysLeft, copiesLeft, byCopies, reason });
  }

  return alerts.sort((a, b) => {
    const ka = a.byCopies ? a.copiesLeft / COPIES_THRESHOLD : (a.daysLeft ?? 0) / DAYS_THRESHOLD;
    const kb = b.byCopies ? b.copiesLeft / COPIES_THRESHOLD : (b.daysLeft ?? 0) / DAYS_THRESHOLD;
    return ka - kb;
  });
}

export function buildRenewalMessage(alert: WarrantyAlert): string {
  const m = alert.machine;
  const name = m.customer_name || "quý khách";
  const model = [m.brand, m.name].filter(Boolean).join(" ") || "máy photocopy";
  const serial = m.serial_number || "(chưa cập nhật)";
  const expiry = alert.info.endDate ? formatDate(alert.info.endDate) : "sắp tới";
  const copyLine = `Số bản chụp bảo hành còn lại: ${formatNumber(alert.copiesLeft)} bản.`;

  return `Kính gửi quý khách hàng ${name}, công ty Định Tuyến xin thông báo: máy photocopy ${model} - Số seri: ${serial} của quý khách sắp hết hạn bảo hành vào ngày ${expiry}. ${copyLine}

Xin vui lòng liên hệ công ty Định Tuyến để làm thủ tục gia hạn hợp đồng bảo trì, giúp máy luôn hoạt động ổn định và được hỗ trợ kỹ thuật kịp thời.

Trân trọng cảm ơn quý khách!`;
}
