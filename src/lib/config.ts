export const WORKER_URL = "https://tulsa-king-odds.ryboss36010.workers.dev";

// Sport key prefixes we care about — filters the Odds API "all sports" list
const ALLOWED_PREFIXES = [
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "basketball_ncaab",
  "baseball_mlb",
  "icehockey_nhl",
  "soccer_usa_mls",
  "mma_mixed_martial_arts",
  "boxing_boxing",
  "golf_",
  "tennis_atp",
];

export function isAllowedSport(key: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));
}
