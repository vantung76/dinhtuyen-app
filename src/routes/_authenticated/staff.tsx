import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendStaffInvite } from "@/lib/email.functions";
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
      return (profiles ?? []).map((p) => ({
        ...(p as unknown as Omit<StaffRow, "roles">),
        roles: (roles ?? [])
          .filter((r) => (r as { user_id: string }).user_id === (p as { id: string }).id)
          .map((r) => (r as { role: string }).role),
      })) as StaffRow[];
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Quyền</TableHead>
              <TableHead>Ngày tham gia</TableHead>
              <TableHead className="text-right">Đổi quyền</TableHead>
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
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
