-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  phone_number text,
  push_subscription jsonb,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;
create policy "Users can read all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- ============================================
-- GAMES
-- ============================================
create table public.games (
  id uuid default uuid_generate_v4() primary key,
  external_id text unique not null,
  sport text not null,
  home_team text not null,
  away_team text not null,
  start_time timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'final')),
  home_score integer default 0,
  away_score integer default 0,
  last_updated timestamptz default now() not null
);

alter table public.games enable row level security;
create policy "Authenticated users can read games" on public.games for select using (auth.role() = 'authenticated');

-- ============================================
-- MARKETS
-- ============================================
create table public.markets (
  id uuid default uuid_generate_v4() primary key,
  game_id uuid references public.games(id) on delete cascade not null,
  type text not null check (type in ('moneyline', 'spread', 'over_under', 'prop')),
  name text not null,
  line numeric,
  home_odds integer not null,
  away_odds integer not null,
  over_odds integer,
  under_odds integer,
  is_live boolean default false,
  last_updated timestamptz default now() not null
);

alter table public.markets enable row level security;
create policy "Authenticated users can read markets" on public.markets for select using (auth.role() = 'authenticated');

-- Unique constraint for upserts
create unique index idx_markets_game_type_name on public.markets(game_id, type, name);

-- ============================================
-- BETS
-- ============================================
create table public.bets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  game_id uuid references public.games(id) not null,
  market_id uuid references public.markets(id) not null,
  pick text not null,
  wager_amount numeric not null check (wager_amount > 0),
  odds_at_placement integer not null,
  status text not null default 'active' check (status in ('active', 'settled', 'canceled')),
  result text check (result in ('win', 'loss', 'push')),
  created_at timestamptz default now() not null,
  settled_at timestamptz
);

alter table public.bets enable row level security;
create policy "Authenticated users can read all bets" on public.bets for select using (auth.role() = 'authenticated');
create policy "Authenticated users can create bets" on public.bets for insert with check (auth.uid() = user_id);

-- ============================================
-- BET COUNTERPARTIES
-- ============================================
create table public.bet_counterparties (
  id uuid default uuid_generate_v4() primary key,
  bet_id uuid references public.bets(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  share_amount numeric not null check (share_amount > 0),
  result text check (result in ('win', 'loss', 'push')),
  payout numeric
);

alter table public.bet_counterparties enable row level security;
create policy "Authenticated users can read counterparties" on public.bet_counterparties for select using (auth.role() = 'authenticated');
create policy "Authenticated users can create counterparties" on public.bet_counterparties for insert with check (auth.role() = 'authenticated');

-- ============================================
-- LEDGER (append-only)
-- ============================================
create table public.ledger (
  id uuid default uuid_generate_v4() primary key,
  bet_id uuid references public.bets(id),
  from_user_id uuid references public.profiles(id) not null,
  to_user_id uuid references public.profiles(id) not null,
  amount numeric not null check (amount > 0),
  type text not null check (type in ('bet_settlement', 'manual_adjustment')),
  created_at timestamptz default now() not null
);

alter table public.ledger enable row level security;
create policy "Authenticated users can read ledger" on public.ledger for select using (auth.role() = 'authenticated');
create policy "Service role can insert ledger" on public.ledger for insert with check (true);

-- Prevent updates and deletes on ledger (append-only)
create or replace function prevent_ledger_modification()
returns trigger as $$
begin
  raise exception 'Ledger entries cannot be modified or deleted';
end;
$$ language plpgsql;

create trigger no_ledger_update before update on public.ledger
  for each row execute function prevent_ledger_modification();
create trigger no_ledger_delete before delete on public.ledger
  for each row execute function prevent_ledger_modification();

-- ============================================
-- NET BALANCES VIEW
-- ============================================
create or replace view public.net_balances as
select
  from_user_id,
  to_user_id,
  sum(amount) as total_owed
from public.ledger
group by from_user_id, to_user_id;

-- ============================================
-- INDEXES
-- ============================================
create index idx_games_sport_status on public.games(sport, status);
create index idx_games_start_time on public.games(start_time);
create index idx_markets_game_id on public.markets(game_id);
create index idx_bets_user_id on public.bets(user_id);
create index idx_bets_game_id on public.bets(game_id);
create index idx_bets_status on public.bets(status);
create index idx_ledger_users on public.ledger(from_user_id, to_user_id);

-- ============================================
-- REALTIME
-- ============================================
alter publication supabase_realtime add table public.bets;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.markets;
alter publication supabase_realtime add table public.ledger;
