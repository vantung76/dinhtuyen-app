REVOKE EXECUTE ON FUNCTION public.is_staff(uuid), public.my_customer_ids(), public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- customers
DROP POLICY IF EXISTS customers_select ON public.customers;
DROP POLICY IF EXISTS customers_insert ON public.customers;
DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- contracts
DROP POLICY IF EXISTS contracts_select ON public.contracts;
DROP POLICY IF EXISTS contracts_insert ON public.contracts;
DROP POLICY IF EXISTS contracts_update ON public.contracts;
CREATE POLICY contracts_select ON public.contracts FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR customer_id IN (SELECT public.my_customer_ids()));
CREATE POLICY contracts_insert ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY contracts_update ON public.contracts FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- payments
DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_insert ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR contract_id IN (SELECT id FROM public.contracts WHERE customer_id IN (SELECT public.my_customer_ids()))
  );
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- machines
DROP POLICY IF EXISTS machines_select ON public.machines;
DROP POLICY IF EXISTS machines_insert ON public.machines;
DROP POLICY IF EXISTS machines_update ON public.machines;
CREATE POLICY machines_select ON public.machines FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR id IN (SELECT machine_id FROM public.contracts WHERE customer_id IN (SELECT public.my_customer_ids()))
  );
CREATE POLICY machines_insert ON public.machines FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY machines_update ON public.machines FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- profiles: chỉ xem hồ sơ của mình hoặc nhân viên xem tất cả
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));

-- user_roles: chỉ xem quyền của mình hoặc nhân viên xem tất cả
DROP POLICY IF EXISTS roles_select_auth ON public.user_roles;
CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _type text := COALESCE(NEW.raw_user_meta_data->>'account_type', '');
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  IF _type = 'customer' THEN
    _role := 'customer'::public.app_role;
  ELSIF (SELECT count(*) FROM public.user_roles) = 0 THEN
    _role := 'admin'::public.app_role;
  ELSE
    _role := 'staff'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role) ON CONFLICT DO NOTHING;

  IF _role = 'customer'::public.app_role THEN
    UPDATE public.customers c
      SET user_id = NEW.id
      WHERE c.user_id IS NULL
        AND NEW.email IS NOT NULL
        AND lower(c.email) = lower(NEW.email)
        AND NOT EXISTS (SELECT 1 FROM public.customers x WHERE x.user_id = NEW.id);
  END IF;

  RETURN NEW;
END; $function$;
