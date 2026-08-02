import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  activationEmail,
  paymentReceiptEmail,
  reminderEmail,
  sendResendEmail,
} from "./email.server";

type Client = SupabaseClient<Database>;

const METHOD_LABEL: Record<string, string> = {
  tien_mat: "Tiền mặt",
  chuyen_khoan: "Chuyển khoản",
};

function addMonths(dateISO: string, months: number): string {
  const d = new Date(dateISO);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

async function assertStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Chỉ nhân viên hoặc quản trị viên mới được gửi email");
}

async function loadContract(supabase: Client, contractId: string) {
  const { data, error } = await supabase
    .from("contract_summaries")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Không tìm thấy hợp đồng");

  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .select("name, email")
    .eq("id", data.customer_id as string)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!customer?.email) throw new Error("Khách hàng chưa có địa chỉ email");

  return { contract: data, email: customer.email, name: customer.name };
}

function nextDue(startDate: string, paymentsCount: number, months: number) {
  const n = Math.min(Number(paymentsCount ?? 0) + 1, Number(months ?? 0));
  return n > 0 ? addMonths(startDate, n) : null;
}

export async function sendPaymentReceipt(
  supabase: Client,
  userId: string,
  input: { contractId: string; paymentId?: string },
) {
  await assertStaff(supabase, userId);
  const { contract, email, name } = await loadContract(supabase, input.contractId);

  let payment: { amount: number; paid_at: string; method: string } | null = null;
  const query = supabase
    .from("payments")
    .select("amount, paid_at, method")
    .eq("contract_id", input.contractId);
  const { data, error } = input.paymentId
    ? await query.eq("id", input.paymentId).maybeSingle()
    : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  payment = data as typeof payment;
  if (!payment) throw new Error("Chưa có phiếu thu nào cho hợp đồng này");

  const { subject, html } = paymentReceiptEmail({
    customerName: name,
    contractCode: String(contract.code),
    machineName: String(contract.machine_name ?? ""),
    amount: Number(payment.amount),
    paidAt: payment.paid_at,
    method: METHOD_LABEL[payment.method] ?? payment.method,
    totalPaid: Number(contract.total_paid ?? 0),
    remaining: Number(contract.remaining ?? 0),
    monthlyPayment: Number(contract.monthly_payment ?? 0),
    nextDueDate: nextDue(
      String(contract.start_date),
      Number(contract.payments_count ?? 0),
      Number(contract.months ?? 0),
    ),
  });

  await sendResendEmail({ to: email, subject, html });
  return { sent: true, to: email };
}

export async function sendPaymentReminder(
  supabase: Client,
  userId: string,
  input: { contractId: string },
) {
  await assertStaff(supabase, userId);
  const { contract, email, name } = await loadContract(supabase, input.contractId);

  const { subject, html } = reminderEmail({
    customerName: name,
    contractCode: String(contract.code),
    monthlyPayment: Number(contract.monthly_payment ?? 0),
    remaining: Number(contract.remaining ?? 0),
    dueDate: nextDue(
      String(contract.start_date),
      Number(contract.payments_count ?? 0),
      Number(contract.months ?? 0),
    ),
  });

  await sendResendEmail({ to: email, subject, html });
  return { sent: true, to: email };
}

export async function sendCustomerActivation(
  supabase: Client,
  userId: string,
  input: { customerId: string },
) {
  await assertStaff(supabase, userId);

  const { data: customer, error } = await supabase
    .from("customers")
    .select("name, email")
    .eq("id", input.customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer?.email) throw new Error("Khách hàng chưa có địa chỉ email");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const siteUrl = process.env["PUBLIC_SITE_URL"] ?? "";
  const redirectTo = siteUrl ? `${siteUrl}/portal` : undefined;

  const invite = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email: customer.email,
    options: {
      data: { account_type: "customer", full_name: customer.name },
      ...(redirectTo ? { redirectTo } : {}),
    },
  });

  let actionLink = invite.data?.properties?.action_link;
  if (!actionLink) {
    const magic = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: customer.email,
      ...(redirectTo ? { options: { redirectTo } } : {}),
    });
    if (magic.error) throw new Error(magic.error.message);
    actionLink = magic.data?.properties?.action_link;
  }
  if (!actionLink) throw new Error("Không tạo được liên kết kích hoạt");

  const { subject, html } = activationEmail({ customerName: customer.name, actionLink });
  await sendResendEmail({ to: customer.email, subject, html });
  return { sent: true, to: customer.email };
}
