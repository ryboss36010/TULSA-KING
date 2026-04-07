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
 * Calculate combined parlay odds (American) from an array of American odds.
 * Converts each leg to decimal, multiplies, converts back to American.
 */
export function calculateParlayOdds(legs: number[]): number {
  if (legs.length === 0) return 0;
  if (legs.length === 1) return legs[0];

  const combinedDecimal = legs.reduce(
    (acc, odds) => acc * americanToDecimal(odds),
    1
  );

  // Convert decimal back to American
  if (combinedDecimal >= 2) {
    return Math.round((combinedDecimal - 1) * 100);
  }
  return Math.round(-100 / (combinedDecimal - 1));
}

/**
 * Calculate parlay payout from wager and array of American odds.
 */
export function calculateParlayPayout(wager: number, legs: number[]): number {
  const combinedDecimal = legs.reduce(
    (acc, odds) => acc * americanToDecimal(odds),
    1
  );
  return wager * combinedDecimal;
}
