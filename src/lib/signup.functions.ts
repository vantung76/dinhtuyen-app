import { createServerFn } from "@tanstack/react-start";

export const registerCustomerAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => {
    if (!data?.email) throw new Error("Thiếu địa chỉ email");
    if (!data?.password) throw new Error("Thiếu mật khẩu");
    return data;
  })
  .handler(async ({ data }) => {
    const { registerCustomer } = await import("./signup.server");
    return registerCustomer(data);
  });
