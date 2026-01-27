-- 1. Create table to track "exited" duels per user (server-side)
CREATE TABLE public.poker_duel_exits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duel_id uuid NOT NULL REFERENCES public.poker_duels(id) ON DELETE CASCADE,
  exited_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, duel_id)
);

-- Enable RLS
ALTER TABLE public.poker_duel_exits ENABLE ROW LEVEL SECURITY;

-- Policies: users can manage only their own exits
CREATE POLICY "Users can view own exits"
  ON public.poker_duel_exits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exits"
  ON public.poker_duel_exits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exits"
  ON public.poker_duel_exits
  FOR DELETE
  USING (auth.uid() = user_id);

-- System/RPC access (for RPC functions running as SECURITY DEFINER)
CREATE POLICY "System can manage exits"
  ON public.poker_duel_exits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Create table for user poker UI settings
CREATE TABLE public.user_poker_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_bet_amount numeric NOT NULL DEFAULT 100,
  default_max_balance numeric NOT NULL DEFAULT 500,
  default_max_players integer NOT NULL DEFAULT 2,
  default_raise_amount numeric NOT NULL DEFAULT 50,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_poker_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own settings"
  ON public.user_poker_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_poker_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_poker_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- System access for RPC
CREATE POLICY "System can manage settings"
  ON public.user_poker_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Add index for faster lookups
CREATE INDEX idx_poker_duel_exits_user_id ON public.poker_duel_exits(user_id);
CREATE INDEX idx_poker_duel_exits_duel_id ON public.poker_duel_exits(duel_id);

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_duel_exits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_poker_settings;