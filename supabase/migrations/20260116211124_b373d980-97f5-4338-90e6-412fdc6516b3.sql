-- Add multiplayer support to poker_duels table
ALTER TABLE public.poker_duels 
ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS current_players INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS player3_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS player3_cards JSONB,
ADD COLUMN IF NOT EXISTS player3_current_bet INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS player3_hand_rank TEXT,
ADD COLUMN IF NOT EXISTS player3_folded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS player4_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS player4_cards JSONB,
ADD COLUMN IF NOT EXISTS player4_current_bet INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS player4_hand_rank TEXT,
ADD COLUMN IF NOT EXISTS player4_folded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS creator_folded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS opponent_folded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cards_per_player INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS turn_order JSONB,
ADD COLUMN IF NOT EXISTS active_players_count INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS winners JSONB;

-- Create function to create multiplayer poker duel
CREATE OR REPLACE FUNCTION create_multiplayer_poker_duel(
  p_user_id UUID,
  p_bet_amount INTEGER,
  p_max_players INTEGER DEFAULT 2,
  p_cards_per_player INTEGER DEFAULT 2
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_balance INTEGER;
  v_duel_id UUID;
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
    active_players_count
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
    1
  )
  RETURNING id INTO v_duel_id;
  
  RETURN v_duel_id;
END;
$$;

-- Create function to join multiplayer poker duel
CREATE OR REPLACE FUNCTION join_multiplayer_poker_duel(
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
  v_user_balance INTEGER;
  v_deck JSONB;
  v_shuffled_deck JSONB;
  v_player_slot TEXT;
  v_all_players_joined BOOLEAN;
  v_turn_order JSONB;
  v_player_ids UUID[];
  v_current_players INTEGER;
BEGIN
  -- Lock the duel row
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id FOR UPDATE;
  
  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;
  
  IF v_duel.status != 'waiting' THEN
    RAISE EXCEPTION 'Duel is not waiting for players';
  END IF;
  
  IF p_user_id = v_duel.creator_id OR 
     p_user_id = v_duel.opponent_id OR 
     p_user_id = v_duel.player3_id OR 
     p_user_id = v_duel.player4_id THEN
    RAISE EXCEPTION 'You are already in this duel';
  END IF;
  
  -- Get user balance
  SELECT balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
  
  IF v_user_balance < v_duel.initial_bet THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct bet from user
  UPDATE profiles SET balance = balance - v_duel.initial_bet WHERE id = p_user_id;
  
  -- Find empty slot
  IF v_duel.opponent_id IS NULL THEN
    v_player_slot := 'opponent';
  ELSIF v_duel.player3_id IS NULL AND v_duel.max_players >= 3 THEN
    v_player_slot := 'player3';
  ELSIF v_duel.player4_id IS NULL AND v_duel.max_players >= 4 THEN
    v_player_slot := 'player4';
  ELSE
    RAISE EXCEPTION 'Duel is full';
  END IF;
  
  -- Update current players count
  v_current_players := v_duel.current_players + 1;
  
  -- Update turn order
  v_turn_order := v_duel.turn_order || jsonb_build_array(p_user_id);
  
  -- Check if all players joined
  v_all_players_joined := (v_current_players = v_duel.max_players);
  
  -- Update duel with new player
  IF v_player_slot = 'opponent' THEN
    UPDATE poker_duels SET
      opponent_id = p_user_id,
      opponent_current_bet = v_duel.initial_bet,
      pot = pot + v_duel.initial_bet,
      current_players = v_current_players,
      turn_order = v_turn_order,
      active_players_count = v_current_players
    WHERE id = p_duel_id;
  ELSIF v_player_slot = 'player3' THEN
    UPDATE poker_duels SET
      player3_id = p_user_id,
      player3_current_bet = v_duel.initial_bet,
      pot = pot + v_duel.initial_bet,
      current_players = v_current_players,
      turn_order = v_turn_order,
      active_players_count = v_current_players
    WHERE id = p_duel_id;
  ELSIF v_player_slot = 'player4' THEN
    UPDATE poker_duels SET
      player4_id = p_user_id,
      player4_current_bet = v_duel.initial_bet,
      pot = pot + v_duel.initial_bet,
      current_players = v_current_players,
      turn_order = v_turn_order,
      active_players_count = v_current_players
    WHERE id = p_duel_id;
  END IF;
  
  -- If all players joined, start the game
  IF v_all_players_joined THEN
    -- Create and shuffle deck
    v_deck := '[
      {"suit": "hearts", "value": "2"}, {"suit": "hearts", "value": "3"}, {"suit": "hearts", "value": "4"},
      {"suit": "hearts", "value": "5"}, {"suit": "hearts", "value": "6"}, {"suit": "hearts", "value": "7"},
      {"suit": "hearts", "value": "8"}, {"suit": "hearts", "value": "9"}, {"suit": "hearts", "value": "10"},
      {"suit": "hearts", "value": "J"}, {"suit": "hearts", "value": "Q"}, {"suit": "hearts", "value": "K"}, {"suit": "hearts", "value": "A"},
      {"suit": "diamonds", "value": "2"}, {"suit": "diamonds", "value": "3"}, {"suit": "diamonds", "value": "4"},
      {"suit": "diamonds", "value": "5"}, {"suit": "diamonds", "value": "6"}, {"suit": "diamonds", "value": "7"},
      {"suit": "diamonds", "value": "8"}, {"suit": "diamonds", "value": "9"}, {"suit": "diamonds", "value": "10"},
      {"suit": "diamonds", "value": "J"}, {"suit": "diamonds", "value": "Q"}, {"suit": "diamonds", "value": "K"}, {"suit": "diamonds", "value": "A"},
      {"suit": "clubs", "value": "2"}, {"suit": "clubs", "value": "3"}, {"suit": "clubs", "value": "4"},
      {"suit": "clubs", "value": "5"}, {"suit": "clubs", "value": "6"}, {"suit": "clubs", "value": "7"},
      {"suit": "clubs", "value": "8"}, {"suit": "clubs", "value": "9"}, {"suit": "clubs", "value": "10"},
      {"suit": "clubs", "value": "J"}, {"suit": "clubs", "value": "Q"}, {"suit": "clubs", "value": "K"}, {"suit": "clubs", "value": "A"},
      {"suit": "spades", "value": "2"}, {"suit": "spades", "value": "3"}, {"suit": "spades", "value": "4"},
      {"suit": "spades", "value": "5"}, {"suit": "spades", "value": "6"}, {"suit": "spades", "value": "7"},
      {"suit": "spades", "value": "8"}, {"suit": "spades", "value": "9"}, {"suit": "spades", "value": "10"},
      {"suit": "spades", "value": "J"}, {"suit": "spades", "value": "Q"}, {"suit": "spades", "value": "K"}, {"suit": "spades", "value": "A"}
    ]'::jsonb;
    
    -- Shuffle deck
    SELECT jsonb_agg(elem ORDER BY random()) INTO v_shuffled_deck FROM jsonb_array_elements(v_deck) AS elem;
    
    -- Get all player IDs in order
    SELECT ARRAY[v_duel.creator_id] INTO v_player_ids;
    
    -- Build update based on max_players and cards_per_player
    IF v_duel.max_players = 2 THEN
      UPDATE poker_duels SET
        status = 'playing',
        game_phase = 'preflop',
        started_at = now(),
        last_action_at = now(),
        deck = v_shuffled_deck,
        creator_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->0, v_shuffled_deck->1, v_shuffled_deck->2)
          ELSE jsonb_build_array(v_shuffled_deck->0, v_shuffled_deck->1)
        END,
        opponent_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->3, v_shuffled_deck->4, v_shuffled_deck->5)
          ELSE jsonb_build_array(v_shuffled_deck->2, v_shuffled_deck->3)
        END,
        community_cards = '[]'::jsonb,
        current_turn = v_duel.creator_id,
        creator_current_bet = 0,
        opponent_current_bet = 0,
        current_raise_amount = 0
      WHERE id = p_duel_id;
    ELSIF v_duel.max_players = 3 THEN
      UPDATE poker_duels SET
        status = 'playing',
        game_phase = 'preflop',
        started_at = now(),
        last_action_at = now(),
        deck = v_shuffled_deck,
        creator_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->0, v_shuffled_deck->1, v_shuffled_deck->2)
          ELSE jsonb_build_array(v_shuffled_deck->0, v_shuffled_deck->1)
        END,
        opponent_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->3, v_shuffled_deck->4, v_shuffled_deck->5)
          ELSE jsonb_build_array(v_shuffled_deck->2, v_shuffled_deck->3)
        END,
        player3_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->6, v_shuffled_deck->7, v_shuffled_deck->8)
          ELSE jsonb_build_array(v_shuffled_deck->4, v_shuffled_deck->5)
        END,
        community_cards = '[]'::jsonb,
        current_turn = v_duel.creator_id,
        creator_current_bet = 0,
        opponent_current_bet = 0,
        player3_current_bet = 0,
        current_raise_amount = 0
      WHERE id = p_duel_id;
    ELSIF v_duel.max_players = 4 THEN
      UPDATE poker_duels SET
        status = 'playing',
        game_phase = 'preflop',
        started_at = now(),
        last_action_at = now(),
        deck = v_shuffled_deck,
        creator_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->0, v_shuffled_deck->1, v_shuffled_deck->2)
          ELSE jsonb_build_array(v_shuffled_deck->0, v_shuffled_deck->1)
        END,
        opponent_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->3, v_shuffled_deck->4, v_shuffled_deck->5)
          ELSE jsonb_build_array(v_shuffled_deck->2, v_shuffled_deck->3)
        END,
        player3_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->6, v_shuffled_deck->7, v_shuffled_deck->8)
          ELSE jsonb_build_array(v_shuffled_deck->4, v_shuffled_deck->5)
        END,
        player4_cards = CASE 
          WHEN v_duel.cards_per_player = 3 THEN jsonb_build_array(v_shuffled_deck->9, v_shuffled_deck->10, v_shuffled_deck->11)
          ELSE jsonb_build_array(v_shuffled_deck->6, v_shuffled_deck->7)
        END,
        community_cards = '[]'::jsonb,
        current_turn = v_duel.creator_id,
        creator_current_bet = 0,
        opponent_current_bet = 0,
        player3_current_bet = 0,
        player4_current_bet = 0,
        current_raise_amount = 0
      WHERE id = p_duel_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'slot', v_player_slot,
    'game_started', v_all_players_joined
  );
END;
$$;

-- Create function for multiplayer betting action
CREATE OR REPLACE FUNCTION multiplayer_poker_action(
  p_duel_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_raise_amount INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel RECORD;
  v_user_balance INTEGER;
  v_player_slot TEXT;
  v_call_amount INTEGER;
  v_max_bet INTEGER;
  v_current_bet INTEGER;
  v_next_turn UUID;
  v_turn_order JSONB;
  v_turn_index INTEGER;
  v_active_count INTEGER;
  v_all_bets_equal BOOLEAN;
  v_next_phase TEXT;
  v_deck JSONB;
  v_community_cards JSONB;
  v_card_offset INTEGER;
  v_winner_ids UUID[];
  v_pot_per_winner INTEGER;
  v_commission INTEGER;
  v_should_end_game BOOLEAN := FALSE;
  v_i INTEGER;
  v_player_id UUID;
  v_player_bet INTEGER;
  v_player_folded BOOLEAN;
BEGIN
  -- Lock the duel row
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id FOR UPDATE;
  
  IF v_duel IS NULL THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;
  
  IF v_duel.status != 'playing' THEN
    RAISE EXCEPTION 'Duel is not in playing state';
  END IF;
  
  IF v_duel.current_turn != p_user_id THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;
  
  -- Determine player slot
  IF p_user_id = v_duel.creator_id THEN
    v_player_slot := 'creator';
    v_current_bet := v_duel.creator_current_bet;
  ELSIF p_user_id = v_duel.opponent_id THEN
    v_player_slot := 'opponent';
    v_current_bet := v_duel.opponent_current_bet;
  ELSIF p_user_id = v_duel.player3_id THEN
    v_player_slot := 'player3';
    v_current_bet := v_duel.player3_current_bet;
  ELSIF p_user_id = v_duel.player4_id THEN
    v_player_slot := 'player4';
    v_current_bet := v_duel.player4_current_bet;
  ELSE
    RAISE EXCEPTION 'You are not in this duel';
  END IF;
  
  -- Get user balance
  SELECT balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
  
  -- Calculate max bet among all players
  v_max_bet := GREATEST(
    COALESCE(v_duel.creator_current_bet, 0),
    COALESCE(v_duel.opponent_current_bet, 0),
    COALESCE(v_duel.player3_current_bet, 0),
    COALESCE(v_duel.player4_current_bet, 0)
  );
  
  v_call_amount := v_max_bet - v_current_bet;
  
  -- Handle action
  IF p_action = 'fold' THEN
    -- Mark player as folded
    IF v_player_slot = 'creator' THEN
      UPDATE poker_duels SET creator_folded = TRUE, active_players_count = active_players_count - 1, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'opponent' THEN
      UPDATE poker_duels SET opponent_folded = TRUE, active_players_count = active_players_count - 1, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player3' THEN
      UPDATE poker_duels SET player3_folded = TRUE, active_players_count = active_players_count - 1, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player4' THEN
      UPDATE poker_duels SET player4_folded = TRUE, active_players_count = active_players_count - 1, last_action_at = now() WHERE id = p_duel_id;
    END IF;
    
    -- Refresh duel data
    SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
    
    -- Check if only one player left
    IF v_duel.active_players_count = 1 THEN
      v_should_end_game := TRUE;
    END IF;
    
  ELSIF p_action = 'check' THEN
    IF v_call_amount > 0 THEN
      RAISE EXCEPTION 'Cannot check, must call or fold';
    END IF;
    UPDATE poker_duels SET last_action_at = now() WHERE id = p_duel_id;
    
  ELSIF p_action = 'call' THEN
    IF v_call_amount <= 0 THEN
      RAISE EXCEPTION 'Nothing to call';
    END IF;
    
    -- Limit call to user balance
    v_call_amount := LEAST(v_call_amount, v_user_balance);
    
    -- Deduct from user and add to pot
    UPDATE profiles SET balance = balance - v_call_amount WHERE id = p_user_id;
    
    IF v_player_slot = 'creator' THEN
      UPDATE poker_duels SET creator_current_bet = creator_current_bet + v_call_amount, pot = pot + v_call_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'opponent' THEN
      UPDATE poker_duels SET opponent_current_bet = opponent_current_bet + v_call_amount, pot = pot + v_call_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player3' THEN
      UPDATE poker_duels SET player3_current_bet = player3_current_bet + v_call_amount, pot = pot + v_call_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player4' THEN
      UPDATE poker_duels SET player4_current_bet = player4_current_bet + v_call_amount, pot = pot + v_call_amount, last_action_at = now() WHERE id = p_duel_id;
    END IF;
    
  ELSIF p_action = 'raise' THEN
    IF p_raise_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid raise amount';
    END IF;
    
    IF v_call_amount + p_raise_amount > v_user_balance THEN
      RAISE EXCEPTION 'Insufficient balance for raise';
    END IF;
    
    -- Deduct from user and add to pot
    UPDATE profiles SET balance = balance - (v_call_amount + p_raise_amount) WHERE id = p_user_id;
    
    IF v_player_slot = 'creator' THEN
      UPDATE poker_duels SET 
        creator_current_bet = creator_current_bet + v_call_amount + p_raise_amount, 
        pot = pot + v_call_amount + p_raise_amount,
        current_raise_amount = p_raise_amount,
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSIF v_player_slot = 'opponent' THEN
      UPDATE poker_duels SET 
        opponent_current_bet = opponent_current_bet + v_call_amount + p_raise_amount, 
        pot = pot + v_call_amount + p_raise_amount,
        current_raise_amount = p_raise_amount,
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player3' THEN
      UPDATE poker_duels SET 
        player3_current_bet = player3_current_bet + v_call_amount + p_raise_amount, 
        pot = pot + v_call_amount + p_raise_amount,
        current_raise_amount = p_raise_amount,
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player4' THEN
      UPDATE poker_duels SET 
        player4_current_bet = player4_current_bet + v_call_amount + p_raise_amount, 
        pot = pot + v_call_amount + p_raise_amount,
        current_raise_amount = p_raise_amount,
        last_action_at = now()
      WHERE id = p_duel_id;
    END IF;
    
  ELSIF p_action = 'all-in' THEN
    IF v_user_balance <= 0 THEN
      RAISE EXCEPTION 'No balance for all-in';
    END IF;
    
    -- Deduct entire balance
    UPDATE profiles SET balance = 0 WHERE id = p_user_id;
    
    IF v_player_slot = 'creator' THEN
      UPDATE poker_duels SET 
        creator_current_bet = creator_current_bet + v_user_balance, 
        pot = pot + v_user_balance,
        current_raise_amount = GREATEST(current_raise_amount, v_user_balance - v_call_amount),
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSIF v_player_slot = 'opponent' THEN
      UPDATE poker_duels SET 
        opponent_current_bet = opponent_current_bet + v_user_balance, 
        pot = pot + v_user_balance,
        current_raise_amount = GREATEST(current_raise_amount, v_user_balance - v_call_amount),
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player3' THEN
      UPDATE poker_duels SET 
        player3_current_bet = player3_current_bet + v_user_balance, 
        pot = pot + v_user_balance,
        current_raise_amount = GREATEST(current_raise_amount, v_user_balance - v_call_amount),
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player4' THEN
      UPDATE poker_duels SET 
        player4_current_bet = player4_current_bet + v_user_balance, 
        pot = pot + v_user_balance,
        current_raise_amount = GREATEST(current_raise_amount, v_user_balance - v_call_amount),
        last_action_at = now()
      WHERE id = p_duel_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
  
  -- Refresh duel data
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
  
  IF v_should_end_game THEN
    -- Find the only remaining player
    IF NOT COALESCE(v_duel.creator_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.creator_id];
    ELSIF NOT COALESCE(v_duel.opponent_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.opponent_id];
    ELSIF NOT COALESCE(v_duel.player3_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.player3_id];
    ELSIF NOT COALESCE(v_duel.player4_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.player4_id];
    END IF;
    
    -- Calculate commission (5%)
    v_commission := FLOOR(v_duel.pot * 0.05);
    v_pot_per_winner := v_duel.pot - v_commission;
    
    -- Pay winner
    UPDATE profiles SET balance = balance + v_pot_per_winner WHERE id = v_winner_ids[1];
    
    -- Update duel
    UPDATE poker_duels SET
      status = 'finished',
      game_phase = 'showdown',
      winner_id = v_winner_ids[1],
      winners = to_jsonb(v_winner_ids),
      finished_at = now()
    WHERE id = p_duel_id;
    
    RETURN jsonb_build_object('success', true, 'game_ended', true, 'winners', to_jsonb(v_winner_ids));
  END IF;
  
  -- Find next player turn
  v_turn_order := v_duel.turn_order;
  v_turn_index := 0;
  
  FOR v_i IN 0..jsonb_array_length(v_turn_order) - 1 LOOP
    IF (v_turn_order->v_i)::text::uuid = p_user_id THEN
      v_turn_index := v_i;
      EXIT;
    END IF;
  END LOOP;
  
  -- Find next non-folded player
  FOR v_i IN 1..jsonb_array_length(v_turn_order) LOOP
    v_turn_index := (v_turn_index + 1) % jsonb_array_length(v_turn_order);
    v_next_turn := (v_turn_order->v_turn_index)::text::uuid;
    
    -- Check if this player has folded
    IF v_next_turn = v_duel.creator_id AND NOT COALESCE(v_duel.creator_folded, FALSE) THEN
      EXIT;
    ELSIF v_next_turn = v_duel.opponent_id AND NOT COALESCE(v_duel.opponent_folded, FALSE) THEN
      EXIT;
    ELSIF v_next_turn = v_duel.player3_id AND NOT COALESCE(v_duel.player3_folded, FALSE) THEN
      EXIT;
    ELSIF v_next_turn = v_duel.player4_id AND NOT COALESCE(v_duel.player4_folded, FALSE) THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Check if all active players have equal bets (round complete)
  v_max_bet := GREATEST(
    CASE WHEN COALESCE(v_duel.creator_folded, FALSE) THEN 0 ELSE COALESCE(v_duel.creator_current_bet, 0) END,
    CASE WHEN COALESCE(v_duel.opponent_folded, FALSE) THEN 0 ELSE COALESCE(v_duel.opponent_current_bet, 0) END,
    CASE WHEN COALESCE(v_duel.player3_folded, FALSE) OR v_duel.player3_id IS NULL THEN 0 ELSE COALESCE(v_duel.player3_current_bet, 0) END,
    CASE WHEN COALESCE(v_duel.player4_folded, FALSE) OR v_duel.player4_id IS NULL THEN 0 ELSE COALESCE(v_duel.player4_current_bet, 0) END
  );
  
  v_all_bets_equal := TRUE;
  
  IF NOT COALESCE(v_duel.creator_folded, FALSE) AND v_duel.creator_current_bet != v_max_bet THEN
    v_all_bets_equal := FALSE;
  END IF;
  IF NOT COALESCE(v_duel.opponent_folded, FALSE) AND v_duel.opponent_current_bet != v_max_bet THEN
    v_all_bets_equal := FALSE;
  END IF;
  IF v_duel.player3_id IS NOT NULL AND NOT COALESCE(v_duel.player3_folded, FALSE) AND v_duel.player3_current_bet != v_max_bet THEN
    v_all_bets_equal := FALSE;
  END IF;
  IF v_duel.player4_id IS NOT NULL AND NOT COALESCE(v_duel.player4_folded, FALSE) AND v_duel.player4_current_bet != v_max_bet THEN
    v_all_bets_equal := FALSE;
  END IF;
  
  -- If we've gone full circle and bets are equal, advance to next phase
  IF v_all_bets_equal AND v_next_turn = (v_turn_order->0)::text::uuid THEN
    -- Calculate card offset based on cards per player
    v_card_offset := v_duel.max_players * COALESCE(v_duel.cards_per_player, 2);
    v_deck := v_duel.deck;
    v_community_cards := v_duel.community_cards;
    
    IF v_duel.game_phase = 'preflop' THEN
      -- Deal flop (3 cards)
      v_community_cards := jsonb_build_array(
        v_deck->v_card_offset,
        v_deck->(v_card_offset + 1),
        v_deck->(v_card_offset + 2)
      );
      v_next_phase := 'flop';
    ELSIF v_duel.game_phase = 'flop' THEN
      -- Deal turn (1 card)
      v_community_cards := v_community_cards || jsonb_build_array(v_deck->(v_card_offset + 3));
      v_next_phase := 'turn';
    ELSIF v_duel.game_phase = 'turn' THEN
      -- Deal river (1 card)
      v_community_cards := v_community_cards || jsonb_build_array(v_deck->(v_card_offset + 4));
      v_next_phase := 'river';
    ELSIF v_duel.game_phase = 'river' THEN
      -- Showdown - need to evaluate hands externally
      v_next_phase := 'showdown';
    END IF;
    
    UPDATE poker_duels SET
      game_phase = v_next_phase,
      community_cards = v_community_cards,
      current_turn = v_next_turn,
      creator_current_bet = 0,
      opponent_current_bet = 0,
      player3_current_bet = 0,
      player4_current_bet = 0,
      current_raise_amount = 0,
      last_action_at = now()
    WHERE id = p_duel_id;
    
    RETURN jsonb_build_object('success', true, 'phase_changed', true, 'new_phase', v_next_phase);
  ELSE
    -- Just update turn
    UPDATE poker_duels SET current_turn = v_next_turn WHERE id = p_duel_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'next_turn', v_next_turn);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_multiplayer_poker_duel TO authenticated, anon;
GRANT EXECUTE ON FUNCTION join_multiplayer_poker_duel TO authenticated, anon;
GRANT EXECUTE ON FUNCTION multiplayer_poker_action TO authenticated, anon;