import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Chỉ quản trị viên mới xoá được khách hàng");
}

async function findAuthUserIdByEmail(
  admin: { auth: { admin: { listUsers: (o: { page: number; perPage: number }) => Promise<any> } } },
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Không kiểm tra được tài khoản đăng nhập: ${error.message}`);
    const users: { id: string; email?: string | null }[] = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}

export async function deleteCustomer(
  supabase: SupabaseClient,
  userId: string,
  input: { customerId: string; deleteAccount: boolean },
) {
  await assertAdmin(supabase, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("id, name, email, user_id")
    .eq("id", input.customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) throw new Error("Không tìm thấy khách hàng");

  const { count } = await supabaseAdmin
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id);
  if ((count ?? 0) > 0)
    throw new Error("Khách hàng còn hợp đồng. Hãy xoá hợp đồng trước khi xoá khách hàng.");

  let accountRemoved = false;
  if (input.deleteAccount) {
    let authId = customer.user_id as string | null;
    if (!authId && customer.email) {
      authId = await findAuthUserIdByEmail(supabaseAdmin as never, customer.email);
    }
    if (!authId) {
      throw new Error(
        "Không tìm thấy tài khoản đăng nhập tương ứng. Hồ sơ khách hàng chưa bị xoá để tránh bỏ sót tài khoản.",
      );
    }
    if (authId && authId !== userId) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(authId);
      if (delErr) throw new Error(delErr.message);
      accountRemoved = true;
    }
  }

  const { error: delCustErr } = await supabaseAdmin
    .from("customers")
    .delete()
    .eq("id", customer.id);
  if (delCustErr) throw new Error(delCustErr.message);

  return {
    ok: true,
    accountRemoved,
    message: accountRemoved
      ? `Đã xoá khách hàng ${customer.name} và tài khoản đăng nhập ${customer.email ?? ""}`.trim()
      : `Đã xoá khách hàng ${customer.name}`,
  };
}
