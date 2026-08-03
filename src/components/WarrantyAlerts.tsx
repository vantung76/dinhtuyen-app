import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Phone, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNumber } from "@/lib/format";
import { copyText, zaloLink } from "@/lib/zalo";
import {
  buildRenewalMessage,
  buildWarrantyAlerts,
  type MachineWithCustomer,
  type WarrantyAlert,
} from "@/lib/warranty-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MachineRow = MachineWithCustomer & {
  contracts?: { customers?: { name: string; phone: string | null } | null }[] | null;
};

/** Query dùng chung: prefix ["machines"] để cập nhật counter tự động làm mới bảng cảnh báo */
export function useWarrantyAlerts() {
  const query = useQuery({
    queryKey: ["machines", "warranty-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*, contracts(customers(name, phone))")
        .order("warranty_start_date", { ascending: true });
      if (error) throw error;
      return (data as unknown as MachineRow[]).map((m) => {
        const customer = m.contracts?.[0]?.customers ?? null;
        return {
          ...m,
          customer_name: customer?.name ?? null,
          customer_phone: customer?.phone ?? null,
        } as MachineWithCustomer;
      });
    },
  });

  const alerts = useMemo(() => buildWarrantyAlerts(query.data ?? []), [query.data]);
  return { ...query, alerts };
}

function ZaloRenewButton({ alert }: { alert: WarrantyAlert }) {
  const handleClick = async () => {
    const link = zaloLink(alert.machine.customer_phone);
    const message = buildRenewalMessage(alert);
    const win = link ? window.open("", "_blank") : null;
    const copied = await copyText(message);
    if (copied) {
      toast.success(
        "Đã sao chép nội dung nhắc gia hạn! Hệ thống đang chuyển hướng sang Zalo, bạn chỉ cần bấm Ctrl+V (hoặc dán) và gửi cho khách",
      );
    } else {
      toast.warning("Không sao chép được tự động, vui lòng copy thủ công", {
        description: message.slice(0, 120) + "…",
      });
    }
    if (!link) {
      win?.close();
      toast.error("Khách hàng chưa có số điện thoại hợp lệ để mở Zalo");
      return;
    }
    if (win) {
      win.opener = null;
      win.location.href = link;
    } else {
      window.location.href = link;
    }
  };

  return (
    <Button size="sm" onClick={handleClick} className="bg-zalo text-zalo-foreground hover:bg-zalo/90">
      <MessageCircle /> Nhắc Zalo gia hạn
    </Button>
  );
}

export function WarrantyAlertTable({ alerts, isLoading }: { alerts: WarrantyAlert[]; isLoading: boolean }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-destructive">
        <TriangleAlert className="size-5" /> DANH SÁCH MÁY PHOTOCOPY CẦN GIA HẠN BẢO HÀNH
      </h2>
      <div className="overflow-x-auto rounded-xl border border-destructive/30 bg-card shadow-panel">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Thông tin máy</TableHead>
              <TableHead>Hết hạn</TableHead>
              <TableHead>Lý do cảnh báo</TableHead>
              <TableHead className="text-right">Hành động nhanh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Đang tải…
                </TableCell>
              </TableRow>
            ) : alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Không có máy nào sắp hết hạn bảo hành. 🎉
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((a) => (
                <TableRow key={a.machine.id}>
                  <TableCell>
                    <div className="font-medium">{a.machine.customer_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.machine.customer_phone ?? "Chưa có số điện thoại"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">
                      {[a.machine.brand, a.machine.name].filter(Boolean).join(" ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Seri: {a.machine.serial_number ?? "—"} · Counter:{" "}
                      {formatNumber(a.machine.counter_current)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(a.info.endDate)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-destructive/40 bg-destructive/10 font-semibold text-destructive"
                    >
                      {a.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" asChild disabled={!a.machine.customer_phone}>
                        <a href={`tel:${a.machine.customer_phone ?? ""}`}>
                          <Phone /> Gọi điện
                        </a>
                      </Button>
                      <ZaloRenewButton alert={a} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
