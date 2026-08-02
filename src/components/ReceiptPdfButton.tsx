import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHOD_LABEL, formatDate } from "@/lib/format";
import { generateReceiptPdf } from "@/lib/receipt-pdf";
import type { ContractSummary, Payment } from "@/lib/types";
import { Button } from "@/components/ui/button";

type Props = {
  payment: Payment;
  contract: ContractSummary;
  /** Số dư nợ còn lại ngay sau phiếu thu này */
  remainingAfter: number;
  /** Kỳ thứ mấy trong hợp đồng */
  periodIndex: number;
};

/** Nút "Xuất PDF": sinh phiếu thu khổ A5 ngang và tải về để chia sẻ qua Zalo. */
export function ReceiptPdfButton({ payment, contract, remainingAfter, periodIndex }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const { data: customer } = await supabase
        .from("customers")
        .select("name, phone, address")
        .eq("id", contract.customer_id)
        .maybeSingle();
      const { data: machine } = await supabase
        .from("machines")
        .select("name, brand, serial_number")
        .eq("id", contract.machine_id)
        .maybeSingle();

      const machineLabel = [machine?.brand, machine?.name ?? contract.machine_name]
        .filter(Boolean)
        .join(" ")
        .concat(machine?.serial_number ? ` (S/N ${machine.serial_number})` : "");

      await generateReceiptPdf({
        receiptCode: payment.code,
        paidAt: payment.paid_at,
        amount: Number(payment.amount),
        method: PAYMENT_METHOD_LABEL[payment.method],
        note: payment.note,
        periodLabel: `kỳ ${periodIndex}/${contract.months} — tháng ${formatDate(payment.paid_at).slice(3)}`,
        collectorName: payment.collector_name,
        customerName: customer?.name ?? contract.customer_name,
        customerAddress: customer?.address ?? null,
        customerPhone: customer?.phone ?? contract.customer_phone,
        contractCode: contract.code,
        machineLabel,
        totalValue: Number(contract.total_value),
        remainingAfter,
      });
      toast.success("Đã tạo phiếu thu PDF", {
        description: "File đã tải về máy, bạn có thể bấm Chia sẻ để gửi cho khách qua Zalo.",
      });
    } catch (e) {
      toast.error("Không tạo được phiếu thu PDF", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={handleClick}>
      {busy ? <Loader2 className="animate-spin" /> : <FileText />} Xuất PDF
    </Button>
  );
}
