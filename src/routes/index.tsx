import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, FileSpreadsheet, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quản lý trả góp máy photocopy | Hệ thống nội bộ" },
      {
        name: "description",
        content:
          "Tạo hợp đồng trả góp, tự động tính tiền đóng hằng tháng, cập nhật phiếu thu và theo dõi công nợ máy photocopy cho từng khách hàng.",
      },
      { property: "og:title", content: "Quản lý trả góp máy photocopy" },
      {
        property: "og:description",
        content:
          "Hợp đồng trả góp, lịch sử thanh toán và công nợ máy photocopy trong một màn hình duy nhất.",
      },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: "Hợp đồng trả góp",
    desc: "Khách hàng, máy photocopy, tổng giá trị, trả trước, số tháng, lãi suất và trạng thái hợp đồng.",
  },
  {
    icon: Wallet,
    title: "Lịch sử thanh toán",
    desc: "Mỗi lần khách đóng tiền là một phiếu thu: ngày đóng, số tiền, phương thức, nhân viên thu.",
  },
  {
    icon: CalendarClock,
    title: "Tự động tính toán",
    desc: "Tiền đóng mỗi tháng, tổng đã thanh toán và số nợ còn lại được tính lại theo thời gian thực.",
  },
  {
    icon: ShieldCheck,
    title: "Phân quyền rõ ràng",
    desc: "Nhân viên tạo hợp đồng và thu tiền. Chỉ quản trị viên mới được xoá hợp đồng.",
  },
];

function Index() {
  const { session } = useAuth();

  return (
    <main className="min-h-screen bg-background">
      <div className="relative overflow-hidden border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
            Hệ thống nội bộ
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            Quản lý trả góp máy photocopy
          </h1>
          <p className="mt-4 max-w-2xl text-base text-sidebar-foreground/80">
            Theo dõi toàn bộ hợp đồng trả góp, kỳ thu tiền hằng tháng và công nợ còn lại của từng
            khách hàng. Nhân viên chỉ cần bấm “Cập nhật thanh toán” mỗi khi khách đóng tiền.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={session ? "/dashboard" : "/auth"}>
                {session ? "Vào hệ thống" : "Đăng nhập nhân viên"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 py-16 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="stat-card">
            <f.icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
