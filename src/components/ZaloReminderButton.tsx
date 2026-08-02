import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ContractSummary } from "@/lib/types";
import { buildReminderMessage, copyText, nextDueDate, zaloLink } from "@/lib/zalo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  contract: ContractSummary;
  size?: "sm" | "default";
  className?: string;
};

/** Nút "Nhắc nợ Zalo": copy nội dung nhắc nợ rồi mở chat Zalo của khách. */
export function ZaloReminderButton({ contract, size = "sm", className }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    const link = zaloLink(contract.customer_phone);
    if (!link) {
      toast.error("Khách hàng chưa có số điện thoại hợp lệ để mở Zalo");
      return;
    }
    setBusy(true);
    // Mở tab sớm để không bị trình duyệt chặn popup
    const win = window.open("", "_blank");
    try {
      const { data: machine } = await supabase
        .from("machines")
        .select("brand, name, serial_number")
        .eq("id", contract.machine_id)
        .maybeSingle();

      const message = buildReminderMessage({
        customerName: contract.customer_name,
        machineBrand: machine?.brand ?? null,
        machineName: machine?.name ?? contract.machine_name,
        serialNumber: machine?.serial_number ?? null,
        dueDate: nextDueDate(contract.start_date, contract.payments_count, contract.months),
        monthlyAmount: contract.monthly_payment,
      });

      const copied = await copyText(message);
      if (copied) {
        toast.success(
          "Đã sao chép nội dung nhắc nợ! Hệ thống đang chuyển hướng sang Zalo, bạn chỉ cần bấm Ctrl+V (hoặc dán) và gửi cho khách",
        );
      } else {
        toast.warning("Không sao chép được tự động, vui lòng copy nội dung thủ công", {
          description: message.slice(0, 120) + "…",
        });
      }

      if (win) {
        win.opener = null;
        win.location.href = link;
      } else {
        window.location.href = link;
      }
    } catch (e) {
      win?.close();
      toast.error("Không mở được Zalo", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size={size}
      disabled={busy}
      onClick={handleClick}
      className={cn("bg-zalo text-zalo-foreground hover:bg-zalo/90", className)}
    >
      <MessageCircle /> Nhắc nợ Zalo
    </Button>
  );
}
