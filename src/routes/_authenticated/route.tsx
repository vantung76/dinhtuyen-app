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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to={isCustomer ? "/portal" : "/dashboard"} className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Printer className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-semibold">Trả góp máy photocopy</span>
          </Link>

          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {(!isCustomer
              ? NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || isAdmin)
              : []
            ).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname.startsWith(item.to)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium">{fullName}</p>
              <p className="text-xs text-sidebar-foreground/70">
                {isCustomer ? "Khách hàng" : isAdmin ? "Quản trị viên" : "Nhân viên"}
              </p>
            </div>
            <Button size="icon" variant="ghost" onClick={handleSignOut} aria-label="Đăng xuất">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
