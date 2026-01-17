
-- First drop the function that depends on evaluate_poker_hand
DROP FUNCTION IF EXISTS multiplayer_poker_action(UUID, UUID, TEXT, INTEGER);

-- Drop and recreate evaluate_poker_hand with proper high card comparison
DROP FUNCTION IF EXISTS evaluate_poker_hand(text[]);

CREATE OR REPLACE FUNCTION evaluate_poker_hand(cards text[])
RETURNS TABLE(rank integer, name text, high_cards integer[]) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_values integer[];
  v_suits text[];
  v_is_flush boolean;
  v_is_straight boolean;
  v_pairs integer;
  v_three_of_kind boolean;
  i integer;
  v_val text;
  v_sorted integer[];
BEGIN
  -- Parse cards
  FOR i IN 1..3 LOOP
    v_val := regexp_replace(cards[i], '[♠♥♦♣]', '');
    v_suits[i] := regexp_replace(cards[i], '[^♠♥♦♣]', '');
    
    CASE v_val
      WHEN 'A' THEN v_values[i] := 14;
      WHEN 'K' THEN v_values[i] := 13;
      WHEN 'Q' THEN v_values[i] := 12;
      WHEN 'J' THEN v_values[i] := 11;
      ELSE v_values[i] := v_val::integer;
    END CASE;
  END LOOP;
  
  -- Sort values descending
  SELECT array_agg(v ORDER BY v DESC) INTO v_sorted FROM unnest(v_values) AS v;
  
  -- Check flush
  v_is_flush := (v_suits[1] = v_suits[2] AND v_suits[2] = v_suits[3]);
  
  -- Check straight
  v_is_straight := (v_sorted[1] - v_sorted[2] = 1 AND v_sorted[2] - v_sorted[3] = 1)
    OR (v_sorted = ARRAY[14, 3, 2]); -- A-2-3 straight
  
  -- Check pairs and three of a kind
  v_three_of_kind := (v_values[1] = v_values[2] AND v_values[2] = v_values[3]);
  v_pairs := 0;
  IF v_values[1] = v_values[2] OR v_values[1] = v_values[3] OR v_values[2] = v_values[3] THEN
    v_pairs := 1;
  END IF;
  
  -- Determine hand rank
  IF v_is_straight AND v_is_flush THEN
    RETURN QUERY SELECT 6, 'Стрит-флеш'::text, v_sorted;
  ELSIF v_three_of_kind THEN
    RETURN QUERY SELECT 5, 'Тройка'::text, v_sorted;
  ELSIF v_is_straight THEN
    RETURN QUERY SELECT 4, 'Стрит'::text, v_sorted;
  ELSIF v_is_flush THEN
    RETURN QUERY SELECT 3, 'Флеш'::text, v_sorted;
  ELSIF v_pairs > 0 THEN
    -- For pair, put pair value first
    DECLARE
      v_pair_val integer;
      v_kicker integer;
    BEGIN
      IF v_values[1] = v_values[2] THEN
        v_pair_val := v_values[1];
        v_kicker := v_values[3];
      ELSIF v_values[1] = v_values[3] THEN
        v_pair_val := v_values[1];
        v_kicker := v_values[2];
      ELSE
        v_pair_val := v_values[2];
        v_kicker := v_values[1];
      END IF;
      RETURN QUERY SELECT 2, 'Пара'::text, ARRAY[v_pair_val, v_kicker];
    END;
  ELSE
    -- High card - return sorted cards for comparison
    RETURN QUERY SELECT 1, ('Старшая ' || CASE v_sorted[1]
        WHEN 14 THEN 'A'
        WHEN 13 THEN 'K'
        WHEN 12 THEN 'Q'
        WHEN 11 THEN 'J'
        ELSE v_sorted[1]::text
      END)::text, v_sorted;
  END IF;
END;
$$;

-- Recreate multiplayer_poker_action with high card comparison and draw handling
CREATE OR REPLACE FUNCTION multiplayer_poker_action(p_duel_id UUID, p_user_id UUID, p_action TEXT, p_amount INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- For hand evaluation
  v_best_hand_rank INTEGER := -1;
  v_best_high_cards INTEGER[] := ARRAY[]::INTEGER[];
  v_hand_rank INTEGER;
  v_hand_name TEXT;
  v_hand_high_cards INTEGER[];
  v_player_cards JSONB;
  v_all_cards TEXT[];
  v_best_players UUID[];
  v_is_draw BOOLEAN := FALSE;
  v_compare_result INTEGER;
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
    IF v_player_slot = 'creator' THEN
      UPDATE poker_duels SET creator_folded = TRUE, active_players_count = active_players_count - 1, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'opponent' THEN
      UPDATE poker_duels SET opponent_folded = TRUE, active_players_count = active_players_count - 1, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player3' THEN
      UPDATE poker_duels SET player3_folded = TRUE, active_players_count = active_players_count - 1, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player4' THEN
      UPDATE poker_duels SET player4_folded = TRUE, active_players_count = active_players_count - 1, last_action_at = now() WHERE id = p_duel_id;
    END IF;
    
    SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
    
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
    
    v_call_amount := LEAST(v_call_amount, v_user_balance);
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
    IF p_amount <= 0 THEN
      RAISE EXCEPTION 'Raise amount must be positive';
    END IF;
    
    v_call_amount := (v_max_bet - v_current_bet) + p_amount;
    
    IF v_call_amount > v_user_balance THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    UPDATE profiles SET balance = balance - v_call_amount WHERE id = p_user_id;
    
    IF v_player_slot = 'creator' THEN
      UPDATE poker_duels SET creator_current_bet = creator_current_bet + v_call_amount, pot = pot + v_call_amount, current_raise_amount = p_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'opponent' THEN
      UPDATE poker_duels SET opponent_current_bet = opponent_current_bet + v_call_amount, pot = pot + v_call_amount, current_raise_amount = p_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player3' THEN
      UPDATE poker_duels SET player3_current_bet = player3_current_bet + v_call_amount, pot = pot + v_call_amount, current_raise_amount = p_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player4' THEN
      UPDATE poker_duels SET player4_current_bet = player4_current_bet + v_call_amount, pot = pot + v_call_amount, current_raise_amount = p_amount, last_action_at = now() WHERE id = p_duel_id;
    END IF;
    
  ELSIF p_action = 'allin' THEN
    v_call_amount := LEAST(v_user_balance, COALESCE(v_duel.max_balance, v_user_balance));
    
    IF v_call_amount <= 0 THEN
      RAISE EXCEPTION 'No balance for all-in';
    END IF;
    
    UPDATE profiles SET balance = balance - v_call_amount WHERE id = p_user_id;
    
    IF v_player_slot = 'creator' THEN
      UPDATE poker_duels SET creator_current_bet = creator_current_bet + v_call_amount, pot = pot + v_call_amount, current_raise_amount = GREATEST(current_raise_amount, v_call_amount - (v_max_bet - v_duel.creator_current_bet)), last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'opponent' THEN
      UPDATE poker_duels SET opponent_current_bet = opponent_current_bet + v_call_amount, pot = pot + v_call_amount, current_raise_amount = GREATEST(current_raise_amount, v_call_amount - (v_max_bet - v_duel.opponent_current_bet)), last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player3' THEN
      UPDATE poker_duels SET player3_current_bet = player3_current_bet + v_call_amount, pot = pot + v_call_amount, current_raise_amount = GREATEST(current_raise_amount, v_call_amount - (v_max_bet - v_duel.player3_current_bet)), last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player4' THEN
      UPDATE poker_duels SET player4_current_bet = player4_current_bet + v_call_amount, pot = pot + v_call_amount, current_raise_amount = GREATEST(current_raise_amount, v_call_amount - (v_max_bet - v_duel.player4_current_bet)), last_action_at = now() WHERE id = p_duel_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid action';
  END IF;
  
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
  
  IF v_should_end_game THEN
    IF NOT COALESCE(v_duel.creator_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.creator_id];
    ELSIF NOT COALESCE(v_duel.opponent_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.opponent_id];
    ELSIF NOT COALESCE(v_duel.player3_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.player3_id];
    ELSIF NOT COALESCE(v_duel.player4_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.player4_id];
    END IF;
    
    v_commission := FLOOR(v_duel.pot * 0.05);
    v_pot_per_winner := v_duel.pot - v_commission;
    
    UPDATE profiles SET balance = balance + v_pot_per_winner WHERE id = v_winner_ids[1];
    
    UPDATE poker_duels SET status = 'finished', game_phase = 'showdown', winner_id = v_winner_ids[1], winners = to_jsonb(v_winner_ids), is_draw = FALSE, finished_at = now() WHERE id = p_duel_id;
    
    RETURN jsonb_build_object('success', true, 'game_ended', true, 'winners', to_jsonb(v_winner_ids));
  END IF;
  
  v_turn_order := v_duel.turn_order;
  v_turn_index := 0;
  
  FOR v_i IN 0..jsonb_array_length(v_turn_order) - 1 LOOP
    IF ((v_turn_order->v_i)#>>'{}')::uuid = p_user_id THEN
      v_turn_index := v_i;
      EXIT;
    END IF;
  END LOOP;
  
  FOR v_i IN 1..jsonb_array_length(v_turn_order) LOOP
    v_turn_index := (v_turn_index + 1) % jsonb_array_length(v_turn_order);
    v_next_turn := ((v_turn_order->v_turn_index)#>>'{}')::uuid;
    
    IF v_next_turn = v_duel.creator_id AND NOT COALESCE(v_duel.creator_folded, FALSE) THEN EXIT;
    ELSIF v_next_turn = v_duel.opponent_id AND NOT COALESCE(v_duel.opponent_folded, FALSE) THEN EXIT;
    ELSIF v_next_turn = v_duel.player3_id AND NOT COALESCE(v_duel.player3_folded, FALSE) THEN EXIT;
    ELSIF v_next_turn = v_duel.player4_id AND NOT COALESCE(v_duel.player4_folded, FALSE) THEN EXIT;
    END IF;
  END LOOP;
  
  v_max_bet := GREATEST(
    CASE WHEN COALESCE(v_duel.creator_folded, FALSE) THEN 0 ELSE COALESCE(v_duel.creator_current_bet, 0) END,
    CASE WHEN COALESCE(v_duel.opponent_folded, FALSE) THEN 0 ELSE COALESCE(v_duel.opponent_current_bet, 0) END,
    CASE WHEN COALESCE(v_duel.player3_folded, FALSE) OR v_duel.player3_id IS NULL THEN 0 ELSE COALESCE(v_duel.player3_current_bet, 0) END,
    CASE WHEN COALESCE(v_duel.player4_folded, FALSE) OR v_duel.player4_id IS NULL THEN 0 ELSE COALESCE(v_duel.player4_current_bet, 0) END
  );
  
  v_all_bets_equal := TRUE;
  
  IF NOT COALESCE(v_duel.creator_folded, FALSE) AND v_duel.creator_current_bet != v_max_bet THEN v_all_bets_equal := FALSE; END IF;
  IF NOT COALESCE(v_duel.opponent_folded, FALSE) AND v_duel.opponent_current_bet != v_max_bet THEN v_all_bets_equal := FALSE; END IF;
  IF v_duel.player3_id IS NOT NULL AND NOT COALESCE(v_duel.player3_folded, FALSE) AND v_duel.player3_current_bet != v_max_bet THEN v_all_bets_equal := FALSE; END IF;
  IF v_duel.player4_id IS NOT NULL AND NOT COALESCE(v_duel.player4_folded, FALSE) AND v_duel.player4_current_bet != v_max_bet THEN v_all_bets_equal := FALSE; END IF;
  
  IF v_all_bets_equal AND v_next_turn = ((v_turn_order->0)#>>'{}')::uuid THEN
    v_card_offset := v_duel.max_players * COALESCE(v_duel.cards_per_player, 2);
    v_deck := v_duel.deck;
    v_community_cards := v_duel.community_cards;
    
    IF v_duel.game_phase = 'preflop' THEN
      v_community_cards := jsonb_build_array(v_deck->v_card_offset, v_deck->(v_card_offset + 1), v_deck->(v_card_offset + 2));
      v_next_phase := 'flop';
    ELSIF v_duel.game_phase = 'flop' THEN
      v_community_cards := v_community_cards || jsonb_build_array(v_deck->(v_card_offset + 3));
      v_next_phase := 'turn';
    ELSIF v_duel.game_phase = 'turn' THEN
      v_community_cards := v_community_cards || jsonb_build_array(v_deck->(v_card_offset + 4));
      v_next_phase := 'river';
    ELSIF v_duel.game_phase = 'river' THEN
      v_next_phase := 'showdown';
    END IF;
    
    IF v_next_phase = 'showdown' THEN
      v_best_hand_rank := -1;
      v_best_high_cards := ARRAY[]::INTEGER[];
      v_best_players := ARRAY[]::UUID[];
      
      -- Creator
      IF NOT COALESCE(v_duel.creator_folded, FALSE) THEN
        v_player_cards := v_duel.creator_cards;
        v_all_cards := ARRAY[]::TEXT[];
        FOR v_i IN 0..jsonb_array_length(v_player_cards) - 1 LOOP
          v_all_cards := v_all_cards || ((v_player_cards->v_i->>'rank') || CASE (v_player_cards->v_i->>'suit') WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        FOR v_i IN 0..jsonb_array_length(v_community_cards) - 1 LOOP
          v_all_cards := v_all_cards || ((v_community_cards->v_i->>'rank') || CASE (v_community_cards->v_i->>'suit') WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        SELECT rank, name, high_cards INTO v_hand_rank, v_hand_name, v_hand_high_cards FROM evaluate_poker_hand(v_all_cards[1:3]);
        UPDATE poker_duels SET creator_hand_rank = v_hand_name WHERE id = p_duel_id;
        
        IF v_hand_rank > v_best_hand_rank THEN
          v_best_hand_rank := v_hand_rank; v_best_high_cards := v_hand_high_cards; v_best_players := ARRAY[v_duel.creator_id];
        ELSIF v_hand_rank = v_best_hand_rank THEN
          v_compare_result := 0;
          FOR v_i IN 1..LEAST(array_length(v_hand_high_cards, 1), array_length(v_best_high_cards, 1)) LOOP
            IF v_hand_high_cards[v_i] > v_best_high_cards[v_i] THEN v_compare_result := 1; EXIT;
            ELSIF v_hand_high_cards[v_i] < v_best_high_cards[v_i] THEN v_compare_result := -1; EXIT; END IF;
          END LOOP;
          IF v_compare_result = 1 THEN v_best_high_cards := v_hand_high_cards; v_best_players := ARRAY[v_duel.creator_id];
          ELSIF v_compare_result = 0 THEN v_best_players := v_best_players || v_duel.creator_id; END IF;
        END IF;
      END IF;
      
      -- Opponent
      IF v_duel.opponent_id IS NOT NULL AND NOT COALESCE(v_duel.opponent_folded, FALSE) THEN
        v_player_cards := v_duel.opponent_cards;
        v_all_cards := ARRAY[]::TEXT[];
        FOR v_i IN 0..jsonb_array_length(v_player_cards) - 1 LOOP
          v_all_cards := v_all_cards || ((v_player_cards->v_i->>'rank') || CASE (v_player_cards->v_i->>'suit') WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        FOR v_i IN 0..jsonb_array_length(v_community_cards) - 1 LOOP
          v_all_cards := v_all_cards || ((v_community_cards->v_i->>'rank') || CASE (v_community_cards->v_i->>'suit') WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        SELECT rank, name, high_cards INTO v_hand_rank, v_hand_name, v_hand_high_cards FROM evaluate_poker_hand(v_all_cards[1:3]);
        UPDATE poker_duels SET opponent_hand_rank = v_hand_name WHERE id = p_duel_id;
        
        IF v_hand_rank > v_best_hand_rank THEN
          v_best_hand_rank := v_hand_rank; v_best_high_cards := v_hand_high_cards; v_best_players := ARRAY[v_duel.opponent_id];
        ELSIF v_hand_rank = v_best_hand_rank THEN
          v_compare_result := 0;
          FOR v_i IN 1..LEAST(array_length(v_hand_high_cards, 1), array_length(v_best_high_cards, 1)) LOOP
            IF v_hand_high_cards[v_i] > v_best_high_cards[v_i] THEN v_compare_result := 1; EXIT;
            ELSIF v_hand_high_cards[v_i] < v_best_high_cards[v_i] THEN v_compare_result := -1; EXIT; END IF;
          END LOOP;
          IF v_compare_result = 1 THEN v_best_high_cards := v_hand_high_cards; v_best_players := ARRAY[v_duel.opponent_id];
          ELSIF v_compare_result = 0 THEN v_best_players := v_best_players || v_duel.opponent_id; END IF;
        END IF;
      END IF;
      
      -- Player3
      IF v_duel.player3_id IS NOT NULL AND NOT COALESCE(v_duel.player3_folded, FALSE) THEN
        v_player_cards := v_duel.player3_cards;
        v_all_cards := ARRAY[]::TEXT[];
        FOR v_i IN 0..jsonb_array_length(v_player_cards) - 1 LOOP
          v_all_cards := v_all_cards || ((v_player_cards->v_i->>'rank') || CASE (v_player_cards->v_i->>'suit') WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        FOR v_i IN 0..jsonb_array_length(v_community_cards) - 1 LOOP
          v_all_cards := v_all_cards || ((v_community_cards->v_i->>'rank') || CASE (v_community_cards->v_i->>'suit') WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        SELECT rank, name, high_cards INTO v_hand_rank, v_hand_name, v_hand_high_cards FROM evaluate_poker_hand(v_all_cards[1:3]);
        UPDATE poker_duels SET player3_hand_rank = v_hand_name WHERE id = p_duel_id;
        
        IF v_hand_rank > v_best_hand_rank THEN
          v_best_hand_rank := v_hand_rank; v_best_high_cards := v_hand_high_cards; v_best_players := ARRAY[v_duel.player3_id];
        ELSIF v_hand_rank = v_best_hand_rank THEN
          v_compare_result := 0;
          FOR v_i IN 1..LEAST(array_length(v_hand_high_cards, 1), array_length(v_best_high_cards, 1)) LOOP
            IF v_hand_high_cards[v_i] > v_best_high_cards[v_i] THEN v_compare_result := 1; EXIT;
            ELSIF v_hand_high_cards[v_i] < v_best_high_cards[v_i] THEN v_compare_result := -1; EXIT; END IF;
          END LOOP;
          IF v_compare_result = 1 THEN v_best_high_cards := v_hand_high_cards; v_best_players := ARRAY[v_duel.player3_id];
          ELSIF v_compare_result = 0 THEN v_best_players := v_best_players || v_duel.player3_id; END IF;
        END IF;
      END IF;
      
      -- Player4
      IF v_duel.player4_id IS NOT NULL AND NOT COALESCE(v_duel.player4_folded, FALSE) THEN
        v_player_cards := v_duel.player4_cards;
        v_all_cards := ARRAY[]::TEXT[];
        FOR v_i IN 0..jsonb_array_length(v_player_cards) - 1 LOOP
          v_all_cards := v_all_cards || ((v_player_cards->v_i->>'rank') || CASE (v_player_cards->v_i->>'suit') WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        FOR v_i IN 0..jsonb_array_length(v_community_cards) - 1 LOOP
          v_all_cards := v_all_cards || ((v_community_cards->v_i->>'rank') || CASE (v_community_cards->v_i->>'suit') WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        SELECT rank, name, high_cards INTO v_hand_rank, v_hand_name, v_hand_high_cards FROM evaluate_poker_hand(v_all_cards[1:3]);
        UPDATE poker_duels SET player4_hand_rank = v_hand_name WHERE id = p_duel_id;
        
        IF v_hand_rank > v_best_hand_rank THEN
          v_best_hand_rank := v_hand_rank; v_best_high_cards := v_hand_high_cards; v_best_players := ARRAY[v_duel.player4_id];
        ELSIF v_hand_rank = v_best_hand_rank THEN
          v_compare_result := 0;
          FOR v_i IN 1..LEAST(array_length(v_hand_high_cards, 1), array_length(v_best_high_cards, 1)) LOOP
            IF v_hand_high_cards[v_i] > v_best_high_cards[v_i] THEN v_compare_result := 1; EXIT;
            ELSIF v_hand_high_cards[v_i] < v_best_high_cards[v_i] THEN v_compare_result := -1; EXIT; END IF;
          END LOOP;
          IF v_compare_result = 1 THEN v_best_high_cards := v_hand_high_cards; v_best_players := ARRAY[v_duel.player4_id];
          ELSIF v_compare_result = 0 THEN v_best_players := v_best_players || v_duel.player4_id; END IF;
        END IF;
      END IF;
      
      v_winner_ids := v_best_players;
      v_is_draw := array_length(v_winner_ids, 1) > 1;
      
      -- If draw - return bets to all players (no commission)
      IF v_is_draw THEN
        v_pot_per_winner := v_duel.pot / array_length(v_winner_ids, 1);
        FOREACH v_player_id IN ARRAY v_winner_ids LOOP
          UPDATE profiles SET balance = balance + v_pot_per_winner WHERE id = v_player_id;
        END LOOP;
      ELSE
        -- Single winner - calculate commission (5%)
        v_commission := FLOOR(v_duel.pot * 0.05);
        v_pot_per_winner := v_duel.pot - v_commission;
        UPDATE profiles SET balance = balance + v_pot_per_winner WHERE id = v_winner_ids[1];
      END IF;
      
      UPDATE poker_duels SET status = 'finished', game_phase = 'showdown', community_cards = v_community_cards, winner_id = CASE WHEN v_is_draw THEN NULL ELSE v_winner_ids[1] END, winners = to_jsonb(v_winner_ids), is_draw = v_is_draw, finished_at = now() WHERE id = p_duel_id;
      
      RETURN jsonb_build_object('success', true, 'game_ended', true, 'winners', to_jsonb(v_winner_ids), 'is_draw', v_is_draw);
    ELSE
      UPDATE poker_duels SET game_phase = v_next_phase, community_cards = v_community_cards, current_turn = v_next_turn, creator_current_bet = 0, opponent_current_bet = 0, player3_current_bet = 0, player4_current_bet = 0, current_raise_amount = 0, last_action_at = now() WHERE id = p_duel_id;
      RETURN jsonb_build_object('success', true, 'phase_changed', true, 'new_phase', v_next_phase);
    END IF;
  ELSE
    UPDATE poker_duels SET current_turn = v_next_turn WHERE id = p_duel_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'next_turn', v_next_turn);
END;
$$;

-- Delete all existing poker games
DELETE FROM poker_duels;
