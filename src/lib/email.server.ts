// Cổng gửi email qua Resend (server-only).
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const EMAIL_FROM = "CTY DINHTUYEN <info@dinhtuyen.com>";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendResendEmail({ to, subject, html, replyTo }: SendEmailInput) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("Chưa cấu hình RESEND_API_KEY");

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[Resend] gửi email thất bại [${response.status}]: ${body}`);
    throw new Error(`Gửi email thất bại [${response.status}]: ${body}`);
  }

  return (await response.json()) as { id: string };
}

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    .format(Number.isFinite(value) ? value : 0)
    .replace(/\u00a0/g, " ");

const day = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN");
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );

function layout(title: string, inner: string) {
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#101828">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#ffffff;border-radius:14px;padding:28px 24px;border:1px solid #e4e7ec">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#667085">CTY DINHTUYEN</div>
      <h1 style="margin:8px 0 16px;font-size:20px;line-height:1.35">${escapeHtml(title)}</h1>
      ${inner}
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#98a2b3;text-align:center">
      Email tự động từ hệ thống quản lý máy photocopy — CTY DINHTUYEN (info@dinhtuyen.com)
    </p>
  </div></body></html>`;
}

const row = (label: string, value: string, strong = false) =>
  `<tr><td style="padding:8px 0;color:#667085;font-size:14px">${escapeHtml(label)}</td>
   <td style="padding:8px 0;text-align:right;font-size:14px;${strong ? "font-weight:700;color:#101828" : ""}">${escapeHtml(value)}</td></tr>`;

export function paymentReceiptEmail(input: {
  customerName: string;
  contractCode: string;
  machineName: string;
  amount: number;
  paidAt: string;
  method: string;
  totalPaid: number;
  remaining: number;
  monthlyPayment: number;
  nextDueDate: string | null;
}) {
  const settled = Number(input.remaining) <= 0.5;
  const inner = `
  <p style="font-size:15px;line-height:1.6">Kính gửi <strong>${escapeHtml(input.customerName)}</strong>,<br/>
  CTY DINHTUYEN xác nhận đã nhận khoản thanh toán trả góp của quý khách.</p>
  <div style="background:#f0f7ff;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
    <div style="font-size:13px;color:#475467">Số tiền đã nhận</div>
    <div style="font-size:26px;font-weight:700;color:#0b5cd5;margin-top:4px">${escapeHtml(money(input.amount))}</div>
    <div style="font-size:13px;color:#475467;margin-top:4px">Ngày ${escapeHtml(day(input.paidAt))} · ${escapeHtml(input.method)}</div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    ${row("Hợp đồng", input.contractCode)}
    ${row("Máy photocopy", input.machineName)}
    ${row("Tổng đã thanh toán", money(input.totalPaid))}
    ${row("Dư nợ còn lại", money(settled ? 0 : input.remaining), true)}
    ${row("Số tiền kỳ tới", settled ? money(0) : money(input.monthlyPayment))}
    ${row("Hạn đóng kỳ tới", settled ? "—" : day(input.nextDueDate))}
  </table>
  ${
    settled
      ? `<p style="font-size:14px;color:#067647;background:#ecfdf3;border-radius:10px;padding:12px;margin-top:16px">Quý khách đã <strong>tất toán</strong> hợp đồng này. Không còn kỳ đóng tiền nào tiếp theo.</p>`
      : ""
  }
  <p style="font-size:13px;color:#667085;margin-top:20px">Quý khách có thể đăng nhập cổng thông tin khách hàng để xem toàn bộ lịch sử thanh toán.</p>`;
  return {
    subject: `Xác nhận thanh toán ${money(input.amount)} — HĐ ${input.contractCode}`,
    html: layout("Xác nhận thanh toán trả góp", inner),
  };
}

export function activationEmail(input: {
  customerName: string;
  actionLink: string;
  machineLabel?: string | null;
  paymentType?: "tra_gop" | "tra_thang" | null;
}) {
  const machine = input.machineLabel?.trim() || "";
  const isFullPayment = input.paymentType === "tra_thang";

  const headline = isFullPayment
    ? `Kích hoạt bảo hành máy photocopy ${machine}`.trim()
    : "Kích hoạt tài khoản khách hàng";

  const intro = isFullPayment
    ? `<p style="font-size:15px;line-height:1.6">Kính gửi <strong>${escapeHtml(input.customerName)}</strong>,<br/>
    CTY DINHTUYEN trân trọng mời quý khách <strong>${escapeHtml(`Kích hoạt bảo hành máy photocopy ${machine}`.trim())}</strong> và tài khoản tra cứu thông tin bảo hành.</p>`
    : `<p style="font-size:15px;line-height:1.6">Kính gửi <strong>${escapeHtml(input.customerName)}</strong>,<br/>
    CTY DINHTUYEN đã tạo tài khoản tra cứu hợp đồng trả góp${machine ? ` máy photocopy <strong>${escapeHtml(machine)}</strong>` : " máy photocopy"} cho quý khách.</p>`;

  const machineBox = machine
    ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
      ${row("Máy photocopy", machine, true)}
    </table>`
    : "";

  const inner = `
  ${intro}
  ${machineBox}
  <p style="text-align:center;margin:24px 0">
    <a href="${escapeHtml(input.actionLink)}" style="display:inline-block;background:#0b5cd5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">${isFullPayment ? "Kích hoạt bảo hành" : "Kích hoạt tài khoản"}</a>
  </p>
  <p style="font-size:13px;color:#667085;word-break:break-all">Nếu nút không hoạt động, vui lòng mở liên kết sau:<br/>${escapeHtml(input.actionLink)}</p>
  <p style="font-size:13px;color:#667085">Liên kết có hiệu lực trong thời gian giới hạn. Nếu quý khách không yêu cầu, vui lòng bỏ qua email này.</p>`;

  return {
    subject: isFullPayment
      ? `Kích hoạt bảo hành máy photocopy ${machine}`.trim()
      : machine
        ? `Kích hoạt tài khoản tra cứu hợp đồng máy photocopy ${machine}`
        : "Kích hoạt tài khoản tra cứu hợp đồng máy photocopy.",
    html: layout(headline, inner),
  };
}


export function reminderEmail(input: {
  customerName: string;
  contractCode: string;
  monthlyPayment: number;
  remaining: number;
  dueDate: string | null;
  machineLabel?: string | null;
}) {
  const machine = input.machineLabel?.trim() || "";
  const inner = `
  <p style="font-size:15px;line-height:1.6">Kính gửi <strong>${escapeHtml(input.customerName)}</strong>,<br/>
  CTY DINHTUYEN xin thông báo lịch đóng tiền trả góp máy photocopy${machine ? ` <strong>${escapeHtml(machine)}</strong>` : ""} sắp tới của quý khách.</p>
  <div style="background:#fff7ed;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
    <div style="font-size:13px;color:#475467">Số tiền cần đóng</div>
    <div style="font-size:26px;font-weight:700;color:#b54708;margin-top:4px">${escapeHtml(money(input.monthlyPayment))}</div>
    <div style="font-size:13px;color:#475467;margin-top:4px">Hạn đóng: ${escapeHtml(day(input.dueDate))}</div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    ${row("Hợp đồng", input.contractCode)}
    ${machine ? row("Máy photocopy", machine) : ""}
    ${row("Dư nợ còn lại", money(input.remaining), true)}
  </table>`;
  return {
    subject: `Nhắc đóng tiền trả góp${machine ? ` máy ${machine}` : ""} — HĐ ${input.contractCode}`,
    html: layout("Thông báo kỳ đóng tiền trả góp", inner),
  };
}


export function welcomeEmail(input: { fullName: string; roleLabel: string; loginUrl: string }) {
  const inner = `
  <p style="font-size:15px;line-height:1.6">Kính gửi <strong>${escapeHtml(input.fullName)}</strong>,<br/>
  Tài khoản <strong>${escapeHtml(input.roleLabel)}</strong> của bạn tại hệ thống quản lý máy photocopy — CTY DINHTUYEN đã được kích hoạt thành công.</p>
  <p style="text-align:center;margin:24px 0">
    <a href="${escapeHtml(input.loginUrl)}" style="display:inline-block;background:#0b5cd5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Đăng nhập ngay</a>
  </p>
  <p style="font-size:13px;color:#667085;word-break:break-all">Nếu nút không hoạt động, vui lòng mở liên kết sau:<br/>${escapeHtml(input.loginUrl)}</p>
  <p style="font-size:13px;color:#667085">Mọi thắc mắc xin liên hệ CTY DINHTUYEN — 431 Tô Hiến Thành, Diên Hồng, HCM · 076 9119 919.</p>`;
  return {
    subject: "Tài khoản của bạn đã được kích hoạt — CTY DINHTUYEN",
    html: layout("Chào mừng đến với CTY DINHTUYEN", inner),
  };
}

export function staffInvitationEmail(input: { fullName: string; actionLink: string; roleLabel: string }) {
  const inner = `
  <p style="font-size:15px;line-height:1.6">Kính gửi <strong>${escapeHtml(input.fullName)}</strong>,<br/>
  CTY DINHTUYEN mời bạn tham gia hệ thống quản lý máy photocopy với vai trò <strong>${escapeHtml(input.roleLabel)}</strong>.</p>
  <p style="text-align:center;margin:24px 0">
    <a href="${escapeHtml(input.actionLink)}" style="display:inline-block;background:#0b5cd5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Kích hoạt tài khoản nhân viên</a>
  </p>
  <p style="font-size:13px;color:#667085;word-break:break-all">Nếu nút không hoạt động, vui lòng mở liên kết sau:<br/>${escapeHtml(input.actionLink)}</p>
  <p style="font-size:13px;color:#667085">Sau khi kích hoạt, bạn hãy đặt mật khẩu và đăng nhập để tạo hợp đồng, thu tiền trả góp.</p>`;
  return {
    subject: `Kích hoạt tài khoản ${input.roleLabel} — CTY DINHTUYEN`,
    html: layout("Mời tham gia hệ thống quản lý máy photocopy Định Tuyến", inner),
  };
}

export function passwordResetEmail(input: { fullName: string; actionLink: string }) {
  const inner = `
  <p style="font-size:15px;line-height:1.6">Kính gửi <strong>${escapeHtml(input.fullName)}</strong>,<br/>
  Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại hệ thống quản lý máy photocopy — CTY DINHTUYEN.</p>
  <p style="text-align:center;margin:24px 0">
    <a href="${escapeHtml(input.actionLink)}" style="display:inline-block;background:#0b5cd5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:15px">Đặt lại mật khẩu</a>
  </p>
  <p style="font-size:13px;color:#667085;word-break:break-all">Nếu nút không hoạt động, vui lòng mở liên kết sau:<br/>${escapeHtml(input.actionLink)}</p>
  <p style="font-size:13px;color:#667085">Liên kết có hiệu lực trong thời gian giới hạn. Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này.</p>`;
  return {
    subject: "Đặt lại mật khẩu — CTY DINHTUYEN",
    html: layout("Yêu cầu đặt lại mật khẩu", inner),
  };
}
