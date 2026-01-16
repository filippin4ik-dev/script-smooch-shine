-- Drop old function first
DROP FUNCTION IF EXISTS create_multiplayer_poker_duel(UUID, INTEGER, INTEGER, INTEGER);

-- Add max_balance field to poker_duels for limiting bets
ALTER TABLE public.poker_duels 
ADD COLUMN IF NOT EXISTS max_balance INTEGER DEFAULT 0;

-- Create new function with max_balance parameter
CREATE OR REPLACE FUNCTION create_multiplayer_poker_duel(
  p_user_id UUID,
  p_bet_amount INTEGER,
  p_max_players INTEGER DEFAULT 2,
  p_cards_per_player INTEGER DEFAULT 2,
  p_max_balance INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_balance INTEGER;
  v_duel_id UUID;
  v_actual_max_balance INTEGER;
BEGIN
  -- Validate max_players
  IF p_max_players < 2 OR p_max_players > 4 THEN
    RAISE EXCEPTION 'max_players must be between 2 and 4';
  END IF;
  
  -- Validate cards_per_player
  IF p_cards_per_player < 2 OR p_cards_per_player > 3 THEN
    RAISE EXCEPTION 'cards_per_player must be 2 or 3';
  END IF;

  -- Get user balance
  SELECT balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
  
  IF v_user_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- If max_balance is 0 or not provided, use bet_amount as max
  v_actual_max_balance := CASE WHEN p_max_balance <= 0 THEN p_bet_amount ELSE p_max_balance END;
  
  -- Validate that bet amount doesn't exceed max balance
  IF p_bet_amount > v_actual_max_balance THEN
    RAISE EXCEPTION 'Bet amount exceeds max balance';
  END IF;
  
  -- Deduct bet from user
  UPDATE profiles SET balance = balance - p_bet_amount WHERE id = p_user_id;
  
  -- Create duel
  INSERT INTO poker_duels (
    creator_id,
    initial_bet,
    pot,
    status,
    max_players,
    current_players,
    cards_per_player,
    creator_current_bet,
    turn_order,
    active_players_count,
    max_balance
  ) VALUES (
    p_user_id,
    p_bet_amount,
    p_bet_amount,
    'waiting',
    p_max_players,
    1,
    p_cards_per_player,
    p_bet_amount,
    jsonb_build_array(p_user_id),
    1,
    v_actual_max_balance
  )
  RETURNING id INTO v_duel_id;
  
  RETURN v_duel_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_multiplayer_poker_duel(UUID, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated, anon;