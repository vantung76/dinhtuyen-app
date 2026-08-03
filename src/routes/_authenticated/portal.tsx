import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CalendarClock, Wallet, PiggyBank, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CONTRACT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  addMonths,
  formatDate,
  formatMoney,
} from "@/lib/format";
import type { ContractSummary, Machine, Payment } from "@/lib/types";
import { WarrantyPanel } from "@/components/WarrantyPanel";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/portal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cổng thông tin khách hàng | Trả góp máy photocopy" },
      {
        name: "description",
        content:
          "Tra cứu hợp đồng trả góp máy photocopy của bạn: số dư nợ, kỳ đóng tiếp theo và lịch sử thanh toán đã xác nhận.",
      },
      { property: "og:title", content: "Cổng thông tin khách hàng trả góp" },
      {
        property: "og:description",
        content: "Theo dõi công nợ và lịch sử thanh toán hợp đồng trả góp của bạn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerPortal,
});

function nextDueDate(c: ContractSummary): string | null {
  if (Number(c.remaining) <= 0) return null;
  const paidPeriods = Math.min(Number(c.payments_count) || 0, Number(c.months));
  if (paidPeriods >= Number(c.months)) return null;
  return addMonths(c.start_date, paidPeriods + 1);
}

function CustomerPortal() {
  const { user, fullName } = useAuth();

  const {
    data: contracts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["portal-contracts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Tự gắn hồ sơ khách hàng có cùng email với tài khoản đang đăng nhập
      try {
        await supabase.rpc("claim_my_customer_records" as never);
      } catch {
        /* bỏ qua nếu không gắn được */
      }

      const { data, error: err } = await supabase
        .from("contract_summaries")
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      return (data ?? []) as unknown as ContractSummary[];
    },
  });

  const contractIds = contracts.map((c) => c.id);
  const machineIds = contracts.map((c) => c.machine_id);

  const { data: machines = [] } = useQuery({
    queryKey: ["portal-machines", machineIds.join(",")],
    enabled: machineIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").in("id", machineIds);
      if (error) throw error;
      return (data ?? []) as unknown as Machine[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["portal-payments", contractIds.join(",")],
    enabled: contractIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .in("contract_id", contractIds)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải dữ liệu của bạn…</p>;
  }

  if (contracts.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
        <h1 className="text-lg font-semibold">Chào {fullName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tài khoản của bạn chưa được gắn với hợp đồng trả góp nào. Vui lòng liên hệ nhân viên phụ
          trách để được hỗ trợ.
        </p>
      </div>
    );
  }

  const isOutright =
    contracts.length > 0 &&
    contracts.every(
      (c) => c.customer_payment_type === "tra_thang" || c.payment_type === "tra_thang",
    );

  if (isOutright) {
    return (
      <div className="space-y-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">Cổng thông tin khách hàng</h1>
            <p className="truncate text-sm text-muted-foreground">{fullName}</p>
          </div>
          <Badge variant="outline" className="shrink-0">
            Trả thẳng (100%)
          </Badge>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Máy photocopy của bạn</h2>
          {contracts.map((c) => {
            const machine = machines.find((m) => m.id === c.machine_id);
            return (
              <div key={c.id} className="space-y-3">
                <article className="stat-card">
                  <p className="font-semibold">{c.machine_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.code} · {c.machine_code}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Ngày mua / bàn giao</dt>
                      <dd className="font-medium">{formatDate(c.start_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Counter hiện tại</dt>
                      <dd className="num font-medium">{machine?.counter_current ?? "—"}</dd>
                    </div>
                  </dl>
                </article>
                {machine && <WarrantyPanel machine={machine} />}
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  const totalValue = contracts.reduce((s, c) => s + Number(c.total_value), 0);
  const totalPaid = contracts.reduce((s, c) => s + Number(c.total_paid), 0);
  const totalRemaining = contracts.reduce((s, c) => s + Number(c.remaining), 0);
  const dueNext = contracts
    .filter((c) => Number(c.remaining) > 0)
    .reduce((s, c) => s + Number(c.monthly_payment), 0);
  const nextDates = contracts
    .map(nextDueDate)
    .filter((d): d is string => !!d)
    .sort();
  const nextDate = nextDates[0] ?? null;

  const cards = [
    {
      label: "Tổng giá trị máy",
      value: formatMoney(totalValue),
      icon: PiggyBank,
      tone: "text-foreground",
    },
    {
      label: "Số tiền đã trả",
      value: formatMoney(totalPaid),
      icon: CheckCircle2,
      tone: "text-success",
    },
    { label: "Số dư nợ còn lại", value: formatMoney(totalRemaining), icon: Wallet, tone: "text-foreground" },
    { label: "Cần đóng kỳ tới", value: formatMoney(dueNext), icon: Receipt, tone: "text-primary" },
    {
      label: "Hạn đóng tiếp theo",
      value: nextDate ? formatDate(nextDate) : "Đã tất toán",
      icon: CalendarClock,
      tone: "text-foreground",
    },
  ];

  const progress = totalValue > 0 ? Math.min(100, (totalPaid / totalValue) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">Cổng thông tin khách hàng</h1>
          <p className="truncate text-sm text-muted-foreground">{fullName}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {contracts.length} hợp đồng
        </Badge>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <c.icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{c.label}</span>
            </div>
            <p className={`num mt-2 text-2xl font-bold leading-tight ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </section>

      <section className="stat-card">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Tiến độ thanh toán</span>
          <span className="num font-semibold">{progress.toFixed(1)}%</span>
        </div>
        <Progress value={progress} className="mt-3" />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Hợp đồng của bạn</h2>
        {contracts.map((c) => {
          const due = nextDueDate(c);
          const machine = machines.find((m) => m.id === c.machine_id);
          return (
            <div key={c.id} className="space-y-3">
            <article className="stat-card space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.machine_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.code} · {c.machine_code}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {CONTRACT_STATUS_LABEL[c.status]}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Tổng giá trị</dt>
                  <dd className="num font-medium">{formatMoney(c.total_value)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Đã trả</dt>
                  <dd className="num font-medium text-success">{formatMoney(c.total_paid)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Còn nợ</dt>
                  <dd className="num font-medium">{formatMoney(c.remaining)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mỗi tháng</dt>
                  <dd className="num font-medium">{formatMoney(c.monthly_payment)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Kỳ đã đóng</dt>
                  <dd className="num font-medium">
                    {c.payments_count}/{c.months}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Hạn kỳ tới</dt>
                  <dd className="font-medium">{due ? formatDate(due) : "—"}</dd>
                </div>
              </dl>
            </article>
            {machine && <WarrantyPanel machine={machine} />}
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lịch sử thanh toán</h2>

        {payments.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-panel">
            Chưa có khoản thanh toán nào được ghi nhận.
          </p>
        ) : (
          <>
            {/* Mobile: danh sách thẻ */}
            <ul className="space-y-2 md:hidden">
              {payments.map((p) => (
                <li key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-panel">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="num text-lg font-bold">{formatMoney(p.amount)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(p.paid_at)} · {PAYMENT_METHOD_LABEL[p.method]}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Đã xác nhận
                    </span>
                  </div>
                  <p className="mt-2 truncate text-xs text-muted-foreground">Phiếu thu {p.code}</p>
                </li>
              ))}
            </ul>

            {/* Desktop: bảng */}
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-panel md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ngày thu</th>
                    <th className="px-4 py-3 font-medium">Mã phiếu thu</th>
                    <th className="px-4 py-3 text-right font-medium">Số tiền</th>
                    <th className="px-4 py-3 font-medium">Phương thức</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{formatDate(p.paid_at)}</td>
                      <td className="px-4 py-3 font-medium">{p.code}</td>
                      <td className="num px-4 py-3 text-right">{formatMoney(p.amount)}</td>
                      <td className="px-4 py-3">{PAYMENT_METHOD_LABEL[p.method]}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                          <CheckCircle2 className="size-3.5" aria-hidden /> Đã xác nhận
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
