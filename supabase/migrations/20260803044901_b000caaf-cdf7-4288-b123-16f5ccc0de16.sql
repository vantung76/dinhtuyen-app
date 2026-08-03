ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_user_id_fkey;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;