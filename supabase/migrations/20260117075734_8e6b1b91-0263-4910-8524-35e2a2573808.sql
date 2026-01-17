-- Drop any check constraints on game_phase that might be causing issues
ALTER TABLE public.poker_duels DROP CONSTRAINT IF EXISTS poker_duels_game_phase_check;

-- Also ensure max_balance constraint is removed (in case previous migration didn't run)
ALTER TABLE public.poker_duels DROP CONSTRAINT IF EXISTS poker_duels_max_balance_check;

-- Set proper defaults
ALTER TABLE public.poker_duels ALTER COLUMN max_balance SET DEFAULT 100;
ALTER TABLE public.poker_duels ALTER COLUMN game_phase SET DEFAULT 'preflop';

-- Fix any existing rows
UPDATE public.poker_duels SET max_balance = 100 WHERE max_balance = 0 OR max_balance IS NULL;
UPDATE public.poker_duels SET game_phase = 'preflop' WHERE game_phase IS NULL OR game_phase = '';