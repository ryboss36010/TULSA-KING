-- Add parlay_group_id to bets table
-- Bets sharing the same parlay_group_id are legs of the same parlay.
-- NULL means a straight/single bet.

ALTER TABLE bets ADD COLUMN IF NOT EXISTS parlay_group_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_bets_parlay_group_id ON bets (parlay_group_id) WHERE parlay_group_id IS NOT NULL;
