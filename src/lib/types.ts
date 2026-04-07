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
  type: "moneyline" | "spread" | "over_under" | "prop" | "outright";
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
  parlay_group_id: string | null;
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

export interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

// Known sport labels — major USA sports + tennis/golf/UFC
export const SPORT_LABELS: Record<string, string> = {
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "College Football",
  americanfootball_nfl_super_bowl_winner: "Super Bowl Winner",
  americanfootball_ncaaf_championship_winner: "CFP Champion",
  basketball_nba: "NBA",
  basketball_ncaab: "College Basketball",
  basketball_nba_championship_winner: "NBA Champion",
  baseball_mlb: "MLB",
  baseball_mlb_world_series_winner: "World Series Winner",
  icehockey_nhl: "NHL",
  icehockey_nhl_championship_winner: "Stanley Cup Winner",
  soccer_usa_mls: "MLS",
  mma_mixed_martial_arts: "UFC / MMA",
  boxing_boxing: "Boxing",
  golf_masters_tournament_winner: "The Masters",
  golf_pga_championship_winner: "PGA Championship",
  golf_us_open_winner: "US Open (Golf)",
  golf_the_open_championship_winner: "The Open",
  tennis_atp_french_open: "French Open",
  tennis_atp_wimbledon: "Wimbledon",
  tennis_atp_us_open: "US Open (Tennis)",
  tennis_atp_aus_open: "Australian Open",
};

export function getSportLabel(sportKey: string, apiTitle?: string): string {
  if (SPORT_LABELS[sportKey]) return SPORT_LABELS[sportKey];
  if (apiTitle) return apiTitle;
  return sportKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isOutrightSport(sportKey: string): boolean {
  return (
    sportKey.includes("_winner") ||
    sportKey.includes("_championship") ||
    sportKey.includes("_series_winner")
  );
}
