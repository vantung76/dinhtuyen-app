import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendStaffInvite } from "@/lib/email.functions";
import { updateStaffMember, deleteStaffMember } from "@/lib/staff.functions";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Nhân viên & phân quyền | Quản lý trả góp" },
      {
        name: "description",
        content:
          "Quản trị viên cấp quyền Admin hoặc Nhân viên cho từng tài khoản sử dụng hệ thống trả góp.",
      },
      { property: "og:title", content: "Nhân viên & phân quyền" },
      {
        property: "og:description",
        content: "Phân quyền Admin/Nhân viên cho hệ thống quản lý trả góp máy photocopy.",
      },
    ],
  }),
  component: StaffPage,
});

type StaffRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  roles: string[];
};

function StaffPage() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const invite = useServerFn(sendStaffInvite);
  const [inviteForm, setInviteForm] = useState({ email: "", fullName: "", role: "staff" as "staff" | "admin" });

  const sendInvite = useMutation({
    mutationFn: async () => invite({ data: inviteForm }),
    onSuccess: (r) => {
      toast.success(`Đã gửi thư kích hoạt tới ${r.to}`);
      setInviteForm({ email: "", fullName: "", role: "staff" });
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error("Không gửi được thư mời", { description: e.message }),
  });



  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      return (profiles ?? [])
        .map((p) => ({
          ...(p as unknown as Omit<StaffRow, "roles">),
          roles: (roles ?? [])
            .filter((r) => (r as { user_id: string }).user_id === (p as { id: string }).id)
            .map((r) => (r as { role: string }).role),
        }))
        .filter((s) => s.roles.some((r) => r === "admin" || r === "staff")) as StaffRow[];
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "staff" }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật quyền");
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error("Không đổi được quyền", { description: e.message }),
  });

  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", phone: "" });
  const [deleting, setDeleting] = useState<StaffRow | null>(null);
  const runUpdate = useServerFn(updateStaffMember);
  const runDelete = useServerFn(deleteStaffMember);

  const updateStaff = useMutation({
    mutationFn: async () =>
      runUpdate({ data: { id: editing!.id, fullName: editForm.fullName, phone: editForm.phone } }),
    onSuccess: () => {
      toast.success("Đã cập nhật thông tin nhân viên");
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error("Không cập nhật được", { description: e.message }),
  });

  const removeStaff = useMutation({
    mutationFn: async () => runDelete({ data: { id: deleting!.id } }),
    onSuccess: () => {
      toast.success("Đã xoá nhân viên khỏi hệ thống");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error("Không xoá được", { description: e.message }),
  });

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-panel">
        <h1 className="text-lg font-semibold">Chỉ quản trị viên mới xem được trang này</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tài khoản Nhân viên có thể tạo hợp đồng và cập nhật thanh toán ở mục Hợp đồng.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nhân viên &amp; phân quyền</h1>
        <p className="text-sm text-muted-foreground">
          Admin có toàn quyền. Nhân viên được tạo hợp đồng và thu tiền, không được xoá dữ liệu.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-panel">
        <h2 className="text-base font-semibold">Mời nhân viên qua email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hệ thống gửi thư kích hoạt từ CTY DINHTUYEN &lt;info@dinhtuyen.com&gt;.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            sendInvite.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="nhanvien@dinhtuyen.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Họ tên</Label>
            <Input
              id="invite-name"
              placeholder="Nguyễn Văn A"
              value={inviteForm.fullName}
              onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Vai trò</Label>
            <select
              id="invite-role"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm((f) => ({ ...f, role: e.target.value as "staff" | "admin" }))
              }
            >
              <option value="staff">Nhân viên</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>
          <Button type="submit" disabled={sendInvite.isPending}>
            {sendInvite.isPending ? "Đang gửi…" : "Gửi thư kích hoạt"}
          </Button>
        </form>
      </div>


      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Quyền</TableHead>
              <TableHead>Ngày tham gia</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Đang tải…
                </TableCell>
              </TableRow>
            ) : (
              staff.map((s) => {
                const isSelf = s.id === user?.id;
                const isUserAdmin = s.roles.includes("admin");
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.full_name ?? "—"} {isSelf && <span className="text-xs">(bạn)</span>}
                    </TableCell>
                    <TableCell>{s.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={isUserAdmin ? "default" : "secondary"}>
                        {isUserAdmin ? "Quản trị viên" : "Nhân viên"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(s.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSelf || setRole.isPending}
                          onClick={() =>
                            setRole.mutate({
                              userId: s.id,
                              role: isUserAdmin ? "staff" : "admin",
                            })
                          }
                        >
                          {isUserAdmin ? "Chuyển thành Nhân viên" : "Cấp quyền Admin"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(s);
                            setEditForm({ fullName: s.full_name ?? "", phone: s.phone ?? "" });
                          }}
                        >
                          <Pencil className="mr-1.5 h-4 w-4" /> Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isSelf}
                          onClick={() => setDeleting(s)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" /> Xoá
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa thông tin nhân viên</DialogTitle>
            <DialogDescription>{editing?.email ?? ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Họ tên</Label>
              <Input
                id="edit-name"
                value={editForm.fullName}
                onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Số điện thoại</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Huỷ
            </Button>
            <Button
              disabled={updateStaff.isPending || !editForm.fullName.trim()}
              onClick={() => updateStaff.mutate()}
            >
              {updateStaff.isPending ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá nhân viên khỏi hệ thống?</AlertDialogTitle>
            <AlertDialogDescription>
              Tài khoản {deleting?.full_name || deleting?.email} sẽ bị xoá vĩnh viễn và không thể
              đăng nhập nữa. Dữ liệu hợp đồng/phiếu thu đã tạo vẫn được giữ lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeStaff.isPending}
              onClick={(e) => {
                e.preventDefault();
                removeStaff.mutate();
              }}
            >
              {removeStaff.isPending ? "Đang xoá…" : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
