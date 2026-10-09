-- DailyEarn starter schema for Supabase SQL Editor.
-- Keep the service-role key only in Cloudflare Worker secrets. Never expose it in frontend JS.
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id text unique not null,
  username text,
  first_name text not null default 'Player',
  points bigint not null default 0 check (points >= 0),
  energy integer not null default 5 check (energy between 0 and 5),
  streak integer not null default 0 check (streak >= 0),
  referral_code text unique default encode(gen_random_bytes(6),'hex'),
  referred_by uuid references public.users(id),
  last_checkin date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  type text not null check (type in ('daily_checkin','ad_reward','referral_bonus','task_reward','withdrawal','withdrawal_reversal','admin_adjustment')),
  label text not null,
  amount bigint not null,
  status text not null default 'confirmed' check (status in ('pending','confirmed','rejected','reversed')),
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  provider_event_id text unique,
  provider text not null default 'monetag',
  event_type text not null,
  monetized boolean not null default false,
  estimated_revenue numeric(12,6),
  points_awarded bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id),
  referred_id uuid not null unique references public.users(id),
  status text not null default 'pending' check (status in ('pending','qualified','rejected')),
  bonus_points bigint not null default 0,
  created_at timestamptz not null default now(),
  qualified_at timestamptz
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  points_amount bigint not null check (points_amount > 0),
  cash_amount numeric(12,2),
  currency text not null default 'NGN',
  payout_method text not null,
  account_name text,
  account_number text,
  status text not null default 'pending' check (status in ('pending','approved','processing','paid','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.users enable row level security;
alter table public.transactions enable row level security;
alter table public.ad_events enable row level security;
alter table public.referrals enable row level security;
alter table public.withdrawals enable row level security;
-- No anon/authenticated policies are created intentionally. The Worker uses service-role access.

create or replace function public.claim_daily_checkin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.users%rowtype;
  today_date date := (now() at time zone 'UTC')::date;
  reward_points bigint := 100;
begin
  select * into u from public.users where id = p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  if u.last_checkin = today_date then raise exception 'Already claimed today'; end if;

  update public.users
    set points = points + reward_points,
        streak = case when last_checkin = today_date - 1 then streak + 1 else 1 end,
        last_checkin = today_date,
        updated_at = now()
    where id = p_user_id
    returning * into u;

  insert into public.transactions(user_id,type,label,amount,status,idempotency_key)
    values(p_user_id,'daily_checkin','Daily check-in',reward_points,'confirmed','checkin:'||p_user_id::text||':'||today_date::text)
    on conflict (idempotency_key) do nothing;

  return jsonb_build_object('ok',true,'points',u.points,'streak',u.streak);
end;
$$;

-- Return basic profile fields. The Worker refreshes the user record using its service role.
