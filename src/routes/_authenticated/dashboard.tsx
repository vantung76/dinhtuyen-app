import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CONTRACT_STATUS_LABEL,
  formatDate,
  formatMoney,
  PAYMENT_TYPE_LABEL,
} from "@/lib/format";
import { computeWarranty } from "@/lib/warranty";
import { exportExcel, fileDateSuffix } from "@/lib/excel-export";
import { ExcelExportButton } from "@/components/ExcelExportButton";
import type { ContractStatus, ContractSummary, Machine } from "@/lib/types";

import { ContractFormDialog } from "@/components/ContractFormDialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import { ZaloReminderButton } from "@/components/ZaloReminderButton";
import { WarrantyAlertTable, useWarrantyAlerts } from "@/components/WarrantyAlerts";
import { nextDueDate } from "@/lib/zalo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Hợp đồng trả góp | Quản lý máy photocopy" },
      {
        name: "description",
        content:
          "Danh sách hợp đồng trả góp máy photocopy kèm số tiền đóng mỗi tháng, đã thanh toán và công nợ còn lại.",
      },
      { property: "og:title", content: "Hợp đồng trả góp máy photocopy" },
      {
        property: "og:description",
        content: "Theo dõi kỳ thu tiền và công nợ của toàn bộ hợp đồng trả góp.",
      },
    ],
  }),
  component: DashboardPage,
});

function statusVariant(status: ContractStatus) {
  if (status === "da_hoan_thanh") return "bg-success/15 text-success border-success/30";
  if (status === "qua_han") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-primary/10 text-primary border-primary/25";
}

/** Hợp đồng quá hạn hoặc sắp đến hạn trong 10 ngày tới */
function isDueSoon(c: ContractSummary) {
  if (c.status === "qua_han") return true;
  const due = new Date(nextDueDate(c.start_date, c.payments_count, c.months));
  const diff = (due.getTime() - Date.now()) / 86_400_000;
  return diff <= 10;
}



function DashboardPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | ContractStatus>("all");
  const { alerts: warrantyAlerts, isLoading: warrantyLoading } = useWarrantyAlerts();

  const { data: customerGroups = { installment: 0, outright: 0 } } = useQuery({
    queryKey: ["customer-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("payment_type");
      if (error) throw error;
      const rows = (data ?? []) as { payment_type: string | null }[];
      return {
        installment: rows.filter((r) => (r.payment_type ?? "tra_gop") === "tra_gop").length,
        outright: rows.filter((r) => r.payment_type === "tra_thang").length,
      };
    },
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_summaries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ContractSummary[];
    },
  });

  const removeContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xoá hợp đồng");
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (e: Error) => toast.error("Không xoá được hợp đồng", { description: e.message }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      const matchTab = tab === "all" || c.status === tab;
      const matchSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.customer_name.toLowerCase().includes(q) ||
        (c.customer_phone ?? "").toLowerCase().includes(q) ||
        c.machine_name.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [contracts, search, tab]);

  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === "dang_tra_gop").length;
    const overdue = contracts.filter((c) => c.status === "qua_han").length;
    const debt = contracts.reduce((s, c) => s + Number(c.remaining), 0);
    const collected = contracts.reduce((s, c) => s + Number(c.total_paid), 0);
    return { active, overdue, debt, collected };
  }, [contracts]);

  const exportContracts = async () => {
    const { data: machineRows, error: machineErr } = await supabase
      .from("machines")
      .select("*")
      .order("created_at", { ascending: false });
    if (machineErr) throw machineErr;
    const machines = (machineRows ?? []) as unknown as Machine[];

    await exportExcel(
      [
        {
          name: "Dòng tiền trả góp",
          rows: filtered,
          columns: [
            { header: "Mã hợp đồng", value: (c: ContractSummary) => c.code },
            { header: "Khách hàng", value: (c: ContractSummary) => c.customer_name },
            { header: "Điện thoại", value: (c: ContractSummary) => c.customer_phone ?? "" },
            {
              header: "Hình thức",
              value: (c: ContractSummary) =>
                PAYMENT_TYPE_LABEL[c.payment_type ?? "tra_gop"],
            },
            { header: "Máy photocopy", value: (c: ContractSummary) => c.machine_name },
            { header: "Mã máy", value: (c: ContractSummary) => c.machine_code },
            { header: "Tổng giá trị máy", value: (c: ContractSummary) => Number(c.total_value) },
            { header: "Trả trước", value: (c: ContractSummary) => Number(c.down_payment) },
            { header: "Số tháng", value: (c: ContractSummary) => Number(c.months) },
            { header: "Lãi suất/tháng (%)", value: (c: ContractSummary) => Number(c.interest_rate) },
            { header: "Phải đóng mỗi tháng", value: (c: ContractSummary) => Number(c.monthly_payment) },
            { header: "Đã thanh toán", value: (c: ContractSummary) => Number(c.total_paid) },
            { header: "Còn nợ", value: (c: ContractSummary) => Number(c.remaining) },
            { header: "Số kỳ đã đóng", value: (c: ContractSummary) => Number(c.payments_count) },
            {
              header: "Lần đóng gần nhất",
              value: (c: ContractSummary) =>
                c.last_payment_date ? formatDate(c.last_payment_date) : "",
            },
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
              value: (c: ContractSummary) => CONTRACT_STATUS_LABEL[c.status],
            },
            { header: "Ghi chú", value: (c: ContractSummary) => c.note ?? "" },
          ],
        },
        {
          name: "Theo dõi bảo hành",
          rows: machines,
          columns: [
            { header: "Mã máy", value: (m: Machine) => m.code },
            { header: "Tên máy", value: (m: Machine) => m.name },
            { header: "Hãng", value: (m: Machine) => m.brand ?? "" },
            { header: "Số serial", value: (m: Machine) => m.serial_number ?? "" },
            { header: "Giá máy", value: (m: Machine) => Number(m.price) },
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
            {
              header: "Số bản chụp bảo hành",
              value: (m: Machine) => Number(m.warranty_copies ?? 0),
            },
            { header: "Chỉ số đầu", value: (m: Machine) => Number(m.counter_start ?? 0) },
            { header: "Chỉ số hiện tại", value: (m: Machine) => Number(m.counter_current ?? 0) },
            {
              header: "Bản chụp đã dùng",
              value: (m: Machine) => computeWarranty(m).copiesUsed,
            },
            {
              header: "Bản chụp còn lại",
              value: (m: Machine) => computeWarranty(m).copiesLeft,
            },
            {
              header: "Trạng thái bảo hành",
              value: (m: Machine) => computeWarranty(m).label,
            },
            {
              header: "Cập nhật chỉ số",
              value: (m: Machine) =>
                m.counter_updated_at ? formatDate(m.counter_updated_at) : "",
            },
            { header: "Ghi chú", value: (m: Machine) => m.note ?? "" },
          ],
        },
      ],
      `Backup_Hop_Dong_Va_Bao_Hanh_${fileDateSuffix()}.xlsx`,
    );

    return filtered.length + machines.length;
  };



  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hợp đồng trả góp</h1>
          <p className="text-sm text-muted-foreground">
            Tổng {contracts.length} hợp đồng · công nợ được tính tự động theo lịch sử thanh toán.
          </p>
        </div>
        <ContractFormDialog
          trigger={
            <Button>
              <Plus /> Tạo hợp đồng
            </Button>
          }
        />
      </div>

      <div
        className={
          warrantyAlerts.length > 0
            ? "stat-card border-destructive/40 bg-destructive/10"
            : "stat-card"
        }
      >
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <TriangleAlert className="size-4" /> Số máy sắp hết hạn bảo hành
        </p>
        <p
          className={
            warrantyAlerts.length > 0
              ? "num mt-2 text-3xl font-bold text-destructive"
              : "num mt-2 text-3xl font-bold"
          }
        >
          {warrantyAlerts.length}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Còn ≤ 30 ngày hoặc ≤ 5.000 bản chụp — cần liên hệ gia hạn bảo trì.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Tổng khách trả góp
          </p>
          <p className="num mt-2 text-2xl font-bold text-primary">{customerGroups.installment}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Tổng khách trả thẳng
          </p>
          <p className="num mt-2 text-2xl font-bold text-success">{customerGroups.outright}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Đang trả góp</p>
          <p className="num mt-2 text-2xl font-bold">{stats.active}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Quá hạn</p>
          <p className="num mt-2 text-2xl font-bold text-destructive">{stats.overdue}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Đã thu</p>
          <p className="num mt-2 text-xl font-bold text-success">{formatMoney(stats.collected)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Còn nợ</p>
          <p className="num mt-2 text-xl font-bold">{formatMoney(stats.debt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">Tất cả</TabsTrigger>
            <TabsTrigger value="dang_tra_gop">Đang trả góp</TabsTrigger>
            <TabsTrigger value="da_hoan_thanh">Hoàn thành</TabsTrigger>
            <TabsTrigger value="qua_han">Quá hạn</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm mã hợp đồng, khách hàng, máy…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ExcelExportButton onExport={exportContracts} />
      </div>


      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Mã HĐ</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Máy</TableHead>
              <TableHead className="text-right">Mỗi tháng</TableHead>
              <TableHead className="text-right">Đã thanh toán</TableHead>
              <TableHead className="text-right">Còn nợ</TableHead>
              <TableHead>Kết thúc</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Đang tải…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Chưa có hợp đồng nào. Bấm “Tạo hợp đồng” để bắt đầu.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/contracts/$contractId"
                      params={{ contractId: c.id }}
                      className="text-primary hover:underline"
                    >
                      {c.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{c.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{c.customer_phone}</div>
                  </TableCell>
                  <TableCell className="text-sm">{c.machine_name}</TableCell>
                  <TableCell className="num text-right">
                    {formatMoney(c.monthly_payment)}
                  </TableCell>
                  <TableCell className="num text-right text-success">
                    {formatMoney(c.total_paid)}
                  </TableCell>
                  <TableCell className="num text-right font-semibold">
                    {formatMoney(c.remaining)}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(c.end_date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusVariant(c.status)}>
                      {CONTRACT_STATUS_LABEL[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {Number(c.remaining) > 0 && (
                        <>
                          {isDueSoon(c) && <ZaloReminderButton contract={c} />}
                          <PaymentDialog
                            contract={c}
                            trigger={
                              <Button size="sm" variant="secondary">
                                <Wallet /> Cập nhật thanh toán
                              </Button>
                            }
                          />
                        </>
                      )}
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Xoá hợp đồng">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xoá hợp đồng {c.code}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Toàn bộ lịch sử thanh toán của hợp đồng cũng sẽ bị xoá. Hành động
                                này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Huỷ</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeContract.mutate(c.id)}>
                                Xoá
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <WarrantyAlertTable alerts={warrantyAlerts} isLoading={warrantyLoading} />

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Bạn đang đăng nhập với quyền Nhân viên: được tạo hợp đồng và cập nhật thanh toán, không
          được xoá hợp đồng.
        </p>
      )}
    </div>
  );
}
