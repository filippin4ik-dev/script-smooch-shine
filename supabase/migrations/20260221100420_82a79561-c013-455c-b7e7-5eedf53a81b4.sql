
-- Drop existing function with old parameter names
DROP FUNCTION IF EXISTS public.check_rate_limit(uuid, text, integer);

-- =============================================================
-- 1) RATE LIMITING TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.game_rate_limits (
  user_id uuid NOT NULL,
  game_name text NOT NULL,
  last_action_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_name)
);
ALTER TABLE public.game_rate_limits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "rate_limits_rpc_only" ON public.game_rate_limits FOR ALL USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Helper: check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(_user_id uuid, _game text, _interval_ms int DEFAULT 1000)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
BEGIN
  SELECT last_action_at INTO v_last
  FROM game_rate_limits
  WHERE user_id = _user_id AND game_name = _game;

  IF v_last IS NOT NULL AND (now() - v_last) < (_interval_ms || ' milliseconds')::interval THEN
    RETURN false;
  END IF;

  INSERT INTO game_rate_limits (user_id, game_name, last_action_at)
  VALUES (_user_id, _game, now())
  ON CONFLICT (user_id, game_name) DO UPDATE SET last_action_at = now();

  RETURN true;
END;
$$;

-- =============================================================
-- 2) calc_bj_hand helper
-- =============================================================
CREATE OR REPLACE FUNCTION public.calc_bj_hand(cards text[])
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total int := 0;
  v_aces int := 0;
  v_card text;
  v_rank text;
BEGIN
  FOREACH v_card IN ARRAY cards LOOP
    v_rank := regexp_replace(v_card, '[♠♥♦♣]', '', 'g');
    IF v_rank = 'A' THEN
      v_aces := v_aces + 1;
      v_total := v_total + 11;
    ELSIF v_rank IN ('J', 'Q', 'K') THEN
      v_total := v_total + 10;
    ELSE
      v_total := v_total + v_rank::int;
    END IF;
  END LOOP;

  WHILE v_total > 21 AND v_aces > 0 LOOP
    v_total := v_total - 10;
    v_aces := v_aces - 1;
  END LOOP;

  RETURN v_total;
END;
$$;

-- =============================================================
-- 3) PLAY_BLACKJACK_SERVER
-- =============================================================
CREATE OR REPLACE FUNCTION public.play_blackjack_server(
  _user_id uuid,
  _bet_amount numeric,
  _is_freebet boolean DEFAULT false,
  _is_demo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_deck text[];
  v_player_cards text[];
  v_dealer_cards text[];
  v_player_value int;
  v_dealer_value int;
  v_player_blackjack boolean;
  v_dealer_blackjack boolean;
  v_win_amount numeric := 0;
  v_multiplier numeric := 0;
  v_result text;
  v_game_number bigint;
  v_seed_hash text;
  v_card text;
  v_balance_field text;
  v_current_balance numeric;
  v_i int;
  v_j int;
  v_card_idx int;
BEGIN
  IF NOT check_rate_limit(_user_id, 'blackjack') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Слишком быстро, подождите');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Профиль не найден');
  END IF;

  IF _is_demo THEN
    v_current_balance := v_profile.demo_balance;
    v_balance_field := 'demo_balance';
  ELSIF _is_freebet THEN
    v_current_balance := v_profile.freebet_balance;
    v_balance_field := 'freebet_balance';
  ELSE
    v_current_balance := v_profile.balance;
    v_balance_field := 'balance';
  END IF;

  IF _bet_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Минимальная ставка 10₽');
  END IF;
  IF _bet_amount > v_current_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Недостаточно средств');
  END IF;

  PERFORM 1 FROM game_settings WHERE game_name = 'blackjack' AND (is_maintenance = true OR status = 'maintenance');
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Игра на обслуживании');
  END IF;

  EXECUTE format('UPDATE profiles SET %I = %I - $1 WHERE id = $2', v_balance_field, v_balance_field) USING _bet_amount, _user_id;

  v_deck := ARRAY[
    '2♠','3♠','4♠','5♠','6♠','7♠','8♠','9♠','10♠','J♠','Q♠','K♠','A♠',
    '2♥','3♥','4♥','5♥','6♥','7♥','8♥','9♥','10♥','J♥','Q♥','K♥','A♥',
    '2♦','3♦','4♦','5♦','6♦','7♦','8♦','9♦','10♦','J♦','Q♦','K♦','A♦',
    '2♣','3♣','4♣','5♣','6♣','7♣','8♣','9♣','10♣','J♣','Q♣','K♣','A♣'
  ];
  
  -- Fisher-Yates shuffle
  FOR v_i IN REVERSE array_length(v_deck, 1)..2 LOOP
    v_j := 1 + floor(random() * v_i)::int;
    v_card := v_deck[v_i];
    v_deck[v_i] := v_deck[v_j];
    v_deck[v_j] := v_card;
  END LOOP;

  v_player_cards := ARRAY[v_deck[1], v_deck[2]];
  v_dealer_cards := ARRAY[v_deck[3], v_deck[4]];
  v_card_idx := 5;

  v_player_value := calc_bj_hand(v_player_cards);
  v_dealer_value := calc_bj_hand(v_dealer_cards);
  v_player_blackjack := (v_player_value = 21);
  v_dealer_blackjack := (v_dealer_value = 21);

  -- Dealer draws to 17
  IF NOT v_player_blackjack THEN
    WHILE calc_bj_hand(v_dealer_cards) < 17 AND v_card_idx <= 52 LOOP
      v_dealer_cards := array_append(v_dealer_cards, v_deck[v_card_idx]);
      v_card_idx := v_card_idx + 1;
    END LOOP;
    v_dealer_value := calc_bj_hand(v_dealer_cards);
  END IF;

  -- Determine outcome
  IF v_player_blackjack AND v_dealer_blackjack THEN
    v_result := 'draw'; v_win_amount := _bet_amount; v_multiplier := 1;
  ELSIF v_player_blackjack THEN
    v_result := 'blackjack'; v_win_amount := _bet_amount + _bet_amount * 1.5; v_multiplier := 2.5;
  ELSIF v_dealer_blackjack THEN
    v_result := 'dealer_blackjack'; v_win_amount := 0; v_multiplier := 0;
  ELSIF v_player_value > 21 THEN
    v_result := 'bust'; v_win_amount := 0; v_multiplier := 0;
  ELSIF v_dealer_value > 21 THEN
    v_result := 'dealer_bust'; v_win_amount := _bet_amount * 2; v_multiplier := 2;
  ELSIF v_player_value > v_dealer_value THEN
    v_result := 'win'; v_win_amount := _bet_amount * 2; v_multiplier := 2;
  ELSIF v_player_value = v_dealer_value THEN
    v_result := 'draw'; v_win_amount := _bet_amount; v_multiplier := 1;
  ELSE
    v_result := 'lose'; v_win_amount := 0; v_multiplier := 0;
  END IF;

  IF v_win_amount > 0 THEN
    EXECUTE format('UPDATE profiles SET %I = %I + $1 WHERE id = $2', v_balance_field, v_balance_field) USING v_win_amount, _user_id;
  END IF;

  SELECT nextval('game_number_seq') INTO v_game_number;
  v_seed_hash := encode(digest(gen_random_uuid()::text || now()::text, 'sha256'), 'hex');

  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_number, server_seed_hash)
  VALUES (_user_id, 'blackjack', _bet_amount, GREATEST(0, v_win_amount - _bet_amount), v_multiplier, v_game_number, v_seed_hash);

  PERFORM update_game_stats(_user_id, v_win_amount > _bet_amount);

  IF v_win_amount > _bet_amount THEN
    PERFORM add_user_xp(_user_id, GREATEST(1, floor(v_win_amount / 10)::int));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'result', v_result,
    'player_cards', to_jsonb(v_player_cards),
    'dealer_cards', to_jsonb(v_dealer_cards),
    'player_value', v_player_value,
    'dealer_value', v_dealer_value,
    'win_amount', v_win_amount,
    'net_profit', v_win_amount - _bet_amount,
    'multiplier', v_multiplier,
    'game_number', v_game_number,
    'seed_hash', left(v_seed_hash, 16)
  );
END;
$$;

-- =============================================================
-- 4) PLAY_HORSE_RACING_SERVER
-- =============================================================
CREATE OR REPLACE FUNCTION public.play_horse_racing_server(
  _user_id uuid,
  _bet_amount numeric,
  _selected_horse int,
  _is_freebet boolean DEFAULT false,
  _is_demo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_winning_horse int;
  v_coefficient numeric := 6;
  v_win_amount numeric := 0;
  v_game_number bigint;
  v_seed_hash text;
  v_balance_field text;
  v_current_balance numeric;
BEGIN
  IF NOT check_rate_limit(_user_id, 'horse-racing', 3000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Подождите окончания гонки');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Профиль не найден');
  END IF;

  IF _selected_horse < 1 OR _selected_horse > 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Неверная лошадь');
  END IF;

  IF _is_demo THEN
    v_current_balance := v_profile.demo_balance; v_balance_field := 'demo_balance';
  ELSIF _is_freebet THEN
    v_current_balance := v_profile.freebet_balance; v_balance_field := 'freebet_balance';
  ELSE
    v_current_balance := v_profile.balance; v_balance_field := 'balance';
  END IF;

  IF _bet_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Минимальная ставка 10₽');
  END IF;
  IF _bet_amount > v_current_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Недостаточно средств');
  END IF;

  PERFORM 1 FROM game_settings WHERE game_name = 'horse-racing' AND (is_maintenance = true OR status = 'maintenance');
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Игра на обслуживании');
  END IF;

  EXECUTE format('UPDATE profiles SET %I = %I - $1 WHERE id = $2', v_balance_field, v_balance_field) USING _bet_amount, _user_id;

  v_winning_horse := 1 + floor(random() * 6)::int;

  IF _selected_horse = v_winning_horse THEN
    v_win_amount := _bet_amount * v_coefficient;
    EXECUTE format('UPDATE profiles SET %I = %I + $1 WHERE id = $2', v_balance_field, v_balance_field) USING v_win_amount, _user_id;
  END IF;

  SELECT nextval('game_number_seq') INTO v_game_number;
  v_seed_hash := encode(digest(gen_random_uuid()::text || now()::text, 'sha256'), 'hex');

  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_number, server_seed_hash)
  VALUES (_user_id, 'horse-racing', _bet_amount, v_win_amount, CASE WHEN v_win_amount > 0 THEN v_coefficient ELSE 0 END, v_game_number, v_seed_hash);

  PERFORM update_game_stats(_user_id, v_win_amount > 0);
  IF v_win_amount > 0 THEN
    PERFORM add_user_xp(_user_id, GREATEST(1, floor(v_win_amount / 10)::int));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'winning_horse', v_winning_horse,
    'won', _selected_horse = v_winning_horse,
    'win_amount', v_win_amount,
    'multiplier', CASE WHEN v_win_amount > 0 THEN v_coefficient ELSE 0 END,
    'game_number', v_game_number,
    'seed_hash', left(v_seed_hash, 16)
  );
END;
$$;

-- =============================================================
-- 5) CHICKEN ROAD SERVER FUNCTIONS
-- =============================================================
CREATE OR REPLACE FUNCTION public.play_chicken_road_server(
  _user_id uuid,
  _bet_amount numeric,
  _difficulty text,
  _is_freebet boolean DEFAULT false,
  _is_demo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_config record;
  v_traps boolean[];
  v_trap_chances numeric[];
  v_multipliers numeric[];
  v_balance_field text;
  v_current_balance numeric;
  v_session_id uuid;
  v_game_number bigint;
  v_seed_hash text;
  v_i int;
  v_chance numeric;
BEGIN
  IF NOT check_rate_limit(_user_id, 'chicken-road') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Слишком быстро');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Профиль не найден');
  END IF;

  SELECT * INTO v_config FROM chicken_road_config WHERE difficulty = _difficulty;
  IF v_config IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Неверная сложность');
  END IF;

  IF _is_demo THEN
    v_current_balance := v_profile.demo_balance; v_balance_field := 'demo_balance';
  ELSIF _is_freebet THEN
    v_current_balance := v_profile.freebet_balance; v_balance_field := 'freebet_balance';
  ELSE
    v_current_balance := v_profile.balance; v_balance_field := 'balance';
  END IF;

  IF _bet_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Минимальная ставка 10₽');
  END IF;
  IF _bet_amount > v_current_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Недостаточно средств');
  END IF;

  PERFORM 1 FROM game_settings WHERE game_name = 'chicken-road' AND (is_maintenance = true OR status = 'maintenance');
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Игра на обслуживании');
  END IF;

  EXECUTE format('UPDATE profiles SET %I = %I - $1 WHERE id = $2', v_balance_field, v_balance_field) USING _bet_amount, _user_id;

  v_trap_chances := ARRAY(SELECT jsonb_array_elements_text(v_config.trap_chances)::numeric);
  v_multipliers := ARRAY(SELECT jsonb_array_elements_text(v_config.multipliers)::numeric);
  
  v_traps := ARRAY[]::boolean[];
  FOR v_i IN 1..array_length(v_trap_chances, 1) LOOP
    v_chance := v_trap_chances[v_i] * 100;
    IF v_profile.guaranteed_max_win THEN
      v_traps := array_append(v_traps, false);
    ELSE
      v_traps := array_append(v_traps, (random() * 100) < v_chance);
    END IF;
  END LOOP;

  UPDATE profiles SET guaranteed_max_win = false WHERE id = _user_id;

  v_seed_hash := encode(digest(gen_random_uuid()::text || now()::text, 'sha256'), 'hex');
  SELECT nextval('game_number_seq') INTO v_game_number;

  INSERT INTO game_sessions (
    user_id, game_name, bet_amount, server_seed, 
    game_state, status, is_freebet, is_demo, game_number
  ) VALUES (
    _user_id, 'chicken-road', _bet_amount, v_seed_hash,
    jsonb_build_object(
      'traps', to_jsonb(v_traps),
      'multipliers', to_jsonb(v_multipliers),
      'current_step', 0,
      'difficulty', _difficulty,
      'balance_field', v_balance_field
    ),
    'active', _is_freebet, _is_demo, v_game_number
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'steps', array_length(v_multipliers, 1),
    'multipliers', to_jsonb(v_multipliers),
    'game_number', v_game_number,
    'seed_hash', left(v_seed_hash, 16)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.chicken_road_step(
  _user_id uuid,
  _session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_traps boolean[];
  v_multipliers numeric[];
  v_current_step int;
  v_is_trap boolean;
  v_multiplier numeric;
  v_win_amount numeric;
  v_balance_field text;
BEGIN
  SELECT * INTO v_session FROM game_sessions 
  WHERE id = _session_id AND user_id = _user_id AND game_name = 'chicken-road' AND status = 'active';
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;

  v_traps := ARRAY(SELECT jsonb_array_elements_text(v_session.game_state->'traps')::boolean);
  v_multipliers := ARRAY(SELECT jsonb_array_elements_text(v_session.game_state->'multipliers')::numeric);
  v_current_step := (v_session.game_state->>'current_step')::int;
  v_balance_field := v_session.game_state->>'balance_field';

  IF v_current_step >= array_length(v_traps, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Игра завершена');
  END IF;

  v_is_trap := v_traps[v_current_step + 1];
  v_current_step := v_current_step + 1;

  IF v_is_trap THEN
    UPDATE game_sessions SET status = 'completed', completed_at = now(), win_amount = 0,
        game_state = game_state || jsonb_build_object('current_step', v_current_step),
        result = jsonb_build_object('lost', true, 'step', v_current_step)
    WHERE id = _session_id;

    INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_number, server_seed_hash)
    VALUES (_user_id, 'chicken-road', v_session.bet_amount, 0, 0, v_session.game_number, v_session.server_seed);
    PERFORM update_game_stats(_user_id, false);

    RETURN jsonb_build_object('success', true, 'is_trap', true, 'step', v_current_step, 'game_over', true);
  ELSE
    v_multiplier := v_multipliers[v_current_step];
    UPDATE game_sessions SET game_state = game_state || jsonb_build_object('current_step', v_current_step) WHERE id = _session_id;

    IF v_current_step >= array_length(v_traps, 1) THEN
      v_win_amount := v_session.bet_amount * v_multiplier;
      EXECUTE format('UPDATE profiles SET %I = %I + $1 WHERE id = $2', v_balance_field, v_balance_field) USING v_win_amount, _user_id;
      UPDATE game_sessions SET status = 'completed', completed_at = now(), win_amount = v_win_amount,
          result = jsonb_build_object('lost', false, 'multiplier', v_multiplier) WHERE id = _session_id;
      INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_number, server_seed_hash)
      VALUES (_user_id, 'chicken-road', v_session.bet_amount, v_win_amount, v_multiplier, v_session.game_number, v_session.server_seed);
      PERFORM update_game_stats(_user_id, true);
      PERFORM add_user_xp(_user_id, GREATEST(1, floor(v_win_amount / 10)::int));
      RETURN jsonb_build_object('success', true, 'is_trap', false, 'step', v_current_step, 'multiplier', v_multiplier, 'win_amount', v_win_amount, 'game_over', true, 'completed', true);
    END IF;

    RETURN jsonb_build_object('success', true, 'is_trap', false, 'step', v_current_step, 'multiplier', v_multiplier, 'game_over', false);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.chicken_road_cashout(
  _user_id uuid,
  _session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_multipliers numeric[];
  v_current_step int;
  v_multiplier numeric;
  v_win_amount numeric;
  v_balance_field text;
BEGIN
  SELECT * INTO v_session FROM game_sessions 
  WHERE id = _session_id AND user_id = _user_id AND game_name = 'chicken-road' AND status = 'active';
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;

  v_multipliers := ARRAY(SELECT jsonb_array_elements_text(v_session.game_state->'multipliers')::numeric);
  v_current_step := (v_session.game_state->>'current_step')::int;
  v_balance_field := v_session.game_state->>'balance_field';

  IF v_current_step < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Нужно сделать хотя бы один шаг');
  END IF;

  v_multiplier := v_multipliers[v_current_step];
  v_win_amount := v_session.bet_amount * v_multiplier;

  EXECUTE format('UPDATE profiles SET %I = %I + $1 WHERE id = $2', v_balance_field, v_balance_field) USING v_win_amount, _user_id;

  UPDATE game_sessions SET status = 'completed', completed_at = now(), win_amount = v_win_amount,
      result = jsonb_build_object('lost', false, 'multiplier', v_multiplier, 'cashout', true) WHERE id = _session_id;

  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_number, server_seed_hash)
  VALUES (_user_id, 'chicken-road', v_session.bet_amount, v_win_amount, v_multiplier, v_session.game_number, v_session.server_seed);

  PERFORM update_game_stats(_user_id, true);
  PERFORM add_user_xp(_user_id, GREATEST(1, floor(v_win_amount / 10)::int));

  RETURN jsonb_build_object('success', true, 'multiplier', v_multiplier, 'win_amount', v_win_amount, 'game_number', v_session.game_number);
END;
$$;
