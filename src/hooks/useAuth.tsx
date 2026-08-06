import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "staff" | "customer";

type AuthValue = {
  session: Session | null;
  user: User | null;
  roles: Role[];
  isAdmin: boolean;
  isCustomer: boolean;
  isStaff: boolean;
  rolesLoaded: boolean;
  fullName: string;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [fullName, setFullName] = useState("");
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setRoles([]);
        setFullName("");
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    setRolesLoaded(false);
    if (!userId) {
      setRoles([]);
      return;
    }
    let active = true;
    void (async () => {

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      ]);
      if (!active) return;
      setRoles(((rolesRes.data ?? []) as { role: Role }[]).map((r) => r.role));
      setFullName(profileRes.data?.full_name ?? "");
      setRolesLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const value = useMemo<AuthValue>(() => {
    // Nguyên tắc tối thiểu quyền: chỉ coi là nhân viên/quản trị khi ĐÃ tải xong
    // danh sách vai trò và thực sự có vai trò admin/staff.
    const isStaff = rolesLoaded && (roles.includes("admin") || roles.includes("staff"));
    const isAdmin = rolesLoaded && roles.includes("admin");
    return {
      session,
      user: session?.user ?? null,
      roles,
      isAdmin,
      isCustomer: !isStaff,
      isStaff,
      rolesLoaded,
      fullName: fullName || (session?.user.email ?? ""),
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [session, roles, rolesLoaded, fullName, loading]);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
