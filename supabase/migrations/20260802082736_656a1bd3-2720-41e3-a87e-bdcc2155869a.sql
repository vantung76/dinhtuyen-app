CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  _type text := COALESCE(NEW.raw_user_meta_data->>'account_type', '');
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  IF (SELECT count(*) FROM public.user_roles) = 0 THEN
    _role := 'admin'::public.app_role;
  ELSIF _type = 'staff' THEN
    _role := 'staff'::public.app_role;
  ELSE
    _role := 'customer'::public.app_role;
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
