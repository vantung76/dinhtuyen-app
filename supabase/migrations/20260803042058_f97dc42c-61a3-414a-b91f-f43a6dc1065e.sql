DO $$ BEGIN
  CREATE TYPE public.payment_type AS ENUM ('tra_gop','tra_thang');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS payment_type public.payment_type NOT NULL DEFAULT 'tra_gop';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_type public.payment_type NOT NULL DEFAULT 'tra_gop';

CREATE OR REPLACE VIEW public.contract_summaries AS
SELECT c.id,
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
    COALESCE(p.paid_sum, 0::numeric) AS payments_total,
    c.down_payment + COALESCE(p.paid_sum, 0::numeric) AS total_paid,
    c.total_value - (c.down_payment + COALESCE(p.paid_sum, 0::numeric)) AS remaining,
    COALESCE(p.paid_count, 0::bigint) AS payments_count,
    ( SELECT max(px.paid_at) AS max
           FROM payments px
          WHERE px.contract_id = c.id) AS last_payment_date,
    c.payment_type,
    cu.payment_type AS customer_payment_type
   FROM contracts c
     JOIN customers cu ON cu.id = c.customer_id
     JOIN machines m ON m.id = c.machine_id
     LEFT JOIN ( SELECT payments.contract_id,
            sum(payments.amount) AS paid_sum,
            count(*) AS paid_count
           FROM payments
          GROUP BY payments.contract_id) p ON p.contract_id = c.id;