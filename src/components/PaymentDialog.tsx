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

  const [amount, setAmount] = useState(String(Math.round(Number(contract.monthly_payment))));
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("tien_mat");
  const [note, setNote] = useState("");

  const remaining = Number(contract.remaining);

  const addPayment = useMutation({
    mutationFn: async () => {
      const value = Number(amount) || 0;
      if (value <= 0) throw new Error("Số tiền phải lớn hơn 0");
      if (value > remaining + 0.5) throw new Error("Số tiền vượt quá số nợ còn lại");

      const { error } = await supabase.from("payments").insert({
        code: makeCode("PT"),
        contract_id: contract.id,
        paid_at: paidAt,
        amount: value,
        method,
        collector_id: user?.id ?? null,
        collector_name: fullName,
        note: note || null,
      });
      if (error) throw error;

      if (remaining - value <= 0.5) {
        await supabase.from("contracts").update({ status: "da_hoan_thanh" }).eq("id", contract.id);
      }
    },
    onSuccess: () => {
      toast.success("Đã cập nhật thanh toán");
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
      void queryClient.invalidateQueries({ queryKey: ["contract", contract.id] });
      void queryClient.invalidateQueries({ queryKey: ["payments", contract.id] });
      setOpen(false);
      setNote("");
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button disabled={addPayment.isPending} onClick={() => addPayment.mutate()}>
            Lưu phiếu thu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
