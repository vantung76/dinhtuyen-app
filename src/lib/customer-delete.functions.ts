import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const removeCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string; deleteAccount: boolean }) => {
    if (!data?.customerId) throw new Error("Thiếu mã khách hàng");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { deleteCustomer } = await import("./customer-delete.server");
    return deleteCustomer(context.supabase, context.userId, data);
  });
