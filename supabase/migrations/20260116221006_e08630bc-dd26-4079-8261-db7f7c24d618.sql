-- Drop the problematic check constraint on max_balance
ALTER TABLE public.poker_duels DROP CONSTRAINT IF EXISTS poker_duels_max_balance_check;

-- Update the default value for max_balance to be 100 instead of 0
ALTER TABLE public.poker_duels ALTER COLUMN max_balance SET DEFAULT 100;

-- Update any existing rows with max_balance = 0 to 100
UPDATE public.poker_duels SET max_balance = 100 WHERE max_balance = 0 OR max_balance IS NULL;