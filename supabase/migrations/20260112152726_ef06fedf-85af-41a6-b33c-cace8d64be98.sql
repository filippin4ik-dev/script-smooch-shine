-- Удаляем старые функции если существуют
DROP FUNCTION IF EXISTS public.give_demo_balance(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.give_demo_balance(uuid, numeric);
DROP FUNCTION IF EXISTS public.deduct_demo_balance(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.deduct_demo_balance(uuid, numeric);

-- Создаём функцию для выдачи демо-баланса
CREATE OR REPLACE FUNCTION public.give_demo_balance(
  _admin_id uuid,
  _target_user_id uuid,
  _amount numeric
)
RETURNS TABLE(success boolean, amount numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Проверяем что вызывающий - админ
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN QUERY SELECT false, 0::numeric, 'Нет прав администратора'::text;
    RETURN;
  END IF;

  -- Проверяем сумму
  IF _amount <= 0 THEN
    RETURN QUERY SELECT false, 0::numeric, 'Сумма должна быть больше 0'::text;
    RETURN;
  END IF;

  -- Обновляем демо-баланс пользователя
  UPDATE profiles
  SET demo_balance = demo_balance + _amount,
      updated_at = now()
  WHERE id = _target_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, 'Пользователь не найден'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, _amount, ('Демо-баланс начислен: +' || _amount::text || '₽')::text;
END;
$$;

-- Создаём функцию для списания демо-баланса
CREATE OR REPLACE FUNCTION public.deduct_demo_balance(
  _admin_id uuid,
  _target_user_id uuid,
  _amount numeric
)
RETURNS TABLE(success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_demo numeric;
BEGIN
  -- Проверяем что вызывающий - админ
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN QUERY SELECT false, 'Нет прав администратора'::text;
    RETURN;
  END IF;

  -- Проверяем сумму
  IF _amount <= 0 THEN
    RETURN QUERY SELECT false, 'Сумма должна быть больше 0'::text;
    RETURN;
  END IF;

  -- Получаем текущий демо-баланс
  SELECT demo_balance INTO current_demo
  FROM profiles
  WHERE id = _target_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Пользователь не найден'::text;
    RETURN;
  END IF;

  IF current_demo < _amount THEN
    RETURN QUERY SELECT false, 'Недостаточно демо-баланса для списания'::text;
    RETURN;
  END IF;

  -- Списываем демо-баланс
  UPDATE profiles
  SET demo_balance = demo_balance - _amount,
      updated_at = now()
  WHERE id = _target_user_id;

  RETURN QUERY SELECT true, ('Демо-баланс списан: -' || _amount::text || '₽')::text;
END;
$$;