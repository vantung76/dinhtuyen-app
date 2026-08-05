// Lấy thông tin thương hiệu / model máy của khách hàng (server-only).
export type CustomerMachineInfo = {
  paymentType: "tra_gop" | "tra_thang" | null;
  machineLabel: string | null;
};

export function formatMachineLabel(brand: string | null | undefined, name: string | null | undefined) {
  return [brand?.trim(), name?.trim()].filter(Boolean).join(" ") || null;
}

export async function getCustomerMachineInfoById(customerId: string): Promise<CustomerMachineInfo> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("payment_type")
    .eq("id", customerId)
    .maybeSingle();

  const { data: contracts } = await supabaseAdmin
    .from("contracts")
    .select("machine_id, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const machineIds = [...new Set((contracts ?? []).map((c) => c.machine_id).filter(Boolean))];
  if (machineIds.length === 0) {
    return { paymentType: (customer?.payment_type as CustomerMachineInfo["paymentType"]) ?? null, machineLabel: null };
  }

  const { data: machines } = await supabaseAdmin
    .from("machines")
    .select("id, brand, name")
    .in("id", machineIds as string[]);

  const labels = machineIds
    .map((id) => {
      const m = (machines ?? []).find((x) => x.id === id);
      return m ? formatMachineLabel(m.brand, m.name) : null;
    })
    .filter((v): v is string => Boolean(v));

  return {
    paymentType: (customer?.payment_type as CustomerMachineInfo["paymentType"]) ?? null,
    machineLabel: labels.length ? [...new Set(labels)].join(", ") : null,
  };
}

export async function getCustomerMachineInfoByEmail(email: string): Promise<CustomerMachineInfo> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("customers")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (!data?.id) return { paymentType: null, machineLabel: null };
  return getCustomerMachineInfoById(data.id);
}
