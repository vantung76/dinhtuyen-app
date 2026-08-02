import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { sendWelcomeEmail } from "@/lib/email.functions";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Đăng nhập | Quản lý trả góp máy photocopy" },
      {
        name: "description",
        content: "Đăng nhập tài khoản nhân viên để quản lý hợp đồng trả góp máy photocopy.",
      },
      { property: "og:title", content: "Đăng nhập hệ thống trả góp máy photocopy" },
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
  const { session, isCustomer, rolesLoaded } = useAuth();
  const [accountType, setAccountType] = useState<"staff" | "customer">("customer");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [sentConfirm, setSentConfirm] = useState(false);
  const sendWelcome = useServerFn(sendWelcomeEmail);


  useEffect(() => {
    if (!session || !rolesLoaded) return;
    void navigate({ to: isCustomer ? "/portal" : "/dashboard", replace: true });
  }, [session, rolesLoaded, isCustomer, navigate]);

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
        data: { full_name: fullName, account_type: accountType },
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
    void sendWelcome({ data: { email, fullName, siteUrl: window.location.origin } }).catch(
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
            <h1 className="text-lg font-semibold leading-tight">Trả góp máy photocopy</h1>
            <p className="text-xs text-muted-foreground">Khách hàng &amp; nhân viên</p>
          </div>
        </div>

        {sentConfirm ? (
          <p className="mt-8 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            Chúng tôi đã gửi email xác nhận tới <strong>{email}</strong>. Vui lòng mở email và bấm
            liên kết xác nhận, sau đó quay lại đăng nhập.
          </p>
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
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Đăng nhập
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Loại tài khoản</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { v: "customer", l: "Khách hàng" },
                        { v: "staff", l: "Nhân viên" },
                      ] as const
                    ).map((o) => (
                      <Button
                        key={o.v}
                        type="button"
                        variant={accountType === o.v ? "default" : "outline"}
                        onClick={() => setAccountType(o.v)}
                      >
                        {o.l}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullname">Họ và tên</Label>
                  <Input
                    id="fullname"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
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
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Tạo tài khoản
                </Button>
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
          mình. Tài khoản nhân viên đầu tiên sẽ là Quản trị viên.
        </p>
      </div>
    </main>
  );
}
