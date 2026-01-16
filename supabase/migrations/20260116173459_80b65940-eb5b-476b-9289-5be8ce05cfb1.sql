-- Update poker_betting_action to handle all-in and call when player doesn't have enough balance
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
  v_actual_call NUMERIC;
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
    
    -- If player doesn't have enough, they go all-in with what they have
    v_actual_call := LEAST(v_call_amount, v_user_balance);
    
    IF v_actual_call <= 0 THEN
      RAISE EXCEPTION 'No balance to call';
    END IF;
    
    -- Deduct call amount (capped at user balance)
    UPDATE profiles SET balance = balance - v_actual_call WHERE id = p_user_id;
    
    -- Update duel
    IF v_is_creator THEN
      UPDATE poker_duels SET
        creator_current_bet = creator_current_bet + v_actual_call,
        pot = pot + v_actual_call,
        last_action_at = now()
      WHERE id = p_duel_id;
    ELSE
      UPDATE poker_duels SET
        opponent_current_bet = opponent_current_bet + v_actual_call,
        pot = pot + v_actual_call,
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
  END IF;
  
  -- Just update turn for check
  UPDATE poker_duels SET
    current_turn = v_next_turn,
    last_action_at = now()
  WHERE id = p_duel_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'next_turn', v_next_turn
  );
END;
$$;