-- Fix UUID cast errors when reading turn_order JSONB values
-- The previous code used (jsonb_value)::text::uuid which produces a quoted string like '"uuid"'
-- and fails with: invalid input syntax for type uuid: ""uuid""

CREATE OR REPLACE FUNCTION public.multiplayer_poker_action(
  p_duel_id uuid,
  p_user_id uuid,
  p_action text,
  p_raise_amount integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- IMPORTANT: use #>>'{}' to get raw text without JSON quotes
    IF ((v_turn_order->v_i)#>>'{}')::uuid = p_user_id THEN
      v_turn_index := v_i;
      EXIT;
    END IF;
  END LOOP;
  
  -- Find next non-folded player
  FOR v_i IN 1..jsonb_array_length(v_turn_order) LOOP
    v_turn_index := (v_turn_index + 1) % jsonb_array_length(v_turn_order);
    v_next_turn := ((v_turn_order->v_turn_index)#>>'{}')::uuid;
    
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
  IF v_all_bets_equal AND v_next_turn = ((v_turn_order->0)#>>'{}')::uuid THEN
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
$function$;
