import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const changeCustomerEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string; newEmail: string; keepAccount: boolean }) => {
    if (!data?.customerId) throw new Error("Thiếu mã khách hàng");
    if (!data.newEmail?.trim()) throw new Error("Vui lòng nhập email mới");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { changeCustomerEmail: run } = await import("./customer.server");
    return run(context.supabase, context.userId, data);
  });
