import { passwordResetEmail, sendResendEmail } from "./email.server";
import { createAppAuthLink } from "./auth-link.server";

export async function sendPasswordReset(input: { email: string; siteUrl?: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ");

  const base = (input.siteUrl?.trim() || process.env["PUBLIC_SITE_URL"] || "").replace(/\/$/, "");
  const redirectTo = base ? `${base}/reset-password` : undefined;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    ...(redirectTo ? { options: { redirectTo } } : {}),
  });

  // Không tiết lộ email có tồn tại hay không.
  const actionLink = createAppAuthLink(base, data?.properties, "/reset-password");
  if (error || !actionLink) return { sent: true };

  const fullName =
    (data.user?.user_metadata?.["full_name"] as string | undefined)?.trim() || email.split("@")[0]!;

  const { subject, html } = passwordResetEmail({ fullName, actionLink });
  await sendResendEmail({ to: email, subject, html });
  return { sent: true };
}
