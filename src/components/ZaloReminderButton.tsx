import { useState } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ContractSummary } from "@/lib/types";
import { buildReminderMessage, copyText, nextDueDate, zaloLink } from "@/lib/zalo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  contract: ContractSummary;
  size?: "sm" | "default";
  className?: string;
};

/** Nút "Nhắc nợ Zalo": copy nội dung nhắc nợ rồi mở chat Zalo của khách. */
export function ZaloReminderButton({ contract, size = "sm", className }: Props) {
  const [busy, setBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [copiedInDialog, setCopiedInDialog] = useState(false);

  const handleClick = async () => {
    const link = zaloLink(contract.customer_phone);
    if (!link) {
      toast.error("Khách hàng chưa có số điện thoại hợp lệ để mở Zalo");
      return;
    }
    setBusy(true);
    setCopiedInDialog(false);
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
        // Hiển thị dialog để người dùng copy thủ công toàn bộ nội dung
        setManualMessage(message);
        toast.warning("Không sao chép tự động được. Hãy dùng hộp thoại vừa hiện ra để copy nội dung.", {
          duration: 5000,
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

  const handleDialogCopy = async () => {
    if (!manualMessage) return;
    const ok = await copyText(manualMessage);
    if (ok) {
      setCopiedInDialog(true);
      toast.success("Đã sao chép nội dung nhắc nợ!");
      setTimeout(() => setManualMessage(null), 600);
    } else {
      toast.info("Bấm vào ô nội dung bên dưới, chọn tất cả (Ctrl+A) rồi sao chép (Ctrl+C)");
    }
  };

  return (
    <>
      <Button
        size={size}
        disabled={busy}
        onClick={handleClick}
        className={cn("bg-zalo text-zalo-foreground hover:bg-zalo/90", className)}
      >
        <MessageCircle /> Nhắc nợ Zalo
      </Button>

      <Dialog open={!!manualMessage} onOpenChange={(open) => !open && setManualMessage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sao chép nội dung nhắc nợ</DialogTitle>
            <DialogDescription>
              Trình duyệt chưa cấp quyền tự động sao chép. Bạn hãy bấm nút bên dưới hoặc chọn toàn bộ nội dung rồi copy.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            readOnly
            value={manualMessage ?? ""}
            className="min-h-[220px] resize-none text-sm leading-relaxed"
            onFocus={(e) => e.currentTarget.select()}
          />

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setManualMessage(null)}>
              Đóng
            </Button>
            <Button onClick={handleDialogCopy} className="gap-2">
              {copiedInDialog ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedInDialog ? "Đã sao chép" : "Sao chép"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
