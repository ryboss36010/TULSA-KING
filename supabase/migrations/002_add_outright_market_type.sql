-- Add 'outright' to the markets type check constraint
-- This enables futures/outrights like "Masters Tournament Winner", "NBA Championship Winner", etc.

ALTER TABLE markets DROP CONSTRAINT markets_type_check;
ALTER TABLE markets ADD CONSTRAINT markets_type_check CHECK (type IN ('moneyline', 'spread', 'over_under', 'prop', 'outright'));
