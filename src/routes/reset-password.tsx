import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Đặt lại mật khẩu | Hệ thống quản lý máy photocopy Định Tuyến" },
      {
        name: "description",
        content: "Tạo mật khẩu mới cho tài khoản hệ thống quản lý trả góp máy photocopy.",
      },
      { property: "og:title", content: "Đặt lại mật khẩu — CTY DINHTUYEN" },
      {
        property: "og:description",
        content: "Trang đặt lại mật khẩu cho khách hàng và nhân viên CTY DINHTUYEN.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Mật khẩu nhập lại không khớp");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Không đổi được mật khẩu", { description: error.message });
      return;
    }
    toast.success("Đã cập nhật mật khẩu mới");
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-panel">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Đặt lại mật khẩu</h1>
            <p className="text-xs text-muted-foreground">CTY DINHTUYEN</p>
          </div>
        </div>

        {!ready ? (
          <p className="mt-8 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            Đang xác thực liên kết đặt lại mật khẩu. Nếu màn hình này không thay đổi, liên kết có
            thể đã hết hạn — vui lòng yêu cầu gửi lại từ trang đăng nhập.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <PasswordInput
                id="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Nhập lại mật khẩu</Label>
              <PasswordInput
                id="confirm-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Cập nhật mật khẩu
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
