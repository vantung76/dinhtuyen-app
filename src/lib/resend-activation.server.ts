import { activationEmail, sendResendEmail } from "./email.server";

export async function resendActivation(input: { email: string; siteUrl?: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ");

  const base = (input.siteUrl?.trim() || process.env["PUBLIC_SITE_URL"] || "").replace(/\/$/, "");
  const redirectTo = base || undefined;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const magic = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    ...(redirectTo ? { options: { redirectTo } } : {}),
  });

  const actionLink = magic.data?.properties?.action_link;
  // Không tiết lộ email có tồn tại hay không.
  if (magic.error || !actionLink) return { sent: true };

  const customerName =
    (magic.data.user?.user_metadata?.["full_name"] as string | undefined)?.trim() ||
    email.split("@")[0]!;

  const { subject, html } = activationEmail({ customerName, actionLink });
  await sendResendEmail({ to: email, subject, html });
  return { sent: true };
}
