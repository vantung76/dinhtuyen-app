import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  activationEmail,
  paymentReceiptEmail,
  reminderEmail,
  sendResendEmail,
  staffInvitationEmail,
  welcomeEmail,
} from "./email.server";
import { createAppAuthLink, getPublicSiteUrl } from "./auth-link.server";


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

  type PaymentRow = { amount: number; paid_at: string; method: string };
  const query = supabase
    .from("payments")
    .select("amount, paid_at, method")
    .eq("contract_id", input.contractId);
  const { data, error } = input.paymentId
    ? await query.eq("id", input.paymentId).maybeSingle()
    : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  const payment = data as PaymentRow | null;
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

  const { data: machine } = await supabase
    .from("machines")
    .select("brand, name")
    .eq("id", String(contract.machine_id))
    .maybeSingle();
  const { formatMachineLabel } = await import("./machine-info.server");
  const machineLabel = formatMachineLabel(machine?.brand, machine?.name ?? contract.machine_name);

  const { subject, html } = reminderEmail({
    customerName: name,
    contractCode: String(contract.code),
    monthlyPayment: Number(contract.monthly_payment ?? 0),
    remaining: Number(contract.remaining ?? 0),
    machineLabel,
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
  input: { customerId: string; siteUrl?: string },
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
  const siteUrl = getPublicSiteUrl();
  const redirectTo = siteUrl ? `${siteUrl}/reset-password` : undefined;

  const invite = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email: customer.email,
    options: {
      data: { account_type: "customer", full_name: customer.name },
      ...(redirectTo ? { redirectTo } : {}),
    },
  });

  let actionLink = createAppAuthLink(siteUrl, invite.data?.properties, "/reset-password");
  if (!actionLink) {
    const magic = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: customer.email,
      ...(redirectTo ? { options: { redirectTo } } : {}),
    });
    if (magic.error) throw new Error(magic.error.message);
    actionLink = createAppAuthLink(siteUrl, magic.data?.properties, "/reset-password");
  }
  if (!actionLink) throw new Error("Không tạo được liên kết kích hoạt");

  const { getCustomerMachineInfoById } = await import("./machine-info.server");
  const info = await getCustomerMachineInfoById(input.customerId);
  const { subject, html } = activationEmail({
    customerName: customer.name,
    actionLink,
    machineLabel: info.machineLabel,
    paymentType: info.paymentType,
  });
  await sendResendEmail({ to: customer.email, subject, html });
  return { sent: true, to: customer.email };
}

export async function sendStaffInvite(
  supabase: Client,
  userId: string,
  input: { email: string; fullName?: string; role?: "admin" | "staff"; siteUrl?: string },
) {
  const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr) throw new Error(roleErr.message);
  if (!isAdmin) throw new Error("Chỉ quản trị viên mới được mời nhân viên");

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ");
  const role = input.role === "admin" ? "admin" : "staff";
  const fullName = input.fullName?.trim() || email.split("@")[0]!;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const siteUrl = getPublicSiteUrl();
  const redirectTo = siteUrl ? `${siteUrl}/reset-password` : undefined;

  const invite = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { account_type: "staff", full_name: fullName },
      ...(redirectTo ? { redirectTo } : {}),
    },
  });

  let actionLink = createAppAuthLink(siteUrl, invite.data?.properties, "/reset-password");
  let invitedUserId = invite.data?.user?.id;

  if (!actionLink) {
    const magic = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      ...(redirectTo ? { options: { redirectTo } } : {}),
    });
    if (magic.error) throw new Error(magic.error.message);
    actionLink = createAppAuthLink(siteUrl, magic.data?.properties, "/reset-password");
    invitedUserId = magic.data?.user?.id ?? invitedUserId;
  }
  if (!actionLink) throw new Error("Không tạo được liên kết kích hoạt");

  if (invitedUserId) {
    await supabaseAdmin.from("user_roles").delete().eq("user_id", invitedUserId);
    await supabaseAdmin.from("user_roles").insert({ user_id: invitedUserId, role });
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: invitedUserId, full_name: fullName }, { onConflict: "id" });
  }

  const { subject, html } = staffInvitationEmail({
    fullName,
    actionLink,
    roleLabel: role === "admin" ? "Quản trị viên" : "Nhân viên",
  });
  await sendResendEmail({ to: email, subject, html });
  return { sent: true, to: email, role };
}

export async function sendWelcomeEmail(
  supabase: Client,
  userId: string,
  input: { email: string; fullName?: string; siteUrl?: string },
) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ");

  const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
  const roleLabel = isStaff ? "Nhân viên" : "Khách hàng";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const fullName = input.fullName?.trim() || profile?.full_name || email.split("@")[0]!;
  const base = getPublicSiteUrl();
  const loginUrl = base ? `${base.replace(/\/$/, "")}/auth` : "https://dinhtuyen.com";

  const { subject, html } = welcomeEmail({ fullName, roleLabel, loginUrl });
  await sendResendEmail({ to: email, subject, html });
  return { sent: true, to: email };
}
