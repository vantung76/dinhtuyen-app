import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeEmail } from "@/lib/email.functions";
import { requestPasswordReset } from "@/lib/password-reset.functions";
import { resendActivationEmail } from "@/lib/resend-activation.functions";
import { checkEmailAllowed, checkEmailAccessStatus } from "@/lib/access-check.functions";
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
  const { session, isStaff, rolesLoaded, signOut } = useAuth();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sentConfirm, setSentConfirm] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [checkedSession, setCheckedSession] = useState(false);
  const sendWelcome = useServerFn(sendWelcomeEmail);
  const sendReset = useServerFn(requestPasswordReset);
  const [sentReset, setSentReset] = useState(false);
  const resendActivation = useServerFn(resendActivationEmail);
  const [resending, setResending] = useState(false);
  const verifyEmailAllowed = useServerFn(checkEmailAllowed);
  const verifyEmailStatus = useServerFn(checkEmailAccessStatus);


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


  // Khi mở trang /auth: KHÔNG tự động vào cổng khách hàng bằng phiên đăng nhập cũ.
  // Chỉ kiểm tra phiên hiện tại; nếu email chưa được xác nhận thì đăng xuất ngay.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        setCheckedSession(true);
        return;
      }
      if (!data.user.email_confirmed_at) {
        setUnconfirmed(true);
        setEmail(data.user.email ?? "");
        await supabase.auth.signOut();
      }
      setCheckedSession(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  function goToApp() {
    void navigate({ to: isStaff ? "/dashboard" : "/portal", replace: true });
  }

  const NOT_ALLOWED_MSG =
    "Email này chưa có trong hệ thống. Vui lòng liên hệ CTY DINHTUYEN (info@dinhtuyen.com) để được khai báo trước khi đăng nhập.";

  async function ensureAllowed(target: string) {
    try {
      const res = await verifyEmailAllowed({ data: { email: target } });
      return res.allowed;
    } catch {
      return false;
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let status: { allowed: boolean; hasAccount: boolean; confirmed: boolean };
    try {
      status = await verifyEmailStatus({ data: { email } });
    } catch {
      status = { allowed: false, hasAccount: false, confirmed: false };
    }
    if (!status.allowed) {
      setLoading(false);
      toast.error("Tài khoản không được phép truy cập", { description: NOT_ALLOWED_MSG });
      return;
    }
    if (!status.hasAccount) {
      setLoading(false);
      toast.error("Email chưa có tài khoản đăng nhập", {
        description:
          "Email của bạn đã có trong danh sách khách hàng. Vui lòng chuyển sang tab “Tạo tài khoản” để đăng ký mật khẩu, sau đó kích hoạt qua email.",
      });
      return;
    }
    if (!status.confirmed) {
      setLoading(false);
      setUnconfirmed(true);
      toast.error("Tài khoản chưa được kích hoạt", {
        description: "Vui lòng mở email kích hoạt trước khi đăng nhập, hoặc bấm “Gửi lại”.",
      });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error("Đăng nhập thất bại", { description: error.message });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    setLoading(false);
    if (userData.user && !userData.user.email_confirmed_at) {
      await supabase.auth.signOut();
      setUnconfirmed(true);
      toast.error("Tài khoản chưa được kích hoạt", {
        description: "Vui lòng mở email kích hoạt trước khi đăng nhập.",
      });
      return;
    }
    toast.success("Đăng nhập thành công");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (!(await ensureAllowed(email))) {
      setLoading(false);
      toast.error("Không thể tạo tài khoản", { description: NOT_ALLOWED_MSG });
      return;
    }
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

        {unconfirmed ? (
          <div className="mt-6 space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <p>
              Tài khoản này <strong>chưa được kích hoạt</strong>. Vui lòng mở email kích hoạt rồi
              đăng nhập lại.
            </p>
          </div>
        ) : null}

        {checkedSession && session && !sentConfirm ? (
          <div className="mt-6 space-y-3 rounded-lg border border-border bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Bạn đang đăng nhập bằng <strong>{session.user.email}</strong>.
            </p>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={goToApp} disabled={!rolesLoaded}>
                Tiếp tục
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  await signOut();
                  setUnconfirmed(false);
                }}
              >
                Đăng xuất
              </Button>
            </div>
          </div>
        ) : sentConfirm ? (

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
