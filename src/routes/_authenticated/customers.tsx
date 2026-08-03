import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AtSign, MailCheck, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, makeCode } from "@/lib/format";
import { sendCustomerActivation } from "@/lib/email.functions";
import { changeCustomerEmail } from "@/lib/customer.functions";
import type { Customer } from "@/lib/types";


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

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Khách hàng | Quản lý trả góp máy photocopy" },
      {
        name: "description",
        content: "Danh bạ khách hàng thuê mua trả góp máy photocopy: liên hệ, địa chỉ và ghi chú.",
      },
      { property: "og:title", content: "Danh sách khách hàng" },
      {
        property: "og:description",
        content: "Quản lý thông tin khách hàng dùng cho hợp đồng trả góp máy photocopy.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const sendActivation = useServerFn(sendCustomerActivation);

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", note: "" });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Customer[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Vui lòng nhập tên khách hàng");
      const { error } = await supabase.from("customers").insert({
        code: makeCode("KH"),
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        note: form.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm khách hàng");
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      setForm({ name: "", phone: "", email: "", address: "", note: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Không lưu được", { description: e.message }),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => sendActivation({ data: { customerId: id } }),
    onSuccess: (r) => toast.success(`Đã gửi email kích hoạt tới ${r.to}`),
    onError: (e: Error) => toast.error("Không gửi được email", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xoá khách hàng");
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error("Không xoá được", { description: e.message }),
  });


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Khách hàng</h1>
          <p className="text-sm text-muted-foreground">{customers.length} khách hàng</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Thêm khách hàng
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Thêm khách hàng</DialogTitle>
              <DialogDescription>Thông tin dùng để lập hợp đồng trả góp.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên khách hàng</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Ghi chú</Label>
                <Textarea
                  id="note"
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
          placeholder="Tìm khách hàng…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Mã KH</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead>Ngày tạo</TableHead>
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
                  Chưa có khách hàng nào.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell className="max-w-64 truncate text-sm">{c.address ?? "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(c.created_at)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Gửi email kích hoạt tài khoản"
                      title="Gửi email kích hoạt tài khoản"
                      disabled={!c.email || activate.isPending}
                      onClick={() => activate.mutate(c.id)}
                    >
                      <MailCheck className="size-4 text-primary" />
                    </Button>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Xoá khách hàng"
                        onClick={() => remove.mutate(c.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}

          </TableBody>
        </Table>
      </div>
    </div>
  );
}
