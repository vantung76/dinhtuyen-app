-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.contract_status AS ENUM ('dang_tra_gop', 'da_hoan_thanh', 'qua_han');
CREATE TYPE public.payment_method AS ENUM ('tien_mat', 'chuyen_khoan');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.user_roles) = 0 THEN 'admin'::public.app_role ELSE 'staff'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "customers_delete_admin" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MACHINES
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  brand text,
  serial_number text,
  price numeric(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machines_select" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "machines_insert" ON public.machines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "machines_update" ON public.machines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_delete_admin" ON public.machines FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_machines_updated BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CONTRACTS
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  total_value numeric(14,2) NOT NULL CHECK (total_value >= 0),
  down_payment numeric(14,2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
  months integer NOT NULL CHECK (months > 0),
  interest_rate numeric(6,3) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  start_date date NOT NULL DEFAULT current_date,
  end_date date NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'dang_tra_gop',
  note text,
  monthly_payment numeric(14,2) GENERATED ALWAYS AS
    (round(((total_value - down_payment) / GREATEST(months,1)) + ((total_value - down_payment) * interest_rate / 100), 2)) STORED,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (down_payment <= total_value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "contracts_delete_admin" ON public.contracts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  paid_at date NOT NULL DEFAULT current_date,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL DEFAULT 'tien_mat',
  collector_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  collector_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_contract ON public.payments(contract_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payments_update_admin" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "payments_delete_admin" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- SUMMARY VIEW
CREATE VIEW public.contract_summaries
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.code,
  c.customer_id,
  cu.name AS customer_name,
  cu.phone AS customer_phone,
  c.machine_id,
  m.name AS machine_name,
  m.code AS machine_code,
  c.total_value,
  c.down_payment,
  c.months,
  c.interest_rate,
  c.start_date,
  c.end_date,
  c.status,
  c.monthly_payment,
  c.note,
  c.created_at,
  COALESCE(p.paid_sum, 0) AS payments_total,
  c.down_payment + COALESCE(p.paid_sum, 0) AS total_paid,
  c.total_value - (c.down_payment + COALESCE(p.paid_sum, 0)) AS remaining,
  COALESCE(p.paid_count, 0) AS payments_count,
  (SELECT max(paid_at) FROM public.payments px WHERE px.contract_id = c.id) AS last_payment_date
FROM public.contracts c
JOIN public.customers cu ON cu.id = c.customer_id
JOIN public.machines m ON m.id = c.machine_id
LEFT JOIN (
  SELECT contract_id, sum(amount) AS paid_sum, count(*) AS paid_count
  FROM public.payments GROUP BY contract_id
) p ON p.contract_id = c.id;

GRANT SELECT ON public.contract_summaries TO authenticated;
GRANT ALL ON public.contract_summaries TO service_role;