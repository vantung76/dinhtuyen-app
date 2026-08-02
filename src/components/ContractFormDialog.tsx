import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addMonths, formatMoney, makeCode, monthlyPayment } from "@/lib/format";
import type { Customer, Machine } from "@/lib/types";
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

export function ContractFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [customerId, setCustomerId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [downPayment, setDownPayment] = useState("0");
  const [months, setMonths] = useState("12");
  const [interestRate, setInterestRate] = useState("0");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data as unknown as Customer[];
    },
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").order("name");
      if (error) throw error;
      return data as unknown as Machine[];
    },
  });

  const total = Number(totalValue) || 0;
  const down = Number(downPayment) || 0;
  const m = Number(months) || 0;
  const rate = Number(interestRate) || 0;
  const perMonth = monthlyPayment(total, down, m, rate);
  const endDate = m > 0 ? addMonths(startDate, m) : startDate;

  const createContract = useMutation({
    mutationFn: async () => {
      if (down > total) throw new Error("Số tiền trả trước không được lớn hơn tổng giá trị máy");
      const { error } = await supabase.from("contracts").insert({
        code: makeCode("HD"),
        customer_id: customerId,
        machine_id: machineId,
        total_value: total,
        down_payment: down,
        months: m,
        interest_rate: rate,
        start_date: startDate,
        end_date: endDate,
        note: note || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã tạo hợp đồng trả góp");
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setOpen(false);
      setCustomerId("");
      setMachineId("");
      setTotalValue("");
      setDownPayment("0");
      setMonths("12");
      setInterestRate("0");
      setNote("");
    },
    onError: (e: Error) => toast.error("Không tạo được hợp đồng", { description: e.message }),
  });

  const canSubmit = customerId && machineId && total > 0 && m > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo hợp đồng trả góp</DialogTitle>
          <DialogDescription>
            Chọn khách hàng và máy, hệ thống sẽ tự tính số tiền phải đóng mỗi tháng.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Khách hàng</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn khách hàng" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.phone ? `· ${c.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Máy photocopy</Label>
            <Select
              value={machineId}
              onValueChange={(v) => {
                setMachineId(v);
                const machine = machines.find((x) => x.id === v);
                if (machine && !totalValue) setTotalValue(String(machine.price));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn máy" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((mc) => (
                  <SelectItem key={mc.id} value={mc.id}>
                    {mc.name} · {mc.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="total">Tổng giá trị máy (VNĐ)</Label>
              <Input
                id="total"
                inputMode="numeric"
                value={totalValue}
                onChange={(e) => setTotalValue(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="down">Số tiền trả trước (VNĐ)</Label>
              <Input
                id="down"
                inputMode="numeric"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="months">Số tháng trả góp</Label>
              <Input
                id="months"
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Lãi suất/tháng (%)</Label>
              <Input
                id="rate"
                inputMode="decimal"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Ngày bắt đầu</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ngày kết thúc (tự tính)</Label>
              <Input value={endDate} readOnly disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <div className="rounded-lg border border-border bg-muted p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số tiền phải đóng mỗi tháng</span>
              <strong className="num">{formatMoney(perMonth)}</strong>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Còn nợ sau khi trả trước</span>
              <span className="num">{formatMoney(Math.max(total - down, 0))}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button
            disabled={!canSubmit || createContract.isPending}
            onClick={() => createContract.mutate()}
          >
            Tạo hợp đồng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
