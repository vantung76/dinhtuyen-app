export type ContractStatus = "dang_tra_gop" | "da_hoan_thanh" | "qua_han";
export type PaymentMethod = "tien_mat" | "chuyen_khoan";

export type Customer = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
  created_at: string;
};

export type Machine = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  serial_number: string | null;
  price: number;
  note: string | null;
  created_at: string;
  warranty_start_date: string | null;
  warranty_months: number;
  warranty_copies: number;
  counter_start: number;
  counter_current: number;
  counter_updated_at: string | null;
};


export type ContractSummary = {
  id: string;
  code: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  machine_id: string;
  machine_name: string;
  machine_code: string;
  total_value: number;
  down_payment: number;
  months: number;
  interest_rate: number;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  monthly_payment: number;
  note: string | null;
  created_at: string;
  payments_total: number;
  total_paid: number;
  remaining: number;
  payments_count: number;
  last_payment_date: string | null;
};

export type Payment = {
  id: string;
  code: string;
  contract_id: string;
  paid_at: string;
  amount: number;
  method: PaymentMethod;
  collector_id: string | null;
  collector_name: string | null;
  note: string | null;
  created_at: string;
};
