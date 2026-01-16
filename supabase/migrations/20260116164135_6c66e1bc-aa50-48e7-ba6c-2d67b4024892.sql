
-- Таблица для покерных дуэлей
CREATE TABLE public.poker_duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  opponent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  bet_amount numeric NOT NULL CHECK (bet_amount > 0),
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  creator_cards jsonb,
  opponent_cards jsonb,
  community_cards jsonb,
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_draw boolean DEFAULT false,
  creator_hand_rank text,
  opponent_hand_rank text,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- Индексы
CREATE INDEX idx_poker_duels_status ON public.poker_duels(status);
CREATE INDEX idx_poker_duels_creator ON public.poker_duels(creator_id);
CREATE INDEX idx_poker_duels_created_at ON public.poker_duels(created_at DESC);

-- RLS
ALTER TABLE public.poker_duels ENABLE ROW LEVEL SECURITY;

-- Политики - публичный доступ на чтение (Telegram auth)
CREATE POLICY "Anyone can view poker duels"
ON public.poker_duels FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert poker duels"
ON public.poker_duels FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update poker duels"
ON public.poker_duels FOR UPDATE
USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_duels;

-- Функция создания дуэли
CREATE OR REPLACE FUNCTION public.create_poker_duel(
  p_creator_id uuid,
  p_bet_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_duel_id uuid;
BEGIN
  -- Проверяем баланс
  SELECT balance INTO v_balance FROM profiles WHERE id = p_creator_id;
  
  IF v_balance < p_bet_amount THEN
    RAISE EXCEPTION 'Недостаточно средств';
  END IF;
  
  -- Списываем ставку
  UPDATE profiles SET balance = balance - p_bet_amount WHERE id = p_creator_id;
  
  -- Создаём дуэль
  INSERT INTO poker_duels (creator_id, bet_amount, status)
  VALUES (p_creator_id, p_bet_amount, 'waiting')
  RETURNING id INTO v_duel_id;
  
  RETURN v_duel_id;
END;
$$;

-- Функция отмены дуэли
CREATE OR REPLACE FUNCTION public.cancel_poker_duel(
  p_duel_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel poker_duels%ROWTYPE;
BEGIN
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id;
  
  IF v_duel.id IS NULL THEN
    RAISE EXCEPTION 'Дуэль не найдена';
  END IF;
  
  IF v_duel.creator_id != p_user_id THEN
    RAISE EXCEPTION 'Только создатель может отменить';
  END IF;
  
  IF v_duel.status != 'waiting' THEN
    RAISE EXCEPTION 'Дуэль уже началась';
  END IF;
  
  -- Возвращаем ставку
  UPDATE profiles SET balance = balance + v_duel.bet_amount WHERE id = p_user_id;
  
  -- Отменяем дуэль
  UPDATE poker_duels SET status = 'cancelled' WHERE id = p_duel_id;
  
  RETURN true;
END;
$$;

-- Функция присоединения к дуэли и розыгрыша
CREATE OR REPLACE FUNCTION public.join_poker_duel(
  p_duel_id uuid,
  p_opponent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duel poker_duels%ROWTYPE;
  v_balance numeric;
  v_deck text[];
  v_creator_cards text[];
  v_opponent_cards text[];
  v_creator_rank integer;
  v_opponent_rank integer;
  v_creator_rank_name text;
  v_opponent_rank_name text;
  v_winner_id uuid;
  v_is_draw boolean := false;
  v_pot numeric;
  v_commission numeric;
  v_win_amount numeric;
  i integer;
  v_card text;
BEGIN
  -- Получаем дуэль с блокировкой
  SELECT * INTO v_duel FROM poker_duels WHERE id = p_duel_id FOR UPDATE;
  
  IF v_duel.id IS NULL THEN
    RAISE EXCEPTION 'Дуэль не найдена';
  END IF;
  
  IF v_duel.status != 'waiting' THEN
    RAISE EXCEPTION 'Дуэль недоступна';
  END IF;
  
  IF v_duel.creator_id = p_opponent_id THEN
    RAISE EXCEPTION 'Нельзя играть против себя';
  END IF;
  
  -- Проверяем баланс оппонента
  SELECT balance INTO v_balance FROM profiles WHERE id = p_opponent_id;
  
  IF v_balance < v_duel.bet_amount THEN
    RAISE EXCEPTION 'Недостаточно средств';
  END IF;
  
  -- Списываем ставку оппонента
  UPDATE profiles SET balance = balance - v_duel.bet_amount WHERE id = p_opponent_id;
  
  -- Создаём колоду
  v_deck := ARRAY[
    '2♠','3♠','4♠','5♠','6♠','7♠','8♠','9♠','10♠','J♠','Q♠','K♠','A♠',
    '2♥','3♥','4♥','5♥','6♥','7♥','8♥','9♥','10♥','J♥','Q♥','K♥','A♥',
    '2♦','3♦','4♦','5♦','6♦','7♦','8♦','9♦','10♦','J♦','Q♦','K♦','A♦',
    '2♣','3♣','4♣','5♣','6♣','7♣','8♣','9♣','10♣','J♣','Q♣','K♣','A♣'
  ];
  
  -- Перемешиваем колоду (Fisher-Yates)
  FOR i IN REVERSE 52..2 LOOP
    v_card := v_deck[i];
    v_deck[i] := v_deck[1 + floor(random() * i)::integer];
    v_deck[1 + floor(random() * i)::integer] := v_card;
  END LOOP;
  
  -- Раздаём карты
  v_creator_cards := ARRAY[v_deck[1], v_deck[2], v_deck[3]];
  v_opponent_cards := ARRAY[v_deck[4], v_deck[5], v_deck[6]];
  
  -- Оцениваем руки (упрощённая логика)
  SELECT rank, name INTO v_creator_rank, v_creator_rank_name 
  FROM evaluate_poker_hand(v_creator_cards);
  
  SELECT rank, name INTO v_opponent_rank, v_opponent_rank_name 
  FROM evaluate_poker_hand(v_opponent_cards);
  
  -- Определяем победителя
  IF v_creator_rank > v_opponent_rank THEN
    v_winner_id := v_duel.creator_id;
  ELSIF v_opponent_rank > v_creator_rank THEN
    v_winner_id := p_opponent_id;
  ELSE
    v_is_draw := true;
  END IF;
  
  -- Расчёт выигрыша
  v_pot := v_duel.bet_amount * 2;
  v_commission := v_pot * 0.05; -- 5% комиссия
  v_win_amount := v_pot - v_commission;
  
  -- Выплата
  IF v_is_draw THEN
    -- Возврат ставок при ничьей (минус комиссия пополам)
    UPDATE profiles SET balance = balance + (v_duel.bet_amount - v_commission / 2) 
    WHERE id = v_duel.creator_id;
    UPDATE profiles SET balance = balance + (v_duel.bet_amount - v_commission / 2) 
    WHERE id = p_opponent_id;
  ELSE
    -- Победитель получает всё
    UPDATE profiles SET balance = balance + v_win_amount WHERE id = v_winner_id;
  END IF;
  
  -- Обновляем дуэль
  UPDATE poker_duels SET
    opponent_id = p_opponent_id,
    status = 'finished',
    creator_cards = to_jsonb(v_creator_cards),
    opponent_cards = to_jsonb(v_opponent_cards),
    winner_id = v_winner_id,
    is_draw = v_is_draw,
    creator_hand_rank = v_creator_rank_name,
    opponent_hand_rank = v_opponent_rank_name,
    started_at = now(),
    finished_at = now()
  WHERE id = p_duel_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'winner_id', v_winner_id,
    'is_draw', v_is_draw,
    'creator_cards', v_creator_cards,
    'opponent_cards', v_opponent_cards,
    'creator_hand', v_creator_rank_name,
    'opponent_hand', v_opponent_rank_name,
    'win_amount', v_win_amount
  );
END;
$$;

-- Функция оценки покерной руки (3 карты)
CREATE OR REPLACE FUNCTION public.evaluate_poker_hand(cards text[])
RETURNS TABLE(rank integer, name text)
LANGUAGE plpgsql
IMMUTABLE
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
  -- Парсим карты
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
  
  -- Сортируем значения
  SELECT array_agg(v ORDER BY v DESC) INTO v_sorted FROM unnest(v_values) AS v;
  
  -- Проверяем флеш
  v_is_flush := (v_suits[1] = v_suits[2] AND v_suits[2] = v_suits[3]);
  
  -- Проверяем стрит
  v_is_straight := (v_sorted[1] - v_sorted[2] = 1 AND v_sorted[2] - v_sorted[3] = 1)
    OR (v_sorted = ARRAY[14, 3, 2]); -- A-2-3 стрит
  
  -- Проверяем пары и тройки
  v_three_of_kind := (v_values[1] = v_values[2] AND v_values[2] = v_values[3]);
  v_pairs := 0;
  IF v_values[1] = v_values[2] OR v_values[1] = v_values[3] OR v_values[2] = v_values[3] THEN
    v_pairs := 1;
  END IF;
  
  -- Определяем ранг руки
  IF v_is_straight AND v_is_flush THEN
    RETURN QUERY SELECT 6, 'Стрит-флеш'::text;
  ELSIF v_three_of_kind THEN
    RETURN QUERY SELECT 5, 'Тройка'::text;
  ELSIF v_is_straight THEN
    RETURN QUERY SELECT 4, 'Стрит'::text;
  ELSIF v_is_flush THEN
    RETURN QUERY SELECT 3, 'Флеш'::text;
  ELSIF v_pairs > 0 THEN
    RETURN QUERY SELECT 2, 'Пара'::text;
  ELSE
    -- Для старшей карты добавляем её значение для сравнения
    RETURN QUERY SELECT 1 + (v_sorted[1]::numeric / 100)::integer, 
      'Старшая ' || CASE v_sorted[1]
        WHEN 14 THEN 'A'
        WHEN 13 THEN 'K'
        WHEN 12 THEN 'Q'
        WHEN 11 THEN 'J'
        ELSE v_sorted[1]::text
      END;
  END IF;
END;
$$;
