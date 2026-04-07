# TULSA KING — Private P2P Sportsbook

## Overview

A private peer-to-peer sportsbook web app for 3 friends. When one person places a bet, the other two are forced to split the other side equally. Bets settle automatically when games end. A running ledger tracks who owes who — no real money moves through the app.

## Stack

- **Frontend:** Next.js (React), mobile-first responsive design
- **Hosting:** Vercel
- **Backend/DB:** Supabase (Postgres + Auth + Realtime subscriptions)
- **Odds Proxy & Cron:** Cloudflare Worker
- **Odds Data:** The Odds API (all major US sports, moneyline/spread/O-U/props)
- **SMS Notifications:** Twilio
- **Push Notifications:** Web Push API (browser-native)
- **Ledger Backup:** Cloudflare R2 (nightly export)

## Architecture

```
┌──────────────────────────────────────────────┐
│              Vercel (Hosting)                 │
│         Next.js App (React + API)            │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │Sportsbook│  │ Dashboard │  │  Auth    │   │
│  │  (Home)  │  │ Analytics │  │  Pages   │   │
│  └────┬─────┘  └─────┬─────┘  └──────────┘  │
│       │               │                      │
├───────┼───────────────┼──────────────────────┤
│       ▼               ▼                      │
│  ┌──────────────────────────────────────┐    │
│  │        Supabase                       │    │
│  │  • Auth (username/password)           │    │
│  │  • Postgres DB (bets, users, ledger)  │    │
│  │  • Realtime subscriptions             │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────┐  ┌──────────────────┐      │
│  │ CF Worker     │  │ Twilio           │      │
│  │ (Odds Proxy)  │  │ (SMS Alerts)     │      │
│  └──────────────┘  └──────────────────┘      │
└──────────────────────────────────────────────┘
```

## Pages

### Public
- `/login` — Username/password sign-in

### Core Sportsbook (logged in)
- `/` — **Home/Featured** — promoted games, live now, popular bets, trending lines
- `/live` — **Live Betting** — games currently in progress with live-updating odds
- `/sports/[sport]` — **Sport Page** (e.g. `/sports/nfl`) — all upcoming games for that sport, organized by date
- `/sports/[sport]/[game]` — **Game Detail Page** — single game with all available markets organized in tabs/sections:
  - Game Lines (moneyline, spread, over/under)
  - Player Props (points, rebounds, passing yards, etc.)
  - Game Props (first to score, halftime result, etc.)
  - Tap any odds button → bet slip opens
- `/promos` — Custom boosted odds or fun challenges between friends

### Bet Slip (persistent component)
- Slide-up half-sheet on mobile, sidebar on desktop
- Shows current selections, enter wager amounts, see potential payouts
- **Swipe-up to confirm** (Robinhood-style) on mobile, hold-to-confirm on desktop
- Haptic feedback on mobile, confetti/checkmark animation on success

### Account Pages
- `/my-bets` — Open bets, settled bets, filterable by status/sport/date
- `/dashboard` — Full analytics: win/loss record, ROI, sport-by-sport breakdown, leaderboard, biggest win, hot streaks
- `/ledger` — Who owes who, net balances between each pair, settlement history, CSV export
- `/settings` — Profile, notification preferences, change password

### Navigation
- **Mobile:** Bottom tab bar — Home | Live | Sports | My Bets | Dashboard
- **Desktop:** Top navigation bar with same items

## Bet Mechanics

### Placing a Bet
1. User taps a game card → navigates to game detail page with all markets
2. User taps an odds button → bet slip slides up from bottom
3. User enters wager amount → potential payout calculated in real-time
4. Review card shows: matchup, bet type, odds, wager, payout, and who's taking the other side (the other 2 friends, split equally)
5. **Swipe up to confirm** — draggable pill at bottom of bet slip
6. On confirm: bet is created, SMS + push notification fires to the other two friends

### Forced Acceptance
- The other two friends **must** take the other side — split equally
- No option to decline individually
- Bets can only be canceled if **all three** friends agree

### Settlement
- Cloudflare Worker cron checks game results via The Odds API every 5 minutes
- When a game is marked final, all bets on that game are resolved
- Payouts calculated based on odds locked at time of bet placement
- Settlement entries written to the append-only ledger
- SMS + push notifications sent to all 3 users with results

## Data Model

### Users
- `id`, `username`, `password_hash`, `display_name`, `avatar_url`, `created_at`
- 3 records total

### Games
- `id`, `external_id` (Odds API ID), `sport`, `home_team`, `away_team`, `start_time`, `status` (upcoming/live/final), `home_score`, `away_score`, `last_updated`
- Synced from The Odds API via Cloudflare Worker cron

### Markets
- `id`, `game_id`, `type` (moneyline/spread/over_under/prop), `name`, `line`, `home_odds`, `away_odds`, `is_live`, `last_updated`
- Updated every 30-60 seconds for live games

### Bets
- `id`, `user_id` (who placed it), `game_id`, `market_id`, `pick`, `wager_amount`, `odds_at_placement`, `status` (active/settled/canceled), `result` (win/loss/push), `created_at`, `settled_at`

### Bet Counterparties
- `id`, `bet_id`, `user_id`, `share_amount`, `result`, `payout`
- 2 records per bet (the two friends taking the other side)

### Ledger (append-only)
- `id`, `bet_id`, `from_user_id`, `to_user_id`, `amount`, `type` (bet_settlement/manual_adjustment), `timestamp`
- **Immutable** — no updates or deletes. Corrections are new entries.

### Net Balances (computed view)
- Derived from ledger table — what each person owes each other person
- Not stored as a separate table, calculated on read

## Ledger Security & Backup

### Security
- Supabase Row-Level Security (RLS) — only authenticated users can access their own data
- Append-only ledger — no edits, no deletes, full audit trail
- Every transaction timestamped and references source bet ID
- Secure password auth with bcrypt hashing (Supabase default)

### Backup Strategy (3 layers)
1. **Supabase automatic backups** — daily, 7-day retention (free) or 30-day (Pro)
2. **Nightly R2 export** — Cloudflare Worker dumps ledger to JSON/CSV in R2 storage
3. **Manual export** — "Download Ledger" button exports full history as CSV

## Notifications

### Triggers
- New bet placed → SMS + push to the other 2 friends
- Bet settled (game ends) → SMS + push to all 3 with result
- (Optional) Game starting soon for an active bet

### Implementation
- **SMS:** Twilio API called from Next.js API routes
- **Push:** Web Push API with service worker, permission requested on first login

## Sports Coverage
All major US sports via The Odds API:
- NFL, College Football
- NBA, College Basketball
- MLB, NHL
- Soccer (MLS, Premier League, etc.)
- Golf, Tennis, UFC/MMA
- Any other sport The Odds API supports

## Estimated Monthly Cost

| Service | Cost |
|---------|------|
| Vercel (hosting) | $0 (free tier) |
| Supabase (auth + DB) | $0–25/month |
| The Odds API | $0–79/month |
| Cloudflare Worker + R2 | $0 (free tier) |
| Twilio SMS | ~$1–3/month |
| **Total** | **$0–107/month** |

## Key UX Principles
- **Sportsbook-first** — the app IS the sportsbook, you land on games not a dashboard
- **Robinhood swipe-to-confirm** — intentional, tactile bet placement
- **Real-time everything** — odds update live, bets appear instantly via Supabase Realtime
- **Mobile-first** — designed for phone use, works great on desktop too
