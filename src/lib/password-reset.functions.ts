import { createServerFn } from "@tanstack/react-start";

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; siteUrl?: string }) => {
    if (!data?.email) throw new Error("Thiếu địa chỉ email");
    return data;
  })
  .handler(async ({ data }) => {
    const { sendPasswordReset } = await import("./password-reset.server");
    return sendPasswordReset(data);
  });
