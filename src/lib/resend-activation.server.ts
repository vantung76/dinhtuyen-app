import { activationEmail, sendResendEmail } from "./email.server";
import { createAppAuthLink, getPublicSiteUrl } from "./auth-link.server";

export async function resendActivation(input: { email: string; siteUrl?: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ");

  const { isEmailAllowed } = await import("./access-check.server");
  if (!(await isEmailAllowed(email))) return { sent: true };

  const base = getPublicSiteUrl();
  const redirectTo = base || undefined;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const magic = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    ...(redirectTo ? { options: { redirectTo } } : {}),
  });

  const actionLink = createAppAuthLink(base, magic.data?.properties, "/auth");
  // Không tiết lộ email có tồn tại hay không.
  if (magic.error || !actionLink) return { sent: true };

  const customerName =
    (magic.data.user?.user_metadata?.["full_name"] as string | undefined)?.trim() ||
    email.split("@")[0]!;

  const { getCustomerMachineInfoByEmail } = await import("./machine-info.server");
  const info = await getCustomerMachineInfoByEmail(email);
  const { subject, html } = activationEmail({
    customerName,
    actionLink,
    machineLabel: info.machineLabel,
    paymentType: info.paymentType,
  });
  await sendResendEmail({ to: email, subject, html });
  return { sent: true };
}
