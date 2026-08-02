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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm máy");
      void queryClient.invalidateQueries({ queryKey: ["machines"] });
      setForm({ name: "", brand: "", serial_number: "", price: "", note: "" });
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã máy</TableHead>
              <TableHead>Tên máy</TableHead>
              <TableHead>Hãng</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead className="text-right">Giá máy</TableHead>
              {isAdmin && <TableHead className="text-right">Thao tác</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Đang tải…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Chưa có máy nào trong danh mục.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.code}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.brand ?? "—"}</TableCell>
                  <TableCell>{m.serial_number ?? "—"}</TableCell>
                  <TableCell className="num text-right">{formatMoney(m.price)}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Xoá máy"
                        onClick={() => remove.mutate(m.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
