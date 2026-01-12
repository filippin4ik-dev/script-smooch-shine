-- Обновляем функцию admin_finish_match чтобы рассчитывать и парлеи
CREATE OR REPLACE FUNCTION admin_finish_match(
  _admin_id UUID,
  _match_id UUID,
  _winner TEXT,
  _team1_score INTEGER,
  _team2_score INTEGER,
  _map_scores JSONB DEFAULT NULL
)
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

  -- Обновляем матч
  UPDATE matches SET
    status = 'finished',
    winner = _winner,
    team1_score = _team1_score,
    team2_score = _team2_score,
    map1_team1_score = COALESCE((_map_scores->>'map1_team1')::int, map1_team1_score),
    map1_team2_score = COALESCE((_map_scores->>'map1_team2')::int, map1_team2_score),
    map2_team1_score = COALESCE((_map_scores->>'map2_team1')::int, map2_team1_score),
    map2_team2_score = COALESCE((_map_scores->>'map2_team2')::int, map2_team2_score),
    map3_team1_score = COALESCE((_map_scores->>'map3_team1')::int, map3_team1_score),
    map3_team2_score = COALESCE((_map_scores->>'map3_team2')::int, map3_team2_score),
    map4_team1_score = COALESCE((_map_scores->>'map4_team1')::int, map4_team1_score),
    map4_team2_score = COALESCE((_map_scores->>'map4_team2')::int, map4_team2_score),
    map5_team1_score = COALESCE((_map_scores->>'map5_team1')::int, map5_team1_score),
    map5_team2_score = COALESCE((_map_scores->>'map5_team2')::int, map5_team2_score),
    updated_at = now()
  WHERE id = _match_id;

  -- Рассчитываем одиночные ставки
  PERFORM auto_calculate_bets(_match_id);
  
  -- Рассчитываем экспрессы (парлеи)
  PERFORM calculate_all_parlay_bets();

  -- Логируем действие
  INSERT INTO action_logs (user_id, action_type, action_data)
  VALUES (_admin_id, 'match_complete', jsonb_build_object(
    'match_id', _match_id,
    'winner', _winner,
    'team1_score', _team1_score,
    'team2_score', _team2_score,
    'map_scores', _map_scores
  ));

  RETURN jsonb_build_object('success', true, 'message', 'Матч завершён и ставки рассчитаны');
END;
$$;