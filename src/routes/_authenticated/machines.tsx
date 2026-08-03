import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatMoney, makeCode } from "@/lib/format";
import type { Machine } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/machines")({
  head: () => ({
    meta: [
      { title: "Máy photocopy | Quản lý trả góp" },
      {
        name: "description",
        content: "Danh mục máy photocopy: hãng, số serial và giá bán dùng để lập hợp đồng trả góp.",
      },
      { property: "og:title", content: "Danh mục máy photocopy" },
      {
        property: "og:description",
        content: "Quản lý kho máy photocopy và giá trị máy cho hợp đồng trả góp.",
      },
    ],
  }),
  component: MachinesPage,
});

function MachinesPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    serial_number: "",
    price: "",
    note: "",
    warranty_start_date: "",
    warranty_months: "24",
    warranty_copies: "60000",
    counter_start: "0",
    counter_current: "0",
  });

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Machine[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Vui lòng nhập tên máy");
      const { error } = await supabase.from("machines").insert({
        code: makeCode("MAY"),
        name: form.name.trim(),
        brand: form.brand || null,
        serial_number: form.serial_number || null,
        price: Number(form.price) || 0,
        note: form.note || null,
        warranty_start_date: form.warranty_start_date || null,
        warranty_months: Number(form.warranty_months) || 0,
        warranty_copies: Number(form.warranty_copies) || 0,
        counter_start: Number(form.counter_start) || 0,
        counter_current: Number(form.counter_current) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm máy");
      void queryClient.invalidateQueries({ queryKey: ["machines"] });
      setForm({
        name: "",
        brand: "",
        serial_number: "",
        price: "",
        note: "",
        warranty_start_date: "",
        warranty_months: "24",
        warranty_copies: "60000",
        counter_start: "0",
        counter_current: "0",
      });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Không lưu được", { description: e.message }),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("machines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xoá máy");
      void queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
    onError: (e: Error) => toast.error("Không xoá được", { description: e.message }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        (m.brand ?? "").toLowerCase().includes(q) ||
        (m.serial_number ?? "").toLowerCase().includes(q),
    );
  }, [machines, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Máy photocopy</h1>
          <p className="text-sm text-muted-foreground">{machines.length} máy trong danh mục</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Thêm máy
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Thêm máy photocopy</DialogTitle>
              <DialogDescription>Giá máy sẽ được dùng làm tổng giá trị hợp đồng.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mname">Tên máy</Label>
                <Input
                  id="mname"
                  placeholder="Ricoh MP 3055"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brand">Hãng</Label>
                  <Input
                    id="brand"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial">Số serial</Label>
                  <Input
                    id="serial"
                    value={form.serial_number}
                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Giá máy (VNĐ)</Label>
                <Input
                  id="price"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
                />
                <p className="num text-xs text-muted-foreground">
                  {formatMoney(Number(form.price) || 0)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-semibold">Thông tin bảo hành</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wstart">Ngày bàn giao / kích hoạt</Label>
                    <Input
                      id="wstart"
                      type="date"
                      value={form.warranty_start_date}
                      onChange={(e) => setForm({ ...form, warranty_start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wmonths">Thời hạn bảo hành (tháng)</Label>
                    <Input
                      id="wmonths"
                      inputMode="numeric"
                      placeholder="24"
                      value={form.warranty_months}
                      onChange={(e) =>
                        setForm({ ...form, warranty_months: e.target.value.replace(/\D/g, "") })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wcopies">Số bản chụp bảo hành</Label>
                    <Input
                      id="wcopies"
                      inputMode="numeric"
                      placeholder="60000"
                      value={form.warranty_copies}
                      onChange={(e) =>
                        setForm({ ...form, warranty_copies: e.target.value.replace(/\D/g, "") })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cstart">Counter khi bàn giao</Label>
                    <Input
                      id="cstart"
                      inputMode="numeric"
                      value={form.counter_start}
                      onChange={(e) =>
                        setForm({ ...form, counter_start: e.target.value.replace(/\D/g, "") })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="ccur">Counter hiện tại</Label>
                    <Input
                      id="ccur"
                      inputMode="numeric"
                      value={form.counter_current}
                      onChange={(e) =>
                        setForm({ ...form, counter_current: e.target.value.replace(/\D/g, "") })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">

                <Label htmlFor="mnote">Ghi chú</Label>
                <Textarea
                  id="mnote"
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Huỷ
              </Button>
              <Button disabled={create.isPending} onClick={() => create.mutate()}>
                Lưu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Tìm máy…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
        <Table className="min-w-[880px]">
          <TableHeader>
            <TableRow>
              <TableHead>Mã máy</TableHead>
              <TableHead>Tên máy</TableHead>
              <TableHead>Hãng</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead className="text-right">Giá máy</TableHead>
              <TableHead>Bảo hành</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Đang tải…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Chưa có máy nào trong danh mục.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => {
                const info = computeWarranty(m);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.code}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.brand ?? "—"}</TableCell>
                    <TableCell>{m.serial_number ?? "—"}</TableCell>
                    <TableCell className="num text-right">{formatMoney(m.price)}</TableCell>
                    <TableCell>
                      <Badge className={info.className}>{info.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetail(m)}
                        aria-label="Xem bảo hành"
                      >
                        <ShieldCheck className="size-4" /> Bảo hành
                      </Button>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Xoá máy"
                          onClick={() => remove.mutate(m.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.name} (${detail.code})` : "Chi tiết thiết bị"}</DialogTitle>
            <DialogDescription>
              Theo dõi bảo hành theo thời gian và số bản chụp của thiết bị.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <WarrantyPanel
              machine={filtered.find((m) => m.id === detail.id) ?? detail}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
