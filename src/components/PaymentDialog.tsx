import { todayISO } from "@/lib/format";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatMoney, makeCode } from "@/lib/format";
import { sendPaymentReceipt } from "@/lib/email.functions";
import type { ContractSummary, PaymentMethod } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PaymentDialog({
  contract,
  trigger,
}: {
  contract: ContractSummary;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { user, fullName } = useAuth();
  const queryClient = useQueryClient();
  const sendReceipt = useServerFn(sendPaymentReceipt);

  const [amount, setAmount] = useState(String(Math.round(Number(contract.monthly_payment))));
  const [paidAt, setPaidAt] = useState(() => todayISO());
  const [method, setMethod] = useState<PaymentMethod>("tien_mat");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);

  const remaining = Number(contract.remaining);
  const monthly = Number(contract.monthly_payment);
  const value = Number(amount) || 0;
  const isSettlement = value > 0 && value >= remaining - 0.5;
  const earlySettlement = isSettlement && remaining > monthly + 0.5;

  const addPayment = useMutation({
    mutationFn: async () => {
      if (value <= 0) throw new Error("Số tiền phải lớn hơn 0");
      if (value > remaining + 0.5) throw new Error("Số tiền vượt quá số nợ còn lại");

      const autoNote = earlySettlement
        ? [note, "Tất toán trước hạn"].filter(Boolean).join(" — ")
        : note;

      const { error } = await supabase.from("payments").insert({
        code: makeCode("PT"),
        contract_id: contract.id,
        paid_at: paidAt,
        amount: value,
        method,
        collector_id: user?.id ?? null,
        collector_name: fullName,
        note: autoNote || null,
      });
      if (error) throw error;

      if (remaining - value <= 0.5) {
        await supabase
          .from("contracts")
          .update({ status: "da_hoan_thanh", end_date: paidAt })
          .eq("id", contract.id);
      }
    },
    onSuccess: () => {
      toast.success(
        isSettlement ? "Đã tất toán hợp đồng" : "Đã cập nhật thanh toán",
      );
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
      void queryClient.invalidateQueries({ queryKey: ["contract", contract.id] });
      void queryClient.invalidateQueries({ queryKey: ["payments", contract.id] });
      setOpen(false);
      setNote("");

      if (notify) {
        void sendReceipt({ data: { contractId: contract.id } })
          .then((r) => toast.success(`Đã gửi email xác nhận tới ${r.to}`))
          .catch((e: Error) =>
            toast.error("Không gửi được email xác nhận", { description: e.message }),
          );
      }
    },
    onError: (e: Error) => toast.error("Không lưu được phiếu thu", { description: e.message }),
  });


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cập nhật thanh toán</DialogTitle>
          <DialogDescription>
            Hợp đồng {contract.code} · {contract.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phải đóng mỗi tháng</span>
              <strong className="num">{formatMoney(contract.monthly_payment)}</strong>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Nợ còn lại</span>
              <span className="num">{formatMoney(remaining)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Số tiền khách đóng (VNĐ)</Label>
            <Input
              id="amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount(String(Math.round(Math.min(monthly, remaining))))}
              >
                Đóng 1 kỳ ({formatMoney(Math.min(monthly, remaining))})
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setAmount(String(Math.round(remaining)))}
              >
                Tất toán toàn bộ ({formatMoney(remaining)})
              </Button>
            </div>
            {isSettlement && (
              <p className="rounded-md bg-success/10 p-2 text-sm text-success">
                {earlySettlement
                  ? "Khách tất toán trước hạn — hợp đồng sẽ được đóng và chuyển sang trạng thái “Đã hoàn thành”."
                  : "Khoản này thanh toán hết dư nợ — hợp đồng sẽ chuyển sang “Đã hoàn thành”."}
              </p>
            )}
          </div>


          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paidAt">Ngày đóng tiền</Label>
              <Input
                id="paidAt"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phương thức</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tien_mat">Tiền mặt</SelectItem>
                  <SelectItem value="chuyen_khoan">Chuyển khoản</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nhân viên thu tiền</Label>
            <Input value={fullName} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pnote">Ghi chú</Label>
            <Textarea id="pnote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
            />
            Gửi email xác nhận cho khách hàng (info@dinhtuyen.com)
          </label>
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button disabled={addPayment.isPending} onClick={() => addPayment.mutate()}>
            {isSettlement ? "Tất toán hợp đồng" : "Lưu phiếu thu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
