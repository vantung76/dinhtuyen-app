import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { sendWelcomeEmail } from "@/lib/email.functions";
import { requestPasswordReset } from "@/lib/password-reset.functions";
import { resendActivationEmail } from "@/lib/resend-activation.functions";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Đăng nhập | Cổng khách hàng Định Tuyến" },
      {
        name: "description",
        content: "Đăng nhập tài khoản nhân viên để quản lý hợp đồng trả góp máy photocopy.",
      },
      { property: "og:title", content: "Cổng khách hàng Định Tuyến — Trả góp & Trả thẳng" },
      {
        property: "og:description",
        content: "Khu vực dành cho nhân viên và quản trị viên của hệ thống trả góp.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, isStaff, rolesLoaded } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sentConfirm, setSentConfirm] = useState(false);
  const sendWelcome = useServerFn(sendWelcomeEmail);
  const sendReset = useServerFn(requestPasswordReset);
  const [sentReset, setSentReset] = useState(false);
  const resendActivation = useServerFn(resendActivationEmail);
  const [resending, setResending] = useState(false);

  async function handleResendActivation() {
    if (!email.trim()) {
      toast.error("Vui lòng nhập email trước khi gửi lại thư kích hoạt");
      return;
    }
    setResending(true);
    try {
      await resendActivation({ data: { email, siteUrl: window.location.origin } });
      toast.success("Đã gửi lại email kích hoạt", {
        description: "Vui lòng kiểm tra hộp thư (kể cả mục Quảng cáo/Spam).",
      });
    } catch (err) {
      toast.error("Không gửi lại được email kích hoạt", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setResending(false);
    }
  }


  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Vui lòng nhập email trước khi yêu cầu đặt lại mật khẩu");
      return;
    }
    setLoading(true);
    try {
      await sendReset({ data: { email, siteUrl: window.location.origin } });
      setSentReset(true);
      toast.success("Đã gửi email đặt lại mật khẩu", {
        description: "Vui lòng kiểm tra hộp thư (kể cả mục Quảng cáo/Spam).",
      });
    } catch (err) {
      toast.error("Không gửi được email đặt lại mật khẩu", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (!session || !rolesLoaded) return;
    void navigate({ to: isStaff ? "/dashboard" : "/portal", replace: true });
  }, [session, rolesLoaded, isStaff, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Đăng nhập thất bại", { description: error.message });
      return;
    }
    toast.success("Đăng nhập thành công");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: email.split("@")[0], account_type: "customer" },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Tạo tài khoản thất bại", { description: error.message });
      return;
    }
    if (!data.session) {
      setSentConfirm(true);
      toast.success("Hãy kiểm tra email để xác nhận tài khoản");
      return;
    }
    toast.success("Tạo tài khoản thành công");
    void sendWelcome({ data: { email, fullName: email.split("@")[0] ?? email, siteUrl: window.location.origin } }).catch(
      () => undefined,
    );
  }


  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Không đăng nhập được bằng Google");
      return;
    }
    if (result.redirected) return;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-panel">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Printer className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Cổng khách hàng Định Tuyến</h1>
            <p className="text-xs text-muted-foreground">Khách hàng &amp; nhân viên</p>
          </div>
        </div>

        {sentConfirm ? (
          <div className="mt-8 space-y-3 rounded-lg border border-border bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Chúng tôi đã gửi email xác nhận tới <strong>{email}</strong>. Vui lòng mở email và bấm
              liên kết xác nhận, sau đó quay lại đăng nhập.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendActivation}
              disabled={resending}
            >
              {resending ? "Đang gửi lại..." : "Gửi lại email kích hoạt"}
            </Button>
          </div>

        ) : (
          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Tạo tài khoản</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <PasswordInput
                    id="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Đăng nhập
                </Button>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
                >
                  Quên mật khẩu?
                </button>
                {sentReset ? (
                  <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
                    Nếu email <strong>{email}</strong> tồn tại trong hệ thống, chúng tôi đã gửi liên
                    kết đặt lại mật khẩu từ info@dinhtuyen.com.
                  </p>
                ) : null}
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
                  Cổng này chỉ dành cho <strong>khách hàng</strong>. Tài khoản nhân viên do quản trị
                  viên tạo và gửi thư mời từ hệ thống.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="email2">Email</Label>
                  <Input
                    id="email2"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Mật khẩu</Label>
                  <PasswordInput
                    id="password2"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <PasswordRequirements password={password} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Tạo tài khoản
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendActivation}
                  disabled={resending}
                >
                  {resending ? "Đang gửi lại..." : "Gửi lại email kích hoạt"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Không nhận được thư kích hoạt? Nhập email ở trên rồi bấm “Gửi lại”.
                </p>

              </form>
            </TabsContent>
          </Tabs>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          hoặc
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          Tiếp tục với Google
        </Button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Khách hàng đăng ký bằng đúng email đã khai báo với nhân viên để xem được hợp đồng của
          mình. Nhân viên vui lòng dùng tài khoản do quản trị viên cấp.

        </p>
      </div>
    </main>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const checks = [
    { label: "Nhập ít nhất 8 ký tự", met: password.length >= 8 },
    { label: "Chữ thường", met: /[a-z]/.test(password) },
    { label: "Chữ in hoa", met: /[A-Z]/.test(password) },
    { label: "Chữ số", met: /\d/.test(password) },
    { label: "Ký tự đặc biệt", met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <ul className="mt-2 grid grid-cols-1 gap-1">
      {checks.map((check) => (
        <li
          key={check.label}
          className={cn(
            "flex items-center gap-2 text-xs",
            check.met ? "text-green-600" : "text-muted-foreground",
          )}
        >
          {check.met ? (
            <Check className="size-3" aria-hidden />
          ) : (
            <X className="size-3" aria-hidden />
          )}
          {check.label}
        </li>
      ))}
    </ul>
  );
}
