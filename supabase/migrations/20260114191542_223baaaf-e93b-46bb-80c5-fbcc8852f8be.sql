-- RPC function for toggling map betting (admin only)
CREATE OR REPLACE FUNCTION admin_toggle_map_betting(
  _admin_id UUID,
  _match_id UUID,
  _map_number INT,
  _is_closed BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Update the specific map betting status
  IF _map_number = 1 THEN
    UPDATE matches SET map1_betting_closed = _is_closed WHERE id = _match_id;
  ELSIF _map_number = 2 THEN
    UPDATE matches SET map2_betting_closed = _is_closed WHERE id = _match_id;
  ELSIF _map_number = 3 THEN
    UPDATE matches SET map3_betting_closed = _is_closed WHERE id = _match_id;
  ELSIF _map_number = 4 THEN
    UPDATE matches SET map4_betting_closed = _is_closed WHERE id = _match_id;
  ELSIF _map_number = 5 THEN
    UPDATE matches SET map5_betting_closed = _is_closed WHERE id = _match_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid map number');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC function for toggling exact score betting (admin only)
CREATE OR REPLACE FUNCTION admin_toggle_exact_score_betting(
  _admin_id UUID,
  _match_id UUID,
  _is_closed BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Update exact score betting - we use a special field
  -- If closing, set exact_score_odds to NULL; if opening, restore default
  IF _is_closed THEN
    UPDATE matches SET exact_score_odds = NULL WHERE id = _match_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Add exact_score_closed column to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS exact_score_closed BOOLEAN DEFAULT FALSE;

-- Update the RPC function to use the new column
CREATE OR REPLACE FUNCTION admin_toggle_exact_score_betting(
  _admin_id UUID,
  _match_id UUID,
  _is_closed BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  UPDATE matches SET exact_score_closed = _is_closed WHERE id = _match_id;

  RETURN jsonb_build_object('success', true);
END;
$$;