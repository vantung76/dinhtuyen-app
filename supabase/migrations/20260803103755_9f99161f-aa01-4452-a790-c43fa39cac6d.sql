-- 1) Backfill: link existing customer records to their login accounts by email
UPDATE public.customers c
SET user_id = u.id
FROM auth.users u
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND lower(c.email) = lower(u.email)
  AND NOT EXISTS (SELECT 1 FROM public.customers x WHERE x.user_id = u.id);

-- 2) When a customer record is created/updated with an email that already has an account, link it
CREATE OR REPLACE FUNCTION public.link_customer_to_existing_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT u.id INTO NEW.user_id
    FROM auth.users u
    WHERE lower(u.email) = lower(NEW.email)
      AND NOT EXISTS (SELECT 1 FROM public.customers x WHERE x.user_id = u.id AND x.id <> NEW.id)
    LIMIT 1;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_customers_link_user ON public.customers;
CREATE TRIGGER trg_customers_link_user
BEFORE INSERT OR UPDATE OF email, user_id ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.link_customer_to_existing_user();

-- 3) Self-service claim at login time
CREATE OR REPLACE FUNCTION public.claim_my_customer_records()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = auth.uid();
  IF _email IS NULL THEN RETURN 0; END IF;

  UPDATE public.customers c
  SET user_id = auth.uid()
  WHERE c.user_id IS NULL AND lower(c.email) = _email;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END; $$;

GRANT EXECUTE ON FUNCTION public.claim_my_customer_records() TO authenticated;