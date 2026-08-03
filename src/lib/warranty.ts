import { addMonths } from "./format";

export type WarrantyState = "con_bao_hanh" | "het_thoi_gian" | "het_ban_chup" | "chua_kich_hoat";

export type WarrantyInput = {
  warranty_start_date: string | null;
  warranty_months: number | null;
  warranty_copies: number | null;
  counter_start: number | null;
  counter_current: number | null;
};

export type WarrantyInfo = {
  state: WarrantyState;
  label: string;
  /** Tailwind classes cho nhãn trạng thái */
  className: string;
  endDate: string | null;
  copyLimit: number;
  copiesLeft: number;
  copiesUsed: number;
};

export function computeWarranty(m: WarrantyInput, now: Date = new Date()): WarrantyInfo {
  const months = Number(m.warranty_months ?? 0);
  const copies = Number(m.warranty_copies ?? 0);
  const start = Number(m.counter_start ?? 0);
  const current = Number(m.counter_current ?? 0);
  const copyLimit = start + copies;
  const copiesLeft = Math.max(0, copyLimit - current);
  const copiesUsed = Math.max(0, current - start);
  const endDate = m.warranty_start_date ? addMonths(m.warranty_start_date, months) : null;

  const base = { endDate, copyLimit, copiesLeft, copiesUsed };

  if (!m.warranty_start_date) {
    return {
      ...base,
      state: "chua_kich_hoat",
      label: "Chưa kích hoạt bảo hành",
      className: "border-transparent bg-muted text-muted-foreground",
    };
  }

  const expired = endDate ? new Date(`${endDate}T23:59:59`) < now : false;
  if (expired) {
    return {
      ...base,
      state: "het_thoi_gian",
      label: "Hết bảo hành (Quá thời gian)",
      className: "border-transparent bg-destructive text-destructive-foreground",
    };
  }

  if (copies > 0 && current >= copyLimit) {
    return {
      ...base,
      state: "het_ban_chup",
      label: "Hết bảo hành (Quá số bản chụp)",
      className: "border-transparent bg-warning text-warning-foreground",
    };
  }

  return {
    ...base,
    state: "con_bao_hanh",
    label: "Còn bảo hành",
    className: "border-transparent bg-success text-success-foreground",
  };
}
