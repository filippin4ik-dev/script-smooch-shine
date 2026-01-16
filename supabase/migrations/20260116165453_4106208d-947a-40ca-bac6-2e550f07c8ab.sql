
-- Drop existing functions and table to recreate with new schema
DROP FUNCTION IF EXISTS create_poker_duel(UUID, NUMERIC);
DROP FUNCTION IF EXISTS cancel_poker_duel(UUID, UUID);
DROP FUNCTION IF EXISTS join_poker_duel(UUID, UUID);
DROP TABLE IF EXISTS poker_duels CASCADE;

-- Create enhanced poker_duels table with betting system
CREATE TABLE public.poker_duels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.profiles(id),
  opponent_id UUID REFERENCES public.profiles(id),
  invited_user_id UUID REFERENCES public.profiles(id),
  
  -- Betting amounts
  initial_bet NUMERIC NOT NULL DEFAULT 0,
  creator_current_bet NUMERIC NOT NULL DEFAULT 0,
  opponent_current_bet NUMERIC NOT NULL DEFAULT 0,
  pot NUMERIC NOT NULL DEFAULT 0,
  current_raise_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Game state
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'betting', 'showdown', 'finished', 'cancelled', 'declined')),
  game_phase TEXT DEFAULT 'pre_deal' CHECK (game_phase IN ('pre_deal', 'dealing', 'betting_round_1', 'betting_round_2', 'showdown')),
  current_turn UUID,
  
  -- Cards (stored encrypted on server, revealed only at showdown)
  deck JSONB,
  creator_cards JSONB,
  opponent_cards JSONB,
  community_cards JSONB,
  
  -- Results
  winner_id UUID REFERENCES public.profiles(id),
  creator_hand_rank TEXT,
  opponent_hand_rank TEXT,
  is_draw BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  last_action_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.poker_duels ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view duels" ON public.poker_duels FOR SELECT USING (true);
CREATE POLICY "Users can create duels" ON public.poker_duels FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their duels" ON public.poker_duels FOR UPDATE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_duels;

-- Function to search users by username or public_id
CREATE OR REPLACE FUNCTION search_users_for_duel(
  search_query TEXT,
  current_user_id UUID
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  public_id INTEGER,
  avatar_url TEXT,
  level INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.public_id,
    p.avatar_url,
    p.level
  FROM profiles p
  WHERE p.id != current_user_id
    AND p.is_banned = false
    AND (
      p.username ILIKE '%' || search_query || '%'
      OR p.public_id::TEXT = search_query
    )
  ORDER BY p.level DESC
  LIMIT 20;
END;
$$;

-- Function to create a duel (open or with invitation)
CREATE OR REPLACE FUNCTION create_poker_duel_v2(
  p_creator_id UUID,
  p_initial_bet NUMERIC,
  p_invited_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel_id UUID;
  v_creator_balance NUMERIC;
  v_status TEXT;
BEGIN
  -- Check creator balance
  SELECT balance INTO v_creator_balance FROM profiles WHERE id = p_creator_id;
  
  IF v_creator_balance < p_initial_bet THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct bet from creator
  UPDATE profiles SET balance = balance - p_initial_bet WHERE id = p_creator_id;
  
  -- Set status based on whether it's an invitation
  v_status := CASE WHEN p_invited_user_id IS NOT NULL THEN 'invited' ELSE 'waiting' END;
  
  -- Create duel
  INSERT INTO poker_duels (
    creator_id,
    invited_user_id,
    initial_bet,
    pot,
    status,
    game_phase
  ) VALUES (
    p_creator_id,
    p_invited_user_id,
    p_initial_bet,
    p_initial_bet,
    v_status,
    'pre_deal'
  ) RETURNING id INTO v_duel_id;
  
  RETURN v_duel_id;
END;
$$;

-- Function to cancel a duel
CREATE OR REPLACE FUNCTION cancel_poker_duel_v2(
  p_duel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel RECORD;
BEGIN
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
  
  IF v_duel.creator_id != p_user_id THEN
    RAISE EXCEPTION 'Not the creator';
  END IF;
  
  IF v_duel.status NOT IN ('waiting', 'invited') THEN
    RAISE EXCEPTION 'Cannot cancel active duel';
  END IF;
  
  -- Refund creator
  UPDATE profiles SET balance = balance + v_duel.pot WHERE id = v_duel.creator_id;
  
  -- Update duel status
  UPDATE poker_duels SET status = 'cancelled' WHERE id = p_duel_id;
  
  RETURN true;
END;
$$;

-- Function to decline invitation
CREATE OR REPLACE FUNCTION decline_poker_duel(
  p_duel_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel RECORD;
BEGIN
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
  
  IF v_duel.invited_user_id != p_user_id THEN
    RAISE EXCEPTION 'Not invited to this duel';
  END IF;
  
  IF v_duel.status != 'invited' THEN
    RAISE EXCEPTION 'Duel not in invited state';
  END IF;
  
  -- Refund creator
  UPDATE profiles SET balance = balance + v_duel.pot WHERE id = v_duel.creator_id;
  
  -- Update duel status
  UPDATE poker_duels SET status = 'declined' WHERE id = p_duel_id;
  
  RETURN true;
END;
$$;

-- Helper function to create and shuffle deck
CREATE OR REPLACE FUNCTION create_shuffled_deck()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  suits TEXT[] := ARRAY['hearts', 'diamonds', 'clubs', 'spades'];
  ranks TEXT[] := ARRAY['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  deck JSONB := '[]'::JSONB;
  card JSONB;
  i INT;
  j INT;
BEGIN
  FOR i IN 1..array_length(suits, 1) LOOP
    FOR j IN 1..array_length(ranks, 1) LOOP
      card := jsonb_build_object('suit', suits[i], 'rank', ranks[j]);
      deck := deck || jsonb_build_array(card);
    END LOOP;
  END LOOP;
  
  -- Shuffle using random order
  SELECT jsonb_agg(elem ORDER BY random()) INTO deck FROM jsonb_array_elements(deck) elem;
  
  RETURN deck;
END;
$$;

-- Helper function to get card value for comparison
CREATE OR REPLACE FUNCTION get_card_value(rank TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE rank
    WHEN 'A' THEN 14
    WHEN 'K' THEN 13
    WHEN 'Q' THEN 12
    WHEN 'J' THEN 11
    ELSE rank::INTEGER
  END;
END;
$$;

-- Helper function to evaluate 5-card poker hand
CREATE OR REPLACE FUNCTION evaluate_poker_hand(cards JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  suits TEXT[];
  ranks INTEGER[];
  rank_counts INTEGER[];
  unique_ranks INTEGER[];
  i INTEGER;
  card JSONB;
  is_flush BOOLEAN := false;
  is_straight BOOLEAN := false;
  hand_rank INTEGER;
  hand_name TEXT;
  high_card INTEGER;
  kickers INTEGER[];
BEGIN
  -- Extract suits and ranks
  suits := ARRAY[]::TEXT[];
  ranks := ARRAY[]::INTEGER[];
  
  FOR card IN SELECT * FROM jsonb_array_elements(cards) LOOP
    suits := array_append(suits, card->>'suit');
    ranks := array_append(ranks, get_card_value(card->>'rank'));
  END LOOP;
  
  -- Sort ranks descending
  SELECT array_agg(r ORDER BY r DESC) INTO ranks FROM unnest(ranks) r;
  
  -- Check for flush (all same suit)
  IF (SELECT COUNT(DISTINCT s) FROM unnest(suits) s) = 1 THEN
    is_flush := true;
  END IF;
  
  -- Check for straight
  IF ranks[1] - ranks[5] = 4 AND (SELECT COUNT(DISTINCT r) FROM unnest(ranks) r) = 5 THEN
    is_straight := true;
  END IF;
  -- Check for wheel (A-2-3-4-5)
  IF ranks = ARRAY[14, 5, 4, 3, 2] THEN
    is_straight := true;
    ranks := ARRAY[5, 4, 3, 2, 1]; -- Ace low
  END IF;
  
  -- Count rank occurrences
  SELECT array_agg(cnt ORDER BY cnt DESC, val DESC), array_agg(val ORDER BY cnt DESC, val DESC)
  INTO rank_counts, unique_ranks
  FROM (SELECT r AS val, COUNT(*) AS cnt FROM unnest(ranks) r GROUP BY r) t;
  
  -- Determine hand rank
  IF is_straight AND is_flush THEN
    IF ranks[1] = 14 THEN
      hand_rank := 10; hand_name := 'Royal Flush';
    ELSE
      hand_rank := 9; hand_name := 'Straight Flush';
    END IF;
    high_card := ranks[1];
  ELSIF rank_counts[1] = 4 THEN
    hand_rank := 8; hand_name := 'Four of a Kind';
    high_card := unique_ranks[1];
  ELSIF rank_counts[1] = 3 AND rank_counts[2] = 2 THEN
    hand_rank := 7; hand_name := 'Full House';
    high_card := unique_ranks[1];
  ELSIF is_flush THEN
    hand_rank := 6; hand_name := 'Flush';
    high_card := ranks[1];
  ELSIF is_straight THEN
    hand_rank := 5; hand_name := 'Straight';
    high_card := ranks[1];
  ELSIF rank_counts[1] = 3 THEN
    hand_rank := 4; hand_name := 'Three of a Kind';
    high_card := unique_ranks[1];
  ELSIF rank_counts[1] = 2 AND rank_counts[2] = 2 THEN
    hand_rank := 3; hand_name := 'Two Pair';
    high_card := unique_ranks[1];
  ELSIF rank_counts[1] = 2 THEN
    hand_rank := 2; hand_name := 'Pair';
    high_card := unique_ranks[1];
  ELSE
    hand_rank := 1; hand_name := 'High Card';
    high_card := ranks[1];
  END IF;
  
  RETURN jsonb_build_object(
    'rank', hand_rank,
    'name', hand_name,
    'high_card', high_card,
    'cards', unique_ranks
  );
END;
$$;

-- Function to join a duel and start the game
CREATE OR REPLACE FUNCTION join_poker_duel_v2(
  p_duel_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel RECORD;
  v_opponent_balance NUMERIC;
  v_deck JSONB;
  v_creator_cards JSONB;
  v_opponent_cards JSONB;
  v_community_cards JSONB;
BEGIN
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id FOR UPDATE;
  
  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;
  
  IF v_duel.status NOT IN ('waiting', 'invited') THEN
    RAISE EXCEPTION 'Duel not available';
  END IF;
  
  IF v_duel.creator_id = p_user_id THEN
    RAISE EXCEPTION 'Cannot join own duel';
  END IF;
  
  -- If invited duel, check if user is the invited one
  IF v_duel.invited_user_id IS NOT NULL AND v_duel.invited_user_id != p_user_id THEN
    RAISE EXCEPTION 'This duel is for a specific player';
  END IF;
  
  -- Check opponent balance
  SELECT balance INTO v_opponent_balance FROM profiles WHERE id = p_user_id;
  
  IF v_opponent_balance < v_duel.initial_bet THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct bet from opponent
  UPDATE profiles SET balance = balance - v_duel.initial_bet WHERE id = p_user_id;
  
  -- Create and shuffle deck
  v_deck := create_shuffled_deck();
  
  -- Deal 2 hole cards to each player
  v_creator_cards := jsonb_build_array(v_deck->0, v_deck->1);
  v_opponent_cards := jsonb_build_array(v_deck->2, v_deck->3);
  
  -- Deal 5 community cards (will be revealed progressively)
  v_community_cards := jsonb_build_array(v_deck->4, v_deck->5, v_deck->6, v_deck->7, v_deck->8);
  
  -- Update duel
  UPDATE poker_duels SET
    opponent_id = p_user_id,
    pot = pot + v_duel.initial_bet,
    status = 'betting',
    game_phase = 'betting_round_1',
    current_turn = v_duel.creator_id,
    deck = v_deck,
    creator_cards = v_creator_cards,
    opponent_cards = v_opponent_cards,
    community_cards = v_community_cards,
    creator_current_bet = 0,
    opponent_current_bet = 0,
    started_at = now(),
    last_action_at = now()
  WHERE id = p_duel_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'duel_id', p_duel_id
  );
END;
$$;

-- Function to perform betting action
CREATE OR REPLACE FUNCTION poker_betting_action(
  p_duel_id UUID,
  p_user_id UUID,
  p_action TEXT, -- 'check', 'call', 'raise', 'fold', 'all_in'
  p_raise_amount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel RECORD;
  v_is_creator BOOLEAN;
  v_user_balance NUMERIC;
  v_opponent_bet NUMERIC;
  v_user_bet NUMERIC;
  v_call_amount NUMERIC;
  v_total_raise NUMERIC;
  v_next_turn UUID;
  v_new_phase TEXT;
  v_both_acted BOOLEAN := false;
  v_creator_hand JSONB;
  v_opponent_hand JSONB;
  v_winner_id UUID;
  v_win_amount NUMERIC;
  v_commission NUMERIC;
BEGIN
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id FOR UPDATE;
  
  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;
  
  IF v_duel.status != 'betting' THEN
    RAISE EXCEPTION 'Duel not in betting phase';
  END IF;
  
  IF v_duel.current_turn != p_user_id THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;
  
  v_is_creator := (p_user_id = v_duel.creator_id);
  
  SELECT balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
  
  IF v_is_creator THEN
    v_user_bet := v_duel.creator_current_bet;
    v_opponent_bet := v_duel.opponent_current_bet;
    v_next_turn := v_duel.opponent_id;
  ELSE
    v_user_bet := v_duel.opponent_current_bet;
    v_opponent_bet := v_duel.creator_current_bet;
    v_next_turn := v_duel.creator_id;
  END IF;
  
  v_call_amount := v_opponent_bet - v_user_bet;
  
  -- Handle actions
  IF p_action = 'fold' THEN
    -- Player folds, opponent wins
    v_winner_id := CASE WHEN v_is_creator THEN v_duel.opponent_id ELSE v_duel.creator_id END;
    v_commission := v_duel.pot * 0.05;
    v_win_amount := v_duel.pot - v_commission;
    
    UPDATE profiles SET balance = balance + v_win_amount WHERE id = v_winner_id;
    
    UPDATE poker_duels SET
      status = 'finished',
      winner_id = v_winner_id,
      finished_at = now()
    WHERE id = p_duel_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'fold',
      'winner_id', v_winner_id,
      'win_amount', v_win_amount
    );
    
  ELSIF p_action = 'check' THEN
    IF v_call_amount > 0 THEN
      RAISE EXCEPTION 'Cannot check, must call or fold';
    END IF;
    
    -- Check if both players have acted
    IF v_duel.current_raise_amount = 0 AND v_opponent_bet = 0 AND v_user_bet = 0 THEN
      -- First check, wait for opponent
      v_both_acted := false;
    ELSIF v_opponent_bet = v_user_bet THEN
      v_both_acted := true;
    END IF;
    
  ELSIF p_action = 'call' THEN
    IF v_call_amount <= 0 THEN
      RAISE EXCEPTION 'Nothing to call, use check';
    END IF;
    
    IF v_user_balance < v_call_amount THEN
      RAISE EXCEPTION 'Insufficient balance to call';
    END IF;
    
    -- Deduct call amount
    UPDATE profiles SET balance = balance - v_call_amount WHERE id = p_user_id;
    
    -- Update duel
    IF v_is_creator THEN
      UPDATE poker_duels SET
        creator_current_bet = creator_current_bet + v_call_amount,
        pot = pot + v_call_amount,
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSE
      UPDATE poker_duels SET
        opponent_current_bet = opponent_current_bet + v_call_amount,
        pot = pot + v_call_amount,
        last_action_at = now()
      WHERE id = p_duel_id;
    END IF;
    
    v_both_acted := true;
    
  ELSIF p_action = 'raise' THEN
    IF p_raise_amount <= 0 THEN
      RAISE EXCEPTION 'Raise amount must be positive';
    END IF;
    
    v_total_raise := v_call_amount + p_raise_amount;
    
    IF v_user_balance < v_total_raise THEN
      RAISE EXCEPTION 'Insufficient balance to raise';
    END IF;
    
    -- Deduct raise amount
    UPDATE profiles SET balance = balance - v_total_raise WHERE id = p_user_id;
    
    -- Update duel
    IF v_is_creator THEN
      UPDATE poker_duels SET
        creator_current_bet = creator_current_bet + v_total_raise,
        pot = pot + v_total_raise,
        current_raise_amount = p_raise_amount,
        current_turn = v_next_turn,
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSE
      UPDATE poker_duels SET
        opponent_current_bet = opponent_current_bet + v_total_raise,
        pot = pot + v_total_raise,
        current_raise_amount = p_raise_amount,
        current_turn = v_next_turn,
        last_action_at = now()
      WHERE id = p_duel_id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'raise',
      'amount', v_total_raise,
      'next_turn', v_next_turn
    );
    
  ELSIF p_action = 'all_in' THEN
    IF v_user_balance <= 0 THEN
      RAISE EXCEPTION 'No balance for all-in';
    END IF;
    
    -- Deduct all balance
    UPDATE profiles SET balance = 0 WHERE id = p_user_id;
    
    -- Update duel
    IF v_is_creator THEN
      UPDATE poker_duels SET
        creator_current_bet = creator_current_bet + v_user_balance,
        pot = pot + v_user_balance,
        current_raise_amount = GREATEST(v_user_balance - v_call_amount, 0),
        current_turn = v_next_turn,
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSE
      UPDATE poker_duels SET
        opponent_current_bet = opponent_current_bet + v_user_balance,
        pot = pot + v_user_balance,
        current_raise_amount = GREATEST(v_user_balance - v_call_amount, 0),
        current_turn = v_next_turn,
        last_action_at = now()
      WHERE id = p_duel_id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'all_in',
      'amount', v_user_balance,
      'next_turn', v_next_turn
    );
  END IF;
  
  -- Handle phase transitions
  IF v_both_acted THEN
    SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
    
    IF v_duel.game_phase = 'betting_round_1' THEN
      -- Move to round 2 (flop revealed)
      UPDATE poker_duels SET
        game_phase = 'betting_round_2',
        current_turn = v_duel.creator_id,
        creator_current_bet = 0,
        opponent_current_bet = 0,
        current_raise_amount = 0,
        last_action_at = now()
      WHERE id = p_duel_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', p_action,
        'new_phase', 'betting_round_2',
        'next_turn', v_duel.creator_id
      );
      
    ELSIF v_duel.game_phase = 'betting_round_2' THEN
      -- Move to showdown
      -- Combine hole cards with community cards for each player
      v_creator_hand := v_duel.creator_cards || v_duel.community_cards;
      v_opponent_hand := v_duel.opponent_cards || v_duel.community_cards;
      
      -- Evaluate hands (best 5 cards)
      v_creator_hand := evaluate_poker_hand(v_creator_hand);
      v_opponent_hand := evaluate_poker_hand(v_opponent_hand);
      
      -- Determine winner
      IF (v_creator_hand->>'rank')::INTEGER > (v_opponent_hand->>'rank')::INTEGER THEN
        v_winner_id := v_duel.creator_id;
      ELSIF (v_creator_hand->>'rank')::INTEGER < (v_opponent_hand->>'rank')::INTEGER THEN
        v_winner_id := v_duel.opponent_id;
      ELSIF (v_creator_hand->>'high_card')::INTEGER > (v_opponent_hand->>'high_card')::INTEGER THEN
        v_winner_id := v_duel.creator_id;
      ELSIF (v_creator_hand->>'high_card')::INTEGER < (v_opponent_hand->>'high_card')::INTEGER THEN
        v_winner_id := v_duel.opponent_id;
      ELSE
        v_winner_id := NULL; -- Draw
      END IF;
      
      -- Calculate winnings
      v_commission := v_duel.pot * 0.05;
      v_win_amount := v_duel.pot - v_commission;
      
      IF v_winner_id IS NOT NULL THEN
        UPDATE profiles SET balance = balance + v_win_amount WHERE id = v_winner_id;
      ELSE
        -- Split pot on draw
        UPDATE profiles SET balance = balance + (v_win_amount / 2) WHERE id = v_duel.creator_id;
        UPDATE profiles SET balance = balance + (v_win_amount / 2) WHERE id = v_duel.opponent_id;
      END IF;
      
      UPDATE poker_duels SET
        status = 'finished',
        game_phase = 'showdown',
        winner_id = v_winner_id,
        is_draw = (v_winner_id IS NULL),
        creator_hand_rank = v_creator_hand->>'name',
        opponent_hand_rank = v_opponent_hand->>'name',
        finished_at = now()
      WHERE id = p_duel_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', p_action,
        'new_phase', 'showdown',
        'winner_id', v_winner_id,
        'is_draw', (v_winner_id IS NULL),
        'creator_hand', v_creator_hand,
        'opponent_hand', v_opponent_hand,
        'win_amount', v_win_amount
      );
    END IF;
  ELSE
    -- Continue betting, switch turn
    UPDATE poker_duels SET
      current_turn = v_next_turn,
      last_action_at = now()
    WHERE id = p_duel_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', p_action,
      'next_turn', v_next_turn
    );
  END IF;
  
  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- Function to get user's cards (only visible to the player)
CREATE OR REPLACE FUNCTION get_my_poker_cards(
  p_duel_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel RECORD;
  v_cards JSONB;
  v_community_visible INTEGER;
BEGIN
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
  
  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;
  
  -- Get player's cards
  IF p_user_id = v_duel.creator_id THEN
    v_cards := v_duel.creator_cards;
  ELSIF p_user_id = v_duel.opponent_id THEN
    v_cards := v_duel.opponent_cards;
  ELSE
    RAISE EXCEPTION 'Not a player in this duel';
  END IF;
  
  -- Determine how many community cards to show
  CASE v_duel.game_phase
    WHEN 'betting_round_1' THEN v_community_visible := 0;
    WHEN 'betting_round_2' THEN v_community_visible := 3; -- Flop
    WHEN 'showdown' THEN v_community_visible := 5;
    ELSE v_community_visible := 0;
  END CASE;
  
  RETURN jsonb_build_object(
    'my_cards', v_cards,
    'community_cards', CASE 
      WHEN v_community_visible = 0 THEN '[]'::JSONB
      WHEN v_community_visible = 3 THEN jsonb_build_array(v_duel.community_cards->0, v_duel.community_cards->1, v_duel.community_cards->2)
      ELSE v_duel.community_cards
    END,
    'game_phase', v_duel.game_phase,
    'opponent_cards', CASE 
      WHEN v_duel.game_phase = 'showdown' THEN 
        CASE WHEN p_user_id = v_duel.creator_id THEN v_duel.opponent_cards ELSE v_duel.creator_cards END
      ELSE NULL
    END
  );
END;
$$;

-- Function to get pending invitations for a user
CREATE OR REPLACE FUNCTION get_poker_invitations(p_user_id UUID)
RETURNS SETOF poker_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM poker_duels
  WHERE invited_user_id = p_user_id
    AND status = 'invited'
  ORDER BY created_at DESC;
END;
$$;
