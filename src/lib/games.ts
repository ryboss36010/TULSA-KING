import type { Game } from "./types";
import { isOutrightSport } from "./types";

/**
 * Filter games to only show bettable events.
 * - Upcoming games that haven't started yet
 * - Live games (started within the last 4 hours)
 * - Outright/futures with upcoming status
 * - NEVER show past events
 */
export function filterBettableGames(games: Game[]): Game[] {
  const now = Date.now();

  return games.filter((game) => {
    // Always show live games
    if (game.status === "live") return true;

    // Never show final
    if (game.status === "final") return false;

    const startTime = new Date(game.start_time).getTime();

    // Outright/futures: show if status is upcoming (regardless of date)
    if (isOutrightSport(game.sport)) {
      return game.status === "upcoming";
    }

    // Standard games: only show if they haven't started yet
    return startTime > now;
  });
}

/**
 * Check if a specific game is still bettable (not started).
 */
export function isGameBettable(game: Game): boolean {
  if (game.status === "final") return false;
  if (game.status === "live") return true;

  if (isOutrightSport(game.sport)) return true;

  return new Date(game.start_time).getTime() > Date.now();
}
