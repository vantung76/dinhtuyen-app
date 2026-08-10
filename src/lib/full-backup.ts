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

type StaffRow = {
  id: string;
  phone: string | null;
  full_name: string | null;
  created_at: string | null;
  roles: string[];
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

/**
 * Xuất TOÀN BỘ dữ liệu hệ thống ra 1 file Excel nhiều sheet để backup:
 * Khách hàng · Hợp đồng · Lịch sử thanh toán · Máy & bảo hành · Người dùng.
 */
export async function exportFullBackup(): Promise<number> {
  const [customersRes, contractsRes, paymentsRes, machinesRes, profilesRes, rolesRes] =
    await Promise.all([
      supabase.from("customers").select("*").order("created_at"),
      supabase.from("contract_summaries").select("*").order("created_at"),
      supabase.from("payments").select("*").order("paid_at"),
      supabase.from("machines").select("*").order("created_at"),
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

  for (const res of [customersRes, contractsRes, paymentsRes, machinesRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const customers = (customersRes.data ?? []) as unknown as Customer[];
  const contracts = (contractsRes.data ?? []) as unknown as ContractSummary[];
  const payments = (paymentsRes.data ?? []) as unknown as Payment[];
  const machines = (machinesRes.data ?? []) as unknown as Machine[];

  const roleRows = (rolesRes.data ?? []) as { user_id: string; role: string }[];
  const users: StaffRow[] = (
    (profilesRes.data ?? []) as unknown as {
      id: string;
      phone: string | null;
      full_name: string | null;
      created_at: string | null;
    }[]
  ).map((p) => ({
    ...p,
    roles: roleRows.filter((r) => r.user_id === p.id).map((r) => r.role),
  }));

  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const machineById = new Map(machines.map((m) => [m.id, m]));

  await exportExcel(
    [
      {
        name: "Khách hàng",
        rows: customers,
        columns: [
          { header: "Mã khách hàng", value: (c: Customer) => c.code },
          { header: "Họ tên", value: (c: Customer) => c.name },
          {
            header: "Nhóm khách",
            value: (c: Customer) => PAYMENT_TYPE_LABEL[c.payment_type ?? "tra_gop"] ?? "",
          },
          { header: "Điện thoại", value: (c: Customer) => c.phone ?? "" },
          { header: "Email", value: (c: Customer) => c.email ?? "" },
          { header: "Địa chỉ", value: (c: Customer) => c.address ?? "" },
          { header: "Ngày tạo", value: (c: Customer) => formatDate(c.created_at) },
          { header: "Ghi chú", value: (c: Customer) => c.note ?? "" },
        ],
      },
      {
        name: "Hợp đồng",
        rows: contracts,
        columns: [
          { header: "Mã hợp đồng", value: (c: ContractSummary) => c.code },
          { header: "Khách hàng", value: (c: ContractSummary) => c.customer_name },
          { header: "Điện thoại", value: (c: ContractSummary) => c.customer_phone ?? "" },
          {
            header: "Hình thức",
            value: (c: ContractSummary) => PAYMENT_TYPE_LABEL[c.payment_type ?? "tra_gop"] ?? "",
          },
          { header: "Mã máy", value: (c: ContractSummary) => c.machine_code },
          { header: "Máy photocopy", value: (c: ContractSummary) => c.machine_name },
          { header: "Tổng giá trị máy", value: (c: ContractSummary) => Number(c.total_value) },
          { header: "Trả trước", value: (c: ContractSummary) => Number(c.down_payment) },
          { header: "Số tháng", value: (c: ContractSummary) => Number(c.months) },
          { header: "Lãi suất/tháng (%)", value: (c: ContractSummary) => Number(c.interest_rate) },
          {
            header: "Phải đóng mỗi tháng",
            value: (c: ContractSummary) => Number(c.monthly_payment),
          },
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
          { header: "Ngày bắt đầu", value: (c: ContractSummary) => formatDate(c.start_date) },
          { header: "Ngày kết thúc", value: (c: ContractSummary) => formatDate(c.end_date) },
          {
            header: "Trạng thái",
            value: (c: ContractSummary) => CONTRACT_STATUS_LABEL[c.status] ?? c.status,
          },
          { header: "Ghi chú", value: (c: ContractSummary) => c.note ?? "" },
        ],
      },
      {
        name: "Lịch sử thanh toán",
        rows: payments,
        columns: [
          { header: "Mã phiếu thu", value: (p: Payment) => p.code },
          {
            header: "Mã hợp đồng",
            value: (p: Payment) => contractById.get(p.contract_id)?.code ?? "",
          },
          {
            header: "Khách hàng",
            value: (p: Payment) => contractById.get(p.contract_id)?.customer_name ?? "",
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
            header: "Khách đang sử dụng",
            value: (m: Machine) =>
              contracts.find((c) => c.machine_id === m.id)?.customer_name ?? "",
          },
          {
            header: "Ngày bắt đầu bảo hành",
            value: (m: Machine) =>
              m.warranty_start_date ? formatDate(m.warranty_start_date) : "",
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
      {
        name: "Người dùng",
        rows: users,
        columns: [
          { header: "Họ tên", value: (u: StaffRow) => u.full_name ?? "" },
          { header: "Điện thoại", value: (u: StaffRow) => u.phone ?? "" },
          {
            header: "Quyền",
            value: (u: StaffRow) => u.roles.map((r) => ROLE_LABEL[r] ?? r).join(", "),
          },
          { header: "Ngày tạo", value: (u: StaffRow) => formatDate(u.created_at) },
        ],
      },
      {
        name: "Thông tin backup",
        rows: [
          { k: "Thời điểm xuất", v: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" }) },
          { k: "Số khách hàng", v: String(customers.length) },
          { k: "Số hợp đồng", v: String(contracts.length) },
          { k: "Số phiếu thu", v: String(payments.length) },
          { k: "Số máy", v: String(machines.length) },
          { k: "Số tài khoản", v: String(users.length) },
          {
            k: "Cách phục hồi",
            v: "Mở lại từng sheet và nhập lại theo thứ tự: Khách hàng → Máy → Hợp đồng → Lịch sử thanh toán.",
          },
        ],
        columns: [
          { header: "Mục", value: (r: { k: string; v: string }) => r.k },
          { header: "Giá trị", value: (r: { k: string; v: string }) => r.v },
        ],
      },
    ],
    `Backup_Toan_Bo_Du_Lieu_${fileDateSuffix()}.xlsx`,
  );

  return customers.length + contracts.length + payments.length + machines.length + users.length;
}
