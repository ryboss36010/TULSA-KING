# TULSA KING Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a private P2P sportsbook web app for 3 friends with live odds, automatic bet settlement, and a secure append-only ledger.

**Architecture:** Next.js app hosted on Vercel, Supabase for auth/database/realtime, Cloudflare Worker as odds proxy + cron for game sync and auto-settlement, Twilio for SMS, Web Push API for browser notifications.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Supabase (Postgres + Auth + Realtime), Cloudflare Workers (Wrangler), The Odds API, Twilio, framer-motion (swipe gesture), Web Push API

---

## Task 1: Project Scaffolding & Config

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `.env.local`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

**Step 1: Initialize Next.js project**

Run:
```bash
cd "/Users/ryboss/Documents/TULSA KING"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr framer-motion twilio web-push
npm install -D supabase
```

**Step 3: Create `.env.local`**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# The Odds API
ODDS_API_KEY=your_odds_api_key

# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_number

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
```

**Step 4: Verify dev server starts**

Run: `npm run dev`
Expected: App running on localhost:3000

**Step 5: Initialize git and commit**

Run:
```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Supabase Project Setup & Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Initialize Supabase locally**

Run:
```bash
npx supabase init
```

**Step 2: Write the migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS (extends Supabase auth.users)
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
create policy "Only service role can insert ledger" on public.ledger for insert with check (true);

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
```

**Step 3: Link to remote Supabase project and push migration**

Run:
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

**Step 4: Verify tables exist in Supabase dashboard**

Check the Supabase web dashboard → Table Editor. All 6 tables should be visible.

**Step 5: Commit**

Run:
```bash
git add supabase/
git commit -m "feat: add database schema with RLS and append-only ledger"
```

---

## Task 3: Supabase Client & Auth

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`

**Step 1: Create Supabase browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create Supabase server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — ignore
          }
        },
      },
    }
  );
}
```

**Step 3: Create auth middleware**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

Create `src/middleware.ts`:

```typescript
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**Step 4: Create login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: `${username}@tulsa-king.local`,
      password,
    });

    if (error) {
      setError("Invalid username or password");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-6 bg-gray-900 p-8 rounded-2xl"
      >
        <h1 className="text-3xl font-bold text-white text-center">
          TULSA KING
        </h1>
        <div>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-green-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-green-500 focus:outline-none"
            required
          />
        </div>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
```

**Step 5: Test login page renders**

Run: `npm run dev`
Navigate to `localhost:3000/login` — form should render with dark theme.

**Step 6: Commit**

```bash
git add src/lib/ src/middleware.ts src/app/login/
git commit -m "feat: add Supabase auth with login page and middleware"
```

---

## Task 4: Database Types & Shared Utilities

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/odds.ts`

**Step 1: Create TypeScript types matching the schema**

Create `src/lib/types.ts`:

```typescript
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  push_subscription: object | null;
  created_at: string;
}

export interface Game {
  id: string;
  external_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: "upcoming" | "live" | "final";
  home_score: number;
  away_score: number;
  last_updated: string;
}

export interface Market {
  id: string;
  game_id: string;
  type: "moneyline" | "spread" | "over_under" | "prop";
  name: string;
  line: number | null;
  home_odds: number;
  away_odds: number;
  over_odds: number | null;
  under_odds: number | null;
  is_live: boolean;
  last_updated: string;
}

export interface Bet {
  id: string;
  user_id: string;
  game_id: string;
  market_id: string;
  pick: string;
  wager_amount: number;
  odds_at_placement: number;
  status: "active" | "settled" | "canceled";
  result: "win" | "loss" | "push" | null;
  created_at: string;
  settled_at: string | null;
}

export interface BetCounterparty {
  id: string;
  bet_id: string;
  user_id: string;
  share_amount: number;
  result: "win" | "loss" | "push" | null;
  payout: number | null;
}

export interface LedgerEntry {
  id: string;
  bet_id: string | null;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  type: "bet_settlement" | "manual_adjustment";
  created_at: string;
}

export interface NetBalance {
  from_user_id: string;
  to_user_id: string;
  total_owed: number;
}

// Enriched types for UI
export interface BetWithDetails extends Bet {
  game: Game;
  market: Market;
  counterparties: (BetCounterparty & { profile: Profile })[];
  placer: Profile;
}

export type Sport =
  | "americanfootball_nfl"
  | "americanfootball_ncaaf"
  | "basketball_nba"
  | "basketball_ncaab"
  | "baseball_mlb"
  | "icehockey_nhl"
  | "soccer_usa_mls"
  | "soccer_epl"
  | "golf_pga"
  | "tennis_atp"
  | "mma_mixed_martial_arts";

export const SPORT_LABELS: Record<string, string> = {
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "College Football",
  basketball_nba: "NBA",
  basketball_ncaab: "College Basketball",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
  soccer_usa_mls: "MLS",
  soccer_epl: "Premier League",
  golf_pga: "PGA Golf",
  tennis_atp: "Tennis",
  mma_mixed_martial_arts: "UFC/MMA",
};
```

**Step 2: Create odds utility functions**

Create `src/lib/odds.ts`:

```typescript
/**
 * Convert American odds to decimal odds.
 * +150 → 2.50, -200 → 1.50
 */
export function americanToDecimal(odds: number): number {
  if (odds > 0) return odds / 100 + 1;
  return 100 / Math.abs(odds) + 1;
}

/**
 * Calculate potential payout from a wager and American odds.
 */
export function calculatePayout(wager: number, odds: number): number {
  return wager * americanToDecimal(odds);
}

/**
 * Format American odds for display.
 * +150 → "+150", -200 → "-200"
 */
export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/**
 * Calculate counterparty liability.
 * If bettor wagers $20 at +150, potential profit is $30.
 * The two counterparties split $30 risk ($15 each).
 * If bettor wagers $20 at -200, potential profit is $10.
 * The two counterparties split $10 risk ($5 each).
 */
export function calculateCounterpartyShare(
  wager: number,
  odds: number
): number {
  const profit = calculatePayout(wager, odds) - wager;
  return profit / 2;
}
```

**Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/odds.ts
git commit -m "feat: add TypeScript types and odds utility functions"
```

---

## Task 5: Cloudflare Worker — Odds Proxy & Game Sync

**Files:**
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`
- Create: `worker/package.json`

**Step 1: Scaffold the Worker project**

Run:
```bash
mkdir -p "/Users/ryboss/Documents/TULSA KING/worker"
cd "/Users/ryboss/Documents/TULSA KING/worker"
npm init -y
npm install wrangler --save-dev
npm install @supabase/supabase-js
```

**Step 2: Create wrangler config**

Create `worker/wrangler.toml`:

```toml
name = "tulsa-king-odds"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[triggers]
crons = ["*/5 * * * *"]

[vars]
SUPABASE_URL = "your_supabase_url"

# Set secrets via: wrangler secret put ODDS_API_KEY
# Set secrets via: wrangler secret put SUPABASE_SERVICE_KEY
```

**Step 3: Write the Worker**

Create `worker/src/index.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

interface Env {
  ODDS_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

const SPORTS = [
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "basketball_ncaab",
  "baseball_mlb",
  "icehockey_nhl",
  "soccer_usa_mls",
  "soccer_epl",
  "mma_mixed_martial_arts",
];

export default {
  // HTTP handler — proxy for live odds requests from the frontend
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /odds/:sport/:eventId — live odds for a specific game
    if (path.startsWith("/odds/")) {
      const parts = path.split("/").filter(Boolean);
      const sport = parts[1];
      const eventId = parts[2];

      let apiUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
      if (eventId) {
        apiUrl += `&eventIds=${eventId}`;
      }

      const response = await fetch(apiUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /scores/:sport — live scores
    if (path.startsWith("/scores/")) {
      const sport = path.split("/")[2];
      const apiUrl = `https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${env.ODDS_API_KEY}&daysFrom=1`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /sports — list available sports
    if (path === "/sports") {
      const apiUrl = `https://api.the-odds-api.com/v4/sports/?apiKey=${env.ODDS_API_KEY}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },

  // Cron handler — syncs games and settles bets every 5 minutes
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // 1. Sync upcoming games for each sport
    for (const sport of SPORTS) {
      try {
        const response = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${env.ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`
        );
        const events: any[] = await response.json();

        for (const event of events) {
          const gameData = {
            external_id: event.id,
            sport,
            home_team: event.home_team,
            away_team: event.away_team,
            start_time: event.commence_time,
            status: new Date(event.commence_time) <= new Date() ? "live" : "upcoming",
            last_updated: new Date().toISOString(),
          };

          await supabase
            .from("games")
            .upsert(gameData, { onConflict: "external_id" });

          // Upsert markets for this game
          const { data: game } = await supabase
            .from("games")
            .select("id")
            .eq("external_id", event.id)
            .single();

          if (game && event.bookmakers?.length > 0) {
            const bookmaker = event.bookmakers[0]; // Use first bookmaker
            for (const market of bookmaker.markets) {
              const marketData = buildMarketData(game.id, market);
              if (marketData) {
                await supabase
                  .from("markets")
                  .upsert(marketData, {
                    onConflict: "game_id,type,name",
                  });
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error syncing ${sport}:`, e);
      }
    }

    // 2. Check for completed games and settle bets
    for (const sport of SPORTS) {
      try {
        const response = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/scores/?apiKey=${env.ODDS_API_KEY}&daysFrom=3`
        );
        const scores: any[] = await response.json();

        for (const score of scores) {
          if (!score.completed) continue;

          // Update game to final
          const { data: game } = await supabase
            .from("games")
            .update({
              status: "final",
              home_score: parseInt(score.scores?.find((s: any) => s.name === score.home_team)?.score || "0"),
              away_score: parseInt(score.scores?.find((s: any) => s.name === score.away_team)?.score || "0"),
              last_updated: new Date().toISOString(),
            })
            .eq("external_id", score.id)
            .eq("status", "live")
            .select()
            .single();

          if (!game) continue;

          // Settle active bets on this game
          const { data: activeBets } = await supabase
            .from("bets")
            .select("*, market:markets(*), counterparties:bet_counterparties(*)")
            .eq("game_id", game.id)
            .eq("status", "active");

          if (!activeBets) continue;

          for (const bet of activeBets) {
            const result = determineBetResult(bet, game);
            await settleBet(supabase, bet, result);
          }
        }
      } catch (e) {
        console.error(`Error settling ${sport}:`, e);
      }
    }
  },
};

function buildMarketData(gameId: string, market: any) {
  const outcomes = market.outcomes;
  if (!outcomes || outcomes.length < 2) return null;

  if (market.key === "h2h") {
    return {
      game_id: gameId,
      type: "moneyline",
      name: "Moneyline",
      line: null,
      home_odds: outcomes[0].price,
      away_odds: outcomes[1].price,
      is_live: false,
      last_updated: new Date().toISOString(),
    };
  }

  if (market.key === "spreads") {
    return {
      game_id: gameId,
      type: "spread",
      name: `Spread ${outcomes[0].point > 0 ? "+" : ""}${outcomes[0].point}`,
      line: outcomes[0].point,
      home_odds: outcomes[0].price,
      away_odds: outcomes[1].price,
      is_live: false,
      last_updated: new Date().toISOString(),
    };
  }

  if (market.key === "totals") {
    return {
      game_id: gameId,
      type: "over_under",
      name: `O/U ${outcomes[0].point}`,
      line: outcomes[0].point,
      home_odds: outcomes[0].price,
      away_odds: outcomes[1].price,
      over_odds: outcomes[0].price,
      under_odds: outcomes[1].price,
      is_live: false,
      last_updated: new Date().toISOString(),
    };
  }

  return null;
}

function determineBetResult(
  bet: any,
  game: any
): "win" | "loss" | "push" {
  const market = bet.market;
  const homeWon = game.home_score > game.away_score;
  const totalPoints = game.home_score + game.away_score;

  if (market.type === "moneyline") {
    if (game.home_score === game.away_score) return "push";
    if (bet.pick === "home" && homeWon) return "win";
    if (bet.pick === "away" && !homeWon) return "win";
    return "loss";
  }

  if (market.type === "spread") {
    const adjustedScore =
      bet.pick === "home"
        ? game.home_score + market.line
        : game.away_score - market.line;
    const opponentScore =
      bet.pick === "home" ? game.away_score : game.home_score;

    if (adjustedScore === opponentScore) return "push";
    if (adjustedScore > opponentScore) return "win";
    return "loss";
  }

  if (market.type === "over_under") {
    if (totalPoints === market.line) return "push";
    if (bet.pick === "over" && totalPoints > market.line) return "win";
    if (bet.pick === "under" && totalPoints < market.line) return "win";
    return "loss";
  }

  return "loss";
}

async function settleBet(
  supabase: any,
  bet: any,
  result: "win" | "loss" | "push"
) {
  const now = new Date().toISOString();

  // Update bet status
  await supabase
    .from("bets")
    .update({ status: "settled", result, settled_at: now })
    .eq("id", bet.id);

  // Update counterparties
  const counterpartyResult = result === "win" ? "loss" : result === "loss" ? "win" : "push";
  for (const cp of bet.counterparties) {
    await supabase
      .from("bet_counterparties")
      .update({ result: counterpartyResult, payout: cp.share_amount })
      .eq("id", cp.id);
  }

  // Write ledger entries
  if (result === "win") {
    // Bettor wins — each counterparty owes their share
    const profit =
      bet.wager_amount *
        (bet.odds_at_placement > 0
          ? bet.odds_at_placement / 100
          : 100 / Math.abs(bet.odds_at_placement)) ;
    const perPerson = profit / 2;

    for (const cp of bet.counterparties) {
      await supabase.from("ledger").insert({
        bet_id: bet.id,
        from_user_id: cp.user_id,
        to_user_id: bet.user_id,
        amount: perPerson,
        type: "bet_settlement",
      });
    }
  } else if (result === "loss") {
    // Bettor loses — bettor owes each counterparty their share
    const perPerson = bet.wager_amount / 2;

    for (const cp of bet.counterparties) {
      await supabase.from("ledger").insert({
        bet_id: bet.id,
        from_user_id: bet.user_id,
        to_user_id: cp.user_id,
        amount: perPerson,
        type: "bet_settlement",
      });
    }
  }
  // Push result — no money changes hands
}
```

**Step 4: Add unique constraint for market upserts**

Add to migration or run directly:
```sql
create unique index idx_markets_game_type_name on public.markets(game_id, type, name);
```

**Step 5: Commit**

```bash
git add worker/
git commit -m "feat: add Cloudflare Worker for odds proxy and auto-settlement"
```

---

## Task 6: App Layout, Navigation & Theme

**Files:**
- Create: `src/app/globals.css` (update)
- Create: `src/components/layout/BottomNav.tsx`
- Create: `src/components/layout/TopNav.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Update global styles for dark sportsbook theme**

Update `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0a0e17;
  --bg-secondary: #111827;
  --bg-card: #1a2235;
  --accent-green: #22c55e;
  --accent-yellow: #eab308;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

/* Hide scrollbar for cleaner mobile UX */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

**Step 2: Create bottom navigation (mobile)**

Create `src/components/layout/BottomNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/live", label: "Live", icon: "🔴" },
  { href: "/sports", label: "Sports", icon: "🏈" },
  { href: "/my-bets", label: "My Bets", icon: "🎫" },
  { href: "/dashboard", label: "Stats", icon: "📊" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 md:hidden">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 text-xs ${
                isActive ? "text-green-500" : "text-gray-400"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 3: Create top navigation (desktop)**

Create `src/components/layout/TopNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/sports", label: "Sports" },
  { href: "/my-bets", label: "My Bets" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ledger", label: "Ledger" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center justify-between px-6 h-16 bg-gray-900 border-b border-gray-800">
      <Link href="/" className="text-xl font-bold text-white tracking-wider">
        TULSA KING
      </Link>
      <div className="flex gap-6">
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium ${
                isActive
                  ? "text-green-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <Link
        href="/settings"
        className="text-gray-400 hover:text-white text-sm"
      >
        Settings
      </Link>
    </nav>
  );
}
```

**Step 4: Create app shell**

Create `src/components/layout/AppShell.tsx`:

```tsx
import TopNav from "./TopNav";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <TopNav />
      <main className="pb-20 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}
```

**Step 5: Update root layout**

Modify `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TULSA KING",
  description: "Private P2P Sportsbook",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

**Step 6: Verify layout renders**

Run: `npm run dev`
Check mobile width — bottom nav visible. Desktop width — top nav visible.

**Step 7: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat: add app shell with responsive navigation"
```

---

## Task 7: Home Page — Sportsbook Landing

**Files:**
- Create: `src/app/(app)/page.tsx`
- Create: `src/components/sports/GameCard.tsx`
- Create: `src/components/sports/SportSection.tsx`
- Create: `src/components/sports/OddsButton.tsx`

**Step 1: Create the OddsButton component**

Create `src/components/sports/OddsButton.tsx`:

```tsx
"use client";

import { formatOdds } from "@/lib/odds";

interface OddsButtonProps {
  label: string;
  odds: number;
  isSelected?: boolean;
  onClick: () => void;
}

export default function OddsButton({
  label,
  odds,
  isSelected,
  onClick,
}: OddsButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center px-4 py-2 rounded-lg border transition-colors ${
        isSelected
          ? "bg-green-600 border-green-500 text-white"
          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
      }`}
    >
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-bold">{formatOdds(odds)}</span>
    </button>
  );
}
```

**Step 2: Create the GameCard component**

Create `src/components/sports/GameCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import type { Game, Market } from "@/lib/types";
import OddsButton from "./OddsButton";

interface GameCardProps {
  game: Game;
  markets: Market[];
  onSelectBet: (game: Game, market: Market, pick: string) => void;
}

export default function GameCard({ game, markets, onSelectBet }: GameCardProps) {
  const moneyline = markets.find((m) => m.type === "moneyline");
  const spread = markets.find((m) => m.type === "spread");
  const total = markets.find((m) => m.type === "over_under");

  const startTime = new Date(game.start_time);
  const isLive = game.status === "live";

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Game header — tappable to go to game detail */}
      <Link
        href={`/sports/${game.sport}/${game.id}`}
        className="block px-4 py-3 hover:bg-gray-800/50 transition"
      >
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-white font-medium">{game.away_team}</p>
            <p className="text-white font-medium">{game.home_team}</p>
          </div>
          <div className="text-right">
            {isLive ? (
              <div className="flex items-center gap-2">
                <span className="text-red-500 text-xs font-bold animate-pulse">
                  LIVE
                </span>
                <div className="text-right">
                  <p className="text-white">{game.away_score}</p>
                  <p className="text-white">{game.home_score}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-xs">
                {startTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                <br />
                {startTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* Odds row */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2">
        {spread && (
          <>
            <OddsButton
              label={`${spread.line! > 0 ? "+" : ""}${spread.line}`}
              odds={spread.home_odds}
              onClick={() => onSelectBet(game, spread, "home")}
            />
            <OddsButton
              label={`${-spread.line! > 0 ? "+" : ""}${-spread.line!}`}
              odds={spread.away_odds}
              onClick={() => onSelectBet(game, spread, "away")}
            />
          </>
        )}
        {total && (
          <>
            <OddsButton
              label={`O ${total.line}`}
              odds={total.over_odds!}
              onClick={() => onSelectBet(game, total, "over")}
            />
            <OddsButton
              label={`U ${total.line}`}
              odds={total.under_odds!}
              onClick={() => onSelectBet(game, total, "under")}
            />
          </>
        )}
        {moneyline && (
          <>
            <OddsButton
              label="ML"
              odds={moneyline.home_odds}
              onClick={() => onSelectBet(game, moneyline, "home")}
            />
            <OddsButton
              label="ML"
              odds={moneyline.away_odds}
              onClick={() => onSelectBet(game, moneyline, "away")}
            />
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create SportSection component**

Create `src/components/sports/SportSection.tsx`:

```tsx
import type { Game, Market } from "@/lib/types";
import { SPORT_LABELS } from "@/lib/types";
import GameCard from "./GameCard";

interface SportSectionProps {
  sport: string;
  games: Game[];
  markets: Market[];
  onSelectBet: (game: Game, market: Market, pick: string) => void;
}

export default function SportSection({
  sport,
  games,
  markets,
  onSelectBet,
}: SportSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-white px-1">
        {SPORT_LABELS[sport] || sport}
      </h2>
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          markets={markets.filter((m) => m.game_id === game.id)}
          onSelectBet={onSelectBet}
        />
      ))}
    </section>
  );
}
```

**Step 4: Create the home page**

Create `src/app/(app)/page.tsx` (using route group for authenticated pages):

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import SportSection from "@/components/sports/SportSection";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { addSelection } = useBetSlip();

  useEffect(() => {
    async function fetchGames() {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .in("status", ["upcoming", "live"])
        .order("start_time", { ascending: true })
        .limit(50);

      if (gamesData) {
        setGames(gamesData);

        const gameIds = gamesData.map((g) => g.id);
        const { data: marketsData } = await supabase
          .from("markets")
          .select("*")
          .in("game_id", gameIds);

        if (marketsData) setMarkets(marketsData);
      }
      setLoading(false);
    }

    fetchGames();

    // Subscribe to live updates
    const channel = supabase
      .channel("home-games")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        (payload) => {
          setGames((prev) => {
            const updated = payload.new as Game;
            const idx = prev.findIndex((g) => g.id === updated.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = updated;
              return copy;
            }
            return [...prev, updated];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function handleSelectBet(game: Game, market: Market, pick: string) {
    addSelection({ game, market, pick });
  }

  // Group games by sport
  const gamesBySport = games.reduce(
    (acc, game) => {
      if (!acc[game.sport]) acc[game.sport] = [];
      acc[game.sport].push(game);
      return acc;
    },
    {} as Record<string, Game[]>
  );

  // Live games first
  const liveGames = games.filter((g) => g.status === "live");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {/* Live games banner */}
      {liveGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-bold text-white">Live Now</h2>
          </div>
          {liveGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              markets={markets.filter((m) => m.game_id === game.id)}
              onSelectBet={handleSelectBet}
            />
          ))}
        </section>
      )}

      {/* Games by sport */}
      {Object.entries(gamesBySport).map(([sport, sportGames]) => (
        <SportSection
          key={sport}
          sport={sport}
          games={sportGames.filter((g) => g.status !== "live")}
          markets={markets}
          onSelectBet={handleSelectBet}
        />
      ))}
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/app/ src/components/sports/
git commit -m "feat: add sportsbook home page with game cards and odds buttons"
```

---

## Task 8: Bet Slip with Swipe-to-Confirm

**Files:**
- Create: `src/components/betslip/BetSlipContext.tsx`
- Create: `src/components/betslip/BetSlip.tsx`
- Create: `src/components/betslip/SwipeToConfirm.tsx`

**Step 1: Create bet slip context/state**

Create `src/components/betslip/BetSlipContext.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Game, Market } from "@/lib/types";

export interface BetSelection {
  game: Game;
  market: Market;
  pick: string;
  wager: number;
}

interface BetSlipContextValue {
  selections: BetSelection[];
  addSelection: (sel: Omit<BetSelection, "wager">) => void;
  removeSelection: (index: number) => void;
  updateWager: (index: number, wager: number) => void;
  clearSlip: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  function addSelection(sel: Omit<BetSelection, "wager">) {
    setSelections((prev) => [...prev, { ...sel, wager: 0 }]);
    setIsOpen(true);
  }

  function removeSelection(index: number) {
    setSelections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateWager(index: number, wager: number) {
    setSelections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, wager } : s))
    );
  }

  function clearSlip() {
    setSelections([]);
    setIsOpen(false);
  }

  return (
    <BetSlipContext.Provider
      value={{
        selections,
        addSelection,
        removeSelection,
        updateWager,
        clearSlip,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used within BetSlipProvider");
  return ctx;
}
```

**Step 2: Create swipe-to-confirm component**

Create `src/components/betslip/SwipeToConfirm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface SwipeToConfirmProps {
  onConfirm: () => void;
  disabled?: boolean;
}

export default function SwipeToConfirm({
  onConfirm,
  disabled,
}: SwipeToConfirmProps) {
  const [confirmed, setConfirmed] = useState(false);
  const x = useMotionValue(0);
  const trackWidth = 280;
  const thumbWidth = 64;
  const maxDrag = trackWidth - thumbWidth;

  const bgOpacity = useTransform(x, [0, maxDrag], [0.3, 1]);
  const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);

  function handleDragEnd() {
    if (x.get() > maxDrag * 0.85) {
      setConfirmed(true);
      // Trigger haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
      onConfirm();
      // Reset after animation
      setTimeout(() => {
        setConfirmed(false);
        x.set(0);
      }, 1500);
    } else {
      x.set(0);
    }
  }

  return (
    <div
      className="relative rounded-full overflow-hidden"
      style={{ width: trackWidth, height: 56 }}
    >
      {/* Track background */}
      <motion.div
        className="absolute inset-0 bg-green-600 rounded-full"
        style={{ opacity: bgOpacity }}
      />

      {/* Text */}
      <motion.span
        className="absolute inset-0 flex items-center justify-center text-white font-semibold text-sm pointer-events-none"
        style={{ opacity: textOpacity }}
      >
        {confirmed ? "✓ Bet Placed!" : "Swipe to confirm"}
      </motion.span>

      {/* Draggable thumb */}
      {!confirmed && (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className={`absolute top-1 left-1 w-12 h-12 rounded-full bg-white flex items-center justify-center cursor-grab active:cursor-grabbing ${
            disabled ? "opacity-50" : ""
          }`}
        >
          <span className="text-green-600 font-bold text-lg">→</span>
        </motion.div>
      )}
    </div>
  );
}
```

**Step 3: Create the bet slip panel**

Create `src/components/betslip/BetSlip.tsx`:

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useBetSlip } from "./BetSlipContext";
import SwipeToConfirm from "./SwipeToConfirm";
import { formatOdds, calculatePayout } from "@/lib/odds";
import { createClient } from "@/lib/supabase/client";

export default function BetSlip() {
  const {
    selections,
    removeSelection,
    updateWager,
    clearSlip,
    isOpen,
    setIsOpen,
  } = useBetSlip();
  const supabase = createClient();

  async function handleConfirm() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get all other users (counterparties)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .neq("id", user.id);

    if (!profiles || profiles.length < 2) return;

    for (const sel of selections) {
      // Create the bet
      const { data: bet } = await supabase
        .from("bets")
        .insert({
          user_id: user.id,
          game_id: sel.game.id,
          market_id: sel.market.id,
          pick: sel.pick,
          wager_amount: sel.wager,
          odds_at_placement: getOddsForPick(sel.market, sel.pick),
          status: "active",
        })
        .select()
        .single();

      if (!bet) continue;

      // Create counterparties — split equally between the other 2
      const shareAmount = sel.wager / 2;
      const counterparties = profiles.map((p) => ({
        bet_id: bet.id,
        user_id: p.id,
        share_amount: shareAmount,
      }));

      await supabase.from("bet_counterparties").insert(counterparties);

      // Fire notification via API route
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betId: bet.id,
          type: "new_bet",
        }),
      });
    }

    clearSlip();
  }

  const totalWager = selections.reduce((sum, s) => sum + (s.wager || 0), 0);
  const allValid = selections.every((s) => s.wager > 0);

  return (
    <>
      {/* Collapsed tab */}
      {selections.length > 0 && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40 bg-green-600 text-white py-3 px-4 rounded-xl font-semibold flex justify-between items-center"
        >
          <span>Bet Slip ({selections.length})</span>
          <span>${totalWager.toFixed(2)}</span>
        </button>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 md:right-0 md:left-auto md:w-96 md:top-16 z-50 bg-gray-900 border-t md:border-l border-gray-800 flex flex-col max-h-[80vh] md:max-h-full rounded-t-2xl md:rounded-none"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
              <h3 className="text-white font-bold">
                Bet Slip ({selections.length})
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Selections */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selections.map((sel, i) => {
                const odds = getOddsForPick(sel.market, sel.pick);
                const payout =
                  sel.wager > 0 ? calculatePayout(sel.wager, odds) : 0;

                return (
                  <div
                    key={i}
                    className="bg-gray-800 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white text-sm font-medium">
                          {sel.game.away_team} @ {sel.game.home_team}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {sel.market.name} · {sel.pick.toUpperCase()} ·{" "}
                          {formatOdds(odds)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSelection(i)}
                        className="text-gray-500 hover:text-red-400 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          $
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="0"
                          value={sel.wager || ""}
                          onChange={(e) =>
                            updateWager(i, parseFloat(e.target.value) || 0)
                          }
                          className="w-full pl-7 pr-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
                        />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Payout</p>
                        <p className="text-green-400 font-bold text-sm">
                          ${payout.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Swipe to confirm */}
            <div className="p-4 border-t border-gray-800 flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="text-gray-400 text-xs">Total Wager</p>
                <p className="text-white text-lg font-bold">
                  ${totalWager.toFixed(2)}
                </p>
              </div>

              {/* Mobile: swipe */}
              <div className="md:hidden">
                <SwipeToConfirm
                  onConfirm={handleConfirm}
                  disabled={!allValid}
                />
              </div>

              {/* Desktop: hold button */}
              <button
                onClick={handleConfirm}
                disabled={!allValid}
                className="hidden md:block w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                Place Bet — ${totalWager.toFixed(2)}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function getOddsForPick(market: any, pick: string): number {
  if (pick === "home") return market.home_odds;
  if (pick === "away") return market.away_odds;
  if (pick === "over") return market.over_odds;
  if (pick === "under") return market.under_odds;
  return market.home_odds;
}
```

**Step 4: Wire BetSlipProvider into layout**

Update `src/app/layout.tsx` to wrap children in `BetSlipProvider` and include `BetSlip` component.

**Step 5: Commit**

```bash
git add src/components/betslip/
git commit -m "feat: add bet slip with Robinhood swipe-to-confirm"
```

---

## Task 9: Game Detail Page

**Files:**
- Create: `src/app/(app)/sports/[sport]/[game]/page.tsx`
- Create: `src/components/sports/MarketGroup.tsx`

**Step 1: Create MarketGroup component**

Create `src/components/sports/MarketGroup.tsx`:

```tsx
"use client";

import type { Game, Market } from "@/lib/types";
import OddsButton from "./OddsButton";

interface MarketGroupProps {
  title: string;
  markets: Market[];
  game: Game;
  onSelectBet: (game: Game, market: Market, pick: string) => void;
}

export default function MarketGroup({
  title,
  markets,
  game,
  onSelectBet,
}: MarketGroupProps) {
  if (markets.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold text-sm border-b border-gray-800 pb-2">
        {title}
      </h3>
      {markets.map((market) => (
        <div
          key={market.id}
          className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3"
        >
          <span className="text-gray-300 text-sm flex-1">{market.name}</span>
          <div className="flex gap-2">
            {market.type === "over_under" ? (
              <>
                <OddsButton
                  label={`O ${market.line}`}
                  odds={market.over_odds!}
                  onClick={() => onSelectBet(game, market, "over")}
                />
                <OddsButton
                  label={`U ${market.line}`}
                  odds={market.under_odds!}
                  onClick={() => onSelectBet(game, market, "under")}
                />
              </>
            ) : (
              <>
                <OddsButton
                  label={game.home_team.split(" ").pop()!}
                  odds={market.home_odds}
                  onClick={() => onSelectBet(game, market, "home")}
                />
                <OddsButton
                  label={game.away_team.split(" ").pop()!}
                  odds={market.away_odds}
                  onClick={() => onSelectBet(game, market, "away")}
                />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create game detail page**

Create `src/app/(app)/sports/[sport]/[game]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import MarketGroup from "@/components/sports/MarketGroup";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

export default function GameDetailPage() {
  const { game: gameId } = useParams<{ sport: string; game: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [activeTab, setActiveTab] = useState("game-lines");
  const supabase = createClient();
  const { addSelection } = useBetSlip();

  useEffect(() => {
    async function load() {
      const { data: gameData } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame(gameData);

        const { data: marketData } = await supabase
          .from("markets")
          .select("*")
          .eq("game_id", gameId);

        if (marketData) setMarkets(marketData);
      }
    }

    load();

    // Realtime updates for this game
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "markets",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          setMarkets((prev) => {
            const updated = payload.new as Market;
            const idx = prev.findIndex((m) => m.id === updated.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = updated;
              return copy;
            }
            return [...prev, updated];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  if (!game) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const gameLines = markets.filter(
    (m) => m.type === "moneyline" || m.type === "spread" || m.type === "over_under"
  );
  const playerProps = markets.filter(
    (m) => m.type === "prop" && m.name.toLowerCase().includes("player")
  );
  const gameProps = markets.filter(
    (m) => m.type === "prop" && !m.name.toLowerCase().includes("player")
  );

  const tabs = [
    { id: "game-lines", label: "Game Lines", count: gameLines.length },
    { id: "player-props", label: "Player Props", count: playerProps.length },
    { id: "game-props", label: "Game Props", count: gameProps.length },
  ];

  function handleSelectBet(g: Game, market: Market, pick: string) {
    addSelection({ game: g, market, pick });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Game header */}
      <div className="text-center space-y-2">
        {game.status === "live" && (
          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-bold">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        )}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-white text-xl font-bold">{game.away_team}</p>
            {game.status === "live" && (
              <p className="text-3xl font-bold text-white">
                {game.away_score}
              </p>
            )}
          </div>
          <span className="text-gray-500 text-sm">@</span>
          <div className="text-center">
            <p className="text-white text-xl font-bold">{game.home_team}</p>
            {game.status === "live" && (
              <p className="text-3xl font-bold text-white">
                {game.home_score}
              </p>
            )}
          </div>
        </div>
        {game.status === "upcoming" && (
          <p className="text-gray-400 text-sm">
            {new Date(game.start_time).toLocaleString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* Market tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 text-xs text-gray-500">
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Market content */}
      <div className="space-y-4">
        {activeTab === "game-lines" && (
          <>
            <MarketGroup
              title="Spread"
              markets={gameLines.filter((m) => m.type === "spread")}
              game={game}
              onSelectBet={handleSelectBet}
            />
            <MarketGroup
              title="Moneyline"
              markets={gameLines.filter((m) => m.type === "moneyline")}
              game={game}
              onSelectBet={handleSelectBet}
            />
            <MarketGroup
              title="Total"
              markets={gameLines.filter((m) => m.type === "over_under")}
              game={game}
              onSelectBet={handleSelectBet}
            />
          </>
        )}
        {activeTab === "player-props" && (
          <MarketGroup
            title="Player Props"
            markets={playerProps}
            game={game}
            onSelectBet={handleSelectBet}
          />
        )}
        {activeTab === "game-props" && (
          <MarketGroup
            title="Game Props"
            markets={gameProps}
            game={game}
            onSelectBet={handleSelectBet}
          />
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/ src/components/sports/MarketGroup.tsx
git commit -m "feat: add game detail page with tabbed markets"
```

---

## Task 10: Notifications API Route (SMS + Push)

**Files:**
- Create: `src/app/api/notify/route.ts`

**Step 1: Create the notification API route**

Create `src/app/api/notify/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";
import webpush from "web-push";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

webpush.setVapidDetails(
  "mailto:admin@tulsa-king.local",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: NextRequest) {
  const { betId, type } = await request.json();

  const { data: bet } = await supabase
    .from("bets")
    .select(
      "*, game:games(*), market:markets(*), placer:profiles!bets_user_id_fkey(*), counterparties:bet_counterparties(*, profile:profiles(*))"
    )
    .eq("id", betId)
    .single();

  if (!bet) return NextResponse.json({ error: "Bet not found" }, { status: 404 });

  let message = "";

  if (type === "new_bet") {
    message = `${bet.placer.display_name} bet $${bet.wager_amount} on ${bet.game.away_team} @ ${bet.game.home_team} — ${bet.market.name} (${bet.pick}). You're on the other side for $${(bet.wager_amount / 2).toFixed(2)}.`;
  } else if (type === "settled") {
    message = `Bet settled: ${bet.game.away_team} @ ${bet.game.home_team} — ${bet.placer.display_name} ${bet.result === "win" ? "won" : bet.result === "loss" ? "lost" : "pushed"}.`;
  }

  // Send SMS to counterparties
  const recipients =
    type === "new_bet"
      ? bet.counterparties.map((cp: any) => cp.profile)
      : [bet.placer, ...bet.counterparties.map((cp: any) => cp.profile)];

  for (const recipient of recipients) {
    // SMS
    if (recipient.phone_number) {
      try {
        await twilioClient.messages.create({
          body: `TULSA KING: ${message}`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: recipient.phone_number,
        });
      } catch (e) {
        console.error("SMS failed:", e);
      }
    }

    // Web Push
    if (recipient.push_subscription) {
      try {
        await webpush.sendNotification(
          recipient.push_subscription as any,
          JSON.stringify({ title: "TULSA KING", body: message })
        );
      } catch (e) {
        console.error("Push failed:", e);
      }
    }
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/notify/
git commit -m "feat: add notification API route for SMS and push"
```

---

## Task 11: My Bets Page

**Files:**
- Create: `src/app/(app)/my-bets/page.tsx`

**Step 1: Create the my bets page**

Create `src/app/(app)/my-bets/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatOdds } from "@/lib/odds";
import type { BetWithDetails } from "@/lib/types";

type Filter = "all" | "active" | "settled";

export default function MyBetsPage() {
  const [bets, setBets] = useState<BetWithDetails[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("bets")
        .select(
          "*, game:games(*), market:markets(*), counterparties:bet_counterparties(*, profile:profiles(*)), placer:profiles!bets_user_id_fkey(*)"
        )
        .or(`user_id.eq.${user.id},bet_counterparties.user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (data) setBets(data as BetWithDetails[]);
      setLoading(false);
    }

    load();
  }, []);

  const filtered =
    filter === "all"
      ? bets
      : bets.filter((b) => (filter === "active" ? b.status === "active" : b.status === "settled"));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading bets...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">My Bets</h1>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "active", "settled"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
              filter === f
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bet list */}
      <div className="space-y-3">
        {filtered.map((bet) => (
          <div
            key={bet.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-medium text-sm">
                  {bet.game.away_team} @ {bet.game.home_team}
                </p>
                <p className="text-gray-400 text-xs">
                  {bet.market.name} · {bet.pick.toUpperCase()} ·{" "}
                  {formatOdds(bet.odds_at_placement)}
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  bet.status === "active"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : bet.result === "win"
                      ? "bg-green-500/20 text-green-400"
                      : bet.result === "loss"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-gray-500/20 text-gray-400"
                }`}
              >
                {bet.status === "active"
                  ? "ACTIVE"
                  : bet.result?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                Wager: ${bet.wager_amount}
              </span>
              <span className="text-gray-400">
                Placed by {bet.placer.display_name}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-8">No bets found</p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/my-bets/
git commit -m "feat: add My Bets page with filtering"
```

---

## Task 12: Dashboard — Full Analytics

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`

**Step 1: Create the dashboard page**

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Bet } from "@/lib/types";

interface Stats {
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalWagered: number;
  totalProfit: number;
  roi: number;
  biggestWin: number;
  currentStreak: { type: "win" | "loss"; count: number };
  bySport: Record<string, { wins: number; losses: number; profit: number }>;
}

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allBets, setAllBets] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");
      if (profilesData) setProfiles(profilesData);

      const { data: betsData } = await supabase
        .from("bets")
        .select("*, game:games(*), counterparties:bet_counterparties(*)")
        .eq("status", "settled")
        .order("settled_at", { ascending: false });

      if (betsData) setAllBets(betsData);
      setLoading(false);
    }

    load();
  }, []);

  function calculateStats(uid: string): Stats {
    const userBets = allBets.filter((b) => b.user_id === uid);
    const wins = userBets.filter((b) => b.result === "win");
    const losses = userBets.filter((b) => b.result === "loss");
    const pushes = userBets.filter((b) => b.result === "push");

    const totalWagered = userBets.reduce(
      (sum, b) => sum + Number(b.wager_amount),
      0
    );

    let totalProfit = 0;
    let biggestWin = 0;
    for (const bet of userBets) {
      if (bet.result === "win") {
        const profit =
          bet.wager_amount *
          (bet.odds_at_placement > 0
            ? bet.odds_at_placement / 100
            : 100 / Math.abs(bet.odds_at_placement));
        totalProfit += profit;
        if (profit > biggestWin) biggestWin = profit;
      } else if (bet.result === "loss") {
        totalProfit -= bet.wager_amount;
      }
    }

    // Current streak
    let streakType: "win" | "loss" = "win";
    let streakCount = 0;
    for (const bet of userBets) {
      if (bet.result === "push") continue;
      if (streakCount === 0) {
        streakType = bet.result as "win" | "loss";
        streakCount = 1;
      } else if (bet.result === streakType) {
        streakCount++;
      } else {
        break;
      }
    }

    // By sport
    const bySport: Record<string, { wins: number; losses: number; profit: number }> = {};
    for (const bet of userBets) {
      const sport = bet.game.sport;
      if (!bySport[sport]) bySport[sport] = { wins: 0, losses: 0, profit: 0 };
      if (bet.result === "win") {
        bySport[sport].wins++;
        bySport[sport].profit +=
          bet.wager_amount *
          (bet.odds_at_placement > 0
            ? bet.odds_at_placement / 100
            : 100 / Math.abs(bet.odds_at_placement));
      } else if (bet.result === "loss") {
        bySport[sport].losses++;
        bySport[sport].profit -= bet.wager_amount;
      }
    }

    return {
      totalBets: userBets.length,
      wins: wins.length,
      losses: losses.length,
      pushes: pushes.length,
      winRate: userBets.length > 0 ? (wins.length / userBets.length) * 100 : 0,
      totalWagered,
      totalProfit,
      roi: totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0,
      biggestWin,
      currentStreak: { type: streakType, count: streakCount },
      bySport,
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading stats...</div>
      </div>
    );
  }

  // Sort leaderboard by profit
  const leaderboard = profiles
    .map((p) => ({ profile: p, stats: calculateStats(p.id) }))
    .sort((a, b) => b.stats.totalProfit - a.stats.totalProfit);

  const myStats = calculateStats(userId);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Leaderboard */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((entry, i) => (
            <div
              key={entry.profile.id}
              className={`flex items-center justify-between bg-gray-900 border rounded-xl px-4 py-3 ${
                entry.profile.id === userId
                  ? "border-green-500"
                  : "border-gray-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-500">
                  #{i + 1}
                </span>
                <span className="text-white font-medium">
                  {entry.profile.display_name}
                </span>
              </div>
              <div className="text-right">
                <p
                  className={`font-bold ${
                    entry.stats.totalProfit >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {entry.stats.totalProfit >= 0 ? "+" : ""}$
                  {entry.stats.totalProfit.toFixed(2)}
                </p>
                <p className="text-gray-400 text-xs">
                  {entry.stats.wins}W - {entry.stats.losses}L
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Your Stats */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Your Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Record" value={`${myStats.wins}W - ${myStats.losses}L - ${myStats.pushes}P`} />
          <StatCard label="Win Rate" value={`${myStats.winRate.toFixed(1)}%`} />
          <StatCard
            label="Profit/Loss"
            value={`${myStats.totalProfit >= 0 ? "+" : ""}$${myStats.totalProfit.toFixed(2)}`}
            color={myStats.totalProfit >= 0 ? "green" : "red"}
          />
          <StatCard label="ROI" value={`${myStats.roi.toFixed(1)}%`} color={myStats.roi >= 0 ? "green" : "red"} />
          <StatCard label="Total Wagered" value={`$${myStats.totalWagered.toFixed(2)}`} />
          <StatCard label="Biggest Win" value={`$${myStats.biggestWin.toFixed(2)}`} color="green" />
          <StatCard
            label="Streak"
            value={`${myStats.currentStreak.count} ${myStats.currentStreak.type === "win" ? "W" : "L"}`}
            color={myStats.currentStreak.type === "win" ? "green" : "red"}
          />
          <StatCard label="Total Bets" value={`${myStats.totalBets}`} />
        </div>
      </section>

      {/* Sport Breakdown */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">By Sport</h2>
        <div className="space-y-2">
          {Object.entries(myStats.bySport).map(([sport, data]) => (
            <div
              key={sport}
              className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
            >
              <span className="text-white text-sm">{sport}</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  {data.wins}W - {data.losses}L
                </span>
                <span
                  className={`font-bold ${
                    data.profit >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {data.profit >= 0 ? "+" : ""}${data.profit.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red";
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <p className="text-gray-400 text-xs">{label}</p>
      <p
        className={`text-lg font-bold ${
          color === "green"
            ? "text-green-400"
            : color === "red"
              ? "text-red-400"
              : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/dashboard/
git commit -m "feat: add analytics dashboard with leaderboard and stats"
```

---

## Task 13: Ledger Page

**Files:**
- Create: `src/app/(app)/ledger/page.tsx`

**Step 1: Create the ledger page**

Create `src/app/(app)/ledger/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, LedgerEntry, NetBalance } from "@/lib/types";

export default function LedgerPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ledger, setLedger] = useState<(LedgerEntry & { from: Profile; to: Profile })[]>([]);
  const [netBalances, setNetBalances] = useState<NetBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");
      if (profilesData) setProfiles(profilesData);

      const { data: ledgerData } = await supabase
        .from("ledger")
        .select("*, from:profiles!ledger_from_user_id_fkey(*), to:profiles!ledger_to_user_id_fkey(*)")
        .order("created_at", { ascending: false });
      if (ledgerData) setLedger(ledgerData as any);

      const { data: balances } = await supabase
        .from("net_balances")
        .select("*");
      if (balances) setNetBalances(balances);

      setLoading(false);
    }

    load();
  }, []);

  function getNetOwed(fromId: string, toId: string): number {
    const fromTo =
      netBalances.find(
        (b) => b.from_user_id === fromId && b.to_user_id === toId
      )?.total_owed || 0;
    const toFrom =
      netBalances.find(
        (b) => b.from_user_id === toId && b.to_user_id === fromId
      )?.total_owed || 0;
    return fromTo - toFrom;
  }

  function exportCSV() {
    const rows = [
      ["Date", "From", "To", "Amount", "Type", "Bet ID"],
      ...ledger.map((entry) => [
        new Date(entry.created_at).toISOString(),
        entry.from.display_name,
        entry.to.display_name,
        entry.amount.toFixed(2),
        entry.type,
        entry.bet_id || "",
      ]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tulsa-king-ledger-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading ledger...</div>
      </div>
    );
  }

  // Build pairs for net balances display
  const pairs: { a: Profile; b: Profile; net: number }[] = [];
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const net = getNetOwed(profiles[i].id, profiles[j].id);
      pairs.push({ a: profiles[i], b: profiles[j], net });
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Ledger</h1>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700"
        >
          Export CSV
        </button>
      </div>

      {/* Net balances */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Who Owes Who</h2>
        <div className="space-y-2">
          {pairs.map(({ a, b, net }) => {
            if (Math.abs(net) < 0.01) {
              return (
                <div
                  key={`${a.id}-${b.id}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-gray-400 text-sm text-center"
                >
                  {a.display_name} and {b.display_name} are even
                </div>
              );
            }

            const owes = net > 0 ? a : b;
            const owed = net > 0 ? b : a;

            return (
              <div
                key={`${a.id}-${b.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex justify-between items-center"
              >
                <span className="text-white text-sm">
                  <span className="text-red-400 font-medium">
                    {owes.display_name}
                  </span>{" "}
                  owes{" "}
                  <span className="text-green-400 font-medium">
                    {owed.display_name}
                  </span>
                </span>
                <span className="text-white font-bold">
                  ${Math.abs(net).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Transaction history */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Transaction History</h2>
        <div className="space-y-2">
          {ledger.map((entry) => (
            <div
              key={entry.id}
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex justify-between items-center"
            >
              <div>
                <p className="text-white text-sm">
                  {entry.from.display_name} → {entry.to.display_name}
                </p>
                <p className="text-gray-500 text-xs">
                  {new Date(entry.created_at).toLocaleString()} ·{" "}
                  {entry.type.replace("_", " ")}
                </p>
              </div>
              <span className="text-white font-bold">
                ${Number(entry.amount).toFixed(2)}
              </span>
            </div>
          ))}
          {ledger.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              No transactions yet
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/ledger/
git commit -m "feat: add ledger page with net balances and CSV export"
```

---

## Task 14: Live Betting Page & Sport Pages

**Files:**
- Create: `src/app/(app)/live/page.tsx`
- Create: `src/app/(app)/sports/page.tsx`
- Create: `src/app/(app)/sports/[sport]/page.tsx`

**Step 1: Create live betting page** — same as home page but filtered to `status = 'live'` only with 30-second auto-refresh for odds.

**Step 2: Create sports index page** — grid of sport cards linking to `/sports/[sport]`.

**Step 3: Create sport detail page** — all games for one sport, organized by date.

**Step 4: Commit**

```bash
git add src/app/\(app\)/live/ src/app/\(app\)/sports/
git commit -m "feat: add live betting and sport pages"
```

---

## Task 15: Settings Page & Service Worker

**Files:**
- Create: `src/app/(app)/settings/page.tsx`
- Create: `public/sw.js`

**Step 1: Create settings page** — display name, phone number for SMS, enable/disable push notifications, change password.

**Step 2: Create service worker** for Web Push notifications at `public/sw.js`.

**Step 3: Add push subscription logic** — on settings page, request push permission and save subscription to profile.

**Step 4: Commit**

```bash
git add src/app/\(app\)/settings/ public/sw.js
git commit -m "feat: add settings page and push notification service worker"
```

---

## Task 16: Ledger Backup Worker (Nightly R2 Export)

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/wrangler.toml`

**Step 1: Add R2 bucket binding to wrangler.toml**

```toml
[[r2_buckets]]
binding = "LEDGER_BACKUP"
bucket_name = "tulsa-king-ledger-backups"
```

**Step 2: Add nightly cron** — separate cron at `0 5 * * *` (5am UTC) that dumps the ledger table to a timestamped JSON file in R2.

**Step 3: Commit**

```bash
git add worker/
git commit -m "feat: add nightly ledger backup to R2"
```

---

## Task 17: Seed Data & User Setup

**Files:**
- Create: `scripts/seed.ts`

**Step 1: Create seed script** that:
1. Creates 3 auth users in Supabase (using admin API)
2. Creates their profile records
3. Generates a few sample games and markets for testing

**Step 2: Run seed and verify**

```bash
npx tsx scripts/seed.ts
```

**Step 3: Commit**

```bash
git add scripts/
git commit -m "feat: add seed script for 3 users and test data"
```

---

## Task 18: Deploy to Vercel + Cloudflare

**Step 1: Deploy Next.js to Vercel**

```bash
npx vercel --prod
```

Set all environment variables in Vercel dashboard.

**Step 2: Deploy Worker to Cloudflare**

```bash
cd worker
npx wrangler secret put ODDS_API_KEY
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler deploy
```

**Step 3: Create R2 bucket**

```bash
npx wrangler r2 bucket create tulsa-king-ledger-backups
```

**Step 4: Verify end-to-end**
- Login works
- Games appear on home page
- Tap game → detail page with markets
- Place bet → swipe confirm → notifications fire
- Check ledger after game settles

**Step 5: Commit any config changes**

```bash
git add -A
git commit -m "chore: deployment configuration"
```

---

## Dependency Graph

```
Task 1 (scaffold) → Task 2 (database) → Task 3 (auth) → Task 4 (types)
                                                              ↓
Task 5 (worker) ←──────────────────────────────────── Task 4 (types)
                                                              ↓
Task 6 (layout) → Task 7 (home) → Task 8 (bet slip) → Task 9 (game detail)
                                                              ↓
Task 10 (notifications) ← Task 8 (bet slip)
Task 11 (my bets) ← Task 4
Task 12 (dashboard) ← Task 4
Task 13 (ledger) ← Task 4
Task 14 (live + sport pages) ← Task 7
Task 15 (settings + push) ← Task 6
Task 16 (R2 backup) ← Task 5
Task 17 (seed) ← Task 2
Task 18 (deploy) ← ALL
```

Parallelizable after Task 8: Tasks 9–15 can be built concurrently.
