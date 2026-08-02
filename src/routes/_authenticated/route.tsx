import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Printer, Users, FileSpreadsheet, Boxes, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Hợp đồng", icon: FileSpreadsheet },
  { to: "/customers", label: "Khách hàng", icon: Users },
  { to: "/machines", label: "Máy photocopy", icon: Boxes },
  { to: "/staff", label: "Nhân sự", icon: ShieldCheck, adminOnly: true },
  { to: "/access", label: "Phân quyền", icon: ShieldCheck },
] as const;

function AuthenticatedLayout() {
  const { session, loading, fullName, isAdmin, isCustomer, rolesLoaded, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    const allowed = pathname === "/portal" || pathname === "/access";
    if (rolesLoaded && isCustomer && !allowed) {
      void navigate({ to: "/portal", replace: true });
    }
  }, [rolesLoaded, isCustomer, pathname, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Đang tải…
      </div>
    );
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 lg:flex lg:flex-nowrap">
          <Link to={isCustomer ? "/portal" : "/dashboard"} className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Printer className="size-4" aria-hidden />
            </span>
            <span className="truncate text-sm font-semibold">Trả góp máy photocopy</span>
          </Link>

          <div className="col-start-2 row-start-1 flex items-center gap-2 lg:order-3 lg:ml-auto">
            <div className="min-w-0 text-right leading-tight">
              <p className="truncate text-sm font-medium">{fullName}</p>
              <p className="text-xs text-sidebar-foreground/70">
                {isCustomer ? "Khách hàng" : isAdmin ? "Quản trị viên" : "Nhân viên"}
              </p>
            </div>
            <Button size="icon" variant="ghost" onClick={handleSignOut} aria-label="Đăng xuất">
              <LogOut className="size-4" />
            </Button>
          </div>

          <nav className="col-span-2 -mx-1 flex items-center gap-1 overflow-x-auto px-1 lg:order-2 lg:col-span-1 lg:mx-0 lg:flex-1 lg:overflow-visible">
            {(!isCustomer
              ? NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || isAdmin)
              : []
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname.startsWith(item.to)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
