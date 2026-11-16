-- DrinkFlow Expenses & Monthly Payroll
-- Apply once in Supabase SQL Editor. All finance records are Owner-only.

create or replace function public.drinkflow_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner' and p.is_active = true
  );
$$;

revoke all on function public.drinkflow_is_owner() from public;
grant execute on function public.drinkflow_is_owner() to authenticated;

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  category_id uuid references public.expense_categories(id) on delete restrict,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','qris','transfer')),
  receipt_url text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  position text,
  hire_date date,
  base_salary numeric(14,2) not null default 0 check (base_salary >= 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,
  status text not null default 'draft' check (status in ('draft','paid')),
  total_amount numeric(14,2) not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  base_salary numeric(14,2) not null default 0 check (base_salary >= 0),
  allowance numeric(14,2) not null default 0 check (allowance >= 0),
  bonus numeric(14,2) not null default 0 check (bonus >= 0),
  deduction numeric(14,2) not null default 0 check (deduction >= 0),
  net_amount numeric(14,2) generated always as (base_salary + allowance + bonus - deduction) stored,
  payment_method text check (payment_method in ('cash','transfer')),
  payment_reference text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique(period_id, employee_id)
);

create index if not exists expenses_date_idx on public.expenses(expense_date desc);
create index if not exists payroll_period_month_idx on public.payroll_periods(period_month desc);
create index if not exists payroll_items_period_idx on public.payroll_items(period_id);

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.employees enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_items enable row level security;

drop policy if exists "Owner manages expense categories" on public.expense_categories;
create policy "Owner manages expense categories" on public.expense_categories
for all to authenticated using (public.drinkflow_is_owner()) with check (public.drinkflow_is_owner());

drop policy if exists "Owner manages expenses" on public.expenses;
create policy "Owner manages expenses" on public.expenses
for all to authenticated using (public.drinkflow_is_owner()) with check (public.drinkflow_is_owner());

drop policy if exists "Owner manages employees" on public.employees;
create policy "Owner manages employees" on public.employees
for all to authenticated using (public.drinkflow_is_owner()) with check (public.drinkflow_is_owner());

drop policy if exists "Owner manages payroll periods" on public.payroll_periods;
create policy "Owner manages payroll periods" on public.payroll_periods
for all to authenticated using (public.drinkflow_is_owner()) with check (public.drinkflow_is_owner());

drop policy if exists "Owner manages payroll items" on public.payroll_items;
create policy "Owner manages payroll items" on public.payroll_items
for all to authenticated using (public.drinkflow_is_owner()) with check (public.drinkflow_is_owner());

grant select, insert, update, delete on public.expense_categories, public.expenses, public.employees, public.payroll_periods, public.payroll_items to authenticated;

insert into public.expense_categories(name) values
  ('Operasional CFD'), ('Konsumsi'), ('Transportasi'), ('Perlengkapan'),
  ('Utilitas'), ('Sewa Tempat'), ('Lain-lain')
on conflict (name) do nothing;

comment on table public.expenses is 'Pengeluaran operasional non-pembelian stok; pembelian bahan tetap dicatat melalui Purchasing.';
comment on table public.payroll_periods is 'Periode payroll bulanan, satu pembayaran per karyawan untuk setiap periode.';
comment on table public.payroll_items is 'Rincian gaji bulanan dengan nominal gaji pokok, tunjangan, bonus, dan potongan.';
