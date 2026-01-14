-- Create apply_promocode function
CREATE OR REPLACE FUNCTION apply_promocode(_user_id uuid, _code text)
RETURNS TABLE(success boolean, message text) AS $$
DECLARE
  v_promo RECORD;
  v_already_used boolean;
  v_reward_amount numeric;
BEGIN
  -- Find the promocode
  SELECT * INTO v_promo 
  FROM promocodes 
  WHERE UPPER(code) = UPPER(_code) AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Промокод не найден или неактивен'::text;
    RETURN;
  END IF;
  
  -- Check if max uses exceeded
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN QUERY SELECT false, 'Промокод уже исчерпан'::text;
    RETURN;
  END IF;
  
  -- Check if user already used this promocode
  SELECT EXISTS(
    SELECT 1 FROM promocode_activations 
    WHERE promocode_id = v_promo.id AND user_id = _user_id
  ) INTO v_already_used;
  
  IF v_already_used THEN
    RETURN QUERY SELECT false, 'Вы уже использовали этот промокод'::text;
    RETURN;
  END IF;
  
  v_reward_amount := v_promo.reward_amount;
  
  -- Apply reward based on type
  CASE v_promo.reward_type
    WHEN 'money' THEN
      UPDATE profiles SET balance = balance + v_reward_amount WHERE id = _user_id;
    WHEN 'freebet' THEN
      UPDATE profiles SET freebet_balance = COALESCE(freebet_balance, 0) + v_reward_amount WHERE id = _user_id;
    WHEN 'betting_freebet' THEN
      UPDATE profiles SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + v_reward_amount WHERE id = _user_id;
    WHEN 'demo_balance' THEN
      UPDATE profiles SET demo_balance = demo_balance + v_reward_amount WHERE id = _user_id;
    WHEN 'freespins' THEN
      -- Add bonus wheel
      INSERT INTO bonus_wheels (user_id, is_used) VALUES (_user_id, false);
    WHEN 'admin' THEN
      -- Admin promocode - just record activation
      NULL;
    ELSE
      RETURN QUERY SELECT false, 'Неизвестный тип награды'::text;
      RETURN;
  END CASE;
  
  -- Record activation
  INSERT INTO promocode_activations (promocode_id, user_id)
  VALUES (v_promo.id, _user_id);
  
  -- Increment usage counter
  UPDATE promocodes SET current_uses = current_uses + 1 WHERE id = v_promo.id;
  
  -- Return success message
  CASE v_promo.reward_type
    WHEN 'money' THEN
      RETURN QUERY SELECT true, format('Получено %s₽ на баланс!', v_reward_amount)::text;
    WHEN 'freebet' THEN
      RETURN QUERY SELECT true, format('Получен фрибет %s₽!', v_reward_amount)::text;
    WHEN 'betting_freebet' THEN
      RETURN QUERY SELECT true, format('Получен фрибет для ставок %s₽!', v_reward_amount)::text;
    WHEN 'demo_balance' THEN
      RETURN QUERY SELECT true, format('Получено %s₽ на демо-баланс!', v_reward_amount)::text;
    WHEN 'freespins' THEN
      RETURN QUERY SELECT true, 'Получено бонусное колесо!'::text;
    WHEN 'admin' THEN
      RETURN QUERY SELECT true, 'Промокод активирован!'::text;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;