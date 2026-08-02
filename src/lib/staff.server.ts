import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Chỉ quản trị viên mới thực hiện được thao tác này");
}

export async function updateStaff(
  supabase: SupabaseClient,
  userId: string,
  input: { id: string; fullName: string; phone?: string },
) {
  await assertAdmin(supabase, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ full_name: input.fullName.trim(), phone: input.phone?.trim() || null })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteStaff(
  supabase: SupabaseClient,
  userId: string,
  input: { id: string },
) {
  await assertAdmin(supabase, userId);
  if (input.id === userId) throw new Error("Không thể xoá chính tài khoản của bạn");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
