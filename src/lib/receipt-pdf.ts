import { formatDate, formatNumber } from "@/lib/format";

export const SHOP = {
  name: "CTY ĐỊNH TUYẾN",
  address: "431 Tô Hiến Thành, Diên Hồng, HCM",
  phone: "076 9119 919",
};

const UNITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

function readTriple(n: number, full: boolean): string {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const dv = n % 10;
  let s = "";
  if (tram > 0 || full) s += `${UNITS[tram]} trăm`;
  if (chuc === 0) {
    if (dv > 0 && (tram > 0 || full)) s += " linh";
    if (dv > 0) s += ` ${UNITS[dv]}`;
  } else if (chuc === 1) {
    s += " mười";
    if (dv === 1) s += " một";
    else if (dv === 5) s += " lăm";
    else if (dv > 0) s += ` ${UNITS[dv]}`;
  } else {
    s += ` ${UNITS[chuc]} mươi`;
    if (dv === 1) s += " mốt";
    else if (dv === 4) s += " tư";
    else if (dv === 5) s += " lăm";
    else if (dv > 0) s += ` ${UNITS[dv]}`;
  }
  return s.trim();
}

/** Đọc số tiền thành chữ tiếng Việt, ví dụ 3000000 -> "Ba triệu đồng". */
export function moneyToWords(value: number | string): string {
  let n = Math.round(Number(value) || 0);
  if (n <= 0) return "Không đồng";
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const scales = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i] ?? 0;
    if (g === 0) continue;
    parts.push(readTriple(g, i !== groups.length - 1) + (scales[i] ?? ""));
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1) + " đồng";
}

export type ReceiptData = {
  receiptCode: string;
  paidAt: string;
  amount: number;
  method: string;
  note?: string | null;
  periodLabel: string;
  collectorName?: string | null;
  customerName: string;
  customerAddress?: string | null;
  customerPhone?: string | null;
  contractCode: string;
  machineLabel: string;
  totalValue: number;
  remainingAfter: number;
};

const vnd = (v: number | string) => `${formatNumber(v)}đ`;

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** HTML phiếu thu khổ A5 ngang (210 x 148 mm) với màu hex an toàn cho html2canvas. */
export function receiptHtml(d: ReceiptData): string {
  const date = new Date(d.paidAt);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Be Vietnam Pro','Segoe UI',Arial,sans-serif;color:#0f172a;background:#ffffff}
  .page{width:794px;height:559px;padding:34px 42px;background:#ffffff;display:flex;flex-direction:column}
  .shop{font-size:17px;font-weight:700;color:#0b4a8f;letter-spacing:.3px}
  .muted{font-size:12px;color:#475569;line-height:1.55}
  .title{font-size:24px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;color:#0b4a8f}
  .sub{text-align:center;font-size:12.5px;color:#475569;margin-top:5px}
  .rule{height:2px;background:#0b4a8f;margin:12px 0 16px;opacity:.85}
  table.info{width:100%;border-collapse:collapse;font-size:13.5px}
  table.info td{padding:5px 0;vertical-align:top}
  td.lbl{width:170px;color:#475569}
  td.val{font-weight:600}
  .amount{font-size:20px;font-weight:700;color:#b42318}
  .words{font-style:italic;font-weight:600}
  .box{margin-top:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;padding:10px 14px;display:flex;gap:28px;font-size:13px}
  .box div span{color:#475569}
  .box div b{display:block;font-size:15px;margin-top:2px}
  .sign{margin-top:auto;display:flex;justify-content:flex-end;gap:70px;text-align:center;font-size:12.5px}
  .sign div{width:200px}
  .sign b{font-size:13px}
  .sign i{display:block;color:#94a3b8;font-size:11.5px;margin-top:46px}
</style></head><body><div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div class="shop">${esc(SHOP.name)}</div>
      <div class="muted">Địa chỉ: ${esc(SHOP.address)}<br>Điện thoại: ${esc(SHOP.phone)}</div>
    </div>
    <div class="muted" style="text-align:right">Hợp đồng: <b>${esc(d.contractCode)}</b><br>Ngày ${day} tháng ${month} năm ${year}</div>
  </div>
  <div style="margin-top:14px">
    <div class="title">Phiếu thu tiền trả góp</div>
    <div class="sub">Số phiếu: <b>${esc(d.receiptCode)}</b> · Ngày thu: ${formatDate(d.paidAt)}</div>
  </div>
  <div class="rule"></div>
  <table class="info">
    <tr><td class="lbl">Họ tên khách hàng</td><td class="val">${esc(d.customerName)}</td></tr>
    <tr><td class="lbl">Địa chỉ</td><td class="val">${esc(d.customerAddress) || "—"}</td></tr>
    <tr><td class="lbl">Số điện thoại</td><td class="val">${esc(d.customerPhone) || "—"}</td></tr>
    <tr><td class="lbl">Lý do nộp tiền</td><td class="val">Thanh toán trả góp ${esc(d.periodLabel)} — máy ${esc(d.machineLabel)}</td></tr>
    <tr><td class="lbl">Số tiền</td><td class="val"><span class="amount">${vnd(d.amount)}</span> <span style="font-weight:500;color:#475569">(${esc(d.method)})</span></td></tr>
    <tr><td class="lbl">Bằng chữ</td><td class="val words">${esc(moneyToWords(d.amount))}</td></tr>
  </table>
  <div class="box">
    <div><span>Tổng giá trị máy</span><b>${vnd(d.totalValue)}</b></div>
    <div><span>Số dư nợ còn lại sau lần đóng này</span><b style="color:#b42318">${vnd(d.remainingAfter)}</b></div>
    ${d.note ? `<div><span>Ghi chú</span><b style="font-weight:500">${esc(d.note)}</b></div>` : ""}
  </div>
  <div class="sign">
    <div><b>Người nộp tiền</b><i>(Ký, ghi rõ họ tên)</i></div>
    <div><b>Người lập phiếu</b><i>(Ký, ghi rõ họ tên)</i>${
      d.collectorName ? `<div style="margin-top:4px;font-weight:600">${esc(d.collectorName)}</div>` : ""
    }</div>
  </div>
</div></body></html>`;
}

/** Sinh file PDF A5 ngang từ HTML phiếu thu và tải về / mở tab xem trước. */
export async function generateReceiptPdf(d: ReceiptData): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:559px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(receiptHtml(d));
    doc.close();
    // Chờ font web tải xong để tiếng Việt hiển thị đúng
    await new Promise((r) => setTimeout(r, 60));
    try {
      await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      /* bỏ qua */
    }
    const el = doc.querySelector(".page") as HTMLElement;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 148, undefined, "FAST");
    const fileName = `PhieuThu-${d.receiptCode}.pdf`;
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } finally {
    iframe.remove();
  }
}
