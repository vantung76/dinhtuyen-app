import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatNumber } from "@/lib/format";
import { computeWarranty } from "@/lib/warranty";
import type { Machine } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WarrantyPanel({ machine }: { machine: Machine }) {
  const { isStaff } = useAuth();
  const queryClient = useQueryClient();
  const [counter, setCounter] = useState("");

  const preview = counter === "" ? machine.counter_current : Number(counter);
  const info = computeWarranty({ ...machine, counter_current: preview });

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(counter);
      if (!Number.isFinite(value) || value < 0) throw new Error("Số counter không hợp lệ");
      const { error } = await supabase
        .from("machines")
        .update({ counter_current: value, counter_updated_at: new Date().toISOString() })
        .eq("id", machine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật số counter hiện tại");
      setCounter("");
      void queryClient.invalidateQueries({ queryKey: ["machines"] });
      void queryClient.invalidateQueries({ queryKey: ["machine"] });
    },
    onError: (e: Error) => toast.error("Không lưu được", { description: e.message }),
  });

  return (
    <section className="stat-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-muted-foreground" /> Thông tin bảo hành
        </h2>
        <Badge className={info.className}>{info.label}</Badge>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Ngày bàn giao / bắt đầu</dt>
          <dd className="font-medium">{formatDate(machine.warranty_start_date)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ngày dự kiến hết hạn</dt>
          <dd className="font-medium">{formatDate(info.endDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Thời hạn bảo hành</dt>
          <dd className="num font-medium">{machine.warranty_months} tháng</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Số bản chụp bảo hành</dt>
          <dd className="num font-medium">{formatNumber(machine.warranty_copies)} bản</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Counter khi bàn giao</dt>
          <dd className="num font-medium">{formatNumber(machine.counter_start)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Giới hạn bản chụp (mốc)</dt>
          <dd className="num font-medium">{formatNumber(info.copyLimit)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Counter hiện tại</dt>
          <dd className="num font-medium">{formatNumber(preview)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Số bản chụp còn lại</dt>
          <dd className="num font-medium">{formatNumber(info.copiesLeft)} bản</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cập nhật counter gần nhất</dt>
          <dd className="font-medium">{formatDate(machine.counter_updated_at)}</dd>
        </div>
      </dl>

      {isStaff && (
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div className="w-full space-y-2 sm:w-56">
            <Label htmlFor="counter-quick">Nhập nhanh counter hiện tại</Label>
            <Input
              id="counter-quick"
              inputMode="numeric"
              placeholder={String(machine.counter_current)}
              value={counter}
              onChange={(e) => setCounter(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button disabled={counter === "" || save.isPending} onClick={() => save.mutate()}>
            <Save /> Lưu counter
          </Button>
          {counter !== "" && (
            <p className="text-xs text-muted-foreground">
              Trạng thái xem trước đã được tính lại theo số vừa nhập.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
