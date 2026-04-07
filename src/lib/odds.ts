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
 * The two counterparties split the bettor's potential profit equally.
 */
export function calculateCounterpartyShare(
  wager: number,
  odds: number
): number {
  const profit = calculatePayout(wager, odds) - wager;
  return profit / 2;
}
