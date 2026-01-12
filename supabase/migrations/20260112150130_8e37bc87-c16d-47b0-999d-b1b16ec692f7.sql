
-- Drop the problematic RLS policy for user_moderation
DROP POLICY IF EXISTS "Admins can manage moderation" ON public.user_moderation;

-- Create RPC function for toggling VIP status
CREATE OR REPLACE FUNCTION public.admin_toggle_vip(
  _user_id uuid,
  _admin_id uuid,
  _is_vip boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can toggle VIP status';
  END IF;

  UPDATE profiles SET is_vip = _is_vip WHERE id = _user_id;
  RETURN true;
END;
$$;

-- Create RPC function for toggling ban status
CREATE OR REPLACE FUNCTION public.admin_toggle_ban(
  _user_id uuid,
  _admin_id uuid,
  _is_banned boolean,
  _ban_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can ban users';
  END IF;

  -- Update profiles table
  UPDATE profiles SET is_banned = _is_banned WHERE id = _user_id;

  -- Update or insert into user_moderation
  INSERT INTO user_moderation (user_id, is_banned, banned_by, ban_reason)
  VALUES (_user_id, _is_banned, _admin_id, _ban_reason)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    is_banned = _is_banned, 
    banned_by = _admin_id, 
    ban_reason = _ban_reason,
    updated_at = now();

  RETURN true;
END;
$$;

-- Create RPC function for toggling mute status
CREATE OR REPLACE FUNCTION public.admin_toggle_mute(
  _user_id uuid,
  _admin_id uuid,
  _is_muted boolean,
  _mute_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can mute users';
  END IF;

  -- Update profiles table
  UPDATE profiles SET is_muted = _is_muted WHERE id = _user_id;

  -- Update or insert into user_moderation
  INSERT INTO user_moderation (user_id, is_banned, muted_until, muted_by, mute_reason)
  VALUES (_user_id, false, CASE WHEN _is_muted THEN now() + interval '999 years' ELSE NULL END, _admin_id, _mute_reason)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    muted_until = CASE WHEN _is_muted THEN now() + interval '999 years' ELSE NULL END,
    muted_by = _admin_id, 
    mute_reason = _mute_reason,
    updated_at = now();

  RETURN true;
END;
$$;

-- Create RPC function for toggling max win status
CREATE OR REPLACE FUNCTION public.admin_toggle_max_win(
  _user_id uuid,
  _admin_id uuid,
  _guaranteed_max_win boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can toggle max win status';
  END IF;

  UPDATE profiles SET guaranteed_max_win = _guaranteed_max_win WHERE id = _user_id;
  RETURN true;
END;
$$;

-- Create RPC function for updating user balance
CREATE OR REPLACE FUNCTION public.admin_update_balance(
  _user_id uuid,
  _admin_id uuid,
  _amount numeric,
  _balance_type text DEFAULT 'balance'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can update balance';
  END IF;

  IF _balance_type = 'balance' THEN
    UPDATE profiles SET balance = balance + _amount WHERE id = _user_id;
  ELSIF _balance_type = 'demo_balance' THEN
    UPDATE profiles SET demo_balance = demo_balance + _amount WHERE id = _user_id;
  ELSIF _balance_type = 'freebet_balance' THEN
    UPDATE profiles SET freebet_balance = COALESCE(freebet_balance, 0) + _amount WHERE id = _user_id;
  ELSIF _balance_type = 'betting_freebet_balance' THEN
    UPDATE profiles SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + _amount WHERE id = _user_id;
  END IF;

  RETURN true;
END;
$$;

-- Create RPC function for updating username
CREATE OR REPLACE FUNCTION public.admin_update_username(
  _user_id uuid,
  _admin_id uuid,
  _new_username text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can update username';
  END IF;

  UPDATE profiles SET username = _new_username WHERE id = _user_id;
  RETURN true;
END;
$$;

-- Create RPC function for updating gradient color
CREATE OR REPLACE FUNCTION public.admin_update_gradient(
  _user_id uuid,
  _admin_id uuid,
  _gradient_color text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can update gradient';
  END IF;

  UPDATE profiles SET gradient_color = _gradient_color WHERE id = _user_id;
  RETURN true;
END;
$$;

-- Create new RLS policy for user_moderation that allows read access
CREATE POLICY "Anyone can read moderation" ON public.user_moderation
FOR SELECT USING (true);
