import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { activationEmail, sendResendEmail } from "./email.server";

type Client = SupabaseClient<Database>;

async function assertStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Chỉ nhân viên hoặc quản trị viên mới được đổi email khách hàng");
}

export async function changeCustomerEmail(
  supabase: Client,
  userId: string,
  input: { customerId: string; newEmail: string; keepAccount: boolean },
) {
  await assertStaff(supabase, userId);

  const newEmail = input.newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error("Email mới không hợp lệ");

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, email, user_id")
    .eq("id", input.customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) throw new Error("Không tìm thấy khách hàng");
  if ((customer.email ?? "").toLowerCase() === newEmail)
    throw new Error("Email mới trùng với email hiện tại");

  const { data: dup } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", newEmail)
    .neq("id", customer.id)
    .maybeSingle();
  if (dup) throw new Error("Email này đã được dùng cho khách hàng khác");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error: upErr } = await supabaseAdmin
    .from("customers")
    .update({ email: newEmail })
    .eq("id", customer.id);
  if (upErr) throw new Error(upErr.message);

  // Giữ nguyên tài khoản đăng nhập cũ, chỉ đổi email đăng nhập
  if (input.keepAccount && customer.user_id) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(customer.user_id, {
      email: newEmail,
      email_confirm: true,
    });
    if (authErr) throw new Error(authErr.message);
    return {
      mode: "kept" as const,
      to: newEmail,
      message: `Đã đổi email đăng nhập sang ${newEmail}. Khách hàng dùng mật khẩu cũ để đăng nhập.`,
    };
  }

  // Tạo tài khoản mới trên email mới: gỡ liên kết tài khoản cũ rồi gửi thư kích hoạt
  if (customer.user_id) {
    const { error: unlinkErr } = await supabaseAdmin
      .from("customers")
      .update({ user_id: null })
      .eq("id", customer.id);
    if (unlinkErr) throw new Error(unlinkErr.message);
  }

  const siteUrl = getPublicSiteUrl();
  const redirectTo = siteUrl ? `${siteUrl}/reset-password` : undefined;

  const invite = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email: newEmail,
    options: {
      data: { account_type: "customer", full_name: customer.name },
      ...(redirectTo ? { redirectTo } : {}),
    },
  });

  let actionLink = createAppAuthLink(siteUrl, invite.data?.properties, "/reset-password");
  if (!actionLink) {
    const magic = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: newEmail,
      ...(redirectTo ? { options: { redirectTo } } : {}),
    });
    if (magic.error) throw new Error(magic.error.message);
    actionLink = createAppAuthLink(siteUrl, magic.data?.properties, "/reset-password");
  }
  if (!actionLink) throw new Error("Đã đổi email nhưng chưa tạo được liên kết kích hoạt");

  const { subject, html } = activationEmail({ customerName: customer.name, actionLink });
  await sendResendEmail({ to: newEmail, subject, html });

  return {
    mode: "reinvited" as const,
    to: newEmail,
    message: `Đã đổi email và gửi thư kích hoạt tới ${newEmail}. Hợp đồng và lịch sử thanh toán được giữ nguyên.`,
  };
}
