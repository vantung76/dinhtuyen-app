import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AtSign, MailCheck, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, makeCode, PAYMENT_TYPE_LABEL } from "@/lib/format";
import { sendCustomerActivation } from "@/lib/email.functions";
import { changeCustomerEmail } from "@/lib/customer.functions";
import { removeCustomer } from "@/lib/customer-delete.functions";
import type { Customer, PaymentType } from "@/lib/types";



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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const changeEmail = useServerFn(changeCustomerEmail);
  const deleteCustomerFn = useServerFn(removeCustomer);


  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | PaymentType>("all");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    note: "",
    payment_type: "tra_gop" as PaymentType,
  });
  const [emailTarget, setEmailTarget] = useState<Customer | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteAccount, setDeleteAccount] = useState(true);



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
        payment_type: form.payment_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm khách hàng");
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      setForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        note: "",
        payment_type: "tra_gop",
      });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Không lưu được", { description: e.message }),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => sendActivation({ data: { customerId: id , siteUrl: window.location.origin } }),
    onSuccess: (r) => toast.success(`Đã gửi email kích hoạt tới ${r.to}`),
    onError: (e: Error) => toast.error("Không gửi được email", { description: e.message }),
  });

  const updateEmail = useMutation({
    mutationFn: async (keepAccount: boolean) =>
      changeEmail({
        data: { customerId: emailTarget!.id, newEmail: newEmail.trim(), keepAccount },
      }),
    onSuccess: (r) => {
      toast.success(r.message);
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      setEmailTarget(null);
      setNewEmail("");
    },
    onError: (e: Error) => toast.error("Không đổi được email", { description: e.message }),
  });



  const remove = useMutation({
    mutationFn: async (vars: { id: string; deleteAccount: boolean }) =>
      deleteCustomerFn({ data: { customerId: vars.id, deleteAccount: vars.deleteAccount } }),
    onSuccess: (r) => {
      toast.success(r.message);
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error("Không xoá được", { description: e.message }),
  });



  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchTab = tab === "all" || (c.payment_type ?? "tra_gop") === tab;
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q);
      return matchTab && matchSearch;
    });
  }, [customers, search, tab]);

  const counts = useMemo(
    () => ({
      installment: customers.filter((c) => (c.payment_type ?? "tra_gop") === "tra_gop").length,
      outright: customers.filter((c) => c.payment_type === "tra_thang").length,
    }),
    [customers],
  );

  const exportCustomers = async () => {
    await exportExcel(
      [
        {
          name: "Danh sách khách hàng",
          rows: filtered,
          columns: [
            { header: "Mã KH", value: (c: Customer) => c.code },
            { header: "Tên khách hàng", value: (c: Customer) => c.name },
            {
              header: "Hình thức",
              value: (c: Customer) => PAYMENT_TYPE_LABEL[c.payment_type ?? "tra_gop"],
            },
            { header: "Điện thoại", value: (c: Customer) => c.phone ?? "" },
            { header: "Email", value: (c: Customer) => c.email ?? "" },
            { header: "Địa chỉ", value: (c: Customer) => c.address ?? "" },
            { header: "Ghi chú", value: (c: Customer) => c.note ?? "" },
            { header: "Ngày tạo", value: (c: Customer) => formatDate(c.created_at) },
          ],
        },
      ],
      `Backup_Danh_Sach_Khach_Hang_${fileDateSuffix()}.xlsx`,
    );
    return filtered.length;
  };



  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Khách hàng</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} khách hàng · {counts.installment} trả góp · {counts.outright} trả
            thẳng
          </p>
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
                <Label>Hình thức thanh toán</Label>
                <Select
                  value={form.payment_type}
                  onValueChange={(v) => setForm({ ...form, payment_type: v as PaymentType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn hình thức" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tra_gop">Trả góp</SelectItem>
                    <SelectItem value="tra_thang">Trả thẳng (100%)</SelectItem>
                  </SelectContent>
                </Select>
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

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">Tất cả khách hàng</TabsTrigger>
            <TabsTrigger value="tra_gop">Khách hàng Trả góp</TabsTrigger>
            <TabsTrigger value="tra_thang">Khách hàng Trả thẳng</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm sm:w-auto sm:flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm khách hàng…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ExcelExportButton onExport={exportCustomers} />
      </div>


      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Mã KH</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Hình thức</TableHead>
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
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Đang tải…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Chưa có khách hàng nào.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        c.payment_type === "tra_thang"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-primary/25 bg-primary/10 text-primary"
                      }
                    >
                      {PAYMENT_TYPE_LABEL[c.payment_type ?? "tra_gop"]}
                    </Badge>
                  </TableCell>
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
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Đổi email khách hàng"
                      title="Đổi email khách hàng"
                      onClick={() => {
                        setEmailTarget(c);
                        setNewEmail("");
                      }}
                    >
                      <AtSign className="size-4 text-primary" />
                    </Button>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Xoá khách hàng"
                        onClick={() => {
                          setDeleteTarget(c);
                          setDeleteAccount(true);
                        }}

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

      <Dialog
        open={!!emailTarget}
        onOpenChange={(v) => {
          if (!v) setEmailTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Đổi email khách hàng</DialogTitle>
            <DialogDescription>
              Hợp đồng, phiếu thu và lịch sử trả góp của khách được giữ nguyên khi đổi email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="font-medium">{emailTarget?.name}</div>
              <div className="text-muted-foreground">
                Email hiện tại: {emailTarget?.email ?? "chưa có"}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email mới</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="email-moi@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Giữ tài khoản cũ:</strong> chỉ đổi email đăng
                nhập, khách vẫn dùng mật khẩu cũ để vào cổng thông tin.
              </li>
              <li>
                <strong className="text-foreground">Tạo tài khoản mới:</strong> gỡ liên kết tài khoản
                cũ và gửi thư kích hoạt tới email mới để khách đặt mật khẩu.
              </li>
            </ul>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setEmailTarget(null)}>
              Huỷ
            </Button>
            <Button
              variant="secondary"
              disabled={updateEmail.isPending || !newEmail.trim()}
              onClick={() => updateEmail.mutate(false)}
            >
              Đổi & gửi kích hoạt mới
            </Button>
            <Button
              disabled={updateEmail.isPending || !newEmail.trim()}
              onClick={() => updateEmail.mutate(true)}
            >
              Đổi & giữ tài khoản cũ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Xoá khách hàng</DialogTitle>
            <DialogDescription>
              Xoá hồ sơ khách hàng khỏi hệ thống. Nếu không xoá cả tài khoản đăng nhập, khách vẫn có
              thể đăng nhập vào cổng thông tin và thấy màn hình trống.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="font-medium">{deleteTarget?.name}</div>
              <div className="text-muted-foreground">Email: {deleteTarget?.email ?? "chưa có"}</div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[hsl(var(--primary))]"
                checked={deleteAccount}
                onChange={(e) => setDeleteAccount(e.target.checked)}
              />
              <span>
                <strong>Xoá luôn tài khoản đăng nhập</strong> của khách (khuyến nghị) — khách sẽ
                không đăng nhập được nữa.
              </span>
            </label>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: deleteTarget!.id, deleteAccount })}
            >
              Xoá khách hàng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}

