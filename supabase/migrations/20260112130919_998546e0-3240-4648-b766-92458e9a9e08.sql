-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Admins can insert admin achievements" ON public.admin_achievements;

-- Create RPC function for granting achievements (bypasses RLS with admin check)
CREATE OR REPLACE FUNCTION public.grant_admin_achievement(
  _user_id uuid,
  _granter_id uuid,
  _title text,
  _description text,
  _icon text DEFAULT '🏆',
  _rarity text DEFAULT 'rare',
  _place integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
BEGIN
  -- Check if granter is admin
  IF NOT has_role(_granter_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can grant achievements';
  END IF;

  -- Insert the achievement
  INSERT INTO admin_achievements (user_id, granted_by, title, description, icon, rarity, place)
  VALUES (_user_id, _granter_id, _title, _description, _icon, _rarity, _place)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- Create RPC function for deleting achievements
CREATE OR REPLACE FUNCTION public.delete_admin_achievement(
  _achievement_id uuid,
  _admin_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete achievements';
  END IF;

  DELETE FROM admin_achievements WHERE id = _achievement_id;
  RETURN true;
END;
$$;