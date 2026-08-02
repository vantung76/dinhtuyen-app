import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Mail, Wallet } from "lucide-react";
import { toast } from "sonner";
import { sendPaymentReminder } from "@/lib/email.functions";
import { supabase } from "@/integrations/supabase/client";

import {
  CONTRACT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  formatDate,
  formatMoney,
} from "@/lib/format";
import type { ContractSummary, Payment } from "@/lib/types";
import { PaymentDialog } from "@/components/PaymentDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/contracts/$contractId")({
  head: () => ({
    meta: [
      { title: "Chi tiết hợp đồng trả góp | Máy photocopy" },
      {
        name: "description",
        content:
          "Chi tiết hợp đồng trả góp máy photocopy: kỳ đóng hằng tháng, công nợ còn lại và toàn bộ phiếu thu.",
      },
      { property: "og:title", content: "Chi tiết hợp đồng trả góp" },
      {
        property: "og:description",
        content: "Xem lịch sử thanh toán và công nợ của một hợp đồng trả góp.",
      },
    ],
  }),
  component: ContractDetail,
});

function ContractDetail() {
  const { contractId } = Route.useParams();

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_summaries")
        .select("*")
        .eq("id", contractId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ContractSummary | null;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("contract_id", contractId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Payment[];
    },
  });

  const sendReminderFn = useServerFn(sendPaymentReminder);
  const reminder = useMutation({
    mutationFn: async () => sendReminderFn({ data: { contractId } }),
    onSuccess: (r) => toast.success(`Đã gửi email nhắc đóng tiền tới ${r.to}`),
    onError: (e: Error) => toast.error("Không gửi được email", { description: e.message }),
  });



  if (isLoading) return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  if (!contract) return <p className="text-sm text-muted-foreground">Không tìm thấy hợp đồng.</p>;

  const progress =
    Number(contract.total_value) > 0
      ? Math.min(100, (Number(contract.total_paid) / Number(contract.total_value)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/dashboard">
          <ArrowLeft /> Danh sách hợp đồng
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contract.code}</h1>
            <Badge variant="outline">{CONTRACT_STATUS_LABEL[contract.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {contract.customer_name}
            {contract.customer_phone ? ` · ${contract.customer_phone}` : ""} — {contract.machine_name}{" "}
            ({contract.machine_code})
          </p>
        </div>
        {Number(contract.remaining) > 0 && (
          <div className="flex flex-wrap gap-2">
            <ZaloReminderButton contract={contract} size="default" />
            <Button
              variant="outline"
              disabled={reminder.isPending}
              onClick={() => reminder.mutate()}
            >
              <Mail /> Gửi email nhắc đóng tiền
            </Button>
            <PaymentDialog
              contract={contract}
              trigger={
                <Button>
                  <Wallet /> Cập nhật thanh toán
                </Button>
              }
            />
          </div>
        )}
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tổng giá trị máy</p>
          <p className="num mt-2 text-lg font-bold">{formatMoney(contract.total_value)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Phải đóng/tháng</p>
          <p className="num mt-2 text-lg font-bold">{formatMoney(contract.monthly_payment)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Đã thanh toán</p>
          <p className="num mt-2 text-lg font-bold text-success">
            {formatMoney(contract.total_paid)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Nợ còn lại</p>
          <p className="num mt-2 text-lg font-bold">{formatMoney(contract.remaining)}</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tiến độ thanh toán</span>
          <span className="num font-medium">{progress.toFixed(1)}%</span>
        </div>
        <Progress value={progress} className="mt-3" />
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Trả trước</dt>
            <dd className="num font-medium">{formatMoney(contract.down_payment)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Số tháng trả góp</dt>
            <dd className="num font-medium">{contract.months} tháng</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lãi suất/tháng</dt>
            <dd className="num font-medium">{contract.interest_rate}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ngày bắt đầu</dt>
            <dd className="font-medium">{formatDate(contract.start_date)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ngày kết thúc</dt>
            <dd className="font-medium">{formatDate(contract.end_date)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Số kỳ đã đóng</dt>
            <dd className="num font-medium">
              {contract.payments_count}/{contract.months}
            </dd>
          </div>
        </dl>
        {contract.note && (
          <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {contract.note}
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Lịch sử thanh toán</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã phiếu thu</TableHead>
                <TableHead>Ngày đóng</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Phương thức</TableHead>
                <TableHead>Nhân viên thu</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Chưa có phiếu thu nào.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.code}</TableCell>
                    <TableCell>{formatDate(p.paid_at)}</TableCell>
                    <TableCell className="num text-right">{formatMoney(p.amount)}</TableCell>
                    <TableCell>{PAYMENT_METHOD_LABEL[p.method]}</TableCell>
                    <TableCell>{p.collector_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.note ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
