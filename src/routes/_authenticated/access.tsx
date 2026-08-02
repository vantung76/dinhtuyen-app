import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/access")({
  head: () => ({
    meta: [
      { title: "Kiểm tra phân quyền tài khoản | Trả góp máy photocopy" },
      {
        name: "description",
        content:
          "Trang kiểm tra phân quyền: xem vai trò Admin, Nhân viên hay Khách hàng của tài khoản đang đăng nhập và dữ liệu thực tế mà tài khoản đó đọc được.",
      },
      { property: "og:title", content: "Kiểm tra phân quyền tài khoản" },
      {
        property: "og:description",
        content: "So sánh quyền đọc, thêm, sửa, xóa của Admin, Nhân viên và Khách hàng.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessTestPage,
});

const MATRIX = [
  { label: "Xem hợp đồng", admin: "Tất cả", staff: "Tất cả", customer: "Chỉ của mình" },
  { label: "Tạo hợp đồng", admin: true, staff: true, customer: false },
  { label: "Sửa hợp đồng", admin: true, staff: true, customer: false },
  { label: "Xóa hợp đồng", admin: true, staff: false, customer: false },
  { label: "Thêm phiếu thu", admin: true, staff: true, customer: false },
  { label: "Sửa/xóa phiếu thu", admin: true, staff: false, customer: false },
  { label: "Quản lý khách hàng / máy", admin: true, staff: "Thêm & sửa", customer: false },
  { label: "Phân quyền người dùng", admin: true, staff: false, customer: false },
] as const;

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-4 text-success" aria-label="Có" />;
  if (value === false) return <X className="mx-auto size-4 text-destructive" aria-label="Không" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

function AccessTestPage() {
  const { roles, isAdmin, isStaff, isCustomer, fullName, user } = useAuth();

  const { data: probe } = useQuery({
    queryKey: ["access-probe", user?.id],
    queryFn: async () => {
      const [contracts, customers, payments, machines] = await Promise.all([
        supabase.from("contracts").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("id", { count: "exact", head: true }),
        supabase.from("machines").select("id", { count: "exact", head: true }),
      ]);
      return {
        contracts: contracts.count ?? 0,
        customers: customers.count ?? 0,
        payments: payments.count ?? 0,
        machines: machines.count ?? 0,
      };
    },
  });

  const roleLabel = isCustomer ? "Khách hàng" : isAdmin ? "Quản trị viên" : "Nhân viên";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Kiểm tra phân quyền</h1>
          <p className="text-sm text-muted-foreground">
            Dữ liệu bên dưới được lọc trực tiếp bởi cơ chế bảo mật ở tầng cơ sở dữ liệu.
          </p>
        </div>
      </div>

      <div className="stat-card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Đang đăng nhập:</span>
          <span className="font-medium">{fullName}</span>
          <Badge>{roleLabel}</Badge>
          {roles.map((r) => (
            <Badge key={r} variant="outline">
              {r}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {[
          { label: "Hợp đồng đọc được", value: probe?.contracts },
          { label: "Khách hàng đọc được", value: probe?.customers },
          { label: "Phiếu thu đọc được", value: probe?.payments },
          { label: "Máy đọc được", value: probe?.machines },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="num mt-2 text-2xl font-bold">{s.value ?? "…"}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium">Thao tác</th>
              <th className="px-4 py-3 text-center font-medium">Admin</th>
              <th className="px-4 py-3 text-center font-medium">Nhân viên</th>
              <th className="px-4 py-3 text-center font-medium">Khách hàng</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.label} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">{row.label}</td>
                <td className="px-4 py-3 text-center">
                  <Cell value={row.admin} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Cell value={row.staff} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Cell value={row.customer} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        {isStaff
          ? "Bạn đang xem toàn bộ dữ liệu hệ thống. Đăng xuất và đăng nhập bằng tài khoản khách hàng để thấy dữ liệu bị lọc theo đúng khách hàng đó."
          : "Bạn chỉ đọc được dữ liệu thuộc về mình và không thể thêm, sửa hay xóa bất kỳ bản ghi nào."}
      </p>
    </div>
  );
}
