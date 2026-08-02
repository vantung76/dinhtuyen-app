import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; fullName: string; phone?: string }) => {
    if (!data?.id) throw new Error("Thiếu mã tài khoản");
    if (!data.fullName?.trim()) throw new Error("Vui lòng nhập họ tên");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { updateStaff } = await import("./staff.server");
    return updateStaff(context.supabase, context.userId, data);
  });

export const deleteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("Thiếu mã tài khoản");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { deleteStaff } = await import("./staff.server");
    return deleteStaff(context.supabase, context.userId, data);
  });
