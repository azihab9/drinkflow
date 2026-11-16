-- DrinkFlow cashier ID + 6-digit PIN authentication
-- Apply once in Supabase SQL Editor. PIN hashes are only accessible to service_role.
CREATE TABLE IF NOT EXISTS public.cashier_access (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cashier_code text NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cashier_access_code_format CHECK (cashier_code ~ '^KSR[0-9]{3,8}$')
);

ALTER TABLE public.cashier_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cashier_access FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.cashier_access TO service_role;

COMMENT ON TABLE public.cashier_access IS
  'Private cashier login credentials. PINs are bcrypt hashes; access only via cashier-auth Edge Function.';
