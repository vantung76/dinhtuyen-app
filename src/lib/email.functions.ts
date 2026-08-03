import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendPaymentReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contractId: string; paymentId?: string }) => {
    if (!data?.contractId) throw new Error("Thiếu mã hợp đồng");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { sendPaymentReceipt: run } = await import("./email-actions.server");
    return run(context.supabase, context.userId, data);
  });

export const sendPaymentReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contractId: string }) => {
    if (!data?.contractId) throw new Error("Thiếu mã hợp đồng");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { sendPaymentReminder: run } = await import("./email-actions.server");
    return run(context.supabase, context.userId, data);
  });

export const sendCustomerActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string; siteUrl?: string }) => {
    if (!data?.customerId) throw new Error("Thiếu mã khách hàng");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { sendCustomerActivation: run } = await import("./email-actions.server");
    return run(context.supabase, context.userId, data);
  });

export const sendStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; fullName?: string; role?: "admin" | "staff"; siteUrl?: string }) => {
    if (!data?.email) throw new Error("Thiếu địa chỉ email");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { sendStaffInvite: run } = await import("./email-actions.server");
    return run(context.supabase, context.userId, data);
  });

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; fullName?: string; siteUrl?: string }) => {
    if (!data?.email) throw new Error("Thiếu địa chỉ email");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { sendWelcomeEmail: run } = await import("./email-actions.server");
    return run(context.supabase, context.userId, data);
  });
