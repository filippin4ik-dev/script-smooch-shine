-- Drop check constraints on poker_duels that may be causing issues
ALTER TABLE public.poker_duels DROP CONSTRAINT IF EXISTS poker_duels_status_check;
ALTER TABLE public.poker_duels DROP CONSTRAINT IF EXISTS poker_duels_game_phase_check;
ALTER TABLE public.poker_duels DROP CONSTRAINT IF EXISTS poker_duels_max_balance_check;

-- Set proper defaults
ALTER TABLE public.poker_duels ALTER COLUMN status SET DEFAULT 'waiting';
ALTER TABLE public.poker_duels ALTER COLUMN game_phase SET DEFAULT 'preflop';
ALTER TABLE public.poker_duels ALTER COLUMN max_balance SET DEFAULT 100;

-- Fix any null or invalid values
UPDATE public.poker_duels SET status = 'waiting' WHERE status IS NULL OR status = '';
UPDATE public.poker_duels SET game_phase = 'preflop' WHERE game_phase IS NULL OR game_phase = '';
UPDATE public.poker_duels SET max_balance = 100 WHERE max_balance IS NULL OR max_balance <= 0;