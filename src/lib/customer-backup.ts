import { supabase } from "@/integrations/supabase/client";
import {
  CONTRACT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_TYPE_LABEL,
  formatDate,
} from "@/lib/format";
import { computeWarranty } from "@/lib/warranty";
import { nextDueDate } from "@/lib/zalo";
import { exportExcel, fileDateSuffix } from "@/lib/excel-export";
import type { ContractSummary, Customer, Machine, Payment } from "@/lib/types";

/** Bỏ dấu tiếng Việt + ký tự đặc biệt để đặt tên file. */
function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "Khach_Hang"
  );
}

/**
 * Xuất toàn bộ dữ liệu của MỘT khách hàng ra 1 file Excel nhiều sheet:
 * Hồ sơ · Hợp đồng · Lịch sử thanh toán · Máy và bảo hành.
 */
export async function exportCustomerBackup(customer: Customer): Promise<number> {
  const contractsRes = await supabase
    .from("contract_summaries")
    .select("*")
    .eq("customer_id", customer.id)
    .order("created_at");
  if (contractsRes.error) throw new Error(contractsRes.error.message);
  const contracts = (contractsRes.data ?? []) as unknown as ContractSummary[];

  const contractIds = contracts.map((c) => c.id);
  const machineIds = [...new Set(contracts.map((c) => c.machine_id))];

  const [paymentsRes, machinesRes] = await Promise.all([
    contractIds.length
      ? supabase.from("payments").select("*").in("contract_id", contractIds).order("paid_at")
      : Promise.resolve({ data: [], error: null }),
    machineIds.length
      ? supabase.from("machines").select("*").in("id", machineIds).order("created_at")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (machinesRes.error) throw new Error(machinesRes.error.message);

  const payments = (paymentsRes.data ?? []) as unknown as Payment[];
  const machines = (machinesRes.data ?? []) as unknown as Machine[];
  const contractById = new Map(contracts.map((c) => [c.id, c]));

  const isOutright = (customer.payment_type ?? "tra_gop") === "tra_thang";

  const totalValue = contracts.reduce((s, c) => s + Number(c.total_value), 0);
  const totalPaid = contracts.reduce((s, c) => s + Number(c.total_paid), 0);
  const totalRemaining = contracts.reduce((s, c) => s + Number(c.remaining), 0);

  type KV = { k: string; v: string | number };
  const infoRows: KV[] = [
    { k: "Mã khách hàng", v: customer.code },
    { k: "Họ tên", v: customer.name },
    { k: "Nhóm khách", v: PAYMENT_TYPE_LABEL[customer.payment_type ?? "tra_gop"] ?? "" },
    { k: "Điện thoại", v: customer.phone ?? "" },
    { k: "Email", v: customer.email ?? "" },
    { k: "Địa chỉ", v: customer.address ?? "" },
    { k: "Ghi chú", v: customer.note ?? "" },
    { k: "Ngày tạo hồ sơ", v: formatDate(customer.created_at) },
    { k: "Số hợp đồng", v: contracts.length },
    { k: "Số máy", v: machines.length },
    { k: "Số phiếu thu", v: payments.length },
  ];
  if (!isOutright) {
    infoRows.push(
      { k: "Tổng giá trị máy", v: totalValue },
      { k: "Đã thanh toán", v: totalPaid },
      { k: "Còn nợ", v: totalRemaining },
    );
  }
  infoRows.push({ k: "Thời điểm xuất dữ liệu", v: new Date().toLocaleString("vi-VN") });

  const contractColumns = [
    { header: "Mã hợp đồng", value: (c: ContractSummary) => c.code },
    { header: "Mã máy", value: (c: ContractSummary) => c.machine_code },
    { header: "Máy photocopy", value: (c: ContractSummary) => c.machine_name },
    {
      header: "Hình thức",
      value: (c: ContractSummary) => PAYMENT_TYPE_LABEL[c.payment_type ?? "tra_gop"] ?? "",
    },
    { header: "Tổng giá trị máy", value: (c: ContractSummary) => Number(c.total_value) },
    { header: "Ngày bắt đầu", value: (c: ContractSummary) => formatDate(c.start_date) },
    { header: "Ngày kết thúc", value: (c: ContractSummary) => formatDate(c.end_date) },
    {
      header: "Trạng thái",
      value: (c: ContractSummary) => CONTRACT_STATUS_LABEL[c.status] ?? c.status,
    },
    { header: "Ghi chú", value: (c: ContractSummary) => c.note ?? "" },
  ];

  const installmentColumns = [
    { header: "Trả trước", value: (c: ContractSummary) => Number(c.down_payment) },
    { header: "Số tháng", value: (c: ContractSummary) => Number(c.months) },
    { header: "Lãi suất/tháng (%)", value: (c: ContractSummary) => Number(c.interest_rate) },
    { header: "Phải đóng mỗi tháng", value: (c: ContractSummary) => Number(c.monthly_payment) },
    { header: "Đã thanh toán", value: (c: ContractSummary) => Number(c.total_paid) },
    { header: "Còn nợ", value: (c: ContractSummary) => Number(c.remaining) },
    { header: "Số kỳ đã đóng", value: (c: ContractSummary) => Number(c.payments_count) },
    {
      header: "Hạn đóng kỳ tới",
      value: (c: ContractSummary) =>
        Number(c.remaining) > 0
          ? formatDate(nextDueDate(c.start_date, c.payments_count, c.months))
          : "",
    },
  ];

  const sheets = [
    {
      name: "Hồ sơ khách hàng",
      rows: infoRows,
      columns: [
        { header: "Mục", value: (r: KV) => r.k },
        { header: "Giá trị", value: (r: KV) => r.v },
      ],
    },
    {
      name: "Hợp đồng",
      rows: contracts,
      columns: isOutright
        ? contractColumns
        : [...contractColumns.slice(0, 5), ...installmentColumns, ...contractColumns.slice(5)],
    },
    {
      name: "Máy và bảo hành",
      rows: machines,
      columns: [
        { header: "Mã máy", value: (m: Machine) => m.code },
        { header: "Tên máy", value: (m: Machine) => m.name },
        { header: "Hãng", value: (m: Machine) => m.brand ?? "" },
        { header: "Số serial", value: (m: Machine) => m.serial_number ?? "" },
        { header: "Giá máy", value: (m: Machine) => Number(m.price) },
        {
          header: "Ngày bắt đầu bảo hành",
          value: (m: Machine) => (m.warranty_start_date ? formatDate(m.warranty_start_date) : ""),
        },
        { header: "Số tháng bảo hành", value: (m: Machine) => Number(m.warranty_months ?? 0) },
        {
          header: "Ngày hết hạn bảo hành",
          value: (m: Machine) => {
            const w = computeWarranty(m);
            return w.endDate ? formatDate(w.endDate) : "";
          },
        },
        { header: "Số bản chụp bảo hành", value: (m: Machine) => Number(m.warranty_copies ?? 0) },
        { header: "Chỉ số đầu", value: (m: Machine) => Number(m.counter_start ?? 0) },
        { header: "Chỉ số hiện tại", value: (m: Machine) => Number(m.counter_current ?? 0) },
        { header: "Bản chụp đã dùng", value: (m: Machine) => computeWarranty(m).copiesUsed },
        { header: "Bản chụp còn lại", value: (m: Machine) => computeWarranty(m).copiesLeft },
        { header: "Trạng thái bảo hành", value: (m: Machine) => computeWarranty(m).label },
        {
          header: "Cập nhật chỉ số",
          value: (m: Machine) => (m.counter_updated_at ? formatDate(m.counter_updated_at) : ""),
        },
        { header: "Ghi chú", value: (m: Machine) => m.note ?? "" },
      ],
    },
  ];

  if (!isOutright) {
    sheets.splice(2, 0, {
      name: "Lịch sử thanh toán",
      rows: payments,
      columns: [
        { header: "Mã phiếu thu", value: (p: Payment) => p.code },
        {
          header: "Mã hợp đồng",
          value: (p: Payment) => contractById.get(p.contract_id)?.code ?? "",
        },
        { header: "Ngày đóng tiền", value: (p: Payment) => formatDate(p.paid_at) },
        { header: "Số tiền đóng", value: (p: Payment) => Number(p.amount) },
        {
          header: "Phương thức",
          value: (p: Payment) => PAYMENT_METHOD_LABEL[p.method] ?? p.method,
        },
        { header: "Nhân viên thu tiền", value: (p: Payment) => p.collector_name ?? "" },
        { header: "Ngày tạo phiếu", value: (p: Payment) => formatDate(p.created_at) },
        { header: "Ghi chú", value: (p: Payment) => p.note ?? "" },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  await exportExcel(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sheets as any,
    `Backup_KH_${slugify(customer.name)}_${customer.code}_${fileDateSuffix()}.xlsx`,
  );

  return contracts.length + payments.length + machines.length + 1;
}
