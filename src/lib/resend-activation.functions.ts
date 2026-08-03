import { createServerFn } from "@tanstack/react-start";

export const resendActivationEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; siteUrl?: string }) => {
    if (!data?.email) throw new Error("Thiếu địa chỉ email");
    return data;
  })
  .handler(async ({ data }) => {
    const { resendActivation } = await import("./resend-activation.server");
    return resendActivation(data);
  });
