import { createServerFn } from "@tanstack/react-start";

export const checkEmailAllowed = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    if (!data?.email) throw new Error("Thiếu địa chỉ email");
    return data;
  })
  .handler(async ({ data }) => {
    const { isEmailAllowed } = await import("./access-check.server");
    return { allowed: await isEmailAllowed(data.email) };
  });
