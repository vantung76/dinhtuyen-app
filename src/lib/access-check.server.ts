/**
 * Kiểm tra một email có được phép đăng nhập / tạo tài khoản hay không.
 * Chỉ chấp nhận:
 *  - email đã có trong danh sách khách hàng (do nhân viên khai báo trước), hoặc
 *  - tài khoản đã được cấp vai trò nhân viên/quản trị.
 */
export async function isEmailAllowed(rawEmail: string): Promise<boolean> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (customer) return true;

  // Nhân viên / quản trị: tra theo tài khoản auth rồi kiểm tra vai trò.
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const user = userList?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!user) return false;

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return (roles ?? []).some((r) => r.role === "admin" || r.role === "staff");
}
