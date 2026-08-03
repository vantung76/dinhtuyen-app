-- 1) Remove all privileges from anonymous (not signed in) role
REVOKE ALL ON public.profiles, public.user_roles, public.customers, public.machines, public.contracts, public.payments FROM anon;
REVOKE ALL ON public.contract_summaries FROM anon;

-- 2) Right-size authenticated grants (RLS still enforces row-level rules)
REVOKE ALL ON public.profiles, public.user_roles, public.customers, public.machines, public.contracts, public.payments FROM authenticated;
REVOKE ALL ON public.contract_summaries FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT ON public.contract_summaries TO authenticated;

-- 3) service_role keeps full access for server-side/admin operations
GRANT ALL ON public.profiles, public.user_roles, public.customers, public.machines, public.contracts, public.payments TO service_role;
GRANT ALL ON public.contract_summaries TO service_role;

-- 4) Internal SECURITY DEFINER trigger function must not be callable via API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 5) RLS helper functions stay callable by signed-in users (required by policies)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_customer_ids() TO authenticated;