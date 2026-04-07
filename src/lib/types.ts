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
