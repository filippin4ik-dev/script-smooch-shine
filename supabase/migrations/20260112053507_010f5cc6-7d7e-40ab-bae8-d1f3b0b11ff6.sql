-- Создаем функцию для перевода матча в LIVE
CREATE OR REPLACE FUNCTION admin_set_match_live(_admin_id UUID, _match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  UPDATE matches SET status = 'live', updated_at = now() WHERE id = _match_id;

  RETURN jsonb_build_object('success', true, 'message', 'Матч переведен в LIVE');
END;
$$;