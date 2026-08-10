import { activationEmail, sendResendEmail } from "./email.server";
import { createAppAuthLink, getPublicSiteUrl } from "./auth-link.server";

/**
 * Tạo tài khoản khách hàng KHÔNG dùng supabase.auth.signUp ở client,
 * để hệ thống không gửi email mặc định tiếng Anh "Confirm your email".
 * Toàn bộ email kích hoạt do CTY DINHTUYEN gửi qua Resend (tiếng Việt).
 */
export async function registerCustomer(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ");
  if (!input.password || input.password.length < 8) throw new Error("Mật khẩu quá ngắn");

  const { isEmailAllowed } = await import("./access-check.server");
  if (!(await isEmailAllowed(email))) {
    throw new Error(
      "Email chưa có trong hệ thống. Vui lòng liên hệ CTY DINHTUYEN để được khai báo trước.",
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const fullName = email.split("@")[0]!;

  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = userList?.users?.find((u) => (u.email ?? "").toLowerCase() === email);

  if (existing?.email_confirmed_at) {
    throw new Error("Email này đã có tài khoản. Vui lòng đăng nhập.");
  }

  let userId = existing?.id;
  if (existing) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: input.password,
      user_metadata: { full_name: fullName, account_type: "customer" },
    });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: false,
      user_metadata: { full_name: fullName, account_type: "customer" },
    });
    if (error) throw new Error(error.message);
    userId = data.user?.id;
  }

  // Bảo đảm vai trò khách hàng và gắn hồ sơ khách hàng.
  if (userId) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "customer" });
    await supabaseAdmin
      .from("customers")
      .update({ user_id: userId })
      .ilike("email", email)
      .is("user_id", null);
  }

  const siteUrl = getPublicSiteUrl();
  const link = await supabaseAdmin.auth.admin.generateLink({
    type: "signup",
    email,
    password: input.password,
    options: { redirectTo: `${siteUrl}/auth` },
  });
  if (link.error) throw new Error(link.error.message);

  const actionLink = createAppAuthLink(siteUrl, link.data?.properties, "/auth");
  if (!actionLink) throw new Error("Không tạo được liên kết kích hoạt");

  const { getCustomerMachineInfoByEmail } = await import("./machine-info.server");
  const info = await getCustomerMachineInfoByEmail(email);
  const { subject, html } = activationEmail({
    customerName: fullName,
    actionLink,
    machineLabel: info.machineLabel,
    paymentType: info.paymentType,
  });
  await sendResendEmail({ to: email, subject, html });

  return { sent: true, to: email };
}
