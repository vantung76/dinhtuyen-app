import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/confirm")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token_hash: typeof search.token_hash === "string" ? search.token_hash : "",
    type: typeof search.type === "string" ? search.type : "",
    next: search.next === "/auth" ? "/auth" : "/reset-password",
  }),
  head: () => ({
    meta: [
      { title: "Xác thực tài khoản | CTY DINHTUYEN" },
      { name: "description", content: "Xác thực liên kết tài khoản CTY DINHTUYEN." },
      { property: "og:title", content: "Xác thực tài khoản — CTY DINHTUYEN" },
      { property: "og:description", content: "Xác thực liên kết tài khoản CTY DINHTUYEN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmAuthPage,
});

const validTypes = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function ConfirmAuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function confirm() {
      if (!validTypes.has(search.type as EmailOtpType) || !search.token_hash) {
        setError("Liên kết kích hoạt không hợp lệ hoặc đã thiếu thông tin.");
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: search.token_hash,
        type: search.type as EmailOtpType,
      });
      if (!active) return;
      if (verifyError) {
        setError("Liên kết đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu quản trị viên gửi lại.");
        return;
      }
      void navigate({ to: search.next, replace: true });
    }

    void confirm();
    return () => {
      active = false;
    };
  }, [navigate, search.next, search.token_hash, search.type]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
        {error ? (
          <>
            <CircleAlert className="mx-auto size-9 text-destructive" aria-hidden />
            <h1 className="mt-4 text-lg font-semibold">Không thể xác thực liên kết</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button asChild className="mt-6 w-full">
              <Link to="/auth">Về trang đăng nhập</Link>
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto size-9 animate-spin text-primary" aria-hidden />
            <h1 className="mt-4 text-lg font-semibold">Đang xác thực tài khoản</h1>
            <p className="mt-2 text-sm text-muted-foreground">Vui lòng chờ trong giây lát…</p>
          </>
        )}
      </div>
    </main>
  );
}