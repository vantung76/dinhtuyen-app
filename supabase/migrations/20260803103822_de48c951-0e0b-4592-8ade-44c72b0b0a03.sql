REVOKE ALL ON FUNCTION public.link_customer_to_existing_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_my_customer_records() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_my_customer_records() TO authenticated;