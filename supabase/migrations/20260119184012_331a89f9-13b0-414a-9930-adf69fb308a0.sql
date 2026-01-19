
-- First drop the existing function
DROP FUNCTION IF EXISTS public.multiplayer_poker_action(uuid, uuid, text, integer);

-- Recreate with correct card array handling
CREATE OR REPLACE FUNCTION public.multiplayer_poker_action(
  p_duel_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_raise_amount INTEGER DEFAULT 0
)
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
  v_card_value TEXT;
  v_card_suit TEXT;
BEGIN
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
  
  SELECT balance INTO v_user_balance FROM profiles WHERE id = p_user_id;
  
  v_max_bet := GREATEST(
    COALESCE(v_duel.creator_current_bet, 0),
    COALESCE(v_duel.opponent_current_bet, 0),
    COALESCE(v_duel.player3_current_bet, 0),
    COALESCE(v_duel.player4_current_bet, 0)
  );
  
  v_call_amount := v_max_bet - v_current_bet;
  
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
    IF p_raise_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid raise amount';
    END IF;
    
    IF v_call_amount + p_raise_amount > v_user_balance THEN
      RAISE EXCEPTION 'Insufficient balance for raise';
    END IF;
    
    UPDATE profiles SET balance = balance - (v_call_amount + p_raise_amount) WHERE id = p_user_id;
    
    IF v_player_slot = 'creator' THEN
      UPDATE poker_duels SET creator_current_bet = creator_current_bet + v_call_amount + p_raise_amount, pot = pot + v_call_amount + p_raise_amount, current_raise_amount = p_raise_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'opponent' THEN
      UPDATE poker_duels SET opponent_current_bet = opponent_current_bet + v_call_amount + p_raise_amount, pot = pot + v_call_amount + p_raise_amount, current_raise_amount = p_raise_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player3' THEN
      UPDATE poker_duels SET player3_current_bet = player3_current_bet + v_call_amount + p_raise_amount, pot = pot + v_call_amount + p_raise_amount, current_raise_amount = p_raise_amount, last_action_at = now() WHERE id = p_duel_id;
    ELSIF v_player_slot = 'player4' THEN
      UPDATE poker_duels SET player4_current_bet = player4_current_bet + v_call_amount + p_raise_amount, pot = pot + v_call_amount + p_raise_amount, current_raise_amount = p_raise_amount, last_action_at = now() WHERE id = p_duel_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;
  
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
  
  IF v_should_end_game THEN
    IF NOT COALESCE(v_duel.creator_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.creator_id];
    ELSIF v_duel.opponent_id IS NOT NULL AND NOT COALESCE(v_duel.opponent_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.opponent_id];
    ELSIF v_duel.player3_id IS NOT NULL AND NOT COALESCE(v_duel.player3_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.player3_id];
    ELSIF v_duel.player4_id IS NOT NULL AND NOT COALESCE(v_duel.player4_folded, FALSE) THEN
      v_winner_ids := ARRAY[v_duel.player4_id];
    END IF;
    
    v_commission := FLOOR(v_duel.pot * 0.05);
    v_pot_per_winner := v_duel.pot - v_commission;
    
    UPDATE profiles SET balance = balance + v_pot_per_winner WHERE id = v_winner_ids[1];
    UPDATE poker_duels SET status = 'finished', winner_id = v_winner_ids[1], winners = to_jsonb(v_winner_ids), finished_at = now() WHERE id = p_duel_id;
    
    RETURN jsonb_build_object('success', true, 'game_ended', true, 'winner_id', v_winner_ids[1]);
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
          v_card_value := v_player_cards->v_i->>'value';
          v_card_suit := v_player_cards->v_i->>'suit';
          v_all_cards := v_all_cards || (v_card_value || CASE v_card_suit WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        FOR v_i IN 0..jsonb_array_length(v_community_cards) - 1 LOOP
          v_card_value := v_community_cards->v_i->>'value';
          v_card_suit := v_community_cards->v_i->>'suit';
          v_all_cards := v_all_cards || (v_card_value || CASE v_card_suit WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        -- Pass ALL cards to evaluate
        SELECT rank, name, high_cards INTO v_hand_rank, v_hand_name, v_hand_high_cards FROM evaluate_poker_hand(v_all_cards);
        UPDATE poker_duels SET creator_hand_rank = v_hand_name WHERE id = p_duel_id;
        
        IF v_hand_rank > v_best_hand_rank THEN
          v_best_hand_rank := v_hand_rank;
          v_best_high_cards := v_hand_high_cards;
          v_best_players := ARRAY[v_duel.creator_id];
        ELSIF v_hand_rank = v_best_hand_rank THEN
          v_compare_result := 0;
          FOR v_i IN 1..LEAST(array_length(v_hand_high_cards, 1), array_length(v_best_high_cards, 1)) LOOP
            IF v_hand_high_cards[v_i] > v_best_high_cards[v_i] THEN v_compare_result := 1; EXIT;
            ELSIF v_hand_high_cards[v_i] < v_best_high_cards[v_i] THEN v_compare_result := -1; EXIT;
            END IF;
          END LOOP;
          IF v_compare_result = 1 THEN
            v_best_high_cards := v_hand_high_cards;
            v_best_players := ARRAY[v_duel.creator_id];
          ELSIF v_compare_result = 0 THEN
            v_best_players := v_best_players || v_duel.creator_id;
          END IF;
        END IF;
      END IF;
      
      -- Opponent
      IF v_duel.opponent_id IS NOT NULL AND NOT COALESCE(v_duel.opponent_folded, FALSE) THEN
        v_player_cards := v_duel.opponent_cards;
        v_all_cards := ARRAY[]::TEXT[];
        
        FOR v_i IN 0..jsonb_array_length(v_player_cards) - 1 LOOP
          v_card_value := v_player_cards->v_i->>'value';
          v_card_suit := v_player_cards->v_i->>'suit';
          v_all_cards := v_all_cards || (v_card_value || CASE v_card_suit WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        FOR v_i IN 0..jsonb_array_length(v_community_cards) - 1 LOOP
          v_card_value := v_community_cards->v_i->>'value';
          v_card_suit := v_community_cards->v_i->>'suit';
          v_all_cards := v_all_cards || (v_card_value || CASE v_card_suit WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        SELECT rank, name, high_cards INTO v_hand_rank, v_hand_name, v_hand_high_cards FROM evaluate_poker_hand(v_all_cards);
        UPDATE poker_duels SET opponent_hand_rank = v_hand_name WHERE id = p_duel_id;
        
        IF v_hand_rank > v_best_hand_rank THEN
          v_best_hand_rank := v_hand_rank;
          v_best_high_cards := v_hand_high_cards;
          v_best_players := ARRAY[v_duel.opponent_id];
        ELSIF v_hand_rank = v_best_hand_rank THEN
          v_compare_result := 0;
          FOR v_i IN 1..LEAST(array_length(v_hand_high_cards, 1), array_length(v_best_high_cards, 1)) LOOP
            IF v_hand_high_cards[v_i] > v_best_high_cards[v_i] THEN v_compare_result := 1; EXIT;
            ELSIF v_hand_high_cards[v_i] < v_best_high_cards[v_i] THEN v_compare_result := -1; EXIT;
            END IF;
          END LOOP;
          IF v_compare_result = 1 THEN
            v_best_high_cards := v_hand_high_cards;
            v_best_players := ARRAY[v_duel.opponent_id];
          ELSIF v_compare_result = 0 THEN
            v_best_players := v_best_players || v_duel.opponent_id;
          END IF;
        END IF;
      END IF;
      
      -- Player3
      IF v_duel.player3_id IS NOT NULL AND NOT COALESCE(v_duel.player3_folded, FALSE) THEN
        v_player_cards := v_duel.player3_cards;
        v_all_cards := ARRAY[]::TEXT[];
        
        FOR v_i IN 0..jsonb_array_length(v_player_cards) - 1 LOOP
          v_card_value := v_player_cards->v_i->>'value';
          v_card_suit := v_player_cards->v_i->>'suit';
          v_all_cards := v_all_cards || (v_card_value || CASE v_card_suit WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        FOR v_i IN 0..jsonb_array_length(v_community_cards) - 1 LOOP
          v_card_value := v_community_cards->v_i->>'value';
          v_card_suit := v_community_cards->v_i->>'suit';
          v_all_cards := v_all_cards || (v_card_value || CASE v_card_suit WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        SELECT rank, name, high_cards INTO v_hand_rank, v_hand_name, v_hand_high_cards FROM evaluate_poker_hand(v_all_cards);
        UPDATE poker_duels SET player3_hand_rank = v_hand_name WHERE id = p_duel_id;
        
        IF v_hand_rank > v_best_hand_rank THEN
          v_best_hand_rank := v_hand_rank;
          v_best_high_cards := v_hand_high_cards;
          v_best_players := ARRAY[v_duel.player3_id];
        ELSIF v_hand_rank = v_best_hand_rank THEN
          v_compare_result := 0;
          FOR v_i IN 1..LEAST(array_length(v_hand_high_cards, 1), array_length(v_best_high_cards, 1)) LOOP
            IF v_hand_high_cards[v_i] > v_best_high_cards[v_i] THEN v_compare_result := 1; EXIT;
            ELSIF v_hand_high_cards[v_i] < v_best_high_cards[v_i] THEN v_compare_result := -1; EXIT;
            END IF;
          END LOOP;
          IF v_compare_result = 1 THEN
            v_best_high_cards := v_hand_high_cards;
            v_best_players := ARRAY[v_duel.player3_id];
          ELSIF v_compare_result = 0 THEN
            v_best_players := v_best_players || v_duel.player3_id;
          END IF;
        END IF;
      END IF;
      
      -- Player4
      IF v_duel.player4_id IS NOT NULL AND NOT COALESCE(v_duel.player4_folded, FALSE) THEN
        v_player_cards := v_duel.player4_cards;
        v_all_cards := ARRAY[]::TEXT[];
        
        FOR v_i IN 0..jsonb_array_length(v_player_cards) - 1 LOOP
          v_card_value := v_player_cards->v_i->>'value';
          v_card_suit := v_player_cards->v_i->>'suit';
          v_all_cards := v_all_cards || (v_card_value || CASE v_card_suit WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        FOR v_i IN 0..jsonb_array_length(v_community_cards) - 1 LOOP
          v_card_value := v_community_cards->v_i->>'value';
          v_card_suit := v_community_cards->v_i->>'suit';
          v_all_cards := v_all_cards || (v_card_value || CASE v_card_suit WHEN 'hearts' THEN '♥' WHEN 'diamonds' THEN '♦' WHEN 'clubs' THEN '♣' WHEN 'spades' THEN '♠' END);
        END LOOP;
        
        SELECT rank, name, high_cards INTO v_hand_rank, v_hand_name, v_hand_high_cards FROM evaluate_poker_hand(v_all_cards);
        UPDATE poker_duels SET player4_hand_rank = v_hand_name WHERE id = p_duel_id;
        
        IF v_hand_rank > v_best_hand_rank THEN
          v_best_hand_rank := v_hand_rank;
          v_best_high_cards := v_hand_high_cards;
          v_best_players := ARRAY[v_duel.player4_id];
        ELSIF v_hand_rank = v_best_hand_rank THEN
          v_compare_result := 0;
          FOR v_i IN 1..LEAST(array_length(v_hand_high_cards, 1), array_length(v_best_high_cards, 1)) LOOP
            IF v_hand_high_cards[v_i] > v_best_high_cards[v_i] THEN v_compare_result := 1; EXIT;
            ELSIF v_hand_high_cards[v_i] < v_best_high_cards[v_i] THEN v_compare_result := -1; EXIT;
            END IF;
          END LOOP;
          IF v_compare_result = 1 THEN
            v_best_high_cards := v_hand_high_cards;
            v_best_players := ARRAY[v_duel.player4_id];
          ELSIF v_compare_result = 0 THEN
            v_best_players := v_best_players || v_duel.player4_id;
          END IF;
        END IF;
      END IF;
      
      v_winner_ids := v_best_players;
      v_is_draw := array_length(v_winner_ids, 1) > 1;
      
      IF v_is_draw THEN
        v_pot_per_winner := v_duel.pot / array_length(v_winner_ids, 1);
        FOREACH v_player_id IN ARRAY v_winner_ids LOOP
          UPDATE profiles SET balance = balance + v_pot_per_winner WHERE id = v_player_id;
        END LOOP;
      ELSE
        v_commission := FLOOR(v_duel.pot * 0.05);
        v_pot_per_winner := v_duel.pot - v_commission;
        UPDATE profiles SET balance = balance + v_pot_per_winner WHERE id = v_winner_ids[1];
      END IF;
      
      UPDATE poker_duels SET 
        status = 'finished', 
        game_phase = 'showdown', 
        community_cards = v_community_cards, 
        winner_id = CASE WHEN v_is_draw THEN NULL ELSE v_winner_ids[1] END, 
        winners = to_jsonb(v_winner_ids), 
        is_draw = v_is_draw, 
        finished_at = now() 
      WHERE id = p_duel_id;
      
      RETURN jsonb_build_object('success', true, 'game_ended', true, 'winners', to_jsonb(v_winner_ids), 'is_draw', v_is_draw);
    ELSE
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
    END IF;
  ELSE
    UPDATE poker_duels SET current_turn = v_next_turn WHERE id = p_duel_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'next_turn', v_next_turn);
END;
$$;
