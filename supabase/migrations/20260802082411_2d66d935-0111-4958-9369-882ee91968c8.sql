ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_user_id_key ON public.customers(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff'))
$$;

CREATE OR REPLACE FUNCTION public.my_customer_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.customers WHERE user_id = auth.uid()
$$;
