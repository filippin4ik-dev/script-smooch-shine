CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: game_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.game_status AS ENUM (
    'active',
    'maintenance'
);


--
-- Name: acquire_game_lock(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acquire_game_lock(_user_id uuid, _game_session_id uuid, _game_name text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _existing RECORD;
BEGIN
  -- Проверяем существующую блокировку
  SELECT * INTO _existing
  FROM active_game_locks
  WHERE user_id = _user_id;

  IF _existing IS NOT NULL THEN
    -- Проверяем, не та ли это сессия
    IF _existing.game_session_id = _game_session_id THEN
      RETURN json_build_object('success', true, 'locked', true);
    END IF;

    -- Проверяем, не истекла ли блокировка (5 минут максимум)
    IF _existing.locked_at > now() - interval '5 minutes' THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'У вас уже есть активная игра: ' || _existing.game_name,
        'active_game', _existing.game_name
      );
    END IF;

    -- Удаляем устаревшую блокировку
    DELETE FROM active_game_locks WHERE user_id = _user_id;
  END IF;

  -- Создаем новую блокировку
  INSERT INTO active_game_locks (user_id, game_session_id, game_name)
  VALUES (_user_id, _game_session_id, _game_name)
  ON CONFLICT (user_id) DO UPDATE
  SET game_session_id = EXCLUDED.game_session_id,
      game_name = EXCLUDED.game_name,
      locked_at = now();

  RETURN json_build_object('success', true, 'locked', true);
END;
$$;


--
-- Name: add_freespins(uuid, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_freespins(_user_id uuid, _count integer, _bet_amount numeric DEFAULT 16) RETURNS TABLE(success boolean, total_spins integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_spins INTEGER;
BEGIN
  INSERT INTO user_freespins (user_id, freespins_count, freespin_bet_amount)
  VALUES (_user_id, _count, _bet_amount)
  ON CONFLICT (user_id) DO UPDATE 
  SET freespins_count = user_freespins.freespins_count + _count,
      freespin_bet_amount = _bet_amount;
  
  SELECT freespins_count INTO current_spins FROM user_freespins WHERE user_id = _user_id;
  
  RETURN QUERY SELECT TRUE, COALESCE(current_spins, _count);
END;
$$;


--
-- Name: add_streak_bonus_wins(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_streak_bonus_wins(_user_id uuid, _giveaway_id uuid, _bonus_wins integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _giveaway RECORD;
  _participant RECORD;
BEGIN
  -- Check giveaway exists and is active
  SELECT * INTO _giveaway FROM giveaways WHERE id = _giveaway_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Розыгрыш не найден или не активен');
  END IF;

  -- Check if giveaway is achievement type
  IF _giveaway.giveaway_mode != 'achievement' THEN
    RETURN json_build_object('success', false, 'message', 'Этот розыгрыш не поддерживает бонусы');
  END IF;

  -- Check if user is participant
  SELECT * INTO _participant FROM giveaway_participants 
    WHERE giveaway_id = _giveaway_id AND user_id = _user_id;
  
  IF NOT FOUND THEN
    -- Auto-join if not participant
    INSERT INTO giveaway_participants (user_id, giveaway_id) VALUES (_user_id, _giveaway_id);
  END IF;

  -- Add bonus wins to profile total_wins (these count towards leaderboard)
  UPDATE profiles 
  SET total_wins = COALESCE(total_wins, 0) + _bonus_wins
  WHERE id = _user_id;

  -- Also insert game history records for the bonus (so they're tracked in leaderboard)
  FOR i IN 1.._bonus_wins LOOP
    INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
    VALUES (_user_id, 'streak_bonus', 0, 1, 1);
  END LOOP;

  RETURN json_build_object('success', true, 'message', 'Бонус ' || _bonus_wins || ' побед добавлен!');
END;
$$;


--
-- Name: add_user_xp(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_user_xp(_user_id uuid, _xp_amount integer) RETURNS TABLE(new_xp integer, new_level integer, leveled_up boolean, old_level integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_xp INTEGER;
  current_level INTEGER;
  updated_xp INTEGER;
  updated_level INTEGER;
BEGIN
  -- Get current XP and level
  SELECT xp, level INTO current_xp, current_level
  FROM profiles WHERE id = _user_id;
  
  IF current_xp IS NULL THEN
    current_xp := 0;
    current_level := 1;
  END IF;
  
  -- Calculate new XP
  updated_xp := current_xp + _xp_amount;
  updated_level := calculate_level(updated_xp);
  
  -- Update profile
  UPDATE profiles
  SET xp = updated_xp, level = updated_level
  WHERE id = _user_id;
  
  RETURN QUERY SELECT updated_xp, updated_level, updated_level > current_level, current_level;
END;
$$;


--
-- Name: add_user_xp(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_user_xp(_user_id uuid, _xp_amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_xp NUMERIC;
  v_current_level INTEGER;
  v_new_xp NUMERIC;
  v_new_level INTEGER;
  v_xp_for_next_level NUMERIC;
BEGIN
  -- Get current XP and level
  SELECT xp, level INTO v_current_xp, v_current_level FROM profiles WHERE id = _user_id;
  
  IF v_current_xp IS NULL THEN
    v_current_xp := 0;
    v_current_level := 1;
  END IF;
  
  v_new_xp := v_current_xp + _xp_amount;
  v_new_level := v_current_level;
  
  -- Check for level up (simple formula: 1000 XP per level)
  LOOP
    v_xp_for_next_level := v_new_level * 1000;
    EXIT WHEN v_new_xp < v_xp_for_next_level;
    v_new_level := v_new_level + 1;
  END LOOP;
  
  -- Update profile
  UPDATE profiles SET xp = v_new_xp, level = v_new_level WHERE id = _user_id;
END;
$$;


--
-- Name: admin_add_email_account(uuid, text, text, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_add_email_account(_admin_id uuid, _email text, _smtp_host text, _smtp_port integer, _smtp_user text, _smtp_password text, _display_name text DEFAULT 'Lucky Casino'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Проверяем админа
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Нет прав администратора');
  END IF;

  -- Проверяем уникальность
  IF EXISTS (SELECT 1 FROM email_accounts WHERE email = _email) THEN
    RETURN json_build_object('success', false, 'error', 'Этот email уже добавлен');
  END IF;

  INSERT INTO email_accounts (email, smtp_host, smtp_port, smtp_user, smtp_password, display_name)
  VALUES (_email, _smtp_host, _smtp_port, _smtp_user, _smtp_password, _display_name);

  RETURN json_build_object('success', true, 'message', 'Email аккаунт добавлен');
END;
$$;


--
-- Name: admin_add_game_restriction(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_add_game_restriction(_admin_id uuid, _target_user_id uuid, _game_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  INSERT INTO user_game_restrictions (user_id, game_name)
  VALUES (_target_user_id, _game_name)
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object('success', true, 'message', 'Ограничение добавлено');
END;
$$;


--
-- Name: admin_add_game_win(uuid, uuid, text, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_add_game_win(_admin_id uuid, _target_user_id uuid, _game_name text, _bet_amount numeric DEFAULT 100, _win_amount numeric DEFAULT 200, _multiplier numeric DEFAULT 2.0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Проверяем что вызывающий - админ
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN json_build_object('success', false, 'message', 'Только админы могут выполнять это действие');
  END IF;
  
  -- Проверяем существование пользователя
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _target_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Пользователь не найден');
  END IF;
  
  -- Добавляем запись в game_history
  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
  VALUES (_target_user_id, _game_name, _bet_amount, _win_amount, _multiplier);
  
  -- Обновляем total_wins у пользователя
  UPDATE profiles 
  SET total_wins = COALESCE(total_wins, 0) + 1 
  WHERE id = _target_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Победа успешно добавлена'
  );
END;
$$;


--
-- Name: admin_ban_user(uuid, uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_ban_user(_admin_id uuid, _target_user_id uuid, _ban boolean, _reason text DEFAULT NULL::text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT is_admin(_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Недостаточно прав'::TEXT;
    RETURN;
  END IF;
  
  UPDATE profiles SET is_banned = _ban WHERE id = _target_user_id;
  
  INSERT INTO user_moderation (user_id, is_banned, ban_reason, banned_by)
  VALUES (_target_user_id, _ban, _reason, _admin_id)
  ON CONFLICT (user_id) DO UPDATE 
  SET is_banned = _ban, ban_reason = _reason, banned_by = _admin_id, updated_at = now();
  
  RETURN QUERY SELECT TRUE, 
    CASE WHEN _ban THEN 'Пользователь заблокирован'::TEXT ELSE 'Пользователь разблокирован'::TEXT END;
END;
$$;


--
-- Name: admin_create_match(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_match(_admin_id uuid, _match_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
  v_match_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  INSERT INTO matches (
    sport, team1_id, team2_id, team1_odds, team2_odds, match_time, status,
    has_draw, draw_odds, has_total, total_value, over_odds, under_odds,
    has_both_score, both_score_yes_odds, both_score_no_odds,
    has_handicap, handicap_value, team1_handicap_odds, team2_handicap_odds,
    bo_format, map1_team1_odds, map1_team2_odds, map2_team1_odds, map2_team2_odds,
    map3_team1_odds, map3_team2_odds, map4_team1_odds, map4_team2_odds,
    map5_team1_odds, map5_team2_odds, exact_score_odds,
    map1_total_value, map1_over_odds, map1_under_odds,
    map2_total_value, map2_over_odds, map2_under_odds,
    map3_total_value, map3_over_odds, map3_under_odds,
    map4_total_value, map4_over_odds, map4_under_odds,
    map5_total_value, map5_over_odds, map5_under_odds,
    map1_handicaps, map2_handicaps, map3_handicaps, map4_handicaps, map5_handicaps
  )
  VALUES (
    COALESCE(_match_data->>'sport', 'football'),
    (_match_data->>'team1_id')::uuid,
    (_match_data->>'team2_id')::uuid,
    COALESCE((_match_data->>'team1_odds')::numeric, 1.5),
    COALESCE((_match_data->>'team2_odds')::numeric, 1.5),
    (_match_data->>'match_time')::timestamptz,
    COALESCE(_match_data->>'status', 'upcoming'),
    COALESCE((_match_data->>'has_draw')::boolean, false),
    (_match_data->>'draw_odds')::numeric,
    COALESCE((_match_data->>'has_total')::boolean, false),
    (_match_data->>'total_value')::numeric,
    (_match_data->>'over_odds')::numeric,
    (_match_data->>'under_odds')::numeric,
    COALESCE((_match_data->>'has_both_score')::boolean, false),
    (_match_data->>'both_score_yes_odds')::numeric,
    (_match_data->>'both_score_no_odds')::numeric,
    COALESCE((_match_data->>'has_handicap')::boolean, false),
    (_match_data->>'handicap_value')::numeric,
    (_match_data->>'team1_handicap_odds')::numeric,
    (_match_data->>'team2_handicap_odds')::numeric,
    COALESCE(_match_data->>'bo_format', 'BO1'),
    (_match_data->>'map1_team1_odds')::numeric,
    (_match_data->>'map1_team2_odds')::numeric,
    (_match_data->>'map2_team1_odds')::numeric,
    (_match_data->>'map2_team2_odds')::numeric,
    (_match_data->>'map3_team1_odds')::numeric,
    (_match_data->>'map3_team2_odds')::numeric,
    (_match_data->>'map4_team1_odds')::numeric,
    (_match_data->>'map4_team2_odds')::numeric,
    (_match_data->>'map5_team1_odds')::numeric,
    (_match_data->>'map5_team2_odds')::numeric,
    CASE WHEN _match_data->'exact_score_odds' IS NOT NULL THEN _match_data->'exact_score_odds' ELSE NULL END,
    (_match_data->>'map1_total_value')::numeric,
    (_match_data->>'map1_over_odds')::numeric,
    (_match_data->>'map1_under_odds')::numeric,
    (_match_data->>'map2_total_value')::numeric,
    (_match_data->>'map2_over_odds')::numeric,
    (_match_data->>'map2_under_odds')::numeric,
    (_match_data->>'map3_total_value')::numeric,
    (_match_data->>'map3_over_odds')::numeric,
    (_match_data->>'map3_under_odds')::numeric,
    (_match_data->>'map4_total_value')::numeric,
    (_match_data->>'map4_over_odds')::numeric,
    (_match_data->>'map4_under_odds')::numeric,
    (_match_data->>'map5_total_value')::numeric,
    (_match_data->>'map5_over_odds')::numeric,
    (_match_data->>'map5_under_odds')::numeric,
    COALESCE(_match_data->'map1_handicaps', '[]'::jsonb),
    COALESCE(_match_data->'map2_handicaps', '[]'::jsonb),
    COALESCE(_match_data->'map3_handicaps', '[]'::jsonb),
    COALESCE(_match_data->'map4_handicaps', '[]'::jsonb),
    COALESCE(_match_data->'map5_handicaps', '[]'::jsonb)
  )
  RETURNING id INTO v_match_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Матч создан', 'match_id', v_match_id);
END;
$$;


--
-- Name: admin_create_promocode(uuid, text, text, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_promocode(_admin_id uuid, _code text, _reward_type text, _reward_amount numeric, _max_uses integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
  v_promo_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  INSERT INTO promocodes (code, reward_type, reward_amount, max_uses)
  VALUES (UPPER(_code), _reward_type, _reward_amount, _max_uses)
  RETURNING id INTO v_promo_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Промокод создан', 'promocode_id', v_promo_id);
END;
$$;


--
-- Name: admin_create_task(uuid, text, text, text, numeric, text, text, numeric, integer, boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_task(_admin_id uuid, _title text, _description text, _task_type text, _target_value numeric, _target_game text, _reward_type text, _reward_amount numeric, _buff_duration_hours integer DEFAULT 24, _is_daily boolean DEFAULT false, _sort_order integer DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_task_id UUID;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  INSERT INTO tasks (title, description, task_type, target_value, target_game, reward_type, reward_amount, buff_duration_hours, is_daily, sort_order)
  VALUES (_title, _description, _task_type, _target_value, _target_game, _reward_type, _reward_amount, _buff_duration_hours, _is_daily, _sort_order)
  RETURNING id INTO v_task_id;

  RETURN json_build_object('success', true, 'message', 'Задание создано', 'task_id', v_task_id);
END;
$$;


--
-- Name: admin_create_team(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_team(_admin_id uuid, _name text, _logo_url text, _sport text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
  v_team_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  INSERT INTO teams (name, logo_url, sport)
  VALUES (_name, _logo_url, _sport)
  RETURNING id INTO v_team_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Команда создана', 'team_id', v_team_id);
END;
$$;


--
-- Name: admin_deduct_freebet(uuid, uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_deduct_freebet(_admin_id uuid, _target_user_id uuid, _amount numeric, _freebet_type text DEFAULT 'casino'::text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin(_admin_id) THEN
    RETURN QUERY SELECT false, 'Нет прав администратора';
    RETURN;
  END IF;

  IF _freebet_type = 'betting' THEN
    UPDATE profiles 
    SET betting_freebet_balance = GREATEST(0, COALESCE(betting_freebet_balance, 0) - _amount)
    WHERE id = _target_user_id;
  ELSE
    UPDATE profiles 
    SET freebet_balance = GREATEST(0, COALESCE(freebet_balance, 0) - _amount)
    WHERE id = _target_user_id;
    
    UPDATE profiles 
    SET wager_requirement = 0, wager_progress = 0
    WHERE id = _target_user_id AND freebet_balance = 0;
  END IF;

  RETURN QUERY SELECT true, 'Снято ' || _amount::text || '₽ фрибета';
END;
$$;


--
-- Name: admin_delete_email_account(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_email_account(_admin_id uuid, _email_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Нет прав администратора');
  END IF;

  DELETE FROM email_accounts WHERE id = _email_id;
  
  RETURN json_build_object('success', true);
END;
$$;


--
-- Name: admin_delete_match(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_match(_admin_id uuid, _match_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  DELETE FROM matches WHERE id = _match_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Матч удалён');
END;
$$;


--
-- Name: admin_delete_match_safe(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_match_safe(_admin_id uuid, _match_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_match_data RECORD;
BEGIN
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  -- Сохраняем данные матча для лога
  SELECT * INTO v_match_data FROM matches WHERE id = _match_id;
  IF v_match_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Матч не найден');
  END IF;

  -- Возвращаем ставки перед удалением
  UPDATE user_bets SET status = 'refunded' WHERE match_id = _match_id AND status = 'pending';
  
  -- Возвращаем деньги за ставки
  UPDATE profiles p SET balance = balance + ub.bet_amount
  FROM user_bets ub WHERE ub.user_id = p.id AND ub.match_id = _match_id AND ub.status = 'refunded' AND ub.is_freebet = false;
  
  UPDATE profiles p SET betting_freebet_balance = betting_freebet_balance + ub.bet_amount
  FROM user_bets ub WHERE ub.user_id = p.id AND ub.match_id = _match_id AND ub.status = 'refunded' AND ub.is_freebet = true;

  -- Удаляем матч
  DELETE FROM matches WHERE id = _match_id;

  -- Логируем действие
  INSERT INTO action_logs (user_id, action_type, action_data)
  VALUES (_admin_id, 'match_delete', jsonb_build_object(
    'match_id', _match_id,
    'sport', v_match_data.sport,
    'status', v_match_data.status
  ));

  RETURN jsonb_build_object('success', true, 'message', 'Матч удалён, ставки возвращены');
END;
$$;


--
-- Name: admin_delete_promocode(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_promocode(_admin_id uuid, _promocode_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  DELETE FROM promocodes WHERE id = _promocode_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Промокод удалён');
END;
$$;


--
-- Name: admin_delete_task(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_task(_admin_id uuid, _task_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  DELETE FROM tasks WHERE id = _task_id;

  RETURN json_build_object('success', true, 'message', 'Задание удалено');
END;
$$;


--
-- Name: admin_delete_team(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_team(_admin_id uuid, _team_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  DELETE FROM teams WHERE id = _team_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Команда удалена');
END;
$$;


--
-- Name: admin_finish_match(uuid, uuid, text, integer, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_finish_match(_admin_id uuid, _match_id uuid, _winner text, _team1_score integer, _team2_score integer, _map_scores jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

  -- Рассчитываем ставки
  PERFORM auto_calculate_bets(_match_id);

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


--
-- Name: admin_get_email_accounts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_email_accounts(_admin_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Нет прав');
  END IF;

  RETURN json_build_object(
    'success', true,
    'accounts', (
      SELECT json_agg(json_build_object(
        'id', id,
        'email', email,
        'smtp_host', smtp_host,
        'is_active', is_active,
        'use_count', use_count,
        'last_used_at', last_used_at
      ))
      FROM email_accounts
      ORDER BY created_at DESC
    )
  );
END;
$$;


--
-- Name: admin_get_withdrawal_requests(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_withdrawal_requests() RETURNS TABLE(id uuid, user_id uuid, username text, amount numeric, method text, details text, status text, created_at timestamp with time zone, processed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check admin role
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = (SELECT id FROM profiles WHERE id = auth.uid() LIMIT 1) AND role = 'admin') THEN
    -- For Telegram auth, check if the caller's user_id is admin
    -- This is a simplified check - in real scenario you'd pass user_id
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    wr.id,
    wr.user_id,
    p.username,
    wr.amount,
    wr.method,
    wr.details,
    wr.status,
    wr.created_at,
    wr.processed_at
  FROM withdrawal_requests wr
  LEFT JOIN profiles p ON p.id = wr.user_id
  ORDER BY wr.created_at DESC;
END;
$$;


--
-- Name: admin_get_withdrawal_requests_v2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_withdrawal_requests_v2(_admin_user_id uuid) RETURNS TABLE(id uuid, user_id uuid, username text, amount numeric, method text, details text, status text, created_at timestamp with time zone, processed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check admin role
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _admin_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    wr.id,
    wr.user_id,
    p.username,
    wr.amount,
    wr.method,
    wr.details,
    wr.status,
    wr.created_at,
    wr.processed_at
  FROM withdrawal_requests wr
  LEFT JOIN profiles p ON p.id = wr.user_id
  ORDER BY wr.created_at DESC;
END;
$$;


--
-- Name: admin_get_withdrawal_requests_v3(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_withdrawal_requests_v3(_admin_id uuid) RETURNS TABLE(id uuid, user_id uuid, username text, amount numeric, payment_method text, payment_details text, comment text, status text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Проверяем что это админ
  IF NOT has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Доступ запрещён';
  END IF;
  
  RETURN QUERY
  SELECT 
    wr.id,
    wr.user_id,
    p.username,
    wr.amount,
    wr.payment_method,
    wr.payment_details,
    wr.comment,
    wr.status,
    wr.created_at,
    wr.updated_at
  FROM public.withdrawal_requests wr
  JOIN public.profiles p ON p.id = wr.user_id
  ORDER BY wr.created_at DESC;
END;
$$;


--
-- Name: admin_give_buff(uuid, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_give_buff(_admin_id uuid, _target_user_id uuid, _buff_type text, _duration_hours integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN json_build_object('success', false, 'message', 'Нет доступа');
  END IF;

  INSERT INTO user_buffs (user_id, buff_type, expires_at, given_by)
  VALUES (_target_user_id, _buff_type, now() + (_duration_hours || ' hours')::INTERVAL, _admin_id);

  RETURN json_build_object('success', true, 'message', 'Бафф выдан');
END;
$$;


--
-- Name: admin_give_buff_to_all(uuid, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_give_buff_to_all(_admin_id uuid, _giveaway_id uuid, _buff_type text DEFAULT 'x2'::text, _duration_hours integer DEFAULT 24) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_inserted_count INTEGER;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  IF _buff_type NOT IN ('x2', 'x3', 'x5', 'x10', 'x0.5') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Неверный тип баффа');
  END IF;

  INSERT INTO user_buffs (user_id, buff_type, expires_at, given_by)
  SELECT 
    gp.user_id,
    _buff_type,
    now() + (_duration_hours || ' hours')::INTERVAL,
    _admin_id
  FROM giveaway_participants gp
  WHERE gp.giveaway_id = _giveaway_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true, 
    'message', format('Бафф %s выдан %s участникам', _buff_type, v_inserted_count),
    'count', v_inserted_count
  );
END;
$$;


--
-- Name: admin_give_freebet(uuid, uuid, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_give_freebet(_admin_id uuid, _target_user_id uuid, _amount numeric, _freebet_type text DEFAULT 'casino'::text, _description text DEFAULT 'Подарок от администратора'::text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin(_admin_id) THEN
    RETURN QUERY SELECT false, 'Нет прав администратора';
    RETURN;
  END IF;

  IF _freebet_type = 'betting' THEN
    UPDATE profiles 
    SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + _amount 
    WHERE id = _target_user_id;
  ELSE
    UPDATE profiles 
    SET freebet_balance = COALESCE(freebet_balance, 0) + _amount,
        wager_requirement = COALESCE(wager_requirement, 0) + (_amount * 60)
    WHERE id = _target_user_id;
  END IF;

  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (_target_user_id, _amount, 'admin_freebet', _description);

  RETURN QUERY SELECT true, 'Фрибет ' || _amount::text || '₽ выдан';
END;
$$;


--
-- Name: admin_give_giveaway_win(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_give_giveaway_win(_admin_id uuid, _target_user_id uuid, _giveaway_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_giveaway RECORD;
BEGIN
  -- Check if admin
  IF NOT is_admin(_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  -- Get giveaway details
  SELECT * INTO v_giveaway FROM giveaways WHERE id = _giveaway_id;
  
  IF v_giveaway IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Розыгрыш не найден');
  END IF;

  -- Update giveaway with winner
  UPDATE giveaways 
  SET winner_id = _target_user_id, 
      status = 'finished', 
      finished_at = now()
  WHERE id = _giveaway_id;

  -- Give prize
  IF v_giveaway.prize_type = 'balance' THEN
    UPDATE profiles SET balance = balance + COALESCE(v_giveaway.prize_amount, 0) WHERE id = _target_user_id;
  ELSIF v_giveaway.prize_type = 'freebet' THEN
    UPDATE profiles SET freebet_balance = freebet_balance + COALESCE(v_giveaway.prize_amount, 0) WHERE id = _target_user_id;
  ELSIF v_giveaway.prize_type = 'betting_freebet' THEN
    UPDATE profiles SET betting_freebet_balance = betting_freebet_balance + COALESCE(v_giveaway.prize_amount, 0) WHERE id = _target_user_id;
  ELSIF v_giveaway.prize_type = 'skin' AND v_giveaway.prize_skin_id IS NOT NULL THEN
    INSERT INTO user_inventory (user_id, skin_id, purchased_price, is_demo)
    VALUES (_target_user_id, v_giveaway.prize_skin_id, 0, false);
  END IF;

  -- Log action
  INSERT INTO action_logs (user_id, action_type, action_data)
  VALUES (_admin_id, 'admin_give_giveaway_win', jsonb_build_object(
    'target_user_id', _target_user_id,
    'giveaway_id', _giveaway_id,
    'prize_type', v_giveaway.prize_type,
    'prize_amount', v_giveaway.prize_amount
  ));

  RETURN jsonb_build_object('success', true, 'message', 'Победа в розыгрыше выдана');
END;
$$;


--
-- Name: admin_give_skin(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_give_skin(_admin_id uuid, _target_user_id uuid, _skin_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
  v_skin skins%ROWTYPE;
  v_target_username text;
BEGIN
  -- Проверяем админа
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  -- Проверяем существование скина
  SELECT * INTO v_skin FROM skins WHERE id = _skin_id;
  IF v_skin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Скин не найден');
  END IF;
  
  -- Получаем имя пользователя
  SELECT username INTO v_target_username FROM profiles WHERE id = _target_user_id;
  IF v_target_username IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Пользователь не найден');
  END IF;
  
  -- Добавляем скин в инвентарь
  INSERT INTO user_inventory (user_id, skin_id, purchased_price)
  VALUES (_target_user_id, _skin_id, 0);
  
  -- Уведомляем пользователя
  PERFORM notify_user_action(_target_user_id::text, '🎁 Вы получили скин: ' || v_skin.weapon || ' | ' || v_skin.name);
  
  -- Логируем действие
  INSERT INTO action_logs (user_id, action_type, action_data)
  VALUES (_admin_id, 'give_skin', jsonb_build_object(
    'target_user_id', _target_user_id,
    'target_username', v_target_username,
    'skin_id', _skin_id,
    'skin_name', v_skin.weapon || ' | ' || v_skin.name,
    'skin_price', v_skin.price
  ));
  
  RETURN jsonb_build_object('success', true, 'message', 'Скин ' || v_skin.weapon || ' | ' || v_skin.name || ' выдан пользователю ' || v_target_username);
END;
$$;


--
-- Name: admin_give_wheel(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_give_wheel(_admin_id uuid, _target_user_id uuid, _count integer DEFAULT 1) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  i integer;
BEGIN
  IF NOT public.is_admin(_admin_id) THEN
    RETURN QUERY SELECT false, 'Нет прав администратора';
    RETURN;
  END IF;

  FOR i IN 1.._count LOOP
    INSERT INTO bonus_wheels (user_id, is_used)
    VALUES (_target_user_id, false);
  END LOOP;

  RETURN QUERY SELECT true, 'Выдано ' || _count::text || ' колёс';
END;
$$;


--
-- Name: admin_grant_black_crow_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_grant_black_crow_access(_admin_id uuid, _target_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    _is_admin BOOLEAN;
BEGIN
    -- Check if admin
    SELECT EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
    ) INTO _is_admin;
    
    IF NOT _is_admin THEN
        RETURN json_build_object('success', false, 'message', 'Недостаточно прав');
    END IF;
    
    -- Insert or ignore if exists
    INSERT INTO black_crow_access (user_id, granted_by)
    VALUES (_target_user_id, _admin_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN json_build_object('success', true, 'message', 'Доступ к Black Crow выдан');
END;
$$;


--
-- Name: admin_list_wheel_presets(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_wheel_presets(p_admin_id uuid, p_session_token text) RETURNS TABLE(id uuid, user_id uuid, preset_result text, created_at timestamp with time zone, is_used boolean, username text, is_vip boolean, public_id integer, gradient_color text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.validate_user_session(p_admin_id, p_session_token) THEN
    RAISE EXCEPTION 'Не авторизован';
  END IF;

  IF NOT public.has_role(p_admin_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Недостаточно прав';
  END IF;

  RETURN QUERY
  SELECT 
    pwr.id,
    pwr.user_id,
    pwr.preset_result,
    pwr.created_at,
    pwr.is_used,
    pr.username,
    pr.is_vip,
    pr.public_id,
    pr.gradient_color
  FROM public.preset_wheel_results pwr
  LEFT JOIN public.profiles pr ON pr.id = pwr.user_id
  WHERE pwr.is_used = false
  ORDER BY pwr.created_at DESC;
END;
$$;


--
-- Name: admin_modify_balance(uuid, uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_modify_balance(_admin_id uuid, _target_user_id uuid, _amount numeric, _reason text DEFAULT 'Изменение от админа'::text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Проверяем права админа
  IF NOT is_admin(_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Недостаточно прав'::TEXT;
    RETURN;
  END IF;
  
  -- Проверяем существование пользователя
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _target_user_id) THEN
    RETURN QUERY SELECT FALSE, 'Пользователь не найден'::TEXT;
    RETURN;
  END IF;
  
  -- Изменяем баланс
  UPDATE profiles SET balance = balance + _amount WHERE id = _target_user_id;
  
  -- Записываем транзакцию
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (_target_user_id, _amount, 'admin_balance', _reason);
  
  -- Уведомляем пользователя
  INSERT INTO system_notifications (user_id, message)
  VALUES (_target_user_id, 
    CASE WHEN _amount >= 0 
      THEN '💰 Вам начислено ' || _amount::TEXT || '₽'
      ELSE '💸 С вашего баланса списано ' || ABS(_amount)::TEXT || '₽'
    END
  );
  
  RETURN QUERY SELECT TRUE, 'Баланс изменен'::TEXT;
END;
$$;


--
-- Name: admin_modify_xp(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_modify_xp(_admin_id uuid, _target_user_id uuid, _xp_amount integer) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_xp integer;
  new_level integer;
BEGIN
  IF NOT public.is_admin(_admin_id) THEN
    RETURN QUERY SELECT false, 'Нет прав администратора';
    RETURN;
  END IF;

  UPDATE profiles 
  SET xp = GREATEST(0, xp + _xp_amount)
  WHERE id = _target_user_id
  RETURNING xp INTO new_xp;

  new_level := public.calculate_level(new_xp);
  
  UPDATE profiles SET level = new_level WHERE id = _target_user_id;

  RETURN QUERY SELECT true, 'XP изменен на ' || _xp_amount::text || '. Новый XP: ' || new_xp::text || ', уровень: ' || new_level::text;
END;
$$;


--
-- Name: admin_mute_user(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_mute_user(_admin_id uuid, _target_user_id uuid, _mute_seconds integer DEFAULT 3600) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT is_admin(_admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Недостаточно прав'::TEXT;
    RETURN;
  END IF;
  
  INSERT INTO user_moderation (user_id, muted_until, muted_by)
  VALUES (_target_user_id, now() + (_mute_seconds || ' seconds')::INTERVAL, _admin_id)
  ON CONFLICT (user_id) DO UPDATE 
  SET muted_until = now() + (_mute_seconds || ' seconds')::INTERVAL, 
      muted_by = _admin_id, 
      updated_at = now();
  
  UPDATE profiles SET is_muted = TRUE WHERE id = _target_user_id;
  
  RETURN QUERY SELECT TRUE, 'Пользователь замучен на ' || _mute_seconds || ' сек'::TEXT;
END;
$$;


--
-- Name: admin_remove_buff(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_remove_buff(_admin_id uuid, _target_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check admin
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  DELETE FROM user_buffs WHERE user_id = _target_user_id;

  RETURN json_build_object('success', true, 'message', 'Бафф удалён');
END;
$$;


--
-- Name: admin_remove_game_restriction(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_remove_game_restriction(_admin_id uuid, _restriction_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  DELETE FROM user_game_restrictions WHERE id = _restriction_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Ограничение удалено');
END;
$$;


--
-- Name: admin_remove_wheel_preset(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_remove_wheel_preset(p_admin_id uuid, p_session_token text, p_target_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  deleted_count INT;
BEGIN
  IF NOT public.validate_user_session(p_admin_id, p_session_token) THEN
    RETURN json_build_object('success', false, 'message', 'Не авторизован');
  END IF;

  IF NOT public.has_role(p_admin_id, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  DELETE FROM public.preset_wheel_results
  WHERE user_id = p_target_user_id AND is_used = false;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RETURN json_build_object('success', true, 'message', 'Пресет удалён');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Пресет не найден');
END;
$$;


--
-- Name: admin_revoke_black_crow_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_revoke_black_crow_access(_admin_id uuid, _target_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    _is_admin BOOLEAN;
BEGIN
    -- Check if admin
    SELECT EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
    ) INTO _is_admin;
    
    IF NOT _is_admin THEN
        RETURN json_build_object('success', false, 'message', 'Недостаточно прав');
    END IF;
    
    DELETE FROM black_crow_access WHERE user_id = _target_user_id;
    
    RETURN json_build_object('success', true, 'message', 'Доступ к Black Crow отозван');
END;
$$;


--
-- Name: admin_set_bet_status(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_bet_status(_bet_id uuid, _status text, _is_parlay boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  bet_record RECORD;
  xp_reward INTEGER;
BEGIN
  IF _is_parlay THEN
    SELECT * INTO bet_record FROM parlay_bets WHERE id = _bet_id;
    
    IF bet_record IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Экспресс не найден');
    END IF;
    
    IF _status = 'won' AND bet_record.status != 'won' THEN
      -- Set as won and credit winnings
      UPDATE parlay_bets SET status = 'won' WHERE id = _bet_id;
      UPDATE profiles SET balance = balance + bet_record.potential_win WHERE id = bet_record.user_id;
      INSERT INTO transactions (user_id, amount, type, description)
      VALUES (bet_record.user_id, bet_record.potential_win, 'admin_parlay_win', 'Выигрыш экспресса (админ)');
      
      xp_reward := LEAST(50, GREATEST(5, FLOOR(bet_record.potential_win / 20)::INTEGER));
      PERFORM add_user_xp(bet_record.user_id, xp_reward);
      PERFORM process_bet_referral_commission(bet_record.user_id, bet_record.potential_win);
      
    ELSIF _status = 'lost' AND bet_record.status != 'lost' THEN
      -- If was won, remove winnings
      IF bet_record.status = 'won' THEN
        UPDATE profiles SET balance = balance - bet_record.potential_win WHERE id = bet_record.user_id;
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (bet_record.user_id, -bet_record.potential_win, 'admin_parlay_rollback', 'Откат выигрыша экспресса (админ)');
      END IF;
      UPDATE parlay_bets SET status = 'lost' WHERE id = _bet_id;
      
    ELSIF _status = 'pending' THEN
      -- Rollback to pending
      IF bet_record.status = 'won' THEN
        UPDATE profiles SET balance = balance - bet_record.potential_win WHERE id = bet_record.user_id;
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (bet_record.user_id, -bet_record.potential_win, 'admin_parlay_rollback', 'Откат выигрыша экспресса (админ)');
      END IF;
      UPDATE parlay_bets SET status = 'pending' WHERE id = _bet_id;
    END IF;
    
  ELSE
    SELECT * INTO bet_record FROM user_bets WHERE id = _bet_id;
    
    IF bet_record IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Ставка не найдена');
    END IF;
    
    IF _status = 'won' AND bet_record.status != 'won' THEN
      UPDATE user_bets SET status = 'won' WHERE id = _bet_id;
      UPDATE profiles SET balance = balance + bet_record.potential_win WHERE id = bet_record.user_id;
      INSERT INTO transactions (user_id, amount, type, description)
      VALUES (bet_record.user_id, bet_record.potential_win, 'admin_bet_win', 'Выигрыш ставки (админ)');
      
      xp_reward := LEAST(50, GREATEST(5, FLOOR(bet_record.potential_win / 20)::INTEGER));
      PERFORM add_user_xp(bet_record.user_id, xp_reward);
      PERFORM process_bet_referral_commission(bet_record.user_id, bet_record.potential_win);
      
    ELSIF _status = 'lost' AND bet_record.status != 'lost' THEN
      IF bet_record.status = 'won' THEN
        UPDATE profiles SET balance = balance - bet_record.potential_win WHERE id = bet_record.user_id;
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (bet_record.user_id, -bet_record.potential_win, 'admin_bet_rollback', 'Откат выигрыша ставки (админ)');
      END IF;
      UPDATE user_bets SET status = 'lost' WHERE id = _bet_id;
      
    ELSIF _status = 'pending' THEN
      IF bet_record.status = 'won' THEN
        UPDATE profiles SET balance = balance - bet_record.potential_win WHERE id = bet_record.user_id;
        INSERT INTO transactions (user_id, amount, type, description)
        VALUES (bet_record.user_id, -bet_record.potential_win, 'admin_bet_rollback', 'Откат выигрыша ставки (админ)');
      END IF;
      UPDATE user_bets SET status = 'pending' WHERE id = _bet_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Статус ставки изменен на ' || _status);
END;
$$;


--
-- Name: admin_set_parlay_item_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_parlay_item_status(_item_id uuid, _status text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF _status NOT IN ('won', 'lost', 'pending', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Неверный статус');
  END IF;
  
  UPDATE parlay_bet_items SET status = _status WHERE id = _item_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Статус элемента изменен на ' || _status);
END;
$$;


--
-- Name: admin_set_vip(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_vip(_user_id uuid, _is_vip boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  UPDATE profiles SET is_vip = _is_vip WHERE id = _user_id;
END;
$$;


--
-- Name: admin_set_wheel_preset(uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_wheel_preset(p_admin_id uuid, p_session_token text, p_target_user_id uuid, p_preset_result text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.validate_user_session(p_admin_id, p_session_token) THEN
    RETURN json_build_object('success', false, 'message', 'Не авторизован');
  END IF;

  IF NOT public.has_role(p_admin_id, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  IF p_preset_result NOT IN ('wins_1000', 'loses_100', 'buff_x2', 'buff_x3', 'buff_x5', 'debuff_x05', 'nothing') THEN
    RETURN json_build_object('success', false, 'message', 'Неверный тип результата');
  END IF;

  DELETE FROM public.preset_wheel_results
  WHERE user_id = p_target_user_id AND is_used = false;

  INSERT INTO public.preset_wheel_results (user_id, preset_result, created_by)
  VALUES (p_target_user_id, p_preset_result, p_admin_id);

  RETURN json_build_object('success', true, 'message', 'Результат колеса установлен');
END;
$$;


--
-- Name: admin_toggle_game_status(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_toggle_game_status(_admin_id uuid, _game_id uuid, _status text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Проверяем админа
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  -- Обновляем статус игры
  UPDATE game_settings 
  SET status = _status, updated_at = now()
  WHERE id = _game_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Статус игры обновлён');
END;
$$;


--
-- Name: admin_toggle_promocode(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_toggle_promocode(_admin_id uuid, _promocode_id uuid, _is_active boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  UPDATE promocodes SET is_active = _is_active WHERE id = _promocode_id;
  
  RETURN jsonb_build_object('success', true, 'message', CASE WHEN _is_active THEN 'Промокод активирован' ELSE 'Промокод деактивирован' END);
END;
$$;


--
-- Name: admin_toggle_task(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_toggle_task(_admin_id uuid, _task_id uuid, _is_active boolean) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;

  UPDATE tasks SET is_active = _is_active, updated_at = now() WHERE id = _task_id;

  RETURN json_build_object('success', true, 'message', CASE WHEN _is_active THEN 'Задание активировано' ELSE 'Задание деактивировано' END);
END;
$$;


--
-- Name: admin_update_balance(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_balance(_user_id uuid, _amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  UPDATE profiles SET balance = balance + _amount WHERE id = _user_id;
  
  -- Log the transaction
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (_user_id, _amount, 'admin_adjustment', 'Admin balance adjustment');
END;
$$;


--
-- Name: admin_update_match(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_match(_admin_id uuid, _match_id uuid, _match_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  UPDATE matches SET
    status = COALESCE(_match_data->>'status', status),
    winner = _match_data->>'winner',
    team1_score = COALESCE((_match_data->>'team1_score')::int, team1_score),
    team2_score = COALESCE((_match_data->>'team2_score')::int, team2_score),
    map1_team1_score = (_match_data->>'map1_team1_score')::int,
    map1_team2_score = (_match_data->>'map1_team2_score')::int,
    map2_team1_score = (_match_data->>'map2_team1_score')::int,
    map2_team2_score = (_match_data->>'map2_team2_score')::int,
    map3_team1_score = (_match_data->>'map3_team1_score')::int,
    map3_team2_score = (_match_data->>'map3_team2_score')::int,
    map1_betting_closed = COALESCE((_match_data->>'map1_betting_closed')::boolean, map1_betting_closed),
    map2_betting_closed = COALESCE((_match_data->>'map2_betting_closed')::boolean, map2_betting_closed),
    map3_betting_closed = COALESCE((_match_data->>'map3_betting_closed')::boolean, map3_betting_closed),
    updated_at = now()
  WHERE id = _match_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Матч обновлён');
END;
$$;


--
-- Name: admin_update_withdrawal_status(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_withdrawal_status(_admin_id uuid, _request_id uuid, _new_status text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Проверяем что это админ
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Доступ запрещён');
  END IF;
  
  -- Получаем заявку
  SELECT * INTO v_request FROM public.withdrawal_requests WHERE id = _request_id;
  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Заявка не найдена');
  END IF;
  
  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Заявка уже обработана');
  END IF;
  
  IF _new_status = 'approved' THEN
    -- Проверяем баланс
    IF (SELECT balance FROM profiles WHERE id = v_request.user_id) < v_request.amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств у пользователя');
    END IF;
    
    -- Списываем баланс
    UPDATE profiles SET balance = balance - v_request.amount WHERE id = v_request.user_id;
    
    -- Обновляем статус
    UPDATE public.withdrawal_requests 
    SET status = 'approved', updated_at = now()
    WHERE id = _request_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Заявка одобрена');
  ELSIF _new_status = 'rejected' THEN
    UPDATE public.withdrawal_requests 
    SET status = 'rejected', updated_at = now()
    WHERE id = _request_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Заявка отклонена');
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Неверный статус');
  END IF;
END;
$$;


--
-- Name: apply_referral_code(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_referral_code(_user_id uuid, _referral_code text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  referrer_id UUID;
  referrer_username TEXT;
BEGIN
  -- Check if user already has a referrer
  IF EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND referred_by IS NOT NULL) THEN
    RETURN QUERY SELECT FALSE, 'Вы уже использовали реферальный код'::TEXT;
    RETURN;
  END IF;

  -- Find the referrer by code
  SELECT id, username INTO referrer_id, referrer_username
  FROM profiles
  WHERE referral_code = _referral_code;

  IF referrer_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Реферальный код не найден'::TEXT;
    RETURN;
  END IF;

  -- Can't refer yourself
  IF referrer_id = _user_id THEN
    RETURN QUERY SELECT FALSE, 'Нельзя использовать свой собственный код'::TEXT;
    RETURN;
  END IF;

  -- Set the referrer
  UPDATE profiles SET referred_by = referrer_id WHERE id = _user_id;

  -- Give new user 10 coins bonus
  UPDATE profiles SET balance = balance + 10 WHERE id = _user_id;
  
  -- Add transaction for new user
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (_user_id, 10, 'referral_bonus', 'Бонус за использование реферального кода');

  -- Give referrer 30 XP
  PERFORM add_user_xp(referrer_id, 30);

  -- Create referral reward record
  INSERT INTO referral_rewards (referrer_id, referred_id, reward_amount)
  VALUES (referrer_id, _user_id, 0);

  -- Notify referrer
  PERFORM notify_user_action(referrer_id::text, '🎉 Новый реферал! +30 XP');

  RETURN QUERY SELECT TRUE, ('Код применен! Вы получили 10₽ от ' || referrer_username)::TEXT;
END;
$$;


--
-- Name: approve_withdrawal_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_withdrawal_request(_request_id uuid, _admin_id uuid) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  request_record RECORD;
BEGIN
  -- Get the withdrawal request
  SELECT * INTO request_record
  FROM public.withdrawal_requests
  WHERE id = _request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Заявка не найдена или уже обработана'::TEXT;
    RETURN;
  END IF;

  -- Check if user has enough balance
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = request_record.user_id AND balance >= request_record.amount
  ) THEN
    RETURN QUERY SELECT FALSE, 'Недостаточно средств на балансе пользователя'::TEXT;
    RETURN;
  END IF;

  -- Deduct balance
  PERFORM public.update_balance(request_record.user_id, -request_record.amount);

  -- Add transaction
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (request_record.user_id, -request_record.amount, 'withdrawal', 'Вывод средств одобрен');

  -- Update request status
  UPDATE public.withdrawal_requests
  SET status = 'approved', updated_at = now()
  WHERE id = _request_id;

  RETURN QUERY SELECT TRUE, 'Заявка одобрена, средства списаны'::TEXT;
END;
$$;


--
-- Name: auto_calculate_bets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_calculate_bets(_match_id uuid) RETURNS TABLE(processed integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  bet_record RECORD;
  match_record RECORD;
  bet_won BOOLEAN;
  total_score INTEGER;
  exact_parts TEXT[];
  exact_team1 INTEGER;
  exact_team2 INTEGER;
  processed_count INTEGER := 0;
  xp_reward INTEGER;
  handicap_team1_score NUMERIC;
  handicap_team2_score NUMERIC;
BEGIN
  SELECT * INTO match_record FROM matches WHERE id = _match_id;

  IF match_record.status != 'finished' THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  FOR bet_record IN
    SELECT * FROM user_bets
    WHERE match_id = _match_id AND status = 'pending'
  LOOP
    bet_won := FALSE;

    IF bet_record.bet_type = 'team1_win' THEN
      bet_won := match_record.winner = 'team1';
    ELSIF bet_record.bet_type = 'team2_win' THEN
      bet_won := match_record.winner = 'team2';
    ELSIF bet_record.bet_type = 'draw' THEN
      bet_won := match_record.winner = 'draw';
    ELSIF bet_record.bet_type = 'over' THEN
      total_score := COALESCE(match_record.team1_score, 0) + COALESCE(match_record.team2_score, 0);
      bet_won := total_score > match_record.total_value;
    ELSIF bet_record.bet_type = 'under' THEN
      total_score := COALESCE(match_record.team1_score, 0) + COALESCE(match_record.team2_score, 0);
      bet_won := total_score < match_record.total_value;
    ELSIF bet_record.bet_type = 'both_score_yes' THEN
      bet_won := COALESCE(match_record.team1_score, 0) > 0 AND COALESCE(match_record.team2_score, 0) > 0;
    ELSIF bet_record.bet_type = 'both_score_no' THEN
      bet_won := COALESCE(match_record.team1_score, 0) = 0 OR COALESCE(match_record.team2_score, 0) = 0;
    ELSIF bet_record.bet_type = 'team1_handicap' THEN
      handicap_team1_score := COALESCE(match_record.team1_score, 0) + COALESCE(bet_record.handicap_value, 0);
      bet_won := handicap_team1_score > COALESCE(match_record.team2_score, 0);
    ELSIF bet_record.bet_type = 'team2_handicap' THEN
      handicap_team2_score := COALESCE(match_record.team2_score, 0) + COALESCE(-bet_record.handicap_value, 0);
      bet_won := handicap_team2_score > COALESCE(match_record.team1_score, 0);
    ELSIF bet_record.bet_type LIKE 'exact_%' THEN
      exact_parts := string_to_array(REPLACE(bet_record.bet_type, 'exact_', ''), '-');
      IF array_length(exact_parts, 1) = 2 THEN
        exact_team1 := exact_parts[1]::INTEGER;
        exact_team2 := exact_parts[2]::INTEGER;
        bet_won := (COALESCE(match_record.team1_score, 0) = exact_team1) 
                AND (COALESCE(match_record.team2_score, 0) = exact_team2);
      END IF;
    ELSIF bet_record.bet_type = 'map1_team1' THEN
      bet_won := COALESCE(match_record.map1_team1_score, 0) > COALESCE(match_record.map1_team2_score, 0);
    ELSIF bet_record.bet_type = 'map1_team2' THEN
      bet_won := COALESCE(match_record.map1_team2_score, 0) > COALESCE(match_record.map1_team1_score, 0);
    ELSIF bet_record.bet_type = 'map2_team1' THEN
      bet_won := COALESCE(match_record.map2_team1_score, 0) > COALESCE(match_record.map2_team2_score, 0);
    ELSIF bet_record.bet_type = 'map2_team2' THEN
      bet_won := COALESCE(match_record.map2_team2_score, 0) > COALESCE(match_record.map2_team1_score, 0);
    ELSIF bet_record.bet_type = 'map3_team1' THEN
      bet_won := COALESCE(match_record.map3_team1_score, 0) > COALESCE(match_record.map3_team2_score, 0);
    ELSIF bet_record.bet_type = 'map3_team2' THEN
      bet_won := COALESCE(match_record.map3_team2_score, 0) > COALESCE(match_record.map3_team1_score, 0);
    END IF;

    IF bet_won THEN
      UPDATE user_bets SET status = 'won' WHERE id = bet_record.id;
      UPDATE profiles SET balance = balance + bet_record.potential_win WHERE id = bet_record.user_id;
      INSERT INTO transactions (user_id, amount, type, description)
      VALUES (bet_record.user_id, bet_record.potential_win, 'bet_win', 'Выигрыш ставки');
      
      -- XP reward 1-12 (was 1-30)
      xp_reward := LEAST(12, GREATEST(1, FLOOR(bet_record.potential_win / 20)::INTEGER));
      PERFORM add_user_xp(bet_record.user_id, xp_reward);
      
      PERFORM process_bet_referral_commission(bet_record.user_id, bet_record.potential_win);
    ELSE
      UPDATE user_bets SET status = 'lost' WHERE id = bet_record.id;
    END IF;

    processed_count := processed_count + 1;
  END LOOP;

  RETURN QUERY SELECT processed_count;
END;
$$;


--
-- Name: auto_calculate_parlay_bets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_calculate_parlay_bets(_parlay_bet_id uuid) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  parlay_record RECORD;
  item_record RECORD;
  all_won BOOLEAN := TRUE;
  any_lost BOOLEAN := FALSE;
  match_record RECORD;
  exact_parts TEXT[];
  exact_team1 INTEGER;
  exact_team2 INTEGER;
  item_won BOOLEAN;
  total_score INTEGER;
  xp_reward INTEGER;
BEGIN
  SELECT * INTO parlay_record
  FROM parlay_bets
  WHERE id = _parlay_bet_id AND status IN ('pending', 'partial_refund');

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Экспресс не найден или уже обработан'::TEXT;
    RETURN;
  END IF;

  FOR item_record IN
    SELECT * FROM parlay_bet_items
    WHERE parlay_bet_id = _parlay_bet_id AND bet_type != 'refunded'
  LOOP
    SELECT * INTO match_record FROM matches WHERE id = item_record.match_id;

    IF match_record.status != 'finished' THEN
      RETURN QUERY SELECT FALSE, 'Не все матчи завершены'::TEXT;
      RETURN;
    END IF;

    item_won := FALSE;

    IF item_record.bet_type = 'team1_win' THEN
      item_won := match_record.winner = 'team1';
    ELSIF item_record.bet_type = 'team2_win' THEN
      item_won := match_record.winner = 'team2';
    ELSIF item_record.bet_type = 'draw' THEN
      item_won := match_record.winner = 'draw';
    ELSIF item_record.bet_type = 'over' THEN
      total_score := COALESCE(match_record.team1_score, 0) + COALESCE(match_record.team2_score, 0);
      item_won := total_score > match_record.total_value;
    ELSIF item_record.bet_type = 'under' THEN
      total_score := COALESCE(match_record.team1_score, 0) + COALESCE(match_record.team2_score, 0);
      item_won := total_score < match_record.total_value;
    ELSIF item_record.bet_type = 'both_score_yes' THEN
      item_won := COALESCE(match_record.team1_score, 0) > 0 AND COALESCE(match_record.team2_score, 0) > 0;
    ELSIF item_record.bet_type = 'both_score_no' THEN
      item_won := COALESCE(match_record.team1_score, 0) = 0 OR COALESCE(match_record.team2_score, 0) = 0;
    ELSIF item_record.bet_type LIKE 'exact_%' THEN
      exact_parts := string_to_array(REPLACE(item_record.bet_type, 'exact_', ''), '-');
      IF array_length(exact_parts, 1) = 2 THEN
        exact_team1 := exact_parts[1]::INTEGER;
        exact_team2 := exact_parts[2]::INTEGER;
        item_won := (COALESCE(match_record.team1_score, 0) = exact_team1) 
                AND (COALESCE(match_record.team2_score, 0) = exact_team2);
      END IF;
    ELSIF item_record.bet_type = 'map1_team1' THEN
      item_won := COALESCE(match_record.map1_team1_score, 0) > COALESCE(match_record.map1_team2_score, 0);
    ELSIF item_record.bet_type = 'map1_team2' THEN
      item_won := COALESCE(match_record.map1_team2_score, 0) > COALESCE(match_record.map1_team1_score, 0);
    ELSIF item_record.bet_type = 'map2_team1' THEN
      item_won := COALESCE(match_record.map2_team1_score, 0) > COALESCE(match_record.map2_team2_score, 0);
    ELSIF item_record.bet_type = 'map2_team2' THEN
      item_won := COALESCE(match_record.map2_team2_score, 0) > COALESCE(match_record.map2_team1_score, 0);
    ELSIF item_record.bet_type = 'map3_team1' THEN
      item_won := COALESCE(match_record.map3_team1_score, 0) > COALESCE(match_record.map3_team2_score, 0);
    ELSIF item_record.bet_type = 'map3_team2' THEN
      item_won := COALESCE(match_record.map3_team2_score, 0) > COALESCE(match_record.map3_team1_score, 0);
    END IF;

    IF NOT item_won THEN
      any_lost := TRUE;
      all_won := FALSE;
      EXIT;
    END IF;
  END LOOP;

  IF any_lost THEN
    UPDATE parlay_bets SET status = 'lost' WHERE id = _parlay_bet_id;
    RETURN QUERY SELECT TRUE, 'Экспресс проигран'::TEXT;
  ELSIF all_won THEN
    UPDATE parlay_bets SET status = 'won' WHERE id = _parlay_bet_id;
    
    UPDATE profiles SET balance = balance + parlay_record.potential_win WHERE id = parlay_record.user_id;
    
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (parlay_record.user_id, parlay_record.potential_win, 'parlay_win', 'Выигрыш экспресса');
    
    -- XP reward 1-12 (was 5-50)
    xp_reward := LEAST(12, GREATEST(1, FLOOR(parlay_record.potential_win / 20)::INTEGER));
    PERFORM add_user_xp(parlay_record.user_id, xp_reward);
    
    PERFORM process_bet_referral_commission(parlay_record.user_id, parlay_record.potential_win);
    
    RETURN QUERY SELECT TRUE, 'Экспресс выигран!'::TEXT;
  END IF;
END;
$$;


--
-- Name: auto_create_crash_round(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_create_crash_round() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  active_round_exists BOOLEAN;
BEGIN
  -- Проверяем наличие активного или ожидающего раунда
  SELECT EXISTS(
    SELECT 1 FROM crash_rounds 
    WHERE status IN ('pending', 'active')
  ) INTO active_round_exists;
  
  -- Если нет активного раунда, создаем новый
  IF NOT active_round_exists THEN
    INSERT INTO crash_rounds (multiplier, status)
    VALUES (1.50 + (random() * 3.5), 'pending');
  END IF;
END;
$$;


--
-- Name: auto_finish_giveaway(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_finish_giveaway(_giveaway_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _giveaway RECORD;
  _winner_id uuid;
BEGIN
  SELECT * INTO _giveaway FROM giveaways WHERE id = _giveaway_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Розыгрыш не найден или уже завершён');
  END IF;
  
  IF _giveaway.giveaway_mode = 'random' THEN
    SELECT gp.user_id INTO _winner_id
    FROM giveaway_participants gp
    WHERE gp.giveaway_id = _giveaway_id
    ORDER BY random()
    LIMIT 1;
  ELSIF _giveaway.giveaway_mode = 'achievement' THEN
    SELECT lb.user_id INTO _winner_id
    FROM get_giveaway_leaderboard(_giveaway_id) lb
    LIMIT 1;
  END IF;
  
  IF _winner_id IS NULL THEN
    UPDATE giveaways SET status = 'finished', finished_at = now() WHERE id = _giveaway_id;
    RETURN json_build_object('success', true, 'message', 'Розыгрыш завершён без победителя');
  END IF;
  
  -- Выдаём приз
  CASE _giveaway.prize_type
    WHEN 'balance' THEN
      UPDATE profiles SET balance = balance + _giveaway.prize_amount WHERE id = _winner_id;
    WHEN 'freebet' THEN
      UPDATE profiles SET 
        freebet_balance = COALESCE(freebet_balance, 0) + _giveaway.prize_amount,
        wager_requirement = COALESCE(wager_requirement, 0) + (_giveaway.prize_amount * 60)
      WHERE id = _winner_id;
    WHEN 'betting_freebet' THEN
      UPDATE profiles SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + _giveaway.prize_amount WHERE id = _winner_id;
    WHEN 'wheel' THEN
      INSERT INTO bonus_wheels (user_id) 
      SELECT _winner_id FROM generate_series(1, _giveaway.prize_amount::int);
    WHEN 'skin' THEN
      INSERT INTO user_inventory (user_id, skin_id, purchased_price, is_demo) VALUES (_winner_id, _giveaway.prize_skin_id, 0, false);
    WHEN 'demo' THEN
      UPDATE profiles SET demo_balance = COALESCE(demo_balance, 0) + _giveaway.prize_amount WHERE id = _winner_id;
  END CASE;
  
  -- ИСПРАВЛЕНИЕ: Обновляем total_wins у победителя
  UPDATE profiles SET total_wins = COALESCE(total_wins, 0) + 1 WHERE id = _winner_id;
  
  -- Обновляем розыгрыш
  UPDATE giveaways SET status = 'finished', winner_id = _winner_id, finished_at = now() WHERE id = _giveaway_id;
  
  -- Уведомляем победителя
  PERFORM notify_user_action(_winner_id::text, '🎉 Вы выиграли в розыгрыше: ' || _giveaway.title);
  
  RETURN json_build_object('success', true, 'message', 'Победитель определён!', 'winner_id', _winner_id);
END;
$$;


--
-- Name: auto_generate_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_referral_code() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: blackjack_double(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.blackjack_double(_session_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session RECORD;
  _state JSONB;
  _user RECORD;
  _additional_bet NUMERIC;
BEGIN
  SELECT * INTO _session FROM game_sessions WHERE id = _session_id AND status = 'active';
  
  IF _session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;

  -- Проверяем баланс для удвоения
  SELECT * INTO _user FROM profiles WHERE id = _session.user_id;
  _additional_bet := _session.bet_amount;

  IF _session.is_demo THEN
    IF _user.demo_balance < _additional_bet THEN
      RETURN json_build_object('success', false, 'error', 'Недостаточно средств для удвоения');
    END IF;
    UPDATE profiles SET demo_balance = demo_balance - _additional_bet WHERE id = _session.user_id;
  ELSIF _session.is_freebet THEN
    IF COALESCE(_user.freebet_balance, 0) < _additional_bet THEN
      RETURN json_build_object('success', false, 'error', 'Недостаточно фрибетов');
    END IF;
    UPDATE profiles SET freebet_balance = freebet_balance - _additional_bet WHERE id = _session.user_id;
  ELSE
    IF _user.balance < _additional_bet THEN
      RETURN json_build_object('success', false, 'error', 'Недостаточно средств');
    END IF;
    UPDATE profiles SET balance = balance - _additional_bet WHERE id = _session.user_id;
  END IF;

  -- Обновляем ставку
  UPDATE game_sessions
  SET bet_amount = bet_amount * 2
  WHERE id = _session_id;

  -- Берем одну карту и автоматически stand
  DECLARE
    _hit_result JSON;
    _stand_result JSON;
  BEGIN
    _hit_result := blackjack_hit(_session_id);
    
    IF (_hit_result->>'bust')::BOOLEAN THEN
      RETURN _hit_result;
    END IF;

    _stand_result := blackjack_stand(_session_id);
    RETURN json_build_object(
      'success', true,
      'doubled', true,
      'hit_result', _hit_result,
      'final_result', _stand_result
    );
  END;
END;
$$;


--
-- Name: blackjack_hit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.blackjack_hit(_session_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session RECORD;
  _state JSONB;
  _deck INT[];
  _player_cards INT[];
  _new_card INT;
  _player_value INT;
BEGIN
  SELECT * INTO _session FROM game_sessions WHERE id = _session_id AND status = 'active';
  
  IF _session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;

  IF NOT check_rate_limit(_session.user_id, 'game_action') THEN
    RETURN json_build_object('success', false, 'error', 'Слишком быстро');
  END IF;

  _state := _session.game_state;
  _deck := ARRAY(SELECT jsonb_array_elements_text(_state->'deck')::INT);
  _player_cards := ARRAY(SELECT jsonb_array_elements_text(_state->'player_cards')::INT);

  -- Берем карту
  _new_card := _deck[1];
  _deck := _deck[2:];
  _player_cards := _player_cards || _new_card;

  _player_value := calculate_blackjack_value(_player_cards);

  -- Обновляем состояние
  UPDATE game_sessions
  SET game_state = jsonb_set(
    jsonb_set(_state, '{deck}', to_jsonb(_deck)),
    '{player_cards}', to_jsonb(_player_cards)
  )
  WHERE id = _session_id;

  -- Проверяем перебор
  IF _player_value > 21 THEN
    PERFORM complete_game_session(_session_id,
      json_build_object('result', 'bust', 'player_value', _player_value),
      0, 0
    );

    RETURN json_build_object(
      'success', true,
      'new_card', _new_card,
      'player_cards', _player_cards,
      'player_value', _player_value,
      'bust', true,
      'game_over', true,
      'win_amount', 0
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'new_card', _new_card,
    'player_cards', _player_cards,
    'player_value', _player_value,
    'bust', false,
    'game_over', false
  );
END;
$$;


--
-- Name: blackjack_stand(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.blackjack_stand(_session_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session RECORD;
  _state JSONB;
  _deck INT[];
  _player_cards INT[];
  _dealer_cards INT[];
  _player_value INT;
  _dealer_value INT;
  _win_amount NUMERIC := 0;
  _multiplier NUMERIC := 0;
  _result TEXT;
BEGIN
  SELECT * INTO _session FROM game_sessions WHERE id = _session_id AND status = 'active';
  
  IF _session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;

  IF NOT check_rate_limit(_session.user_id, 'cashout') THEN
    RETURN json_build_object('success', false, 'error', 'Подождите');
  END IF;

  _state := _session.game_state;
  _deck := ARRAY(SELECT jsonb_array_elements_text(_state->'deck')::INT);
  _player_cards := ARRAY(SELECT jsonb_array_elements_text(_state->'player_cards')::INT);
  _dealer_cards := ARRAY(SELECT jsonb_array_elements_text(_state->'dealer_cards')::INT);

  _player_value := calculate_blackjack_value(_player_cards);

  -- Дилер добирает до 17
  _dealer_value := calculate_blackjack_value(_dealer_cards);
  WHILE _dealer_value < 17 LOOP
    _dealer_cards := _dealer_cards || _deck[1];
    _deck := _deck[2:];
    _dealer_value := calculate_blackjack_value(_dealer_cards);
  END LOOP;

  -- Определяем победителя
  IF _dealer_value > 21 THEN
    _result := 'dealer_bust';
    _multiplier := 2.0;
    _win_amount := _session.bet_amount * 2;
  ELSIF _player_value > _dealer_value THEN
    _result := 'win';
    _multiplier := 2.0;
    _win_amount := _session.bet_amount * 2;
  ELSIF _player_value = _dealer_value THEN
    _result := 'push';
    _multiplier := 1.0;
    _win_amount := _session.bet_amount; -- Возврат ставки
  ELSE
    _result := 'lose';
    _multiplier := 0;
    _win_amount := 0;
  END IF;

  PERFORM complete_game_session(_session_id,
    json_build_object(
      'result', _result,
      'player_value', _player_value,
      'dealer_value', _dealer_value,
      'dealer_cards', _dealer_cards
    ),
    _win_amount, _multiplier
  );

  RETURN json_build_object(
    'success', true,
    'result', _result,
    'player_cards', _player_cards,
    'dealer_cards', _dealer_cards,
    'player_value', _player_value,
    'dealer_value', _dealer_value,
    'win_amount', _win_amount,
    'multiplier', _multiplier,
    'game_over', true
  );
END;
$$;


--
-- Name: buy_bonus(uuid, numeric, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buy_bonus(_user_id uuid, _price numeric, _bonus_type text, _bonus_value numeric) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT balance INTO current_balance FROM profiles WHERE id = _user_id;
  
  IF current_balance < _price THEN
    RETURN QUERY SELECT FALSE, 'Недостаточно средств'::TEXT;
    RETURN;
  END IF;
  
  -- Списываем стоимость
  UPDATE profiles SET balance = balance - _price WHERE id = _user_id;
  
  -- Добавляем бонус
  IF _bonus_type = 'freespins' THEN
    INSERT INTO user_freespins (user_id, freespins_count, freespin_bet_amount)
    VALUES (_user_id, _bonus_value::INTEGER, 16)
    ON CONFLICT (user_id) DO UPDATE 
    SET freespins_count = user_freespins.freespins_count + _bonus_value::INTEGER;
  END IF;
  
  -- Транзакция
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (_user_id, -_price, 'bonus_purchase', 'Покупка бонуса: ' || _bonus_type);
  
  RETURN QUERY SELECT TRUE, 'Бонус куплен!'::TEXT;
END;
$$;


--
-- Name: buy_skin(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buy_skin(_user_id uuid, _skin_id uuid, _use_freebet boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_skin_price numeric;
  v_balance numeric;
  v_freebet_balance numeric;
BEGIN
  -- Получаем цену скина
  SELECT price INTO v_skin_price FROM skins WHERE id = _skin_id;
  IF v_skin_price IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Скин не найден');
  END IF;

  -- Получаем баланс пользователя
  SELECT balance, freebet_balance INTO v_balance, v_freebet_balance
  FROM profiles WHERE id = _user_id;

  IF _use_freebet THEN
    IF v_freebet_balance < v_skin_price THEN
      RETURN json_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
    END IF;
    UPDATE profiles SET freebet_balance = freebet_balance - v_skin_price WHERE id = _user_id;
  ELSE
    IF v_balance < v_skin_price THEN
      RETURN json_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;
    UPDATE profiles SET balance = balance - v_skin_price WHERE id = _user_id;
  END IF;

  -- Добавляем скин в инвентарь
  INSERT INTO user_inventory (user_id, skin_id, purchased_price)
  VALUES (_user_id, _skin_id, v_skin_price);

  RETURN json_build_object('success', true, 'message', 'Скин куплен!');
END;
$$;


--
-- Name: buy_skin(uuid, uuid, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.buy_skin(_user_id uuid, _skin_id uuid, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_skin_price numeric;
  v_balance numeric;
  v_freebet_balance numeric;
  v_demo_balance numeric;
BEGIN
  SELECT price INTO v_skin_price FROM skins WHERE id = _skin_id;
  IF v_skin_price IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Скин не найден');
  END IF;

  SELECT balance, freebet_balance, demo_balance
  INTO v_balance, v_freebet_balance, v_demo_balance
  FROM profiles
  WHERE id = _user_id;

  IF _use_demo THEN
    IF COALESCE(v_demo_balance, 0) < v_skin_price THEN
      RETURN json_build_object('success', false, 'message', 'Недостаточно демо баланса');
    END IF;

    UPDATE profiles
    SET demo_balance = COALESCE(demo_balance, 0) - v_skin_price
    WHERE id = _user_id;

    INSERT INTO user_inventory (user_id, skin_id, purchased_price, is_demo)
    VALUES (_user_id, _skin_id, v_skin_price, true);

  ELSIF _use_freebet THEN
    IF COALESCE(v_freebet_balance, 0) < v_skin_price THEN
      RETURN json_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
    END IF;

    UPDATE profiles
    SET freebet_balance = COALESCE(freebet_balance, 0) - v_skin_price
    WHERE id = _user_id;

    INSERT INTO user_inventory (user_id, skin_id, purchased_price, is_demo)
    VALUES (_user_id, _skin_id, v_skin_price, false);

  ELSE
    IF COALESCE(v_balance, 0) < v_skin_price THEN
      RETURN json_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;

    UPDATE profiles
    SET balance = COALESCE(balance, 0) - v_skin_price
    WHERE id = _user_id;

    INSERT INTO user_inventory (user_id, skin_id, purchased_price, is_demo)
    VALUES (_user_id, _skin_id, v_skin_price, false);
  END IF;

  RETURN json_build_object('success', true, 'message', 'Скин куплен!', 'is_demo', _use_demo);
END;
$$;


--
-- Name: calculate_all_parlay_bets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_all_parlay_bets() RETURNS TABLE(processed integer, won integer, lost integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  parlay_record RECORD;
  result_record RECORD;
  total_processed INTEGER := 0;
  total_won INTEGER := 0;
  total_lost INTEGER := 0;
BEGIN
  -- Обрабатываем все незавершенные экспрессы
  FOR parlay_record IN
    SELECT id FROM public.parlay_bets WHERE status = 'pending'
  LOOP
    SELECT * INTO result_record FROM public.auto_calculate_parlay_bets(parlay_record.id);
    
    IF result_record.success THEN
      total_processed := total_processed + 1;
      
      IF result_record.message = 'Экспресс выигран!'::TEXT THEN
        total_won := total_won + 1;
      ELSIF result_record.message = 'Экспресс проигран'::TEXT THEN
        total_lost := total_lost + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT total_processed, total_won, total_lost;
END;
$$;


--
-- Name: calculate_blackjack_value(integer[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_blackjack_value(_cards integer[]) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  _value INT := 0;
  _aces INT := 0;
  _card_rank INT;
  _card INT;
BEGIN
  FOREACH _card IN ARRAY _cards LOOP
    _card_rank := ((_card - 1) % 13) + 1;
    
    IF _card_rank = 1 THEN
      _aces := _aces + 1;
      _value := _value + 11;
    ELSIF _card_rank >= 10 THEN
      _value := _value + 10;
    ELSE
      _value := _value + _card_rank;
    END IF;
  END LOOP;

  -- Уменьшаем тузы если перебор
  WHILE _value > 21 AND _aces > 0 LOOP
    _value := _value - 10;
    _aces := _aces - 1;
  END LOOP;

  RETURN _value;
END;
$$;


--
-- Name: calculate_level(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_level(_xp integer) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Increased from 50 to 100, so leveling is harder
  RETURN GREATEST(1, FLOOR(SQRT(_xp / 100) + 1)::INTEGER);
END;
$$;


--
-- Name: can_send_chat_message(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_send_chat_message(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_profile RECORD;
  v_moderation RECORD;
BEGIN
  SELECT email_verified_at, is_muted INTO v_profile FROM profiles WHERE id = _user_id;
  
  IF v_profile.email_verified_at IS NULL THEN
    RETURN jsonb_build_object('can_send', false, 'reason', 'Подтвердите email для отправки сообщений');
  END IF;
  
  SELECT muted_until INTO v_moderation FROM user_moderation WHERE user_id = _user_id;
  IF v_moderation.muted_until IS NOT NULL AND v_moderation.muted_until > NOW() THEN
    RETURN jsonb_build_object('can_send', false, 'reason', 'Вы в муте');
  END IF;
  
  RETURN jsonb_build_object('can_send', true);
END;
$$;


--
-- Name: cashout_balloon(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cashout_balloon(_session_id uuid, _user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_multiplier NUMERIC;
  v_win_amount NUMERIC;
BEGIN
  IF NOT check_rate_limit(_user_id, 'cashout', 1000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Подождите');
  END IF;
  
  SELECT * INTO v_session FROM game_sessions
  WHERE id = _session_id AND user_id = _user_id AND status = 'active' FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  v_multiplier := COALESCE((v_session.game_state->>'current_multiplier')::NUMERIC, 1.00);
  
  IF v_multiplier <= 1.00 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Накачайте шарик хотя бы раз');
  END IF;
  
  v_win_amount := ROUND(v_session.bet_amount * v_multiplier, 2);
  
  RETURN complete_game_session(_session_id, _user_id, v_win_amount, v_multiplier,
    jsonb_build_object('cashed_out', true, 'pop_point', v_session.game_state->>'pop_point'));
END;
$$;


--
-- Name: cashout_chicken_road(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cashout_chicken_road(_session_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session RECORD;
  _state JSONB;
  _current_row INT;
  _multipliers JSONB;
  _multiplier NUMERIC;
  _win_amount NUMERIC;
BEGIN
  SELECT * INTO _session FROM game_sessions WHERE id = _session_id AND status = 'active';
  
  IF _session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;

  IF NOT check_rate_limit(_session.user_id, 'cashout') THEN
    RETURN json_build_object('success', false, 'error', 'Подождите');
  END IF;

  _state := _session.game_state;
  _current_row := (_state->>'current_row')::INT;
  _multipliers := _state->'multipliers';

  IF _current_row = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Сначала сделайте хотя бы один шаг');
  END IF;

  _multiplier := (_multipliers->>(_current_row - 1)::TEXT)::NUMERIC;
  _win_amount := _session.bet_amount * _multiplier;

  PERFORM complete_game_session(_session_id,
    json_build_object('cashout', true, 'rows_cleared', _current_row),
    _win_amount,
    _multiplier
  );

  RETURN json_build_object(
    'success', true,
    'win_amount', _win_amount,
    'multiplier', _multiplier
  );
END;
$$;


--
-- Name: cashout_crash_bet(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cashout_crash_bet(_user_id uuid, _round_id uuid, _current_multiplier numeric) RETURNS TABLE(success boolean, message text, win_amount numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  bet_record RECORD;
  calculated_win NUMERIC;
BEGIN
  -- Получаем ставку
  SELECT * INTO bet_record
  FROM public.crash_bets
  WHERE user_id = _user_id 
    AND round_id = _round_id 
    AND status = 'active'
    AND cashed_out_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Ставка не найдена'::TEXT, 0::NUMERIC;
    RETURN;
  END IF;

  -- Вычисляем выигрыш
  calculated_win := bet_record.bet_amount * _current_multiplier;

  -- Обновляем ставку
  UPDATE public.crash_bets
  SET 
    cashed_out_at = _current_multiplier,
    win_amount = calculated_win,
    status = 'won'
  WHERE id = bet_record.id;

  -- Начисляем выигрыш
  PERFORM public.update_balance(_user_id, calculated_win);

  -- Добавляем транзакцию
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (_user_id, calculated_win, 'crash_win', 'Выигрыш в Crash x' || _current_multiplier::TEXT);

  -- Записываем в историю игр
  INSERT INTO public.game_history (user_id, game_name, bet_amount, multiplier, win_amount)
  VALUES (_user_id, 'crash', bet_record.bet_amount, _current_multiplier, calculated_win);

  RETURN QUERY SELECT TRUE, 'Выигрыш получен!'::TEXT, calculated_win;
END;
$$;


--
-- Name: cashout_hilo(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cashout_hilo(_session_id uuid, _user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_multiplier NUMERIC;
  v_streak INTEGER;
  v_win_amount NUMERIC;
BEGIN
  IF NOT check_rate_limit(_user_id, 'cashout', 1000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Подождите');
  END IF;
  
  SELECT * INTO v_session FROM game_sessions
  WHERE id = _session_id AND user_id = _user_id AND status = 'active' FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  v_streak := COALESCE((v_session.game_state->>'streak')::int, 0);
  v_multiplier := COALESCE((v_session.game_state->>'multiplier')::numeric, 1.00);
  
  IF v_streak = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Угадайте хотя бы одну карту');
  END IF;
  
  v_win_amount := ROUND(v_session.bet_amount * v_multiplier, 2);
  
  RETURN complete_game_session(_session_id, _user_id, v_win_amount, v_multiplier,
    jsonb_build_object('history', v_session.game_state->'history', 'streak', v_streak));
END;
$$;


--
-- Name: cashout_mines(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cashout_mines(_session_id uuid, _user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_mines INTEGER[];
  v_revealed INTEGER[];
  v_mines_count INTEGER;
  v_safe_cells INTEGER;
  v_multiplier NUMERIC;
  v_win_amount NUMERIC;
  v_base_mult NUMERIC;
BEGIN
  SELECT * INTO v_session FROM game_sessions
  WHERE id = _session_id AND user_id = _user_id AND status = 'active' FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_session.game_state->'mines')::int) INTO v_mines;
  SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_session.game_state->'revealed', '[]'::jsonb))::int) INTO v_revealed;
  
  v_mines_count := array_length(v_mines, 1);
  v_safe_cells := COALESCE(array_length(v_revealed, 1), 0);
  
  IF v_safe_cells = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Откройте хотя бы одну клетку');
  END IF;
  
  -- Get base multiplier per reveal based on mines count
  v_base_mult := CASE v_mines_count
    WHEN 2 THEN 1.07 WHEN 3 THEN 1.12 WHEN 4 THEN 1.17 WHEN 5 THEN 1.23
    WHEN 6 THEN 1.30 WHEN 7 THEN 1.37 WHEN 8 THEN 1.45 WHEN 9 THEN 1.54
    WHEN 10 THEN 1.64 WHEN 11 THEN 1.76 WHEN 12 THEN 1.90 WHEN 13 THEN 2.05
    WHEN 14 THEN 2.24 WHEN 15 THEN 2.46 WHEN 16 THEN 2.74 WHEN 17 THEN 3.08
    WHEN 18 THEN 3.52 WHEN 19 THEN 4.11 WHEN 20 THEN 4.93 WHEN 21 THEN 6.16
    WHEN 22 THEN 8.21 WHEN 23 THEN 12.31 WHEN 24 THEN 24.63
    ELSE 1.07
  END;
  
  v_multiplier := ROUND(POWER(v_base_mult, v_safe_cells), 2);
  v_win_amount := ROUND(v_session.bet_amount * v_multiplier, 2);
  
  RETURN complete_game_session(_session_id, _user_id, v_win_amount, v_multiplier,
    jsonb_build_object('mines', v_mines, 'revealed', v_revealed));
END;
$$;


--
-- Name: cashout_mines(uuid, numeric, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cashout_mines(_user_id uuid, _bet_amount numeric, _multiplier numeric, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_win_amount numeric;
BEGIN
  v_win_amount := _bet_amount * _multiplier;

  IF _use_demo THEN
    UPDATE profiles SET demo_balance = demo_balance + v_win_amount WHERE id = _user_id;
  ELSIF _use_freebet THEN
    UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
  ELSE
    UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
  END IF;

  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
  VALUES (_user_id, 'mines', _bet_amount, v_win_amount, _multiplier);

  PERFORM add_user_xp(_user_id, GREATEST(1, FLOOR(_bet_amount / 10))::integer);

  RETURN jsonb_build_object('success', true, 'win_amount', v_win_amount);
END;
$$;


--
-- Name: cashout_towers(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cashout_towers(_session_id uuid, _user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_current_row INTEGER;
  v_multiplier NUMERIC;
  v_win_amount NUMERIC;
  v_multipliers NUMERIC[] := ARRAY[1.08, 1.18, 1.35, 1.62, 1.98, 2.60, 3.50, 4.80, 6.80, 10.20, 16.00];
BEGIN
  SELECT * INTO v_session FROM game_sessions
  WHERE id = _session_id AND user_id = _user_id AND status = 'active' FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  v_current_row := COALESCE((v_session.game_state->>'current_row')::int, 0);
  
  IF v_current_row = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сделайте хотя бы один ход');
  END IF;
  
  -- Get multiplier for current row
  IF v_current_row <= array_length(v_multipliers, 1) THEN
    v_multiplier := v_multipliers[v_current_row];
  ELSE
    v_multiplier := v_multipliers[array_length(v_multipliers, 1)];
  END IF;
  
  v_win_amount := ROUND(v_session.bet_amount * v_multiplier, 2);
  
  -- Credit winnings
  IF v_session.is_demo THEN
    UPDATE profiles SET demo_balance = demo_balance + v_win_amount WHERE id = _user_id;
  ELSE
    UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
  END IF;
  
  -- Complete session
  UPDATE game_sessions SET 
    status = 'completed',
    win_amount = v_win_amount,
    result = jsonb_build_object('cashout_row', v_current_row, 'multiplier', v_multiplier),
    completed_at = now()
  WHERE id = _session_id;
  
  -- Record history
  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_session_id, server_seed_hash, game_number)
  VALUES (_user_id, 'towers', v_session.bet_amount, v_win_amount, v_multiplier, _session_id, 
    encode(digest(v_session.server_seed, 'sha256'), 'hex'),
    v_session.game_number);
  
  -- Update stats
  PERFORM add_user_xp(_user_id, v_session.bet_amount);
  PERFORM update_game_stats(_user_id, true);
  
  -- Remove lock
  DELETE FROM active_game_locks WHERE user_id = _user_id AND game_name = 'towers';
  
  RETURN jsonb_build_object(
    'success', true,
    'win_amount', v_win_amount,
    'multiplier', v_multiplier
  );
END;
$$;


--
-- Name: check_black_crow_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_black_crow_access(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM black_crow_access WHERE user_id = _user_id
    );
$$;


--
-- Name: check_email_for_bonus(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_email_for_bonus(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT is_email_verified(_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Подтвердите email в профиле для получения бонусов', 'need_verification', true);
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;


--
-- Name: check_rate_limit(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(_user_id uuid, _action_type text, _min_interval_ms integer DEFAULT 500) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  last_action TIMESTAMPTZ;
  ms_since_last NUMERIC;
BEGIN
  SELECT last_action_at INTO last_action
  FROM user_rate_limits
  WHERE user_id = _user_id AND action_type = _action_type;
  
  IF last_action IS NOT NULL THEN
    ms_since_last := EXTRACT(EPOCH FROM (now() - last_action)) * 1000;
    IF ms_since_last < _min_interval_ms THEN
      RETURN false;
    END IF;
  END IF;
  
  INSERT INTO user_rate_limits (user_id, action_type, last_action_at, action_count)
  VALUES (_user_id, _action_type, now(), 1)
  ON CONFLICT (user_id, action_type) 
  DO UPDATE SET last_action_at = now(), action_count = user_rate_limits.action_count + 1;
  
  RETURN true;
END;
$$;


--
-- Name: chicken_road_step(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chicken_road_step(_session_id uuid, _column integer) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session RECORD;
  _state JSONB;
  _current_row INT;
  _traps INT[];
  _trap_column INT;
  _multipliers JSONB;
  _multiplier NUMERIC;
  _is_trap BOOLEAN;
  _result JSON;
BEGIN
  -- Получаем сессию
  SELECT * INTO _session FROM game_sessions WHERE id = _session_id AND status = 'active';
  
  IF _session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;

  -- Rate limit
  IF NOT check_rate_limit(_session.user_id, 'game_action') THEN
    RETURN json_build_object('success', false, 'error', 'Слишком быстро');
  END IF;

  _state := _session.game_state;
  _current_row := (_state->>'current_row')::INT;
  _traps := ARRAY(SELECT jsonb_array_elements_text(_state->'traps')::INT);
  _multipliers := _state->'multipliers';
  _trap_column := _traps[_current_row + 1];

  -- Проверяем попадание в ловушку
  _is_trap := (_column = _trap_column);

  IF _is_trap THEN
    -- Проигрыш
    _result := complete_game_session(_session_id, 
      json_build_object('hit_trap', true, 'row', _current_row, 'column', _column),
      0, 0
    );
    
    RETURN json_build_object(
      'success', true,
      'hit_trap', true,
      'trap_column', _trap_column,
      'game_over', true,
      'win_amount', 0
    );
  END IF;

  -- Успешный шаг
  _current_row := _current_row + 1;
  _multiplier := (_multipliers->>(_current_row - 1)::TEXT)::NUMERIC;

  -- Обновляем состояние
  UPDATE game_sessions
  SET game_state = jsonb_set(_state, '{current_row}', to_jsonb(_current_row))
  WHERE id = _session_id;

  -- Проверяем завершение игры (все 10 рядов пройдены)
  IF _current_row >= 10 THEN
    _result := complete_game_session(_session_id,
      json_build_object('completed', true, 'rows_cleared', _current_row),
      _session.bet_amount * _multiplier,
      _multiplier
    );

    RETURN json_build_object(
      'success', true,
      'hit_trap', false,
      'current_row', _current_row,
      'multiplier', _multiplier,
      'game_over', true,
      'win_amount', _session.bet_amount * _multiplier
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'hit_trap', false,
    'current_row', _current_row,
    'multiplier', _multiplier,
    'game_over', false
  );
END;
$$;


--
-- Name: claim_achievement_reward(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_achievement_reward(p_achievement_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_user_achievement RECORD;
  v_achievement RECORD;
  v_profile RECORD;
BEGIN
  -- Получаем user_id из профиля по telegram_id
  SELECT id INTO v_user_id FROM profiles 
  WHERE telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
  END IF;
  
  -- Проверяем email верификацию
  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF v_profile.email_verified_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Требуется верификация email');
  END IF;
  
  -- Получаем прогресс ачивки
  SELECT * INTO v_user_achievement 
  FROM user_achievements 
  WHERE user_id = v_user_id AND achievement_id = p_achievement_id;
  
  IF v_user_achievement IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ачивка не найдена');
  END IF;
  
  IF NOT v_user_achievement.is_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ачивка не выполнена');
  END IF;
  
  IF v_user_achievement.is_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Награда уже получена');
  END IF;
  
  -- Получаем ачивку
  SELECT * INTO v_achievement FROM achievements WHERE id = p_achievement_id;
  
  -- Выдаём награду
  CASE v_achievement.reward_type
    WHEN 'balance' THEN
      UPDATE profiles SET balance = balance + v_achievement.reward_amount WHERE id = v_user_id;
    WHEN 'freebet' THEN
      UPDATE profiles SET freebet_balance = COALESCE(freebet_balance, 0) + v_achievement.reward_amount WHERE id = v_user_id;
    WHEN 'xp' THEN
      UPDATE profiles SET xp = xp + v_achievement.reward_amount::integer WHERE id = v_user_id;
    WHEN 'wheel' THEN
      INSERT INTO bonus_wheels (user_id, is_used) VALUES (v_user_id, false);
    WHEN 'skin' THEN
      IF v_achievement.reward_skin_id IS NOT NULL THEN
        INSERT INTO user_inventory (user_id, skin_id, purchased_price)
        SELECT v_user_id, v_achievement.reward_skin_id, s.price
        FROM skins s WHERE s.id = v_achievement.reward_skin_id;
      END IF;
  END CASE;
  
  -- Помечаем как полученную
  UPDATE user_achievements 
  SET is_claimed = true, claimed_at = now()
  WHERE user_id = v_user_id AND achievement_id = p_achievement_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'reward_type', v_achievement.reward_type,
    'reward_amount', v_achievement.reward_amount,
    'achievement_name', v_achievement.name
  );
END;
$$;


--
-- Name: claim_freespins(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_freespins(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_profile RECORD;
  v_freespins RECORD;
BEGIN
  SELECT email_verified_at INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile.email_verified_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Подтвердите email для получения фриспинов');
  END IF;

  SELECT * INTO v_freespins FROM user_freespins WHERE user_id = _user_id;
  
  IF v_freespins IS NULL THEN
    INSERT INTO user_freespins (user_id, freespins_count, updated_at)
    VALUES (_user_id, 10, NOW());
    RETURN jsonb_build_object('success', true, 'spins', 10);
  END IF;
  
  IF v_freespins.updated_at + INTERVAL '24 hours' > NOW() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Фриспины ещё не доступны');
  END IF;
  
  UPDATE user_freespins 
  SET freespins_count = freespins_count + 10, updated_at = NOW()
  WHERE user_id = _user_id;
  
  RETURN jsonb_build_object('success', true, 'spins', 10);
END;
$$;


--
-- Name: cleanup_expired_codes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_codes() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.verification_codes
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$;


--
-- Name: cleanup_expired_game_locks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_game_locks() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _count INT;
BEGIN
  DELETE FROM active_game_locks
  WHERE locked_at < now() - interval '5 minutes';
  
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;


--
-- Name: cleanup_old_crash_rounds(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_crash_rounds() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.crash_rounds
  WHERE id NOT IN (
    SELECT id FROM public.crash_rounds
    ORDER BY created_at DESC
    LIMIT 10
  );
END;
$$;


--
-- Name: cleanup_old_roulette_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_roulette_history() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM roulette_history 
  WHERE id NOT IN (
    SELECT id FROM roulette_history 
    ORDER BY created_at DESC 
    LIMIT 100
  );
END;
$$;


--
-- Name: complete_game_session(uuid, json, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_game_session(_session_id uuid, _result json, _win_amount numeric, _multiplier numeric DEFAULT 1.0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session RECORD;
  _xp_gain INT;
BEGIN
  -- Получаем сессию
  SELECT * INTO _session FROM game_sessions WHERE id = _session_id AND status = 'active';
  
  IF _session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Сессия не найдена или уже завершена');
  END IF;

  -- Проверяем rate limit на cashout
  IF NOT check_rate_limit(_session.user_id, 'cashout') THEN
    RETURN json_build_object('success', false, 'error', 'Слишком быстро! Подождите');
  END IF;

  -- Начисляем выигрыш
  IF _win_amount > 0 THEN
    IF _session.is_demo THEN
      UPDATE profiles SET demo_balance = demo_balance + _win_amount WHERE id = _session.user_id;
    ELSIF _session.is_freebet THEN
      -- Фрибет выигрыш идет на основной баланс с вейджером
      UPDATE profiles SET 
        balance = balance + _win_amount,
        wager_requirement = COALESCE(wager_requirement, 0) + _win_amount,
        wager_progress = COALESCE(wager_progress, 0)
      WHERE id = _session.user_id;
    ELSE
      UPDATE profiles SET balance = balance + _win_amount WHERE id = _session.user_id;
    END IF;
  END IF;

  -- Обновляем статистику (только для реальных игр)
  IF NOT _session.is_demo THEN
    _xp_gain := GREATEST(1, floor(_session.bet_amount / 10)::INT);
    
    UPDATE profiles SET 
      xp = xp + _xp_gain,
      total_wins = total_wins + (CASE WHEN _win_amount > _session.bet_amount THEN 1 ELSE 0 END),
      total_losses = total_losses + (CASE WHEN _win_amount < _session.bet_amount THEN 1 ELSE 0 END)
    WHERE id = _session.user_id;
  END IF;

  -- Завершаем сессию
  UPDATE game_sessions SET 
    status = 'completed',
    result = _result,
    win_amount = _win_amount,
    completed_at = now()
  WHERE id = _session_id;

  -- Записываем в историю
  INSERT INTO game_history (
    user_id, game_name, bet_amount, win_amount, multiplier,
    game_session_id, server_seed_hash, is_verified
  )
  VALUES (
    _session.user_id, _session.game_name, _session.bet_amount, _win_amount, _multiplier,
    _session_id, hash_seed(_session.server_seed), true
  );

  -- Освобождаем блокировку
  PERFORM release_game_lock(_session.user_id, _session_id);

  RETURN json_build_object(
    'success', true,
    'win_amount', _win_amount,
    'session_id', _session_id
  );
END;
$$;


--
-- Name: complete_game_session(uuid, uuid, numeric, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_game_session(_session_id uuid, _user_id uuid, _win_amount numeric, _multiplier numeric, _result jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  -- Проверяем rate limit на cashout
  IF NOT check_rate_limit(_user_id, 'cashout', 1000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Подождите перед следующим действием');
  END IF;
  
  -- Получаем и блокируем сессию
  SELECT * INTO v_session
  FROM game_sessions
  WHERE id = _session_id AND user_id = _user_id AND status = 'active'
  FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена или уже завершена');
  END IF;
  
  -- Начисляем выигрыш
  IF _win_amount > 0 THEN
    IF v_session.is_demo THEN
      UPDATE profiles SET demo_balance = demo_balance + _win_amount WHERE id = _user_id;
    ELSIF v_session.is_freebet THEN
      UPDATE profiles SET freebet_balance = freebet_balance + _win_amount WHERE id = _user_id;
      -- Прогресс отыгрыша
      IF _win_amount > v_session.bet_amount THEN
        PERFORM update_wager_progress(_user_id, _win_amount - v_session.bet_amount);
      END IF;
    ELSE
      UPDATE profiles SET balance = balance + _win_amount WHERE id = _user_id;
    END IF;
  END IF;
  
  -- Обновляем сессию
  UPDATE game_sessions SET
    status = 'completed',
    win_amount = _win_amount,
    result = _result,
    completed_at = now()
  WHERE id = _session_id;
  
  -- Записываем в историю
  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_session_id, server_seed_hash, nonce)
  VALUES (_user_id, v_session.game_name, v_session.bet_amount, _win_amount, _multiplier, _session_id, hash_seed(v_session.server_seed), v_session.nonce);
  
  -- Добавляем XP
  PERFORM add_user_xp(_user_id, GREATEST(1, (v_session.bet_amount / 10)::int));
  
  RETURN jsonb_build_object(
    'success', true,
    'win_amount', _win_amount,
    'multiplier', _multiplier,
    'server_seed', v_session.server_seed
  );
END;
$$;


--
-- Name: create_betting_tournament(uuid, text, text, text, numeric, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_betting_tournament(_admin_id uuid, _title text, _description text DEFAULT NULL::text, _prize_type text DEFAULT 'balance'::text, _prize_amount numeric DEFAULT 0, _duration_hours integer DEFAULT 24, _min_bet_amount numeric DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _is_admin BOOLEAN;
  _tournament_id UUID;
BEGIN
  -- Check admin
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO _is_admin;
  IF NOT _is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Нет прав администратора');
  END IF;

  -- Create tournament
  INSERT INTO betting_tournaments (title, description, prize_type, prize_amount, end_at, min_bet_amount, created_by)
  VALUES (_title, _description, _prize_type, _prize_amount, now() + (_duration_hours || ' hours')::interval, _min_bet_amount, _admin_id)
  RETURNING id INTO _tournament_id;

  RETURN jsonb_build_object('success', true, 'tournament_id', _tournament_id);
END;
$$;


--
-- Name: create_crash_round(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_crash_round() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_config crash_config%ROWTYPE;
  v_multiplier DECIMAL;
  v_rand DECIMAL;
  v_round_id UUID;
  v_round_number INTEGER;
  v_existing crash_rounds%ROWTYPE;
BEGIN
  -- Check if there's already a pending/betting round
  SELECT * INTO v_existing FROM crash_rounds 
  WHERE status IN ('pending', 'betting') 
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'round_id', v_existing.id, 'already_exists', true);
  END IF;
  
  -- Check if last crashed round is less than 3 seconds old
  SELECT * INTO v_existing FROM crash_rounds 
  WHERE status = 'crashed' 
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_existing IS NOT NULL AND v_existing.crashed_at > now() - interval '3 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wait for next round');
  END IF;
  
  SELECT * INTO v_config FROM crash_config LIMIT 1;
  IF v_config IS NULL THEN
    v_config.chance_1_00 := 25;
    v_config.chance_1_01_1_09 := 25;
    v_config.chance_1_10_1_40 := 18;
    v_config.chance_1_40_2_00 := 14;
    v_config.chance_2_00_5_00 := 10;
    v_config.chance_5_00_15_00 := 5;
    v_config.chance_15_00_35_00 := 3;
  END IF;
  
  v_rand := random() * 100;
  
  IF v_rand < v_config.chance_1_00 THEN
    v_multiplier := 1.00;
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 THEN
    v_multiplier := 1.01 + random() * 0.08;
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 + v_config.chance_1_10_1_40 THEN
    v_multiplier := 1.10 + random() * 0.30;
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 + v_config.chance_1_10_1_40 + v_config.chance_1_40_2_00 THEN
    v_multiplier := 1.40 + random() * 0.60;
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 + v_config.chance_1_10_1_40 + v_config.chance_1_40_2_00 + v_config.chance_2_00_5_00 THEN
    v_multiplier := 2.00 + random() * 3.00;
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 + v_config.chance_1_10_1_40 + v_config.chance_1_40_2_00 + v_config.chance_2_00_5_00 + v_config.chance_5_00_15_00 THEN
    v_multiplier := 5.00 + random() * 10.00;
  ELSE
    v_multiplier := 15.00 + random() * 20.00;
  END IF;
  
  SELECT COALESCE(MAX(round_number), 0) + 1 INTO v_round_number FROM crash_rounds;
  
  INSERT INTO crash_rounds (multiplier, status, round_number)
  VALUES (ROUND(v_multiplier::numeric, 2), 'pending', v_round_number)
  RETURNING id INTO v_round_id;
  
  RETURN jsonb_build_object('success', true, 'round_id', v_round_id);
END;
$$;


--
-- Name: create_profile_with_username(bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_with_username(_telegram_id bigint, _username text, _first_name text DEFAULT NULL::text, _last_name text DEFAULT NULL::text) RETURNS TABLE(success boolean, message text, profile_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _profile_id uuid;
  _referral_code text;
  _public_id integer;
BEGIN
  -- Check if username is valid
  IF length(_username) < 3 OR length(_username) > 20 THEN
    RETURN QUERY SELECT false, 'Никнейм должен быть от 3 до 20 символов'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Check if username contains only allowed characters
  IF _username !~ '^[a-zA-Z0-9_]+$' THEN
    RETURN QUERY SELECT false, 'Никнейм может содержать только буквы, цифры и _'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE username = _username) THEN
    RETURN QUERY SELECT false, 'Этот никнейм уже занят'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Check if telegram_id already has profile
  IF EXISTS (SELECT 1 FROM profiles WHERE telegram_id = _telegram_id) THEN
    RETURN QUERY SELECT false, 'Профиль уже существует'::text, NULL::uuid;
    RETURN;
  END IF;
  
  -- Generate unique referral code
  _referral_code := generate_referral_code();
  
  -- Generate unique public_id
  _public_id := generate_unique_public_id();
  
  -- Create profile
  INSERT INTO profiles (telegram_id, username, referral_code, balance, public_id)
  VALUES (_telegram_id, _username, _referral_code, 0, _public_id)
  RETURNING id INTO _profile_id;
  
  RETURN QUERY SELECT true, 'Профиль создан успешно'::text, _profile_id;
END;
$_$;


--
-- Name: create_user_session(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_session(p_user_id uuid, p_device_info text DEFAULT NULL::text) RETURNS TABLE(session_token text, is_new_session boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_token TEXT;
  v_existing_session RECORD;
BEGIN
  -- Generate new session token
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  SELECT * INTO v_existing_session
  FROM public.user_sessions
  WHERE user_id = p_user_id AND is_active = true;

  IF v_existing_session IS NOT NULL THEN
    UPDATE public.user_sessions
    SET is_active = false
    WHERE id = v_existing_session.id;
  END IF;

  INSERT INTO public.user_sessions (user_id, session_token, device_info, is_active)
  VALUES (p_user_id, v_token, p_device_info, true)
  ON CONFLICT (user_id)
  DO UPDATE SET
    session_token = v_token,
    device_info = p_device_info,
    is_active = true,
    last_active_at = now();

  RETURN QUERY SELECT v_token, (v_existing_session IS NOT NULL);
END;
$$;


--
-- Name: create_withdrawal_request(uuid, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_withdrawal_request(_user_id uuid, _amount numeric, _method text, _details text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_request_id UUID;
BEGIN
  -- Get profile
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id FOR UPDATE;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check balance
  IF v_profile.balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF _amount < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is 100');
  END IF;

  -- Deduct balance
  UPDATE profiles SET balance = balance - _amount WHERE id = _user_id;

  -- Create request
  INSERT INTO withdrawal_requests (user_id, amount, method, details, status)
  VALUES (_user_id, _amount, _method, _details, 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;


--
-- Name: delete_user_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_profile(_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Удаляем все связанные данные
  DELETE FROM public.chat_messages WHERE user_id = _user_id;
  DELETE FROM public.daily_rewards WHERE user_id = _user_id;
  DELETE FROM public.game_history WHERE user_id = _user_id;
  DELETE FROM public.transactions WHERE user_id = _user_id;
  DELETE FROM public.user_bets WHERE user_id = _user_id;
  DELETE FROM public.parlay_bets WHERE user_id = _user_id;
  DELETE FROM public.promocode_activations WHERE user_id = _user_id;
  DELETE FROM public.user_freespins WHERE user_id = _user_id;
  DELETE FROM public.user_moderation WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;

  -- Удаляем реферальные данные, связанные с пользователем
  DELETE FROM public.referral_rewards
  WHERE referrer_id = _user_id OR referred_id = _user_id;

  -- Очищаем ссылки на удалённого пользователя как реферера у других профилей
  UPDATE public.profiles
  SET referred_by = NULL
  WHERE referred_by = _user_id;

  -- Удаляем тикеты поддержки и сообщения пользователя
  DELETE FROM public.support_messages
  WHERE ticket_id IN (
    SELECT id FROM public.support_tickets WHERE user_id = _user_id
  )
  OR user_id = _user_id;

  DELETE FROM public.support_tickets
  WHERE user_id = _user_id;

  -- В конце удаляем профиль
  DELETE FROM public.profiles WHERE id = _user_id;
END;
$$;


--
-- Name: enforce_rate_limit(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_rate_limit(_user_id uuid, _action_type text, _min_interval_ms integer DEFAULT 500) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT check_rate_limit(_user_id, _action_type, _min_interval_ms) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before trying again.';
  END IF;
END;
$$;


--
-- Name: find_game_by_number(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_game_by_number(_game_number bigint) RETURNS TABLE(game_number bigint, game_name text, bet_amount numeric, win_amount numeric, multiplier numeric, server_seed text, revealed_seed text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gh.game_number,
    gh.game_name,
    gh.bet_amount,
    gh.win_amount,
    gh.multiplier,
    gh.server_seed_hash as server_seed,
    gs.server_seed as revealed_seed,
    gh.created_at
  FROM public.game_history gh
  LEFT JOIN public.game_sessions gs ON gh.game_session_id = gs.id AND gs.status = 'completed'
  WHERE gh.game_number = _game_number
  LIMIT 1;
END;
$$;


--
-- Name: finish_betting_tournament(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_betting_tournament(_admin_id uuid, _tournament_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _is_admin BOOLEAN;
  _tournament RECORD;
  _winner RECORD;
BEGIN
  -- Check admin
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO _is_admin;
  IF NOT _is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Нет прав администратора');
  END IF;

  -- Get tournament
  SELECT * INTO _tournament FROM betting_tournaments WHERE id = _tournament_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Турнир не найден');
  END IF;

  IF _tournament.status = 'finished' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Турнир уже завершён');
  END IF;

  -- Get winner (most total_wins)
  SELECT btr.*, p.username INTO _winner
  FROM betting_tournament_results btr
  JOIN profiles p ON p.id = btr.user_id
  WHERE btr.tournament_id = _tournament_id
  ORDER BY btr.total_wins DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- No participants, just close
    UPDATE betting_tournaments SET status = 'finished' WHERE id = _tournament_id;
    RETURN jsonb_build_object('success', true, 'message', 'Турнир завершён без участников');
  END IF;

  -- Award prize
  IF _tournament.prize_type = 'balance' THEN
    UPDATE profiles SET balance = balance + _tournament.prize_amount WHERE id = _winner.user_id;
  ELSIF _tournament.prize_type = 'freebet' THEN
    UPDATE profiles SET freebet_balance = COALESCE(freebet_balance, 0) + _tournament.prize_amount WHERE id = _winner.user_id;
  ELSIF _tournament.prize_type = 'betting_freebet' THEN
    UPDATE profiles SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + _tournament.prize_amount WHERE id = _winner.user_id;
  ELSIF _tournament.prize_type = 'wheel' THEN
    FOR i IN 1.._tournament.prize_amount::INTEGER LOOP
      INSERT INTO bonus_wheels (user_id) VALUES (_winner.user_id);
    END LOOP;
  END IF;

  -- Update tournament
  UPDATE betting_tournaments
  SET status = 'finished', winner_id = _winner.user_id
  WHERE id = _tournament_id;

  -- Notify winner
  INSERT INTO system_notifications (user_id, message)
  VALUES (_winner.user_id, 'Поздравляем! Вы выиграли турнир "' || _tournament.title || '" и получили ' || _tournament.prize_amount || 
    CASE _tournament.prize_type
      WHEN 'balance' THEN '₽'
      WHEN 'freebet' THEN '₽ фрибет'
      WHEN 'betting_freebet' THEN '₽ фрибет ставки'
      WHEN 'wheel' THEN ' колёс фортуны'
      ELSE ''
    END || '!');

  RETURN jsonb_build_object(
    'success', true,
    'winner_id', _winner.user_id,
    'winner_username', _winner.username,
    'total_wins', _winner.total_wins
  );
END;
$$;


--
-- Name: finish_giveaway(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_giveaway(_admin_id uuid, _giveaway_id uuid, _winner_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean;
  v_giveaway giveaways%ROWTYPE;
BEGIN
  -- Проверяем админа
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _admin_id AND role = 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Недостаточно прав');
  END IF;
  
  -- Получаем розыгрыш
  SELECT * INTO v_giveaway FROM giveaways WHERE id = _giveaway_id;
  
  IF v_giveaway IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Розыгрыш не найден');
  END IF;
  
  IF v_giveaway.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Розыгрыш уже завершён');
  END IF;
  
  -- Проверяем, что победитель участвовал
  IF NOT EXISTS (SELECT 1 FROM giveaway_participants WHERE giveaway_id = _giveaway_id AND user_id = _winner_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Победитель не участвовал в розыгрыше');
  END IF;
  
  -- Выдаём приз
  CASE v_giveaway.prize_type
    WHEN 'balance' THEN
      UPDATE profiles SET balance = balance + v_giveaway.prize_amount WHERE id = _winner_id;
    WHEN 'freebet' THEN
      UPDATE profiles SET 
        freebet_balance = COALESCE(freebet_balance, 0) + v_giveaway.prize_amount,
        wager_requirement = COALESCE(wager_requirement, 0) + (v_giveaway.prize_amount * 60)
      WHERE id = _winner_id;
    WHEN 'betting_freebet' THEN
      UPDATE profiles SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + v_giveaway.prize_amount WHERE id = _winner_id;
    WHEN 'wheel' THEN
      INSERT INTO bonus_wheels (user_id) 
      SELECT _winner_id FROM generate_series(1, v_giveaway.prize_amount::int);
    WHEN 'skin' THEN
      INSERT INTO user_inventory (user_id, skin_id, purchased_price, is_demo) VALUES (_winner_id, v_giveaway.prize_skin_id, 0, false);
    WHEN 'demo' THEN
      UPDATE profiles SET demo_balance = COALESCE(demo_balance, 0) + v_giveaway.prize_amount WHERE id = _winner_id;
  END CASE;
  
  -- ИСПРАВЛЕНИЕ: Обновляем total_wins у победителя
  UPDATE profiles SET total_wins = COALESCE(total_wins, 0) + 1 WHERE id = _winner_id;
  
  -- Обновляем розыгрыш
  UPDATE giveaways SET status = 'finished', winner_id = _winner_id, finished_at = now() WHERE id = _giveaway_id;
  
  -- Уведомляем победителя
  PERFORM notify_user_action(_winner_id::text, '🎉 Вы выиграли в розыгрыше: ' || v_giveaway.title);
  
  RETURN jsonb_build_object('success', true, 'message', 'Победитель выбран!');
END;
$$;


--
-- Name: generate_crash_point(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_crash_point() RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_config RECORD;
  v_rand NUMERIC;
  v_crash_point NUMERIC;
BEGIN
  SELECT * INTO v_config FROM public.crash_config LIMIT 1;
  
  IF v_config IS NULL THEN
    v_config := ROW(0.25, 0.25, 0.18, 0.14, 0.10, 0.05, 0.03, 1.00, 35.00);
  END IF;
  
  v_rand := random();
  
  -- 25% - instant crash at 1.00
  IF v_rand < v_config.chance_1_00 THEN
    v_crash_point := 1.00;
  -- 25% - 1.01 to 1.09
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 THEN
    v_crash_point := 1.01 + random() * 0.08;
  -- 18% - 1.10 to 1.40
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 + v_config.chance_1_10_1_40 THEN
    v_crash_point := 1.10 + random() * 0.30;
  -- 14% - 1.40 to 2.00
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 + v_config.chance_1_10_1_40 + v_config.chance_1_40_2_00 THEN
    v_crash_point := 1.40 + random() * 0.60;
  -- 10% - 2.00 to 5.00
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 + v_config.chance_1_10_1_40 + v_config.chance_1_40_2_00 + v_config.chance_2_00_5_00 THEN
    v_crash_point := 2.00 + random() * 3.00;
  -- 5% - 5.00 to 15.00
  ELSIF v_rand < v_config.chance_1_00 + v_config.chance_1_01_1_09 + v_config.chance_1_10_1_40 + v_config.chance_1_40_2_00 + v_config.chance_2_00_5_00 + v_config.chance_5_00_15_00 THEN
    v_crash_point := 5.00 + random() * 10.00;
  -- 3% - 15.00 to 35.00
  ELSE
    v_crash_point := 15.00 + random() * 20.00;
  END IF;
  
  RETURN ROUND(v_crash_point, 2);
END;
$$;


--
-- Name: generate_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_referral_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Генерируем случайный 8-символьный код
    new_code := upper(substring(md5(random()::text) from 1 for 8));
    
    -- Проверяем, не существует ли уже такой код
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO code_exists;
    
    -- Если код уникален, выходим из цикла
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;


--
-- Name: generate_server_seed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_server_seed() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN encode(digest(gen_random_uuid()::text || now()::text || random()::text, 'sha256'), 'hex');
END;
$$;


--
-- Name: generate_unique_public_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_public_id() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  new_id integer;
  done boolean := false;
BEGIN
  WHILE NOT done LOOP
    -- Generate random 8-digit number (10000000 to 99999999)
    new_id := floor(random() * 90000000 + 10000000)::integer;
    -- Check if it exists
    done := NOT EXISTS (SELECT 1 FROM public.profiles WHERE public_id = new_id);
  END LOOP;
  RETURN new_id;
END;
$$;


--
-- Name: generate_verification_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_verification_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN lpad(floor(random() * 1000000)::text, 6, '0');
END;
$$;


--
-- Name: get_betting_tournament_leaderboard(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_betting_tournament_leaderboard(_tournament_id uuid) RETURNS TABLE(user_id uuid, username text, is_vip boolean, level integer, gradient_color text, total_wins numeric, total_bets integer, biggest_win numeric, rank bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    btr.user_id,
    p.username,
    p.is_vip,
    p.level,
    p.gradient_color,
    btr.total_wins,
    btr.total_bets,
    btr.biggest_win,
    ROW_NUMBER() OVER (ORDER BY btr.total_wins DESC) as rank
  FROM betting_tournament_results btr
  JOIN profiles p ON p.id = btr.user_id
  WHERE btr.tournament_id = _tournament_id
  ORDER BY btr.total_wins DESC
  LIMIT 100;
END;
$$;


--
-- Name: get_crash_bets_for_round(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_crash_bets_for_round(_round_id uuid) RETURNS TABLE(id uuid, user_id uuid, username text, bet_amount numeric, auto_cashout numeric, cashed_out_at numeric, win_amount numeric, status text, is_freebet boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT cb.id, cb.user_id, p.username, cb.bet_amount, cb.auto_cashout,
         cb.cashed_out_at, cb.win_amount, cb.status, cb.is_freebet
  FROM crash_bets cb
  JOIN profiles p ON p.id = cb.user_id
  WHERE cb.round_id = _round_id;
END;
$$;


--
-- Name: get_crash_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_crash_state() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_round record;
  v_config record;
  v_countdown_ms bigint;
  v_elapsed_ms bigint;
  v_current_multiplier numeric;
  v_betting_ends_at timestamptz;
  v_game_start_time_ms bigint;
  v_server_time_ms bigint;
BEGIN
  -- Get config
  SELECT * INTO v_config FROM crash_config LIMIT 1;
  IF v_config IS NULL THEN
    v_config := ROW(14, 1.00, 35.00, 50, 15, 15, 10, 7, 3);
  END IF;

  -- Get latest round
  SELECT * INTO v_round
  FROM crash_rounds
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no round or last is crashed, create new pending
  IF v_round IS NULL OR v_round.status = 'crashed' THEN
    INSERT INTO crash_rounds (multiplier, status, round_number)
    VALUES (
      CASE
        WHEN random() < 0.50 THEN 1.00 + random() * 0.09
        WHEN random() < 0.65 THEN 1.10 + random() * 0.30
        WHEN random() < 0.80 THEN 1.40 + random() * 0.60
        WHEN random() < 0.90 THEN 2.00 + random() * 3.00
        WHEN random() < 0.97 THEN 5.00 + random() * 10.00
        ELSE 15.00 + random() * 20.00
      END,
      'pending',
      COALESCE(v_round.round_number, 0) + 1
    )
    RETURNING * INTO v_round;
  END IF;

  -- Calculate betting ends
  v_betting_ends_at := v_round.created_at + (v_config.betting_time_seconds * interval '1 second');
  v_countdown_ms := EXTRACT(EPOCH FROM (v_betting_ends_at - now())) * 1000;
  v_server_time_ms := EXTRACT(EPOCH FROM now()) * 1000;

  -- Handle status transitions: pending -> playing
  IF v_round.status = 'pending' AND v_countdown_ms <= 0 THEN
    UPDATE crash_rounds
    SET status = 'playing', started_at = now()
    WHERE id = v_round.id;
    
    -- Activate all pending bets for this round
    UPDATE crash_bets
    SET status = 'active'
    WHERE round_id = v_round.id AND status = 'pending';
    
    v_round.status := 'playing';
    v_round.started_at := now();
  END IF;

  -- Calculate game_start_time in ms
  IF v_round.started_at IS NOT NULL THEN
    v_game_start_time_ms := EXTRACT(EPOCH FROM v_round.started_at) * 1000;
  ELSE
    v_game_start_time_ms := NULL;
  END IF;

  -- If playing, calculate current multiplier and check for crash
  IF v_round.status = 'playing' AND v_round.started_at IS NOT NULL THEN
    v_elapsed_ms := EXTRACT(EPOCH FROM (now() - v_round.started_at)) * 1000;
    -- Multiplier formula: 1 + elapsed_seconds * 0.15
    v_current_multiplier := 1.00 + (v_elapsed_ms::numeric / 1000.0) * 0.15;
    
    -- Process auto-cashouts
    UPDATE crash_bets cb
    SET 
      cashed_out_at = cb.auto_cashout,
      win_amount = ROUND(cb.bet_amount * cb.auto_cashout, 2),
      status = 'won'
    WHERE cb.round_id = v_round.id 
      AND cb.status = 'active'
      AND cb.cashed_out_at IS NULL
      AND cb.auto_cashout <= v_current_multiplier;
    
    -- Credit auto-cashout winnings
    UPDATE profiles p
    SET balance = p.balance + cb.win_amount
    FROM crash_bets cb
    WHERE cb.round_id = v_round.id 
      AND cb.user_id = p.id
      AND cb.status = 'won'
      AND cb.cashed_out_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.user_id = cb.user_id 
          AND t.description = 'Автовыкуп Crash x' || cb.cashed_out_at::TEXT
          AND t.created_at > now() - interval '5 seconds'
      );
    
    -- Check if crashed
    IF v_current_multiplier >= v_round.multiplier THEN
      UPDATE crash_rounds
      SET status = 'crashed', crashed_at = now()
      WHERE id = v_round.id;
      
      -- Mark all remaining active bets as lost
      UPDATE crash_bets
      SET status = 'lost', win_amount = 0
      WHERE round_id = v_round.id AND status = 'active';
      
      v_round.status := 'crashed';
      v_current_multiplier := v_round.multiplier;
    END IF;
  ELSE
    v_current_multiplier := 1.00;
  END IF;

  -- Return state with correct field names for frontend
  RETURN jsonb_build_object(
    'round_id', v_round.id,
    'round_number', v_round.round_number,
    'status', CASE 
      WHEN v_round.status = 'pending' THEN 'betting'
      ELSE v_round.status 
    END,
    'countdown_ms', GREATEST(v_countdown_ms, 0),
    'game_start_time', v_game_start_time_ms,
    'crash_multiplier', v_round.multiplier,
    'current_multiplier', ROUND(v_current_multiplier, 2),
    'server_time', v_server_time_ms
  );
END;
$$;


--
-- Name: get_giveaway_leaderboard(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_giveaway_leaderboard(_giveaway_id uuid) RETURNS TABLE(user_id uuid, username text, is_vip boolean, gradient_color text, level integer, score bigint, has_buff boolean, buff_type text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_giveaway giveaways%ROWTYPE;
  v_start_at timestamptz;
BEGIN
  SELECT * INTO v_giveaway FROM giveaways WHERE id = _giveaway_id;
  
  IF v_giveaway IS NULL THEN
    RETURN;
  END IF;

  v_start_at := COALESCE(v_giveaway.registration_ends_at, v_giveaway.achievement_start_at, v_giveaway.created_at);

  IF v_giveaway.achievement_type = 'most_wins' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.username,
      COALESCE(p.is_vip, false),
      COALESCE(p.gradient_color, 'gold'),
      COALESCE(p.level, 1),
      (SELECT COALESCE(SUM(
        CASE 
          WHEN EXISTS(SELECT 1 FROM user_buffs ub WHERE ub.user_id = p.id AND ub.expires_at > gh2.created_at AND ub.created_at <= gh2.created_at AND ub.buff_type = 'x10') THEN 10
          WHEN EXISTS(SELECT 1 FROM user_buffs ub WHERE ub.user_id = p.id AND ub.expires_at > gh2.created_at AND ub.created_at <= gh2.created_at AND ub.buff_type = 'x5') THEN 5
          WHEN EXISTS(SELECT 1 FROM user_buffs ub WHERE ub.user_id = p.id AND ub.expires_at > gh2.created_at AND ub.created_at <= gh2.created_at AND ub.buff_type = 'x3') THEN 3
          WHEN EXISTS(SELECT 1 FROM user_buffs ub WHERE ub.user_id = p.id AND ub.expires_at > gh2.created_at AND ub.created_at <= gh2.created_at AND ub.buff_type = 'x2') THEN 2
          ELSE 1
        END
      ), 0)
      FROM game_history gh2 
      WHERE gh2.user_id = p.id 
        AND gh2.win_amount > gh2.bet_amount 
        AND gh2.created_at >= v_start_at
      )::bigint AS score,
      EXISTS(SELECT 1 FROM user_buffs ub2 WHERE ub2.user_id = p.id AND ub2.expires_at > now()) AS has_buff,
      (SELECT ub3.buff_type FROM user_buffs ub3 WHERE ub3.user_id = p.id AND ub3.expires_at > now() ORDER BY 
        CASE ub3.buff_type WHEN 'x10' THEN 1 WHEN 'x5' THEN 2 WHEN 'x3' THEN 3 WHEN 'x2' THEN 4 END 
        LIMIT 1) AS buff_type
    FROM giveaway_participants gp
    JOIN profiles p ON p.id = gp.user_id
    WHERE gp.giveaway_id = _giveaway_id
    ORDER BY score DESC
    LIMIT 50;

  ELSIF v_giveaway.achievement_type = 'most_wins_game' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.username,
      COALESCE(p.is_vip, false),
      COALESCE(p.gradient_color, 'gold'),
      COALESCE(p.level, 1),
      (SELECT COALESCE(SUM(
        CASE 
          WHEN EXISTS(SELECT 1 FROM user_buffs ub WHERE ub.user_id = p.id AND ub.expires_at > gh2.created_at AND ub.created_at <= gh2.created_at AND ub.buff_type = 'x10') THEN 10
          WHEN EXISTS(SELECT 1 FROM user_buffs ub WHERE ub.user_id = p.id AND ub.expires_at > gh2.created_at AND ub.created_at <= gh2.created_at AND ub.buff_type = 'x5') THEN 5
          WHEN EXISTS(SELECT 1 FROM user_buffs ub WHERE ub.user_id = p.id AND ub.expires_at > gh2.created_at AND ub.created_at <= gh2.created_at AND ub.buff_type = 'x3') THEN 3
          WHEN EXISTS(SELECT 1 FROM user_buffs ub WHERE ub.user_id = p.id AND ub.expires_at > gh2.created_at AND ub.created_at <= gh2.created_at AND ub.buff_type = 'x2') THEN 2
          ELSE 1
        END
      ), 0)
      FROM game_history gh2 
      WHERE gh2.user_id = p.id 
        AND gh2.win_amount > gh2.bet_amount 
        AND gh2.game_name = v_giveaway.achievement_game
        AND gh2.created_at >= v_start_at
      )::bigint AS score,
      EXISTS(SELECT 1 FROM user_buffs ub2 WHERE ub2.user_id = p.id AND ub2.expires_at > now()) AS has_buff,
      (SELECT ub3.buff_type FROM user_buffs ub3 WHERE ub3.user_id = p.id AND ub3.expires_at > now() ORDER BY 
        CASE ub3.buff_type WHEN 'x10' THEN 1 WHEN 'x5' THEN 2 WHEN 'x3' THEN 3 WHEN 'x2' THEN 4 END 
        LIMIT 1) AS buff_type
    FROM giveaway_participants gp
    JOIN profiles p ON p.id = gp.user_id
    WHERE gp.giveaway_id = _giveaway_id
    ORDER BY score DESC
    LIMIT 50;

  ELSIF v_giveaway.achievement_type = 'biggest_win' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.username,
      COALESCE(p.is_vip, false),
      COALESCE(p.gradient_color, 'gold'),
      COALESCE(p.level, 1),
      (SELECT COALESCE(MAX(gh2.win_amount), 0)
       FROM game_history gh2 
       WHERE gh2.user_id = p.id 
         AND gh2.created_at >= v_start_at
      )::bigint AS score,
      EXISTS(SELECT 1 FROM user_buffs ub2 WHERE ub2.user_id = p.id AND ub2.expires_at > now()) AS has_buff,
      (SELECT ub3.buff_type FROM user_buffs ub3 WHERE ub3.user_id = p.id AND ub3.expires_at > now() ORDER BY 
        CASE ub3.buff_type WHEN 'x10' THEN 1 WHEN 'x5' THEN 2 WHEN 'x3' THEN 3 WHEN 'x2' THEN 4 END 
        LIMIT 1) AS buff_type
    FROM giveaway_participants gp
    JOIN profiles p ON p.id = gp.user_id
    WHERE gp.giveaway_id = _giveaway_id
    ORDER BY score DESC
    LIMIT 50;

  ELSIF v_giveaway.achievement_type = 'highest_multiplier' THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.username,
      COALESCE(p.is_vip, false),
      COALESCE(p.gradient_color, 'gold'),
      COALESCE(p.level, 1),
      (SELECT COALESCE(MAX(gh2.multiplier), 0)
       FROM game_history gh2 
       WHERE gh2.user_id = p.id 
         AND gh2.created_at >= v_start_at
      )::bigint AS score,
      EXISTS(SELECT 1 FROM user_buffs ub2 WHERE ub2.user_id = p.id AND ub2.expires_at > now()) AS has_buff,
      (SELECT ub3.buff_type FROM user_buffs ub3 WHERE ub3.user_id = p.id AND ub3.expires_at > now() ORDER BY 
        CASE ub3.buff_type WHEN 'x10' THEN 1 WHEN 'x5' THEN 2 WHEN 'x3' THEN 3 WHEN 'x2' THEN 4 END 
        LIMIT 1) AS buff_type
    FROM giveaway_participants gp
    JOIN profiles p ON p.id = gp.user_id
    WHERE gp.giveaway_id = _giveaway_id
    ORDER BY score DESC
    LIMIT 50;

  ELSE
    RETURN QUERY
    SELECT 
      p.id,
      p.username,
      COALESCE(p.is_vip, false),
      COALESCE(p.gradient_color, 'gold'),
      COALESCE(p.level, 1),
      0::bigint AS score,
      false AS has_buff,
      NULL::text AS buff_type
    FROM giveaway_participants gp
    JOIN profiles p ON p.id = gp.user_id
    WHERE gp.giveaway_id = _giveaway_id
    LIMIT 50;
  END IF;
END;
$$;


--
-- Name: get_live_winners(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_live_winners(_limit integer DEFAULT 10) RETURNS TABLE(game_name text, username text, is_vip boolean, gradient_color text, bet_amount numeric, win_amount numeric, multiplier numeric, created_at timestamp with time zone, is_admin boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gh.game_name,
    p.username,
    COALESCE(p.is_vip, false) as is_vip,
    p.gradient_color,
    gh.bet_amount,
    gh.win_amount,
    gh.multiplier,
    gh.created_at,
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin') as is_admin
  FROM game_history gh
  JOIN profiles p ON gh.user_id = p.id
  WHERE gh.win_amount > 0
  ORDER BY gh.created_at DESC
  LIMIT _limit;
END;
$$;


--
-- Name: get_my_withdrawal_requests(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_withdrawal_requests(_user_id uuid) RETURNS TABLE(id uuid, amount numeric, method text, status text, created_at timestamp with time zone, processed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wr.id,
    wr.amount,
    wr.method,
    wr.status,
    wr.created_at,
    wr.processed_at
  FROM withdrawal_requests wr
  WHERE wr.user_id = _user_id
  ORDER BY wr.created_at DESC;
END;
$$;


--
-- Name: get_or_create_profile_by_telegram(bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_profile_by_telegram(_telegram_id bigint, _username text, _first_name text DEFAULT NULL::text, _last_name text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  profile_id UUID;
  anonymous_username TEXT;
BEGIN
  anonymous_username := 'player' || floor(random() * 1000000)::text;
  
  SELECT id INTO profile_id
  FROM public.profiles
  WHERE telegram_id = _telegram_id;
  
  IF profile_id IS NULL THEN
    INSERT INTO public.profiles (telegram_id, username)
    VALUES (_telegram_id, anonymous_username)
    RETURNING id INTO profile_id;
  END IF;
  
  RETURN profile_id;
END;
$$;


--
-- Name: get_parlay_items(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_parlay_items(_parlay_bet_id uuid) RETURNS TABLE(id uuid, match_id uuid, bet_type text, odds numeric, status text, original_bet_type text, original_odds numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT pbi.id, pbi.match_id, pbi.bet_type, pbi.odds,
         pbi.status, pbi.original_bet_type, pbi.original_odds
  FROM parlay_bet_items pbi
  WHERE pbi.parlay_bet_id = _parlay_bet_id;
END;
$$;


--
-- Name: get_player_win_streak(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_player_win_streak(_user_id uuid, _giveaway_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_giveaway giveaways%ROWTYPE;
  v_start_at timestamptz;
  v_streak_count INTEGER := 0;
  v_last_win_time timestamptz;
  v_current_game RECORD;
BEGIN
  SELECT * INTO v_giveaway FROM giveaways WHERE id = _giveaway_id;
  
  IF v_giveaway IS NULL THEN
    RETURN json_build_object('streak', 0, 'bonus', 0);
  END IF;

  v_start_at := COALESCE(v_giveaway.registration_ends_at, v_giveaway.achievement_start_at, v_giveaway.created_at);

  FOR v_current_game IN
    SELECT created_at, win_amount, bet_amount
    FROM game_history
    WHERE user_id = _user_id
      AND created_at >= v_start_at
      AND win_amount > bet_amount
    ORDER BY created_at DESC
    LIMIT 20
  LOOP
    IF v_last_win_time IS NULL THEN
      v_streak_count := 1;
      v_last_win_time := v_current_game.created_at;
    ELSIF v_last_win_time - v_current_game.created_at <= INTERVAL '5 minutes' THEN
      v_streak_count := v_streak_count + 1;
      v_last_win_time := v_current_game.created_at;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'streak', v_streak_count,
    'bonus', CASE 
      WHEN v_streak_count >= 10 THEN 50
      WHEN v_streak_count >= 7 THEN 25
      WHEN v_streak_count >= 5 THEN 10
      WHEN v_streak_count >= 3 THEN 5
      ELSE 0
    END,
    'message', CASE 
      WHEN v_streak_count >= 10 THEN '🔥 МЕГА СЕРИЯ! +50 бонусных очков!'
      WHEN v_streak_count >= 7 THEN '🔥 Отличная серия! +25 бонусных очков!'
      WHEN v_streak_count >= 5 THEN '⚡ Хорошая серия! +10 бонусных очков!'
      WHEN v_streak_count >= 3 THEN '✨ Начало серии! +5 бонусных очков!'
      ELSE NULL
    END
  );
END;
$$;


--
-- Name: get_profile_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_profile_by_id(_user_id uuid) RETURNS TABLE(id uuid, telegram_id bigint, username text, avatar_url text, balance numeric, demo_balance numeric, freebet_balance numeric, betting_freebet_balance numeric, level integer, xp integer, is_vip boolean, is_banned boolean, is_muted boolean, gradient_color text, profile_background text, total_wins numeric, total_losses numeric, wager_progress numeric, wager_requirement numeric, public_id integer, email text, email_verified_at timestamp with time zone, referral_code text, referred_by uuid, created_at timestamp with time zone, guaranteed_max_win boolean, user_roles jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.telegram_id, p.username, p.avatar_url, p.balance, p.demo_balance,
    p.freebet_balance, p.betting_freebet_balance, p.level, p.xp, p.is_vip,
    p.is_banned, p.is_muted, p.gradient_color, p.profile_background,
    p.total_wins, p.total_losses, p.wager_progress, p.wager_requirement,
    p.public_id, p.email, p.email_verified_at, p.referral_code, p.referred_by,
    p.created_at, p.guaranteed_max_win,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('role', ur.role))
       FROM user_roles ur WHERE ur.user_id = p.id),
      '[]'::jsonb
    ) as user_roles
  FROM profiles p
  WHERE p.id = _user_id;
END;
$$;


--
-- Name: get_profile_by_telegram(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_profile_by_telegram(_telegram_id bigint) RETURNS TABLE(id uuid, telegram_id bigint, username text, balance numeric, freebet_balance numeric, betting_freebet_balance numeric, wager_requirement numeric, wager_progress numeric, xp integer, level integer, is_vip boolean, is_banned boolean, is_muted boolean, total_wins integer, total_losses integer, public_id integer, referral_code text, gradient_color text, guaranteed_max_win boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.telegram_id, p.username, p.balance, p.freebet_balance,
         p.betting_freebet_balance, p.wager_requirement, p.wager_progress,
         p.xp, p.level, p.is_vip, p.is_banned, p.is_muted,
         p.total_wins, p.total_losses, p.public_id, p.referral_code,
         p.gradient_color, p.guaranteed_max_win, p.created_at
  FROM profiles p
  WHERE p.telegram_id = _telegram_id;
END;
$$;


--
-- Name: get_profile_by_telegram_id(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_profile_by_telegram_id(_telegram_id bigint) RETURNS TABLE(id uuid, telegram_id bigint, username text, avatar_url text, balance numeric, demo_balance numeric, freebet_balance numeric, betting_freebet_balance numeric, level integer, xp integer, is_vip boolean, is_banned boolean, is_muted boolean, gradient_color text, profile_background text, total_wins numeric, total_losses numeric, wager_progress numeric, wager_requirement numeric, public_id integer, email text, email_verified_at timestamp with time zone, referral_code text, referred_by uuid, created_at timestamp with time zone, guaranteed_max_win boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.telegram_id, p.username, p.avatar_url, p.balance, p.demo_balance,
    p.freebet_balance, p.betting_freebet_balance, p.level, p.xp, p.is_vip,
    p.is_banned, p.is_muted, p.gradient_color, p.profile_background,
    p.total_wins, p.total_losses, p.wager_progress, p.wager_requirement,
    p.public_id, p.email, p.email_verified_at, p.referral_code, p.referred_by,
    p.created_at, p.guaranteed_max_win
  FROM profiles p
  WHERE p.telegram_id = _telegram_id;
END;
$$;


--
-- Name: get_random_email_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_random_email_account() RETURNS TABLE(id uuid, email text, smtp_host text, smtp_port integer, smtp_user text, smtp_password text, display_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ea.id,
    ea.email,
    ea.smtp_host,
    ea.smtp_port,
    ea.smtp_user,
    ea.smtp_password,
    ea.display_name
  FROM email_accounts ea
  WHERE ea.is_active = true
  ORDER BY random()
  LIMIT 1;
END;
$$;


--
-- Name: get_session_game_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_session_game_number(p_session_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_game_number bigint;
BEGIN
  SELECT gh.game_number INTO v_game_number
  FROM public.game_history gh
  WHERE gh.game_session_id = p_session_id
  ORDER BY gh.created_at DESC
  LIMIT 1;
  
  RETURN v_game_number;
END;
$$;


--
-- Name: get_ticket_messages(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ticket_messages(_ticket_id uuid, _user_id uuid) RETURNS TABLE(id uuid, message text, is_admin boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _ticket_owner uuid;
BEGIN
  -- Проверяем, что пользователь владелец тикета или админ
  SELECT user_id INTO _ticket_owner FROM support_tickets WHERE id = _ticket_id;
  
  IF _ticket_owner != _user_id AND NOT has_role(_user_id, 'admin'::app_role) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT sm.id, sm.message, sm.is_admin, sm.created_at
  FROM support_messages sm
  WHERE sm.ticket_id = _ticket_id
  ORDER BY sm.created_at ASC;
END;
$$;


--
-- Name: get_top_winners_today(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_winners_today(_limit integer DEFAULT 3) RETURNS TABLE(user_id uuid, username text, is_vip boolean, gradient_color text, total_winnings numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    COALESCE(p.is_vip, false) as is_vip,
    p.gradient_color,
    SUM(gh.win_amount) as total_winnings
  FROM game_history gh
  JOIN profiles p ON gh.user_id = p.id
  WHERE gh.win_amount > 0
    AND gh.created_at >= CURRENT_DATE
    AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin')
  GROUP BY p.id, p.username, p.is_vip, p.gradient_color
  ORDER BY total_winnings DESC
  LIMIT _limit;
END;
$$;


--
-- Name: get_user_bets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_bets(_user_id uuid) RETURNS TABLE(id uuid, match_id uuid, bet_type text, bet_amount numeric, odds numeric, potential_win numeric, status text, is_freebet boolean, handicap_value numeric, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT ub.id, ub.match_id, ub.bet_type, ub.bet_amount, ub.odds,
         ub.potential_win, ub.status, ub.is_freebet, ub.handicap_value, ub.created_at
  FROM user_bets ub
  WHERE ub.user_id = _user_id
  ORDER BY ub.created_at DESC;
END;
$$;


--
-- Name: get_user_bonus_wheels(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_bonus_wheels(_user_id uuid) RETURNS TABLE(id uuid, is_used boolean, reward_type text, reward_amount numeric, reward_description text, created_at timestamp with time zone, used_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT bw.id, bw.is_used, bw.reward_type, bw.reward_amount, bw.reward_description, bw.created_at, bw.used_at
  FROM bonus_wheels bw
  WHERE bw.user_id = _user_id
  ORDER BY bw.created_at DESC;
END;
$$;


--
-- Name: get_user_buff_multiplier(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_buff_multiplier(_user_id uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_buff_type TEXT;
BEGIN
  SELECT buff_type INTO v_buff_type
  FROM user_buffs
  WHERE user_id = _user_id AND expires_at > now()
  ORDER BY 
    CASE buff_type WHEN 'x10' THEN 0 WHEN 'x5' THEN 1 WHEN 'x3' THEN 2 WHEN 'x2' THEN 3 WHEN 'x0.5' THEN 4 END
  LIMIT 1;

  IF v_buff_type = 'x10' THEN RETURN 10;
  ELSIF v_buff_type = 'x5' THEN RETURN 5;
  ELSIF v_buff_type = 'x3' THEN RETURN 3;
  ELSIF v_buff_type = 'x2' THEN RETURN 2;
  ELSIF v_buff_type = 'x0.5' THEN RETURN 0.5;
  ELSE RETURN 1;
  END IF;
END;
$$;


--
-- Name: get_user_daily_reward(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_daily_reward(_user_id uuid) RETURNS TABLE(id uuid, last_claimed_at timestamp with time zone, total_claimed integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT dr.id, dr.last_claimed_at, dr.total_claimed
  FROM daily_rewards dr
  WHERE dr.user_id = _user_id;
END;
$$;


--
-- Name: get_user_freespins(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_freespins(_user_id uuid) RETURNS TABLE(id uuid, freespins_count integer, freespin_bet_amount numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT uf.id, uf.freespins_count, uf.freespin_bet_amount
  FROM user_freespins uf
  WHERE uf.user_id = _user_id;
END;
$$;


--
-- Name: get_user_game_history(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_game_history(_user_id uuid, _limit integer DEFAULT 50) RETURNS TABLE(id uuid, game_name text, bet_amount numeric, win_amount numeric, multiplier numeric, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT gh.id, gh.game_name, gh.bet_amount, gh.win_amount, gh.multiplier, gh.created_at
  FROM game_history gh
  WHERE gh.user_id = _user_id
  ORDER BY gh.created_at DESC
  LIMIT _limit;
END;
$$;


--
-- Name: get_user_game_history_v2(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_game_history_v2(_user_id uuid, _limit integer DEFAULT 50) RETURNS TABLE(id uuid, game_name text, game_number bigint, bet_amount numeric, win_amount numeric, multiplier numeric, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gh.id,
    gh.game_name,
    gh.game_number,
    gh.bet_amount,
    gh.win_amount,
    gh.multiplier,
    gh.created_at
  FROM public.game_history gh
  WHERE gh.user_id = _user_id
  ORDER BY gh.created_at DESC
  LIMIT _limit;
END;
$$;


--
-- Name: get_user_inventory(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_inventory(_user_id uuid) RETURNS TABLE(id uuid, skin_id uuid, purchased_price numeric, purchased_at timestamp with time zone, skin_name text, skin_weapon text, skin_category text, skin_rarity text, skin_price numeric, skin_image_url text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT ui.id, ui.skin_id, ui.purchased_price, ui.purchased_at,
         s.name, s.weapon, s.category, s.rarity, s.price, s.image_url
  FROM user_inventory ui
  JOIN skins s ON s.id = ui.skin_id
  WHERE ui.user_id = _user_id
  ORDER BY ui.purchased_at DESC;
END;
$$;


--
-- Name: get_user_notifications(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_notifications(_user_id uuid) RETURNS TABLE(id uuid, message text, is_read boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT sn.id, sn.message, sn.is_read, sn.created_at
  FROM system_notifications sn
  WHERE sn.user_id = _user_id OR sn.user_id IS NULL
  ORDER BY sn.created_at DESC;
END;
$$;


--
-- Name: get_user_parlays(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_parlays(_user_id uuid) RETURNS TABLE(id uuid, total_amount numeric, total_odds numeric, potential_win numeric, status text, is_freebet boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT pb.id, pb.total_amount, pb.total_odds, pb.potential_win,
         pb.status, pb.is_freebet, pb.created_at
  FROM parlay_bets pb
  WHERE pb.user_id = _user_id
  ORDER BY pb.created_at DESC;
END;
$$;


--
-- Name: get_user_registration_wheel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_registration_wheel(_user_id uuid) RETURNS TABLE(id uuid, reward_type text, reward_amount numeric, reward_description text, claimed_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT rw.id, rw.reward_type, rw.reward_amount, rw.reward_description, rw.claimed_at
  FROM registration_wheel rw
  WHERE rw.user_id = _user_id;
END;
$$;


--
-- Name: get_user_support_tickets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_support_tickets(_user_id uuid) RETURNS TABLE(id uuid, subject text, status text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT st.id, st.subject, st.status, st.created_at, st.updated_at
  FROM support_tickets st
  WHERE st.user_id = _user_id
  ORDER BY st.updated_at DESC;
END;
$$;


--
-- Name: get_user_tasks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_tasks(_user_id uuid) RETURNS TABLE(id uuid, title text, description text, task_type text, target_value numeric, target_game text, reward_type text, reward_amount numeric, buff_duration_hours integer, is_daily boolean, progress numeric, is_completed boolean, can_claim boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.description,
    t.task_type,
    t.target_value,
    t.target_game,
    t.reward_type,
    t.reward_amount,
    t.buff_duration_hours,
    t.is_daily,
    COALESCE(utp.progress, 0) as progress,
    COALESCE(utp.is_completed, false) as is_completed,
    (COALESCE(utp.progress, 0) >= t.target_value AND COALESCE(utp.is_completed, false) = false) as can_claim
  FROM tasks t
  LEFT JOIN user_task_progress utp ON utp.task_id = t.id AND utp.user_id = _user_id
  WHERE t.is_active = true
  ORDER BY t.sort_order, t.created_at;
END;
$$;


--
-- Name: get_user_transactions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_transactions(_user_id uuid) RETURNS TABLE(id uuid, amount numeric, type text, description text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.amount, t.type, t.description, t.created_at
  FROM transactions t
  WHERE t.user_id = _user_id
  ORDER BY t.created_at DESC;
END;
$$;


--
-- Name: get_user_withdrawals(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_withdrawals(_user_id uuid) RETURNS TABLE(id uuid, amount numeric, payment_details text, comment text, status text, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT wr.id, wr.amount, wr.payment_details, wr.comment, wr.status, wr.created_at, wr.updated_at
  FROM withdrawal_requests wr
  WHERE wr.user_id = _user_id
  ORDER BY wr.created_at DESC;
END;
$$;


--
-- Name: give_demo_balance(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.give_demo_balance(_admin_id uuid, _target_user_id uuid, _amount numeric) RETURNS TABLE(success boolean, message text, amount numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if admin
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN QUERY SELECT false, 'Нет прав администратора'::text, 0::numeric;
    RETURN;
  END IF;

  -- Update demo balance
  UPDATE profiles
  SET demo_balance = COALESCE(demo_balance, 0) + _amount
  WHERE id = _target_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Пользователь не найден'::text, 0::numeric;
    RETURN;
  END IF;

  -- Log action
  INSERT INTO action_logs (user_id, action_type, action_data)
  VALUES (_admin_id, 'give_demo_balance', jsonb_build_object(
    'target_user_id', _target_user_id,
    'amount', _amount
  ));

  RETURN QUERY SELECT true, ('Выдано ' || _amount || '₽ демо баланса')::text, _amount;
END;
$$;


--
-- Name: guess_hilo(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guess_hilo(_session_id uuid, _user_id uuid, _guess text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_current_card INTEGER;
  v_next_card INTEGER;
  v_streak INTEGER;
  v_multiplier NUMERIC;
  v_correct BOOLEAN;
  v_history JSONB;
  v_nonce INTEGER;
BEGIN
  IF NOT check_rate_limit(_user_id, 'hilo_guess', 300) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Слишком быстро');
  END IF;
  
  SELECT * INTO v_session FROM game_sessions
  WHERE id = _session_id AND user_id = _user_id AND status = 'active' FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  v_current_card := (v_session.game_state->>'current_card')::int;
  v_streak := COALESCE((v_session.game_state->>'streak')::int, 0);
  v_multiplier := COALESCE((v_session.game_state->>'multiplier')::numeric, 1.00);
  v_history := COALESCE(v_session.game_state->'history', '[]'::jsonb);
  
  -- Генерируем следующую карту
  v_nonce := v_streak + 1;
  v_next_card := 2 + (('x' || substring(hash_seed(v_session.server_seed || v_nonce::text) from 1 for 8))::bit(32)::int % 13);
  
  -- Проверяем угадал ли
  IF _guess = 'high' THEN
    v_correct := v_next_card > v_current_card;
  ELSE
    v_correct := v_next_card < v_current_card;
  END IF;
  
  -- Если карты равны - ничья, продолжаем
  IF v_next_card = v_current_card THEN
    v_history := v_history || to_jsonb(v_next_card);
    UPDATE game_sessions SET game_state = v_session.game_state || 
      jsonb_build_object('current_card', v_next_card, 'history', v_history), nonce = v_nonce
    WHERE id = _session_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'result', 'draw',
      'next_card', v_next_card,
      'multiplier', v_multiplier
    );
  END IF;
  
  IF NOT v_correct THEN
    -- Проигрыш
    UPDATE game_sessions SET 
      status = 'completed',
      win_amount = 0,
      nonce = v_nonce,
      result = jsonb_build_object('history', v_history || to_jsonb(v_next_card), 'lost_on', v_next_card),
      completed_at = now()
    WHERE id = _session_id;
    
    INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_session_id, nonce)
    VALUES (_user_id, 'hilo', v_session.bet_amount, 0, 0, _session_id, v_nonce);
    
    RETURN jsonb_build_object(
      'success', true,
      'result', 'lost',
      'next_card', v_next_card,
      'multiplier', 0
    );
  END IF;
  
  -- Выигрыш - увеличиваем стрик
  v_streak := v_streak + 1;
  v_multiplier := ROUND(v_multiplier * 1.9, 2);
  v_history := v_history || to_jsonb(v_next_card);
  
  UPDATE game_sessions SET game_state = v_session.game_state || 
    jsonb_build_object('current_card', v_next_card, 'streak', v_streak, 'multiplier', v_multiplier, 'history', v_history),
    nonce = v_nonce
  WHERE id = _session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'result', 'correct',
    'next_card', v_next_card,
    'streak', v_streak,
    'multiplier', v_multiplier,
    'potential_win', ROUND(v_session.bet_amount * v_multiplier, 2)
  );
END;
$$;


--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Создаем профиль для нового пользователя
  INSERT INTO public.profiles (id, telegram_id, username, balance)
  VALUES (
    NEW.id,
    0, -- временный telegram_id, можно обновить позже
    COALESCE(NEW.email, 'player' || floor(random() * 1000000)::text),
    0.00
  );
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Считаем количество существующих пользователей
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- Создаем профиль
  INSERT INTO public.profiles (id, username, balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    1000.00
  );
  
  -- Если это первый пользователь, делаем его админом
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role::text
  )
$$;


--
-- Name: hash_seed(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_seed(_seed text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN encode(digest(_seed, 'sha256'), 'hex');
END;
$$;


--
-- Name: invalidate_user_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invalidate_user_session(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.user_sessions 
  SET is_active = false 
  WHERE user_id = p_user_id;
END;
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id AND role = 'admin'
  );
END;
$$;


--
-- Name: is_email_verified(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_email_verified(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = _user_id 
    AND email_verified_at IS NOT NULL
  );
END;
$$;


--
-- Name: is_profile_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_profile_admin(_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _profile_id AND role = 'admin'
  )
$$;


--
-- Name: join_giveaway(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_giveaway(_user_id uuid, _giveaway_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_giveaway giveaways%ROWTYPE;
  v_user_balance numeric;
  v_user_level integer;
BEGIN
  -- Получаем розыгрыш
  SELECT * INTO v_giveaway FROM giveaways WHERE id = _giveaway_id;
  
  IF v_giveaway IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Розыгрыш не найден');
  END IF;
  
  IF v_giveaway.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Розыгрыш уже завершён');
  END IF;
  
  -- Проверяем, не закрыта ли регистрация
  IF v_giveaway.registration_ends_at IS NOT NULL AND v_giveaway.registration_ends_at < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Регистрация закрыта');
  END IF;
  
  -- Проверяем, не участвует ли уже
  IF EXISTS (SELECT 1 FROM giveaway_participants WHERE giveaway_id = _giveaway_id AND user_id = _user_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Вы уже участвуете');
  END IF;
  
  -- Получаем данные пользователя
  SELECT balance, level INTO v_user_balance, v_user_level FROM profiles WHERE id = _user_id;
  
  -- Проверяем условия участия
  IF v_giveaway.participation_type = 'level' AND v_user_level < v_giveaway.min_level THEN
    RETURN jsonb_build_object('success', false, 'message', 'Нужен уровень ' || v_giveaway.min_level);
  END IF;
  
  IF v_giveaway.participation_type = 'balance' THEN
    IF v_user_balance < v_giveaway.participation_cost THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;
    -- Списываем баланс
    UPDATE profiles SET balance = balance - v_giveaway.participation_cost WHERE id = _user_id;
  END IF;
  
  -- Добавляем участника
  INSERT INTO giveaway_participants (giveaway_id, user_id) VALUES (_giveaway_id, _user_id);
  
  RETURN jsonb_build_object('success', true, 'message', 'Вы участвуете в розыгрыше!');
END;
$$;


--
-- Name: lose_mines(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lose_mines(_user_id uuid, _bet_amount numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
  VALUES (_user_id, 'mines', _bet_amount, 0, 0);

  PERFORM add_user_xp(_user_id, GREATEST(1, FLOOR(_bet_amount / 10))::integer);

  RETURN jsonb_build_object('success', true);
END;
$$;


--
-- Name: make_first_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_first_admin() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Получаем ID первого зарегистрированного пользователя
  SELECT id INTO first_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  -- Если пользователь найден и у него нет роли admin
  IF first_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;


--
-- Name: mark_email_used(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_email_used(_email_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE email_accounts
  SET last_used_at = now(),
      use_count = use_count + 1
  WHERE id = _email_id;
END;
$$;


--
-- Name: normalize_game_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_game_name(_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE lower(coalesce(_name, ''))
    WHEN 'dogs-house' THEN 'dogs-house-slots'
    WHEN 'crypto-trading' THEN 'crypto'
    ELSE coalesce(_name, '')
  END;
$$;


--
-- Name: notify_all_admins(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_all_admins(_message text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  admin_id UUID;
BEGIN
  FOR admin_id IN 
    SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.system_notifications (user_id, message, is_read, created_at)
    VALUES (admin_id, _message, false, now());
  END LOOP;
END;
$$;


--
-- Name: notify_chat_reply(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_chat_reply() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _original_author_id UUID;
  _replier_username TEXT;
BEGIN
  -- Only process if this is a reply
  IF NEW.reply_to_id IS NOT NULL THEN
    -- Get the original message author
    SELECT user_id INTO _original_author_id
    FROM public.chat_messages
    WHERE id = NEW.reply_to_id;
    
    -- Don't notify if replying to own message
    IF _original_author_id IS NOT NULL AND _original_author_id != NEW.user_id THEN
      -- Get the replier's username
      SELECT username INTO _replier_username
      FROM public.profiles
      WHERE id = NEW.user_id;
      
      -- Create notification for the original author
      INSERT INTO public.system_notifications (user_id, message, is_read)
      VALUES (
        _original_author_id,
        '💬 ' || COALESCE(_replier_username, 'Игрок') || ' ответил на ваше сообщение в чате',
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_user_action(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_user_action(_user_id text, _message text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.system_notifications (user_id, message, is_read, created_at)
  VALUES (_user_id::uuid, _message, false, now());
END;
$$;


--
-- Name: on_bet_settled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_bet_settled() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'won' AND OLD.status = 'pending' THEN
    PERFORM notify_user_action(NEW.user_id::text, '✅ Ваша ставка выиграла! +' || NEW.potential_win::text || '₽');
  ELSIF NEW.status = 'lost' AND OLD.status = 'pending' THEN
    PERFORM notify_user_action(NEW.user_id::text, '❌ Ваша ставка проиграла: -' || NEW.bet_amount::text || '₽');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: on_bet_win_add_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_bet_win_add_xp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  xp_reward INTEGER;
BEGIN
  -- Only add XP if bet status changed to 'won'
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
    -- Calculate XP based on potential win (1 XP per 10 coins, min 1)
    xp_reward := GREATEST(1, FLOOR(NEW.potential_win / 10)::INTEGER);
    
    -- Add XP to user
    PERFORM add_user_xp(NEW.user_id, xp_reward);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: on_freebet_given(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_freebet_given() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (NEW.freebet_balance > OLD.freebet_balance) THEN
    PERFORM notify_user_action(NEW.id::text, 'Вы получили фрибет: ' || (NEW.freebet_balance - OLD.freebet_balance)::text || '₽');
  END IF;
  IF (NEW.betting_freebet_balance > OLD.betting_freebet_balance) THEN
    PERFORM notify_user_action(NEW.id::text, 'Вы получили фрибет на ставки: ' || (NEW.betting_freebet_balance - OLD.betting_freebet_balance)::text || '₽');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: on_game_history_insert_update_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_game_history_insert_update_tasks() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Count as win when win_amount > bet_amount (net profit)
  IF NEW.win_amount > NEW.bet_amount THEN
    PERFORM public.update_task_progress(NEW.user_id, 'game_wins', NEW.game_name, 1);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: on_game_win_add_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_game_win_add_xp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  xp_reward INTEGER;
BEGIN
  IF NEW.win_amount > 0 THEN
    -- XP reward 1-12 for games (was 1-30)
    xp_reward := LEAST(12, GREATEST(1, FLOOR(NEW.win_amount / 10)::INTEGER));
    PERFORM add_user_xp(NEW.user_id, xp_reward);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: on_parlay_settled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_parlay_settled() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'won' AND OLD.status = 'pending' THEN
    PERFORM notify_user_action(NEW.user_id::text, '✅ Ваш экспресс выиграл! +' || NEW.potential_win::text || '₽');
  ELSIF NEW.status = 'lost' AND OLD.status = 'pending' THEN
    PERFORM notify_user_action(NEW.user_id::text, '❌ Ваш экспресс проиграл: -' || NEW.total_amount::text || '₽');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: on_parlay_win_add_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_parlay_win_add_xp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  xp_reward INTEGER;
BEGIN
  -- Only add XP if parlay status changed to 'won'
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
    -- Calculate XP based on potential win (1 XP per 10 coins, min 1)
    xp_reward := GREATEST(1, FLOOR(NEW.potential_win / 10)::INTEGER);
    
    -- Add XP to user
    PERFORM add_user_xp(NEW.user_id, xp_reward);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: on_support_ticket_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_support_ticket_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  username_val TEXT;
BEGIN
  SELECT username INTO username_val FROM profiles WHERE id = NEW.user_id;
  PERFORM notify_all_admins('🎫 Новый тикет: "' || NEW.subject || '" от ' || COALESCE(username_val, 'пользователя'));
  RETURN NEW;
END;
$$;


--
-- Name: on_vip_status_given(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_vip_status_given() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (NEW.is_vip = true AND (OLD.is_vip IS NULL OR OLD.is_vip = false)) THEN
    PERFORM notify_user_action(NEW.id::text, '⭐ Поздравляем! Вам присвоен VIP статус!');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: on_withdrawal_request_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_withdrawal_request_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  username_val TEXT;
BEGIN
  SELECT username INTO username_val FROM profiles WHERE id = NEW.user_id;
  PERFORM notify_all_admins('💰 Новая заявка на вывод: ' || NEW.amount::text || '₽ от ' || COALESCE(username_val, 'пользователя'));
  RETURN NEW;
END;
$$;


--
-- Name: on_withdrawal_status_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_withdrawal_status_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    PERFORM notify_user_action(NEW.user_id::text, '✅ Ваша заявка на вывод ' || NEW.amount::text || '₽ одобрена!');
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    PERFORM notify_user_action(NEW.user_id::text, '❌ Ваша заявка на вывод ' || NEW.amount::text || '₽ отклонена. Свяжитесь с поддержкой.');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: open_case(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_case(_user_id uuid, _case_type_id text, _use_freebet boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_case_price NUMERIC;
  v_balance NUMERIC;
  v_freebet_balance NUMERIC;
  v_random NUMERIC;
  v_cumulative NUMERIC := 0;
  v_winning_item RECORD;
  v_actual_skin RECORD;
  v_skin_id UUID;
BEGIN
  -- Получаем цену кейса
  SELECT price INTO v_case_price FROM case_types WHERE id = _case_type_id AND is_active = true;
  IF v_case_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Кейс не найден или недоступен');
  END IF;

  -- Проверяем баланс
  SELECT balance, freebet_balance INTO v_balance, v_freebet_balance FROM profiles WHERE id = _user_id;
  
  IF _use_freebet THEN
    IF v_freebet_balance < v_case_price THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
    END IF;
    UPDATE profiles SET freebet_balance = freebet_balance - v_case_price WHERE id = _user_id;
  ELSE
    IF v_balance < v_case_price THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;
    UPDATE profiles SET balance = balance - v_case_price WHERE id = _user_id;
  END IF;

  -- Определяем выигрыш по шансам
  v_random := random() * 100;
  
  FOR v_winning_item IN 
    SELECT * FROM case_items WHERE case_type_id = _case_type_id ORDER BY chance DESC
  LOOP
    v_cumulative := v_cumulative + v_winning_item.chance;
    IF v_random <= v_cumulative THEN
      EXIT;
    END IF;
  END LOOP;

  -- Если у case_item есть skin_id - используем его напрямую
  IF v_winning_item.skin_id IS NOT NULL THEN
    v_skin_id := v_winning_item.skin_id;
    SELECT * INTO v_actual_skin FROM skins WHERE id = v_skin_id;
  ELSE
    -- Ищем скин по имени и оружию
    SELECT * INTO v_actual_skin FROM skins 
    WHERE LOWER(name) = LOWER(v_winning_item.name)
    AND LOWER(weapon) = LOWER(v_winning_item.weapon)
    LIMIT 1;
    
    IF v_actual_skin IS NULL THEN
      -- Если не нашли точное совпадение - ищем по похожей цене
      SELECT * INTO v_actual_skin FROM skins 
      WHERE price BETWEEN v_winning_item.price * 0.9 AND v_winning_item.price * 1.1
      ORDER BY ABS(price - v_winning_item.price)
      LIMIT 1;
    END IF;
    
    v_skin_id := v_actual_skin.id;
  END IF;

  -- Добавляем скин в инвентарь с ПРАВИЛЬНОЙ ценой из таблицы skins
  IF v_skin_id IS NOT NULL AND v_actual_skin IS NOT NULL THEN
    INSERT INTO user_inventory (user_id, skin_id, purchased_price)
    VALUES (_user_id, v_skin_id, v_actual_skin.price);
  END IF;

  -- Логируем действие
  INSERT INTO action_logs (user_id, action_type, action_data)
  VALUES (_user_id, 'case_open', jsonb_build_object(
    'case_type', _case_type_id,
    'case_price', v_case_price,
    'won_item_name', v_winning_item.name,
    'won_item_weapon', v_winning_item.weapon,
    'actual_skin_name', v_actual_skin.name,
    'actual_skin_price', v_actual_skin.price,
    'use_freebet', _use_freebet,
    'skin_id', v_skin_id
  ));

  -- Возвращаем данные РЕАЛЬНОГО скина из таблицы skins
  RETURN jsonb_build_object(
    'success', true,
    'item', jsonb_build_object(
      'name', COALESCE(v_actual_skin.name, v_winning_item.name),
      'weapon', COALESCE(v_actual_skin.weapon, v_winning_item.weapon),
      'rarity', COALESCE(v_actual_skin.rarity, v_winning_item.rarity),
      'price', COALESCE(v_actual_skin.price, v_winning_item.price),
      'image_url', COALESCE(v_actual_skin.image_url, v_winning_item.image_url),
      'skin_id', v_skin_id
    )
  );
END;
$$;


--
-- Name: open_case(uuid, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_case(_user_id uuid, _case_type_id text, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_case RECORD;
  v_profile RECORD;
  v_item RECORD;
  v_random numeric;
  v_cumulative numeric := 0;
  v_is_win boolean;
BEGIN
  -- Получаем кейс
  SELECT * INTO v_case FROM case_types WHERE id = _case_type_id AND is_active = true;
  IF v_case IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Кейс не найден');
  END IF;
  
  -- Получаем профиль
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id FOR UPDATE;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Профиль не найден');
  END IF;
  
  -- Проверяем баланс
  IF _use_demo THEN
    IF COALESCE(v_profile.demo_balance, 0) < v_case.price THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо баланса');
    END IF;
    UPDATE profiles SET demo_balance = demo_balance - v_case.price WHERE id = _user_id;
  ELSIF _use_freebet THEN
    IF COALESCE(v_profile.freebet_balance, 0) < v_case.price THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
    END IF;
    UPDATE profiles SET 
      freebet_balance = freebet_balance - v_case.price,
      wager_progress = COALESCE(wager_progress, 0) + v_case.price
    WHERE id = _user_id;
  ELSE
    IF v_profile.balance < v_case.price THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;
    UPDATE profiles SET balance = balance - v_case.price WHERE id = _user_id;
  END IF;
  
  -- Выбираем случайный предмет
  v_random := random() * 100;
  FOR v_item IN 
    SELECT * FROM case_items WHERE case_type_id = _case_type_id ORDER BY chance DESC
  LOOP
    v_cumulative := v_cumulative + v_item.chance;
    IF v_random <= v_cumulative THEN
      EXIT;
    END IF;
  END LOOP;
  
  IF v_item IS NULL THEN
    SELECT * INTO v_item FROM case_items WHERE case_type_id = _case_type_id LIMIT 1;
  END IF;
  
  -- Определяем выигрыш или проигрыш
  v_is_win := v_item.price >= v_case.price;
  
  -- Добавляем скин в инвентарь
  IF v_item.skin_id IS NOT NULL THEN
    INSERT INTO user_inventory (user_id, skin_id, purchased_price, is_demo)
    VALUES (_user_id, v_item.skin_id, v_item.price, _use_demo);
  END IF;
  
  -- Записываем историю и статистику (если не демо)
  IF NOT _use_demo THEN
    INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
    VALUES (_user_id, 'cases', v_case.price, v_item.price, v_item.price / v_case.price);
    
    IF v_is_win THEN
      UPDATE profiles SET total_wins = COALESCE(total_wins, 0) + 1 WHERE id = _user_id;
    ELSE
      UPDATE profiles SET total_losses = COALESCE(total_losses, 0) + 1 WHERE id = _user_id;
    END IF;
    
    -- XP
    PERFORM add_user_xp(_user_id, GREATEST(1, FLOOR(v_case.price / 10)));
  END IF;
  
  -- Проверяем отыгрыш фрибета
  IF _use_freebet THEN
    SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
    IF v_profile.wager_progress >= v_profile.wager_requirement AND v_profile.freebet_balance > 0 THEN
      UPDATE profiles SET 
        balance = balance + freebet_balance,
        freebet_balance = 0,
        wager_progress = 0,
        wager_requirement = 0
      WHERE id = _user_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'item', jsonb_build_object(
      'id', v_item.id,
      'name', v_item.name,
      'weapon', v_item.weapon,
      'rarity', v_item.rarity,
      'price', v_item.price,
      'image_url', v_item.image_url,
      'skin_id', v_item.skin_id
    )
  );
END;
$$;


--
-- Name: place_bet(uuid, uuid, text, numeric, numeric, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_bet(_user_id uuid, _match_id uuid, _bet_type text, _bet_amount numeric, _odds numeric, _use_betting_freebet boolean DEFAULT false) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_balance NUMERIC;
  freebet_balance NUMERIC;
  match_status TEXT;
  potential_win NUMERIC;
BEGIN
  SELECT status INTO match_status
  FROM public.matches
  WHERE id = _match_id;

  IF match_status != 'upcoming' THEN
    RETURN QUERY SELECT FALSE, 'Ставки на этот матч закрыты'::TEXT;
    RETURN;
  END IF;

  IF _use_betting_freebet THEN
    SELECT betting_freebet_balance INTO freebet_balance
    FROM public.profiles
    WHERE id = _user_id;

    IF freebet_balance IS NULL OR freebet_balance < _bet_amount THEN
      RETURN QUERY SELECT FALSE, 'Недостаточно фрибета для ставок'::TEXT;
      RETURN;
    END IF;

    potential_win := (_bet_amount * _odds) / 2;

    UPDATE public.profiles
    SET betting_freebet_balance = betting_freebet_balance - _bet_amount
    WHERE id = _user_id;
  ELSE
    SELECT balance INTO user_balance
    FROM public.profiles
    WHERE id = _user_id;

    IF user_balance < _bet_amount THEN
      RETURN QUERY SELECT FALSE, 'Недостаточно средств'::TEXT;
      RETURN;
    END IF;

    potential_win := _bet_amount * _odds;

    PERFORM public.update_balance(_user_id, -_bet_amount);
  END IF;

  -- Создаем ставку с флагом is_freebet
  INSERT INTO public.user_bets (user_id, match_id, bet_type, bet_amount, odds, potential_win, is_freebet)
  VALUES (_user_id, _match_id, _bet_type, _bet_amount, _odds, potential_win, _use_betting_freebet);

  IF _use_betting_freebet THEN
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (_user_id, -_bet_amount, 'betting_freebet_bet', 'Ставка фрибетом для ставок');
  ELSE
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (_user_id, -_bet_amount, 'bet', 'Ставка на матч');
  END IF;

  RETURN QUERY SELECT TRUE, 'Ставка принята!'::TEXT;
END;
$$;


--
-- Name: place_bet(uuid, uuid, text, numeric, numeric, boolean, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_bet(_user_id uuid, _match_id uuid, _bet_type text, _bet_amount numeric, _odds numeric, _use_betting_freebet boolean DEFAULT false, _handicap_value numeric DEFAULT NULL::numeric) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_balance NUMERIC;
  freebet_balance NUMERIC;
  match_record RECORD;
  potential_win NUMERIC;
  is_map_bet BOOLEAN;
  map_betting_allowed BOOLEAN;
BEGIN
  SELECT * INTO match_record
  FROM public.matches
  WHERE id = _match_id;

  -- Check if this is a map bet
  is_map_bet := _bet_type LIKE 'map1_%' OR _bet_type LIKE 'map2_%' OR _bet_type LIKE 'map3_%';

  IF match_record.status = 'finished' THEN
    RETURN QUERY SELECT FALSE, 'Матч уже завершен'::TEXT;
    RETURN;
  END IF;

  IF match_record.status = 'live' THEN
    -- For live matches, only allow map bets if that map's betting is open
    IF NOT is_map_bet THEN
      RETURN QUERY SELECT FALSE, 'Ставки на основной исход закрыты в лайве'::TEXT;
      RETURN;
    END IF;
    
    -- Check specific map betting status
    map_betting_allowed := FALSE;
    IF _bet_type LIKE 'map1_%' AND NOT COALESCE(match_record.map1_betting_closed, false) THEN
      map_betting_allowed := TRUE;
    ELSIF _bet_type LIKE 'map2_%' AND NOT COALESCE(match_record.map2_betting_closed, false) THEN
      map_betting_allowed := TRUE;
    ELSIF _bet_type LIKE 'map3_%' AND NOT COALESCE(match_record.map3_betting_closed, false) THEN
      map_betting_allowed := TRUE;
    END IF;
    
    IF NOT map_betting_allowed THEN
      RETURN QUERY SELECT FALSE, 'Ставки на эту карту закрыты'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF _use_betting_freebet THEN
    SELECT betting_freebet_balance INTO freebet_balance
    FROM public.profiles
    WHERE id = _user_id;

    IF freebet_balance IS NULL OR freebet_balance < _bet_amount THEN
      RETURN QUERY SELECT FALSE, 'Недостаточно фрибета для ставок'::TEXT;
      RETURN;
    END IF;

    potential_win := (_bet_amount * _odds) / 2;

    UPDATE public.profiles
    SET betting_freebet_balance = betting_freebet_balance - _bet_amount
    WHERE id = _user_id;
  ELSE
    SELECT balance INTO user_balance
    FROM public.profiles
    WHERE id = _user_id;

    IF user_balance < _bet_amount THEN
      RETURN QUERY SELECT FALSE, 'Недостаточно средств'::TEXT;
      RETURN;
    END IF;

    potential_win := _bet_amount * _odds;

    PERFORM public.update_balance(_user_id, -_bet_amount);
  END IF;

  INSERT INTO public.user_bets (user_id, match_id, bet_type, bet_amount, odds, potential_win, is_freebet, handicap_value)
  VALUES (_user_id, _match_id, _bet_type, _bet_amount, _odds, potential_win, _use_betting_freebet, _handicap_value);

  IF _use_betting_freebet THEN
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (_user_id, -_bet_amount, 'betting_freebet_bet', 'Ставка фрибетом для ставок');
  ELSE
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (_user_id, -_bet_amount, 'bet', 'Ставка на матч');
  END IF;

  RETURN QUERY SELECT TRUE, 'Ставка принята!'::TEXT;
END;
$$;


--
-- Name: place_crash_bet(uuid, uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_crash_bet(_user_id uuid, _round_id uuid, _bet_amount numeric, _auto_cashout numeric) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_balance NUMERIC;
  round_status TEXT;
BEGIN
  -- Check balance
  SELECT balance INTO user_balance
  FROM public.profiles
  WHERE id = _user_id;

  IF user_balance < _bet_amount THEN
    RETURN QUERY SELECT FALSE, 'Недостаточно средств'::TEXT;
    RETURN;
  END IF;

  -- Check round status (allow betting on pending rounds)
  SELECT status INTO round_status
  FROM public.crash_rounds
  WHERE id = _round_id;

  IF round_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Раунд не найден'::TEXT;
    RETURN;
  END IF;

  IF round_status NOT IN ('pending', 'betting') THEN
    RETURN QUERY SELECT FALSE, 'Прием ставок закрыт'::TEXT;
    RETURN;
  END IF;

  -- Check if user already has a bet in this round
  IF EXISTS (SELECT 1 FROM crash_bets WHERE user_id = _user_id AND round_id = _round_id) THEN
    RETURN QUERY SELECT FALSE, 'Вы уже сделали ставку в этом раунде'::TEXT;
    RETURN;
  END IF;

  -- Deduct balance
  UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;

  -- Create bet with pending status
  INSERT INTO public.crash_bets (user_id, round_id, bet_amount, auto_cashout, status)
  VALUES (_user_id, _round_id, _bet_amount, _auto_cashout, 'pending');

  -- Add transaction
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (_user_id, -_bet_amount, 'crash_bet', 'Ставка в Crash');

  RETURN QUERY SELECT TRUE, 'Ставка принята!'::TEXT;
END;
$$;


--
-- Name: place_parlay_bet(uuid, numeric, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_parlay_bet(_user_id uuid, _bet_amount numeric, _bet_items jsonb, _use_betting_freebet boolean DEFAULT false) RETURNS TABLE(success boolean, message text, parlay_bet_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_balance NUMERIC;
  freebet_balance NUMERIC;
  total_odds NUMERIC := 1;
  potential_win NUMERIC;
  new_parlay_id UUID;
  bet_item JSONB;
BEGIN
  IF _use_betting_freebet THEN
    SELECT betting_freebet_balance INTO freebet_balance
    FROM public.profiles
    WHERE id = _user_id;

    IF freebet_balance IS NULL OR freebet_balance < _bet_amount THEN
      RETURN QUERY SELECT FALSE, 'Недостаточно фрибета для ставок'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  ELSE
    SELECT balance INTO user_balance
    FROM public.profiles
    WHERE id = _user_id;

    IF user_balance < _bet_amount THEN
      RETURN QUERY SELECT FALSE, 'Недостаточно средств'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  FOR bet_item IN SELECT * FROM jsonb_array_elements(_bet_items)
  LOOP
    total_odds := total_odds * (bet_item->>'odds')::NUMERIC;
  END LOOP;

  -- Check coefficient limit for freebet
  IF _use_betting_freebet AND total_odds > 10 THEN
    RETURN QUERY SELECT FALSE, 'Максимальный коэффициент для ставок фрибетом: 10'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF _use_betting_freebet THEN
    potential_win := (_bet_amount * total_odds) / 2;

    UPDATE public.profiles
    SET betting_freebet_balance = betting_freebet_balance - _bet_amount
    WHERE id = _user_id;
  ELSE
    potential_win := _bet_amount * total_odds;

    PERFORM public.update_balance(_user_id, -_bet_amount);
  END IF;

  INSERT INTO public.parlay_bets (user_id, total_amount, total_odds, potential_win, is_freebet)
  VALUES (_user_id, _bet_amount, total_odds, potential_win, _use_betting_freebet)
  RETURNING id INTO new_parlay_id;

  FOR bet_item IN SELECT * FROM jsonb_array_elements(_bet_items)
  LOOP
    INSERT INTO public.parlay_bet_items (parlay_bet_id, match_id, bet_type, odds)
    VALUES (
      new_parlay_id,
      (bet_item->>'match_id')::UUID,
      bet_item->>'bet_type',
      (bet_item->>'odds')::NUMERIC
    );
  END LOOP;

  IF _use_betting_freebet THEN
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (_user_id, -_bet_amount, 'betting_freebet_parlay', 'Экспресс-ставка фрибетом для ставок');
  ELSE
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (_user_id, -_bet_amount, 'parlay_bet', 'Экспресс-ставка');
  END IF;

  RETURN QUERY SELECT TRUE, 'Экспресс-ставка принята!'::TEXT, new_parlay_id;
END;
$$;


--
-- Name: play_balloon(uuid, numeric, text, uuid, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_balloon(_user_id uuid, _bet_amount numeric, _action text, _session_id uuid DEFAULT NULL::uuid, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_session game_sessions%ROWTYPE;
  v_server_seed TEXT;
  v_seed_hash TEXT;
  v_game_number BIGINT;
  v_multiplier NUMERIC;
  v_pop_chance NUMERIC;
  v_popped BOOLEAN;
  v_win_amount NUMERIC;
  v_current_multiplier NUMERIC;
  v_balance_field TEXT;
BEGIN
  -- Check email verification
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile.email_verified_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Подтвердите email для игры');
  END IF;

  -- Determine balance field
  IF _use_demo THEN
    v_balance_field := 'demo_balance';
  ELSIF _use_freebet THEN
    v_balance_field := 'freebet_balance';
  ELSE
    v_balance_field := 'balance';
  END IF;

  IF _action = 'start' THEN
    -- Check balance
    IF _use_demo THEN
      IF v_profile.demo_balance < _bet_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо баланса');
      END IF;
    ELSIF _use_freebet THEN
      IF v_profile.freebet_balance < _bet_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
      END IF;
    ELSE
      IF v_profile.balance < _bet_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
      END IF;
    END IF;

    -- Generate server seed and hash
    v_server_seed := encode(gen_random_bytes(32), 'hex');
    v_seed_hash := encode(sha256(v_server_seed::bytea), 'hex');
    v_game_number := nextval('public.game_number_seq');

    -- Deduct bet
    IF _use_demo THEN
      UPDATE profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
    ELSIF _use_freebet THEN
      UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
    ELSE
      UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;
    END IF;

    -- Create session
    INSERT INTO game_sessions (user_id, game_name, bet_amount, server_seed, status, game_state, is_demo, is_freebet)
    VALUES (_user_id, 'balloon', _bet_amount, v_server_seed, 'active', 
            jsonb_build_object('multiplier', 1.0, 'pumps', 0, 'game_number', v_game_number), 
            _use_demo, _use_freebet)
    RETURNING * INTO v_session;

    RETURN jsonb_build_object(
      'success', true,
      'session_id', v_session.id,
      'multiplier', 1.0,
      'game_number', v_game_number,
      'seed_hash', v_seed_hash
    );

  ELSIF _action = 'pump' THEN
    -- Get session
    SELECT * INTO v_session FROM game_sessions WHERE id = _session_id AND user_id = _user_id AND status = 'active';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Сессия не найдена');
    END IF;

    v_current_multiplier := COALESCE((v_session.game_state->>'multiplier')::NUMERIC, 1.0);
    v_game_number := COALESCE((v_session.game_state->>'game_number')::BIGINT, 0);
    v_seed_hash := encode(sha256(v_session.server_seed::bytea), 'hex');

    -- Calculate pop chance (increases with multiplier) - ~10% house edge
    v_pop_chance := 0.08 + (v_current_multiplier - 1.0) * 0.03;
    IF v_pop_chance > 0.5 THEN v_pop_chance := 0.5; END IF;

    -- Check if popped
    v_popped := random() < v_pop_chance;

    IF v_popped THEN
      -- Update session as completed with loss
      UPDATE game_sessions 
      SET status = 'completed', 
          completed_at = now(),
          win_amount = 0,
          result = jsonb_build_object('popped', true, 'multiplier', v_current_multiplier)
      WHERE id = _session_id;

      -- Record in game history
      INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, server_seed_hash, game_session_id, game_number)
      VALUES (_user_id, 'balloon', v_session.bet_amount, 0, v_current_multiplier, v_seed_hash, _session_id, v_game_number);

      RETURN jsonb_build_object(
        'success', true,
        'popped', true,
        'multiplier', v_current_multiplier,
        'win_amount', 0,
        'game_number', v_game_number,
        'seed_hash', v_seed_hash
      );
    ELSE
      -- Increase multiplier
      v_multiplier := v_current_multiplier + 0.15 + (random() * 0.1);
      
      UPDATE game_sessions
      SET game_state = jsonb_build_object('multiplier', v_multiplier, 'pumps', COALESCE((game_state->>'pumps')::INT, 0) + 1, 'game_number', v_game_number)
      WHERE id = _session_id;

      RETURN jsonb_build_object(
        'success', true,
        'popped', false,
        'multiplier', v_multiplier,
        'game_number', v_game_number,
        'seed_hash', v_seed_hash
      );
    END IF;

  ELSIF _action = 'cashout' THEN
    -- Get session
    SELECT * INTO v_session FROM game_sessions WHERE id = _session_id AND user_id = _user_id AND status = 'active';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Сессия не найдена');
    END IF;

    v_current_multiplier := COALESCE((v_session.game_state->>'multiplier')::NUMERIC, 1.0);
    v_game_number := COALESCE((v_session.game_state->>'game_number')::BIGINT, 0);
    v_win_amount := v_session.bet_amount * v_current_multiplier;
    v_seed_hash := encode(sha256(v_session.server_seed::bytea), 'hex');

    -- Credit winnings
    IF v_session.is_demo THEN
      UPDATE profiles SET demo_balance = demo_balance + v_win_amount WHERE id = _user_id;
    ELSIF v_session.is_freebet THEN
      UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
    ELSE
      UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
    END IF;

    -- Update session
    UPDATE game_sessions 
    SET status = 'completed', 
        completed_at = now(),
        win_amount = v_win_amount,
        result = jsonb_build_object('cashed_out', true, 'multiplier', v_current_multiplier)
    WHERE id = _session_id;

    -- Record in game history
    INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, server_seed_hash, game_session_id, game_number)
    VALUES (_user_id, 'balloon', v_session.bet_amount, v_win_amount, v_current_multiplier, v_seed_hash, _session_id, v_game_number);

    -- Add XP
    UPDATE profiles SET xp = xp + FLOOR(v_session.bet_amount / 10) WHERE id = _user_id;

    RETURN jsonb_build_object(
      'success', true,
      'win_amount', v_win_amount,
      'multiplier', v_current_multiplier,
      'game_number', v_game_number,
      'seed_hash', v_seed_hash
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'message', 'Неизвестное действие');
END;
$$;


--
-- Name: play_crypto_trading(uuid, numeric, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_crypto_trading(_user_id uuid, _bet_amount numeric, _bet_type text, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile RECORD;
  v_outcome TEXT;
  v_won BOOLEAN := FALSE;
  v_multiplier NUMERIC := 0;
  v_win_amount NUMERIC := 0;
  v_server_seed TEXT;
  v_game_number BIGINT;
  v_rand NUMERIC;
BEGIN
  IF NOT _use_demo THEN
    SELECT email_verified_at INTO v_profile FROM public.profiles WHERE id = _user_id;
    IF v_profile.email_verified_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Подтвердите email для игры');
    END IF;
  END IF;
  
  SELECT * INTO v_profile FROM public.profiles WHERE id = _user_id;
  
  IF _use_demo THEN
    IF v_profile.demo_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо баланса');
    END IF;
  ELSIF _use_freebet THEN
    IF COALESCE(v_profile.freebet_balance, 0) < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
    END IF;
  ELSE
    IF v_profile.balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;
  END IF;
  
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_rand := random();
  
  IF v_rand < 0.05 THEN
    v_outcome := 'flat';
  ELSIF v_rand < 0.525 THEN
    v_outcome := 'up';
  ELSE
    v_outcome := 'down';
  END IF;
  
  IF _bet_type = 'flat' THEN
    v_won := (v_outcome = 'flat');
    v_multiplier := CASE WHEN v_won THEN 14 ELSE 0 END;
  ELSIF _bet_type = 'long' THEN
    v_won := (v_outcome = 'up');
    v_multiplier := CASE WHEN v_won THEN 2 ELSE 0 END;
  ELSIF _bet_type = 'short' THEN
    v_won := (v_outcome = 'down');
    v_multiplier := CASE WHEN v_won THEN 2 ELSE 0 END;
  END IF;
  
  v_win_amount := CASE WHEN v_won THEN _bet_amount * v_multiplier ELSE 0 END;
  
  IF _use_demo THEN
    UPDATE public.profiles SET demo_balance = demo_balance - _bet_amount + v_win_amount WHERE id = _user_id;
  ELSIF _use_freebet THEN
    UPDATE public.profiles SET freebet_balance = freebet_balance - _bet_amount + v_win_amount WHERE id = _user_id;
    IF v_won THEN
      UPDATE public.profiles SET wager_progress = COALESCE(wager_progress, 0) + v_win_amount WHERE id = _user_id;
    END IF;
  ELSE
    UPDATE public.profiles SET balance = balance - _bet_amount + v_win_amount WHERE id = _user_id;
  END IF;
  
  v_game_number := nextval('public.game_number_seq');
  
  INSERT INTO public.game_history (user_id, game_name, bet_amount, win_amount, multiplier, server_seed_hash, game_number)
  VALUES (_user_id, 'crypto', _bet_amount, v_win_amount, v_multiplier, encode(sha256(v_server_seed::bytea), 'hex'), v_game_number);
  
  PERFORM public.update_game_stats(_user_id, v_won);
  IF v_won THEN
    PERFORM public.add_user_xp(_user_id, GREATEST(1, floor(v_win_amount / 10)::INTEGER));
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'outcome', v_outcome,
    'won', v_won,
    'multiplier', v_multiplier,
    'win_amount', v_win_amount,
    'game_number', v_game_number,
    'seed_hash', encode(sha256(v_server_seed::bytea), 'hex')
  );
END;
$$;


--
-- Name: play_dice_server(uuid, numeric, integer, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_dice_server(_user_id uuid, _bet_amount numeric, _target integer, _is_over boolean, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile RECORD;
  v_config RECORD;
  v_result INTEGER;
  v_won BOOLEAN := FALSE;
  v_multiplier NUMERIC;
  v_win_amount NUMERIC := 0;
  v_server_seed TEXT;
  v_game_number BIGINT;
BEGIN
  -- Rate limiting
  PERFORM enforce_rate_limit(_user_id, 'dice_roll', 500);

  -- Проверяем email верификацию (кроме демо)
  IF NOT _use_demo THEN
    SELECT email_verified_at INTO v_profile FROM profiles WHERE id = _user_id;
    IF v_profile.email_verified_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Подтвердите email для игры');
    END IF;
  END IF;
  
  -- Получаем профиль
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id FOR UPDATE;
  
  -- Проверяем баланс
  IF _use_demo THEN
    IF v_profile.demo_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо баланса');
    END IF;
  ELSIF _use_freebet THEN
    IF COALESCE(v_profile.freebet_balance, 0) < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
    END IF;
  ELSE
    IF v_profile.balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;
  END IF;
  
  -- Генерируем seed и номер игры
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_game_number := nextval('game_number_seq');
  
  -- Генерируем результат (0-100)
  v_result := floor(random() * 101)::INTEGER;
  
  -- Рассчитываем шанс и множитель
  IF _is_over THEN
    -- Шанс = 100 - target
    v_multiplier := 99.0 / (100 - _target);
    v_won := v_result > _target;
  ELSE
    -- Шанс = target
    v_multiplier := 99.0 / _target;
    v_won := v_result < _target;
  END IF;
  
  -- Рассчитываем выигрыш с 10% house edge
  v_win_amount := CASE WHEN v_won THEN _bet_amount * v_multiplier * 0.90 ELSE 0 END;
  
  -- Обновляем баланс
  IF _use_demo THEN
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount + v_win_amount WHERE id = _user_id;
  ELSIF _use_freebet THEN
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount + v_win_amount WHERE id = _user_id;
  ELSE
    UPDATE profiles SET balance = balance - _bet_amount + v_win_amount WHERE id = _user_id;
  END IF;
  
  -- Добавляем XP
  PERFORM add_user_xp(_user_id, _bet_amount * 0.1);
  
  -- Записываем в историю
  INSERT INTO game_history (user_id, game_name, bet_amount, multiplier, win_amount, game_number, server_seed_hash)
  VALUES (_user_id, 'dice', _bet_amount, v_multiplier, v_win_amount, v_game_number, encode(digest(v_server_seed, 'sha256'), 'hex'));
  
  RETURN jsonb_build_object(
    'success', true,
    'result', v_result,
    'won', v_won,
    'multiplier', v_multiplier,
    'win_amount', v_win_amount,
    'game_number', v_game_number,
    'seed_hash', encode(digest(v_server_seed, 'sha256'), 'hex')
  );
END;
$$;


--
-- Name: play_dice_server(uuid, numeric, integer, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_dice_server(_user_id uuid, _bet_amount numeric, _target integer, _prediction text, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile RECORD;
  v_config RECORD;
  v_dice_result INTEGER;
  v_won BOOLEAN;
  v_multiplier NUMERIC;
  v_win_amount NUMERIC;
  v_server_seed TEXT;
  v_seed_hash TEXT;
  v_game_number BIGINT;
  v_balance_field TEXT;
  v_current_balance NUMERIC;
BEGIN
  -- Проверяем email верификацию (кроме демо)
  IF NOT _is_demo THEN
    SELECT email_verified_at INTO v_profile FROM profiles WHERE id = _user_id;
    IF v_profile.email_verified_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Подтвердите email для игры');
    END IF;
  END IF;

  -- Получаем профиль и баланс
  SELECT 
    p.balance, p.demo_balance, p.freebet_balance, p.guaranteed_max_win,
    p.wager_progress, p.wager_requirement
  INTO v_profile
  FROM profiles p WHERE p.id = _user_id FOR UPDATE;

  -- Определяем поле баланса
  IF _is_demo THEN
    v_balance_field := 'demo_balance';
    v_current_balance := v_profile.demo_balance;
  ELSIF _is_freebet THEN
    v_balance_field := 'freebet_balance';
    v_current_balance := v_profile.freebet_balance;
  ELSE
    v_balance_field := 'balance';
    v_current_balance := v_profile.balance;
  END IF;

  -- Проверяем ставку
  IF _bet_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Минимальная ставка 10₽');
  END IF;

  IF _bet_amount > v_current_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Недостаточно средств');
  END IF;

  -- Валидация target
  IF _target < 2 OR _target > 98 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Цель должна быть от 2 до 98');
  END IF;

  -- Валидация prediction
  IF _prediction NOT IN ('under', 'over') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Неверный тип ставки');
  END IF;

  -- Загружаем конфигурацию
  SELECT house_edge INTO v_config FROM dice_config LIMIT 1;
  IF NOT FOUND THEN
    v_config.house_edge := 0.10;
  END IF;

  -- Генерируем серверный сид и хэш (БЕЗ nonce - он не нужен для dice)
  v_server_seed := encode(extensions.gen_random_bytes(32), 'hex');
  v_seed_hash := encode(extensions.digest(v_server_seed, 'sha256'), 'hex');

  -- Получаем номер игры
  v_game_number := nextval('game_number_seq');

  -- Списываем ставку
  IF _is_demo THEN
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
  ELSIF _is_freebet THEN
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
  ELSE
    UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;
  END IF;

  -- Генерируем результат
  IF v_profile.guaranteed_max_win THEN
    IF _prediction = 'under' THEN
      v_dice_result := 1 + floor(random() * (_target - 2))::INTEGER;
      v_multiplier := (99.0 / (_target - 1)) * (1 - v_config.house_edge);
    ELSE
      v_dice_result := _target + 1 + floor(random() * (100 - _target - 1))::INTEGER;
      v_multiplier := (99.0 / (100 - _target)) * (1 - v_config.house_edge);
    END IF;
    v_won := TRUE;
    UPDATE profiles SET guaranteed_max_win = false WHERE id = _user_id;
  ELSE
    v_dice_result := 1 + floor(random() * 100)::INTEGER;
    
    IF _prediction = 'under' THEN
      v_won := v_dice_result < _target;
      v_multiplier := CASE WHEN v_won THEN (99.0 / (_target - 1)) * (1 - v_config.house_edge) ELSE 0 END;
    ELSE
      v_won := v_dice_result > _target;
      v_multiplier := CASE WHEN v_won THEN (99.0 / (100 - _target)) * (1 - v_config.house_edge) ELSE 0 END;
    END IF;
  END IF;

  -- Рассчитываем выигрыш
  v_win_amount := CASE WHEN v_won THEN _bet_amount * v_multiplier ELSE 0 END;

  -- Начисляем выигрыш
  IF v_won THEN
    IF _is_demo THEN
      UPDATE profiles SET demo_balance = demo_balance + v_win_amount WHERE id = _user_id;
    ELSIF _is_freebet THEN
      UPDATE profiles SET 
        balance = balance + v_win_amount,
        wager_progress = COALESCE(wager_progress, 0) + _bet_amount
      WHERE id = _user_id;
    ELSE
      UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
    END IF;
  ELSE
    IF _is_freebet THEN
      UPDATE profiles SET wager_progress = COALESCE(wager_progress, 0) + _bet_amount WHERE id = _user_id;
    END IF;
  END IF;

  -- Обновляем статистику
  IF NOT _is_demo THEN
    UPDATE profiles SET
      total_wins = COALESCE(total_wins, 0) + CASE WHEN v_won THEN 1 ELSE 0 END,
      total_losses = COALESCE(total_losses, 0) + CASE WHEN NOT v_won THEN 1 ELSE 0 END,
      xp = xp + GREATEST(1, floor(_bet_amount / 100))
    WHERE id = _user_id;
  END IF;

  -- Записываем в историю
  INSERT INTO game_history (user_id, game_name, game_number, bet_amount, win_amount, multiplier, server_seed_hash)
  VALUES (_user_id, 'dice', v_game_number, _bet_amount, v_win_amount, v_multiplier, v_seed_hash);

  RETURN jsonb_build_object(
    'success', true,
    'won', v_won,
    'dice_result', v_dice_result,
    'multiplier', ROUND(v_multiplier, 2),
    'win_amount', ROUND(v_win_amount, 2),
    'game_number', v_game_number,
    'seed_hash', v_seed_hash
  );
END;
$$;


--
-- Name: play_dogs_house(uuid, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_dogs_house(_user_id uuid, _bet_amount numeric, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile RECORD;
  v_freespins RECORD;
  v_is_freespin BOOLEAN := FALSE;
  v_actual_bet NUMERIC;
  v_balance_field TEXT;
  v_server_seed TEXT;
  v_game_number BIGINT;
  v_grid INTEGER[][];
  v_weights NUMERIC[];
  v_total_weight NUMERIC;
  v_random NUMERIC;
  v_symbol INTEGER;
  v_row INTEGER;
  v_col INTEGER;
  v_cumulative NUMERIC;
  v_total_win NUMERIC := 0;
  v_payout NUMERIC;
  v_bet_per_line NUMERIC;
  v_paylines INTEGER[][] := ARRAY[
    ARRAY[1,1,1,1,1],
    ARRAY[0,0,0,0,0],
    ARRAY[2,2,2,2,2],
    ARRAY[0,1,2,1,0],
    ARRAY[2,1,0,1,2],
    ARRAY[0,0,1,2,2],
    ARRAY[2,2,1,0,0],
    ARRAY[1,0,0,0,1],
    ARRAY[1,2,2,2,1],
    ARRAY[0,1,1,1,0],
    ARRAY[2,1,1,1,2],
    ARRAY[0,1,0,1,0],
    ARRAY[2,1,2,1,2],
    ARRAY[1,0,1,0,1],
    ARRAY[1,2,1,2,1],
    ARRAY[0,0,2,0,0],
    ARRAY[2,2,0,2,2],
    ARRAY[0,2,0,2,0],
    ARRAY[2,0,2,0,2],
    ARRAY[1,1,0,1,1]
  ];
  v_line INTEGER[];
  v_line_symbols INTEGER[];
  v_first_symbol INTEGER;
  v_match_count INTEGER;
  v_wild_multiplier INTEGER;
  v_scatter_count INTEGER := 0;
  v_bonus_spins INTEGER := 0;
  v_sticky_wilds JSONB := '[]'::jsonb;
  v_new_sticky_wilds JSONB := '[]'::jsonb;
  v_session RECORD;
  v_paytable NUMERIC[][] := ARRAY[
    ARRAY[0, 0, 5.0, 15.0, 37.5],      -- 1: ротвейлер
    ARRAY[0, 0, 3.75, 10.0, 25.0],    -- 2: мопс
    ARRAY[0, 0, 2.5, 7.5, 15.0],      -- 3: такса
    ARRAY[0, 0, 1.5, 5.0, 10.0],      -- 4: ши-тцу
    ARRAY[0, 0, 1.25, 3.75, 7.5],     -- 5: кость
    ARRAY[0, 0, 1.25, 3.75, 7.5],     -- 6: кость
    ARRAY[0, 0, 1.0, 2.5, 5.0],       -- 7: туз
    ARRAY[0, 0, 1.0, 2.5, 5.0],       -- 8: король
    ARRAY[0, 0, 0.5, 1.25, 2.5],      -- 9: дама
    ARRAY[0, 0, 0.5, 1.25, 2.5],      -- 10: валет
    ARRAY[0, 0, 0.5, 1.25, 2.5]       -- 11: десятка
  ]::NUMERIC[][];
BEGIN
  -- Rate limiting
  PERFORM enforce_rate_limit(_user_id, 'dogs_house_spin', 500);

  -- Получаем профиль
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Профиль не найден');
  END IF;

  -- Проверяем фриспины (специфичные для dogs house)
  SELECT * INTO v_freespins FROM user_freespins WHERE user_id = _user_id AND freespin_bet_amount IS NOT NULL;
  IF v_freespins IS NOT NULL AND v_freespins.freespins_count > 0 THEN
    v_is_freespin := TRUE;
    v_actual_bet := COALESCE(v_freespins.freespin_bet_amount, 10);
    
    -- Получаем sticky wilds из сессии
    SELECT game_state->'sticky_wilds' INTO v_sticky_wilds
    FROM game_sessions 
    WHERE user_id = _user_id AND game_name = 'dogs_house' AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;
    v_sticky_wilds := COALESCE(v_sticky_wilds, '[]'::jsonb);
  ELSE
    v_actual_bet := _bet_amount;
    
    IF v_actual_bet < 10 OR v_actual_bet > 100000 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Ставка от 10₽ до 100,000₽');
    END IF;
  END IF;

  v_bet_per_line := v_actual_bet / 20.0;

  -- Списываем баланс СРАЗУ если не фриспин
  IF NOT v_is_freespin THEN
    IF _use_demo THEN
      IF v_profile.demo_balance < v_actual_bet THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо средств');
      END IF;
      UPDATE profiles SET demo_balance = demo_balance - v_actual_bet WHERE id = _user_id;
      v_balance_field := 'demo_balance';
    ELSIF _use_freebet THEN
      IF COALESCE(v_profile.freebet_balance, 0) < v_actual_bet THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
      END IF;
      UPDATE profiles SET freebet_balance = freebet_balance - v_actual_bet WHERE id = _user_id;
      v_balance_field := 'freebet_balance';
    ELSE
      IF v_profile.balance < v_actual_bet THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
      END IF;
      UPDATE profiles SET balance = balance - v_actual_bet WHERE id = _user_id;
      v_balance_field := 'balance';
    END IF;
  ELSE
    UPDATE user_freespins SET freespins_count = freespins_count - 1 WHERE user_id = _user_id;
    v_balance_field := 'balance';
  END IF;

  -- Генерируем server_seed и game_number
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_game_number := nextval('game_number_seq');

  -- Веса символов для Dogs House (1-11 обычные, 20=wild, 21=wild2x, 22=wild3x, 30=bonus)
  -- Сбалансировано для ~90% RTP с частыми небольшими выигрышами
  IF v_is_freespin THEN
    v_weights := ARRAY[12.0, 14.0, 16.0, 18.0, 20.0, 20.0, 22.0, 22.0, 24.0, 24.0, 24.0];
  ELSE
    v_weights := ARRAY[10.0, 12.0, 14.0, 16.0, 18.0, 18.0, 20.0, 20.0, 22.0, 22.0, 22.0];
  END IF;
  
  v_total_weight := 0;
  FOR v_row IN 1..array_length(v_weights, 1) LOOP
    v_total_weight := v_total_weight + v_weights[v_row];
  END LOOP;

  -- Генерируем сетку 3x5
  v_grid := ARRAY[]::INTEGER[][];
  FOR v_row IN 1..3 LOOP
    v_grid := v_grid || ARRAY[ARRAY[]::INTEGER[]];
    FOR v_col IN 1..5 LOOP
      -- Проверяем sticky wilds
      IF v_is_freespin AND v_sticky_wilds ? ((v_row-1)::text || '-' || (v_col-1)::text) THEN
        v_symbol := (v_sticky_wilds->((v_row-1)::text || '-' || (v_col-1)::text))::integer;
        v_grid[v_row] := v_grid[v_row] || v_symbol;
        v_new_sticky_wilds := v_new_sticky_wilds || jsonb_build_object((v_row-1)::text || '-' || (v_col-1)::text, v_symbol);
      -- Шанс бонуса (только на барабанах 1, 3, 5)
      ELSIF (v_col = 1 OR v_col = 3 OR v_col = 5) AND NOT v_is_freespin AND random() < 0.015 THEN
        v_grid[v_row] := v_grid[v_row] || 30;
        v_scatter_count := v_scatter_count + 1;
      -- Шанс wild с множителем (только на барабанах 2, 3, 4)
      ELSIF (v_col >= 2 AND v_col <= 4) AND random() < (CASE WHEN v_is_freespin THEN 0.08 ELSE 0.03 END) THEN
        -- Wild с множителем 2x или 3x
        v_symbol := CASE WHEN random() < 0.6 THEN 21 ELSE 22 END;
        v_grid[v_row] := v_grid[v_row] || v_symbol;
        -- Во фриспинах становится sticky
        IF v_is_freespin THEN
          v_new_sticky_wilds := v_new_sticky_wilds || jsonb_build_object((v_row-1)::text || '-' || (v_col-1)::text, v_symbol);
        END IF;
      ELSE
        -- Обычный символ по весам
        v_random := random() * v_total_weight;
        v_cumulative := 0;
        v_symbol := 1;
        FOR v_row IN 1..array_length(v_weights, 1) LOOP
          v_cumulative := v_cumulative + v_weights[v_row];
          IF v_random < v_cumulative THEN
            v_symbol := v_row;
            EXIT;
          END IF;
        END LOOP;
        v_grid[v_row] := v_grid[v_row] || v_symbol;
      END IF;
    END LOOP;
  END LOOP;

  -- Проверяем выигрыши по линиям
  FOR v_row IN 1..20 LOOP
    v_line := v_paylines[v_row];
    v_line_symbols := ARRAY[]::INTEGER[];
    
    FOR v_col IN 1..5 LOOP
      v_line_symbols := v_line_symbols || v_grid[v_line[v_col] + 1][v_col];
    END LOOP;
    
    -- Находим первый не-wild символ
    v_first_symbol := NULL;
    FOR v_col IN 1..5 LOOP
      IF v_line_symbols[v_col] < 20 THEN
        v_first_symbol := v_line_symbols[v_col];
        EXIT;
      END IF;
    END LOOP;
    
    IF v_first_symbol IS NULL THEN
      -- Все wild - берём самый ценный
      v_first_symbol := 1;
    END IF;
    
    -- Считаем совпадения слева направо
    v_match_count := 0;
    v_wild_multiplier := 1;
    
    FOR v_col IN 1..5 LOOP
      v_symbol := v_line_symbols[v_col];
      IF v_symbol >= 20 AND v_symbol < 30 THEN
        -- Wild
        v_match_count := v_match_count + 1;
        IF v_symbol = 21 THEN v_wild_multiplier := v_wild_multiplier * 2;
        ELSIF v_symbol = 22 THEN v_wild_multiplier := v_wild_multiplier * 3;
        END IF;
      ELSIF v_symbol = v_first_symbol THEN
        v_match_count := v_match_count + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
    
    -- Выплата за линию
    IF v_match_count >= 3 THEN
      v_payout := v_paytable[v_first_symbol][v_match_count];
      IF v_payout > 0 THEN
        v_total_win := v_total_win + (v_bet_per_line * v_payout * v_wild_multiplier);
      END IF;
    END IF;
  END LOOP;

  -- Применяем 10% house edge
  v_total_win := v_total_win * 0.90;

  -- Бонус: 3+ scatter = фриспины
  IF NOT v_is_freespin AND v_scatter_count >= 3 THEN
    v_bonus_spins := CASE 
      WHEN v_scatter_count >= 5 THEN 15 
      WHEN v_scatter_count = 4 THEN 12 
      ELSE 10 
    END;
    
    INSERT INTO user_freespins (user_id, freespins_count, freespin_bet_amount)
    VALUES (_user_id, v_bonus_spins, v_actual_bet)
    ON CONFLICT (user_id) DO UPDATE SET 
      freespins_count = user_freespins.freespins_count + v_bonus_spins,
      freespin_bet_amount = v_actual_bet;
    
    -- Создаём сессию для sticky wilds
    INSERT INTO game_sessions (user_id, game_name, bet_amount, server_seed, status, game_state)
    VALUES (_user_id, 'dogs_house', v_actual_bet, v_server_seed, 'active', jsonb_build_object('sticky_wilds', '[]'::jsonb));
  END IF;

  -- Обновляем sticky wilds в сессии
  IF v_is_freespin THEN
    UPDATE game_sessions 
    SET game_state = jsonb_set(game_state, '{sticky_wilds}', v_new_sticky_wilds)
    WHERE user_id = _user_id AND game_name = 'dogs_house' AND status = 'active';
    
    -- Если фриспины закончились - закрываем сессию
    IF v_freespins.freespins_count <= 1 THEN
      UPDATE game_sessions SET status = 'completed' 
      WHERE user_id = _user_id AND game_name = 'dogs_house' AND status = 'active';
    END IF;
  END IF;

  -- Начисляем выигрыш
  IF v_total_win > 0 THEN
    IF v_balance_field = 'demo_balance' THEN
      UPDATE profiles SET demo_balance = demo_balance + v_total_win WHERE id = _user_id;
    ELSE
      UPDATE profiles SET balance = balance + v_total_win WHERE id = _user_id;
    END IF;
  END IF;

  -- Записываем в историю
  INSERT INTO game_history (
    user_id, game_name, bet_amount, win_amount, multiplier, 
    game_number, server_seed_hash
  ) VALUES (
    _user_id, 'dogs-house', v_actual_bet, v_total_win,
    CASE WHEN v_total_win > 0 THEN v_total_win / v_actual_bet ELSE 0 END,
    v_game_number, encode(sha256(v_server_seed::bytea), 'hex')
  );

  RETURN jsonb_build_object(
    'success', true,
    'grid', v_grid,
    'win_amount', v_total_win,
    'multiplier', CASE WHEN v_total_win > 0 THEN v_total_win / v_actual_bet ELSE 0 END,
    'bet_amount', v_actual_bet,
    'scatter_count', v_scatter_count,
    'bonus_spins', v_bonus_spins,
    'is_freespin', v_is_freespin,
    'sticky_wilds', v_new_sticky_wilds,
    'game_number', v_game_number,
    'seed_hash', encode(sha256(v_server_seed::bytea), 'hex')
  );
END;
$$;


--
-- Name: play_game(uuid, text, numeric, numeric, numeric, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_game(_user_id uuid, _game_name text, _bet_amount numeric, _win_amount numeric, _multiplier numeric DEFAULT 0, _use_freebet boolean DEFAULT false) RETURNS TABLE(success boolean, message text, new_balance numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_balance NUMERIC;
  current_freebet NUMERIC;
  net_change NUMERIC;
BEGIN
  -- Получаем текущие балансы
  SELECT balance, freebet_balance INTO current_balance, current_freebet
  FROM profiles WHERE id = _user_id;
  
  IF _use_freebet THEN
    -- Проверяем фрибет баланс
    IF current_freebet < _bet_amount THEN
      RETURN QUERY SELECT FALSE, 'Недостаточно фрибет баланса'::TEXT, current_freebet;
      RETURN;
    END IF;
    
    -- Вычисляем изменение (выигрыш - ставка для фрибета)
    net_change := _win_amount - _bet_amount;
    
    -- Обновляем фрибет баланс
    UPDATE profiles
    SET freebet_balance = freebet_balance + net_change
    WHERE id = _user_id;
    
    -- Обновляем прогресс отыгрыша если выиграли
    IF _win_amount > _bet_amount THEN
      PERFORM update_wager_progress(_user_id, _win_amount - _bet_amount);
    END IF;
    
    SELECT freebet_balance INTO current_freebet FROM profiles WHERE id = _user_id;
    
  ELSE
    -- Проверяем обычный баланс
    IF current_balance < _bet_amount THEN
      RETURN QUERY SELECT FALSE, 'Недостаточно средств'::TEXT, current_balance;
      RETURN;
    END IF;
    
    -- Вычисляем изменение
    net_change := _win_amount - _bet_amount;
    
    -- Обновляем баланс
    UPDATE profiles
    SET balance = balance + net_change
    WHERE id = _user_id;
    
    SELECT balance INTO current_balance FROM profiles WHERE id = _user_id;
  END IF;
  
  -- Записываем историю игры
  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
  VALUES (_user_id, _game_name, _bet_amount, _win_amount, _multiplier);
  
  -- Обновляем статистику
  PERFORM update_game_stats(_user_id, _win_amount > _bet_amount);
  
  -- Добавляем XP за выигрыш
  IF _win_amount > _bet_amount THEN
    PERFORM add_user_xp(_user_id, GREATEST(1, FLOOR(_win_amount / 10)::INTEGER));
  END IF;
  
  RETURN QUERY SELECT TRUE, 
    CASE WHEN _win_amount > _bet_amount THEN 'Победа!'::TEXT ELSE 'Проигрыш'::TEXT END,
    CASE WHEN _use_freebet THEN current_freebet ELSE current_balance END;
END;
$$;


--
-- Name: play_game(uuid, text, numeric, numeric, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_game(p_user_id uuid, p_game_name text, p_bet_amount numeric, p_win_amount numeric, p_multiplier numeric DEFAULT 0, p_is_freebet boolean DEFAULT false, p_is_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_balance NUMERIC;
  v_freebet_balance NUMERIC;
  v_demo_balance NUMERIC;
  v_wager_progress NUMERIC;
  v_wager_requirement NUMERIC;
  v_xp_gain INTEGER;
  v_current_xp INTEGER;
  v_current_level INTEGER;
BEGIN
  -- Проверяем верификацию email (кроме демо режима)
  IF NOT p_is_demo AND NOT is_email_verified(p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Подтвердите email в профиле для игры на реальные деньги', 'need_verification', true);
  END IF;

  -- Получаем текущие балансы
  SELECT balance, COALESCE(freebet_balance, 0), demo_balance, 
         COALESCE(wager_progress, 0), COALESCE(wager_requirement, 0),
         xp, level
  INTO v_balance, v_freebet_balance, v_demo_balance, v_wager_progress, v_wager_requirement,
       v_current_xp, v_current_level
  FROM profiles WHERE id = p_user_id;

  -- Проверяем баланс
  IF p_is_demo THEN
    IF v_demo_balance < p_bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно демо-баланса');
    END IF;
  ELSIF p_is_freebet THEN
    IF v_freebet_balance < p_bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно фрибет-баланса');
    END IF;
  ELSE
    IF v_balance < p_bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно средств');
    END IF;
  END IF;

  -- Обновляем баланс
  IF p_is_demo THEN
    UPDATE profiles 
    SET demo_balance = demo_balance - p_bet_amount + p_win_amount
    WHERE id = p_user_id;
  ELSIF p_is_freebet THEN
    UPDATE profiles 
    SET freebet_balance = freebet_balance - p_bet_amount,
        balance = balance + GREATEST(0, p_win_amount - p_bet_amount),
        wager_progress = LEAST(wager_progress + p_bet_amount, wager_requirement)
    WHERE id = p_user_id;
  ELSE
    UPDATE profiles 
    SET balance = balance - p_bet_amount + p_win_amount
    WHERE id = p_user_id;
  END IF;

  -- Начисляем XP за ставку (1 XP за каждые 10 рублей ставки, только для реальных ставок)
  IF NOT p_is_demo THEN
    v_xp_gain := GREATEST(1, FLOOR(p_bet_amount / 10));
    UPDATE profiles SET xp = xp + v_xp_gain WHERE id = p_user_id;
    
    -- Проверяем достижение нового уровня (каждые 1000 XP)
    IF (v_current_xp + v_xp_gain) >= (v_current_level * 1000) THEN
      UPDATE profiles SET level = level + 1 WHERE id = p_user_id;
    END IF;
  END IF;

  -- Записываем историю
  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
  VALUES (p_user_id, p_game_name, p_bet_amount, p_win_amount, p_multiplier);

  -- Обновляем статистику
  IF p_win_amount > 0 THEN
    UPDATE profiles SET total_wins = COALESCE(total_wins, 0) + 1 WHERE id = p_user_id;
  ELSE
    UPDATE profiles SET total_losses = COALESCE(total_losses, 0) + 1 WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'win_amount', p_win_amount,
    'multiplier', p_multiplier
  );
END;
$$;


--
-- Name: play_hilo(uuid, numeric, text, uuid, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_hilo(_user_id uuid, _bet_amount numeric, _action text, _session_id uuid DEFAULT NULL::uuid, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile RECORD;
  v_session RECORD;
  v_config RECORD;
  v_current_card INTEGER;
  v_new_card INTEGER;
  v_correct BOOLEAN;
  v_multiplier NUMERIC;
  v_win_amount NUMERIC;
  v_server_seed TEXT;
  v_game_number BIGINT;
  v_cards TEXT[] := ARRAY['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  v_suits TEXT[] := ARRAY['♠️','♥️','♦️','♣️'];
BEGIN
  IF NOT _use_demo THEN
    SELECT email_verified_at INTO v_profile FROM public.profiles WHERE id = _user_id;
    IF v_profile.email_verified_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Подтвердите email для игры');
    END IF;
  END IF;
  
  SELECT * INTO v_profile FROM public.profiles WHERE id = _user_id;
  SELECT * INTO v_config FROM public.hilo_config LIMIT 1;
  IF v_config IS NULL THEN
    v_config := ROW(0.3, 50);
  END IF;
  
  IF _action = 'start' THEN
    IF _use_demo THEN
      IF v_profile.demo_balance < _bet_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо баланса');
      END IF;
    ELSIF _use_freebet THEN
      IF COALESCE(v_profile.freebet_balance, 0) < _bet_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
      END IF;
    ELSE
      IF v_profile.balance < _bet_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
      END IF;
    END IF;
    
    v_server_seed := encode(gen_random_bytes(32), 'hex');
    v_current_card := floor(random() * 13)::INTEGER;
    
    INSERT INTO public.game_sessions (
      user_id, game_name, bet_amount, server_seed, 
      game_state, is_freebet, is_demo, status
    ) VALUES (
      _user_id, 'hilo', _bet_amount, v_server_seed,
      jsonb_build_object('card', v_current_card, 'streak', 0, 'multiplier', 1.0, 'suit', floor(random() * 4)::INTEGER),
      _use_freebet, _use_demo, 'active'
    ) RETURNING * INTO v_session;
    
    IF _use_demo THEN
      UPDATE public.profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
    ELSIF _use_freebet THEN
      UPDATE public.profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
    ELSE
      UPDATE public.profiles SET balance = balance - _bet_amount WHERE id = _user_id;
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'session_id', v_session.id,
      'card', v_cards[v_current_card + 1],
      'suit', v_suits[(v_session.game_state->>'suit')::INTEGER + 1],
      'multiplier', 1.0
    );
    
  ELSIF _action IN ('guess_high', 'guess_low') THEN
    SELECT * INTO v_session FROM public.game_sessions 
    WHERE id = _session_id AND user_id = _user_id AND status = 'active';
    
    IF v_session IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Сессия не найдена');
    END IF;
    
    v_current_card := (v_session.game_state->>'card')::INTEGER;
    v_new_card := floor(random() * 13)::INTEGER;
    
    IF _action = 'guess_high' THEN
      v_correct := v_new_card > v_current_card;
    ELSE
      v_correct := v_new_card < v_current_card;
    END IF;
    
    IF v_correct THEN
      v_multiplier := 1 + ((v_session.game_state->>'streak')::INTEGER + 1) * v_config.base_multiplier_increment;
      
      UPDATE public.game_sessions 
      SET game_state = jsonb_build_object(
        'card', v_new_card, 
        'streak', (v_session.game_state->>'streak')::INTEGER + 1, 
        'multiplier', v_multiplier,
        'suit', floor(random() * 4)::INTEGER
      )
      WHERE id = _session_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'correct', true,
        'card', v_cards[v_new_card + 1],
        'suit', v_suits[floor(random() * 4)::INTEGER + 1],
        'multiplier', v_multiplier,
        'streak', (v_session.game_state->>'streak')::INTEGER + 1
      );
    ELSE
      UPDATE public.game_sessions SET status = 'completed', completed_at = NOW(), win_amount = 0 WHERE id = _session_id;
      
      v_game_number := nextval('public.game_number_seq');
      INSERT INTO public.game_history (user_id, game_name, bet_amount, win_amount, multiplier, server_seed_hash, game_number)
      VALUES (_user_id, 'hilo', v_session.bet_amount, 0, 0, encode(sha256(v_session.server_seed::bytea), 'hex'), v_game_number);
      
      PERFORM public.update_game_stats(_user_id, false);
      
      RETURN jsonb_build_object(
        'success', true,
        'correct', false,
        'card', v_cards[v_new_card + 1],
        'game_number', v_game_number,
        'seed_hash', encode(sha256(v_session.server_seed::bytea), 'hex'),
        'lost', true
      );
    END IF;
    
  ELSIF _action = 'cashout' THEN
    SELECT * INTO v_session FROM public.game_sessions 
    WHERE id = _session_id AND user_id = _user_id AND status = 'active';
    
    IF v_session IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Сессия не найдена');
    END IF;
    
    v_multiplier := (v_session.game_state->>'multiplier')::NUMERIC;
    v_win_amount := v_session.bet_amount * v_multiplier;
    
    IF v_session.is_demo THEN
      UPDATE public.profiles SET demo_balance = demo_balance + v_win_amount WHERE id = _user_id;
    ELSIF v_session.is_freebet THEN
      UPDATE public.profiles SET freebet_balance = freebet_balance + v_win_amount WHERE id = _user_id;
    ELSE
      UPDATE public.profiles SET balance = balance + v_win_amount WHERE id = _user_id;
    END IF;
    
    UPDATE public.game_sessions SET status = 'completed', completed_at = NOW(), win_amount = v_win_amount WHERE id = _session_id;
    
    v_game_number := nextval('public.game_number_seq');
    INSERT INTO public.game_history (user_id, game_name, bet_amount, win_amount, multiplier, server_seed_hash, game_number)
    VALUES (_user_id, 'hilo', v_session.bet_amount, v_win_amount, v_multiplier, encode(sha256(v_session.server_seed::bytea), 'hex'), v_game_number);
    
    PERFORM public.update_game_stats(_user_id, true);
    PERFORM public.add_user_xp(_user_id, GREATEST(1, floor(v_win_amount / 10)::INTEGER));
    
    RETURN jsonb_build_object(
      'success', true,
      'win_amount', v_win_amount,
      'multiplier', v_multiplier,
      'game_number', v_game_number,
      'seed_hash', encode(sha256(v_session.server_seed::bytea), 'hex')
    );
  END IF;
  
  RETURN jsonb_build_object('success', false, 'message', 'Неверное действие');
END;
$$;


--
-- Name: play_horse_racing(uuid, numeric, integer, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_horse_racing(_user_id uuid, _bet_amount numeric, _selected_horse integer, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session JSON;
  _winner INT;
  _win_amount NUMERIC := 0;
  _multiplier NUMERIC := 0;
  _horse_odds NUMERIC[] := ARRAY[2.5, 3.0, 4.0, 5.0, 7.0, 10.0];
  _result JSON;
BEGIN
  -- Валидация
  IF _selected_horse < 1 OR _selected_horse > 6 THEN
    RETURN json_build_object('success', false, 'error', 'Неверный номер лошади');
  END IF;

  -- Создаем сессию
  _session := start_game_session(_user_id, 'horse_racing', _bet_amount, _is_freebet, _is_demo);
  
  IF NOT (_session->>'success')::BOOLEAN THEN
    RETURN _session;
  END IF;

  -- Определяем победителя (взвешенный рандом - лошади с низким коэффициентом чаще выигрывают)
  DECLARE
    _rand NUMERIC := random();
    _cumulative NUMERIC := 0;
    _weights NUMERIC[] := ARRAY[0.30, 0.25, 0.18, 0.13, 0.09, 0.05]; -- Обратные вероятности
  BEGIN
    FOR i IN 1..6 LOOP
      _cumulative := _cumulative + _weights[i];
      IF _rand <= _cumulative THEN
        _winner := i;
        EXIT;
      END IF;
    END LOOP;
  END;

  IF _winner IS NULL THEN
    _winner := 1;
  END IF;

  -- Проверяем выигрыш
  IF _selected_horse = _winner THEN
    _multiplier := _horse_odds[_selected_horse];
    _win_amount := _bet_amount * _multiplier;
  END IF;

  -- Завершаем игру
  _result := complete_game_session(
    (_session->>'session_id')::UUID,
    json_build_object(
      'selected_horse', _selected_horse,
      'winner', _winner,
      'odds', _horse_odds
    ),
    _win_amount,
    _multiplier
  );

  RETURN json_build_object(
    'success', true,
    'session_id', _session->>'session_id',
    'selected_horse', _selected_horse,
    'winner', _winner,
    'multiplier', _multiplier,
    'win_amount', _win_amount,
    'won', _selected_horse = _winner
  );
END;
$$;


--
-- Name: play_mines(uuid, numeric, integer, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_mines(_user_id uuid, _bet_amount numeric, _mines_count integer, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_balance numeric;
  v_freebet_balance numeric;
  v_demo_balance numeric;
BEGIN
  -- Get current balances
  SELECT balance, freebet_balance, demo_balance
  INTO v_balance, v_freebet_balance, v_demo_balance
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;

  -- Check and deduct appropriate balance
  IF _use_demo THEN
    IF v_demo_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо баланса');
    END IF;
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
  ELSIF _use_freebet THEN
    IF v_freebet_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
    END IF;
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
  ELSE
    IF v_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;
    UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Игра начата');
END;
$$;


--
-- Name: play_penalty_server(uuid, numeric, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_penalty_server(_user_id uuid, _bet_amount numeric, _player_choice text, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_positions TEXT[] := ARRAY['left', 'center', 'right'];
  v_goalkeeper_choice TEXT;
  v_win BOOLEAN;
  v_multiplier NUMERIC := 1.96;
  v_win_amount NUMERIC := 0;
  v_game_number BIGINT;
  v_server_seed TEXT;
BEGIN
  PERFORM enforce_rate_limit(_user_id, 'penalty_play', 500);

  SELECT * INTO v_profile FROM profiles WHERE id = _user_id FOR UPDATE;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _is_demo THEN
    IF v_profile.demo_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient demo balance');
    END IF;
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
  ELSIF _is_freebet THEN
    IF COALESCE(v_profile.freebet_balance, 0) < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient freebet balance');
    END IF;
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
  ELSE
    IF v_profile.balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;
  END IF;

  v_game_number := nextval('public.game_number_seq');
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_goalkeeper_choice := v_positions[1 + floor(random() * 3)::int];
  v_win := _player_choice != v_goalkeeper_choice;

  IF v_win THEN
    v_win_amount := ROUND(_bet_amount * v_multiplier, 2);
    IF _is_demo THEN
      UPDATE profiles SET demo_balance = demo_balance + v_win_amount WHERE id = _user_id;
    ELSE
      UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
    END IF;
  END IF;

  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_number, server_seed_hash)
  VALUES (_user_id, 'penalty', _bet_amount, v_win_amount, CASE WHEN v_win THEN v_multiplier ELSE 0 END, v_game_number, encode(digest(v_server_seed, 'sha256'), 'hex'));

  IF NOT _is_demo THEN
    PERFORM add_user_xp(_user_id, GREATEST(1, floor(_bet_amount / 10)::int));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'player_choice', _player_choice,
    'goalkeeper_choice', v_goalkeeper_choice,
    'win', v_win,
    'multiplier', v_multiplier,
    'win_amount', v_win_amount,
    'game_number', v_game_number
  );
END;
$$;


--
-- Name: play_plinko_server(uuid, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_plinko_server(_user_id uuid, _bet_amount numeric, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_session jsonb;
  v_session_id uuid;
  v_server_seed text;
  v_path integer[];
  v_bin_index integer;
  v_multipliers numeric[];
  v_multiplier numeric;
  v_win_amount numeric;
  v_result jsonb;
  v_game_number bigint;
BEGIN
  SELECT multipliers INTO v_multipliers FROM public.plinko_config LIMIT 1;
  IF v_multipliers IS NULL THEN
    v_multipliers := ARRAY[8.0, 3.0, 1.5, 0.7, 0.3, 0.0, 0.3, 0.7, 1.5, 3.0, 8.0]::numeric[];
  END IF;

  v_session := start_game_session(_user_id, _bet_amount, 'plinko', '{}'::jsonb, _use_freebet, _use_demo);
  
  IF NOT (v_session->>'success')::boolean THEN
    RETURN v_session;
  END IF;
  
  v_session_id := (v_session->>'session_id')::uuid;
  v_server_seed := v_session->>'server_seed';
  
  v_path := ARRAY[]::integer[];
  v_bin_index := 5;
  
  FOR i IN 1..10 LOOP
    IF get_bit(digest(v_server_seed || i::text, 'sha256'), i % 256) = 1 THEN
      v_bin_index := v_bin_index + 1;
      v_path := array_append(v_path, 1);
    ELSE
      v_bin_index := v_bin_index - 1;
      v_path := array_append(v_path, 0);
    END IF;
  END LOOP;
  
  v_bin_index := GREATEST(0, LEAST(10, v_bin_index));
  v_multiplier := v_multipliers[v_bin_index + 1];
  v_win_amount := ROUND(_bet_amount * v_multiplier, 2);
  
  v_result := complete_game_session(v_session_id, _user_id, v_win_amount, v_multiplier,
    jsonb_build_object('path', v_path, 'bin_index', v_bin_index));
  
  SELECT gh.game_number INTO v_game_number
  FROM public.game_history gh
  WHERE gh.game_session_id = v_session_id
  LIMIT 1;
  
  RETURN jsonb_build_object(
    'success', true,
    'path', v_path,
    'bin_index', v_bin_index,
    'multiplier', v_multiplier,
    'win_amount', v_win_amount,
    'seed_hash', v_session->>'seed_hash',
    'game_number', COALESCE(v_game_number, 0)
  );
END;
$$;


--
-- Name: play_roulette(uuid, numeric, text, integer, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_roulette(_user_id uuid, _bet_amount numeric, _bet_type text, _bet_value integer DEFAULT NULL::integer, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile RECORD;
  v_config RECORD;
  v_result INTEGER;
  v_color TEXT;
  v_won BOOLEAN := FALSE;
  v_multiplier NUMERIC := 0;
  v_win_amount NUMERIC := 0;
  v_server_seed TEXT;
  v_game_number BIGINT;
  v_red_numbers INTEGER[] := ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
BEGIN
  -- Rate limiting
  PERFORM enforce_rate_limit(_user_id, 'roulette_spin', 500);

  -- Проверяем email верификацию (кроме демо)
  IF NOT _use_demo THEN
    SELECT email_verified_at INTO v_profile FROM profiles WHERE id = _user_id;
    IF v_profile.email_verified_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Подтвердите email для игры');
    END IF;
  END IF;
  
  -- Получаем профиль
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id FOR UPDATE;
  
  -- Проверяем баланс
  IF _use_demo THEN
    IF v_profile.demo_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо баланса');
    END IF;
  ELSIF _use_freebet THEN
    IF COALESCE(v_profile.freebet_balance, 0) < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
    END IF;
  ELSE
    IF v_profile.balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
    END IF;
  END IF;

  -- Получаем конфигурацию
  SELECT * INTO v_config FROM roulette_config LIMIT 1;
  IF NOT FOUND THEN
    v_config.number_multiplier := 36;
    v_config.color_multiplier := 2;
    v_config.dozen_multiplier := 3;
    v_config.column_multiplier := 3;
  END IF;
  
  -- Генерируем результат (используем gen_random_bytes из extensions и digest из pgcrypto)
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_result := floor(random() * 37)::INTEGER;
  v_game_number := nextval('game_number_seq');
  
  -- Определяем цвет
  IF v_result = 0 THEN
    v_color := 'green';
  ELSIF v_result = ANY(v_red_numbers) THEN
    v_color := 'red';
  ELSE
    v_color := 'black';
  END IF;
  
  -- Сохраняем в историю рулетки
  INSERT INTO roulette_history (number, color) VALUES (v_result, v_color);
  
  -- Проверяем выигрыш
  IF _bet_type = 'number' AND v_result = COALESCE(_bet_value, -1) THEN
    v_won := TRUE;
    v_multiplier := v_config.number_multiplier;
  ELSIF _bet_type = 'red' AND v_color = 'red' THEN
    v_won := TRUE;
    v_multiplier := v_config.color_multiplier;
  ELSIF _bet_type = 'black' AND v_color = 'black' THEN
    v_won := TRUE;
    v_multiplier := v_config.color_multiplier;
  ELSIF _bet_type = 'even' AND v_result > 0 AND v_result % 2 = 0 THEN
    v_won := TRUE;
    v_multiplier := v_config.color_multiplier;
  ELSIF _bet_type = 'odd' AND v_result % 2 = 1 THEN
    v_won := TRUE;
    v_multiplier := v_config.color_multiplier;
  ELSIF _bet_type = 'low' AND v_result BETWEEN 1 AND 18 THEN
    v_won := TRUE;
    v_multiplier := v_config.color_multiplier;
  ELSIF _bet_type = 'high' AND v_result BETWEEN 19 AND 36 THEN
    v_won := TRUE;
    v_multiplier := v_config.color_multiplier;
  ELSIF _bet_type = 'dozen1' AND v_result BETWEEN 1 AND 12 THEN
    v_won := TRUE;
    v_multiplier := v_config.dozen_multiplier;
  ELSIF _bet_type = 'dozen2' AND v_result BETWEEN 13 AND 24 THEN
    v_won := TRUE;
    v_multiplier := v_config.dozen_multiplier;
  ELSIF _bet_type = 'dozen3' AND v_result BETWEEN 25 AND 36 THEN
    v_won := TRUE;
    v_multiplier := v_config.dozen_multiplier;
  ELSIF _bet_type = 'column1' AND v_result > 0 AND v_result % 3 = 1 THEN
    v_won := TRUE;
    v_multiplier := v_config.column_multiplier;
  ELSIF _bet_type = 'column2' AND v_result > 0 AND v_result % 3 = 2 THEN
    v_won := TRUE;
    v_multiplier := v_config.column_multiplier;
  ELSIF _bet_type = 'column3' AND v_result > 0 AND v_result % 3 = 0 THEN
    v_won := TRUE;
    v_multiplier := v_config.column_multiplier;
  END IF;

  -- Рассчитываем выигрыш (с 10% house edge)
  v_win_amount := CASE WHEN v_won THEN _bet_amount * v_multiplier * 0.90 ELSE 0 END;
  
  -- Обновляем баланс
  IF _use_demo THEN
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount + v_win_amount WHERE id = _user_id;
  ELSIF _use_freebet THEN
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount + v_win_amount WHERE id = _user_id;
  ELSE
    UPDATE profiles SET balance = balance - _bet_amount + v_win_amount WHERE id = _user_id;
  END IF;
  
  -- Добавляем XP
  PERFORM add_user_xp(_user_id, _bet_amount * 0.1);
  
  -- Записываем в историю
  INSERT INTO game_history (user_id, game_name, bet_amount, multiplier, win_amount, game_number, server_seed_hash)
  VALUES (_user_id, 'roulette', _bet_amount, v_multiplier, v_win_amount, v_game_number, encode(digest(v_server_seed, 'sha256'), 'hex'));
  
  RETURN jsonb_build_object(
    'success', true,
    'result_number', v_result,
    'color', v_color,
    'won', v_won,
    'multiplier', v_multiplier,
    'win_amount', v_win_amount,
    'game_number', v_game_number,
    'seed_hash', encode(digest(v_server_seed, 'sha256'), 'hex')
  );
END;
$$;


--
-- Name: play_roulette_server(uuid, numeric, text, integer, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_roulette_server(_user_id uuid, _bet_amount numeric, _bet_type text, _bet_value integer DEFAULT NULL::integer, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session JSONB;
  v_session_id UUID;
  v_server_seed TEXT;
  v_result INTEGER;
  v_color TEXT;
  v_won BOOLEAN;
  v_multiplier NUMERIC;
  v_win_amount NUMERIC;
  v_red_numbers INTEGER[] := ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
BEGIN
  v_session := start_game_session(_user_id, 'roulette', _bet_amount, _is_freebet, _is_demo, '{}'::jsonb);
  
  IF NOT (v_session->>'success')::boolean THEN
    RETURN v_session;
  END IF;
  
  v_session_id := (v_session->>'session_id')::UUID;
  SELECT server_seed INTO v_server_seed FROM game_sessions WHERE id = v_session_id;
  
  -- Генерируем результат (0-36)
  v_result := (('x' || substring(hash_seed(v_server_seed) from 1 for 8))::bit(32)::int % 37);
  
  -- Определяем цвет
  IF v_result = 0 THEN
    v_color := 'green';
  ELSIF v_result = ANY(v_red_numbers) THEN
    v_color := 'red';
  ELSE
    v_color := 'black';
  END IF;
  
  -- Проверяем выигрыш
  v_won := false;
  v_multiplier := 0;
  
  CASE _bet_type
    WHEN 'number' THEN
      v_won := (v_result = _bet_value);
      v_multiplier := 35;
    WHEN 'red' THEN
      v_won := (v_color = 'red');
      v_multiplier := 2;
    WHEN 'black' THEN
      v_won := (v_color = 'black');
      v_multiplier := 2;
    WHEN 'even' THEN
      v_won := (v_result > 0 AND v_result % 2 = 0);
      v_multiplier := 2;
    WHEN 'odd' THEN
      v_won := (v_result > 0 AND v_result % 2 = 1);
      v_multiplier := 2;
    WHEN 'dozen1' THEN
      v_won := (v_result >= 1 AND v_result <= 12);
      v_multiplier := 3;
    WHEN 'dozen2' THEN
      v_won := (v_result >= 13 AND v_result <= 24);
      v_multiplier := 3;
    WHEN 'dozen3' THEN
      v_won := (v_result >= 25 AND v_result <= 36);
      v_multiplier := 3;
    ELSE
      v_won := false;
  END CASE;
  
  IF v_won THEN
    v_win_amount := ROUND(_bet_amount * v_multiplier, 2);
  ELSE
    v_win_amount := 0;
    v_multiplier := 0;
  END IF;
  
  -- Записываем в историю рулетки
  INSERT INTO roulette_history (number, color) VALUES (v_result, v_color);
  PERFORM cleanup_old_roulette_history();
  
  RETURN complete_game_session(v_session_id, _user_id, v_win_amount, v_multiplier,
    jsonb_build_object('result', v_result, 'color', v_color, 'bet_type', _bet_type, 'won', v_won));
END;
$$;


--
-- Name: play_sweet_bonanza(uuid, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.play_sweet_bonanza(_user_id uuid, _bet_amount numeric, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile RECORD;
  v_freespins RECORD;
  v_is_freespin BOOLEAN := FALSE;
  v_actual_bet NUMERIC;
  v_balance_field TEXT;
  v_server_seed TEXT;
  v_game_number BIGINT;
  v_grid INTEGER[][];
  v_row_data INTEGER[];
  v_scatter_count INTEGER := 0;
  v_multiplier_sum INTEGER := 0;
  v_weights NUMERIC[];
  v_total_weight NUMERIC;
  v_random NUMERIC;
  v_symbol INTEGER;
  v_row INTEGER;
  v_col INTEGER;
  v_k INTEGER;
  v_cumulative NUMERIC;
  v_symbol_counts INTEGER[];
  v_total_win NUMERIC := 0;
  v_payout NUMERIC;
  v_winning_symbols INTEGER[] := ARRAY[]::INTEGER[];
  v_bonus_spins INTEGER := 0;
  v_scatter_win NUMERIC := 0;
  v_cascade_count INTEGER := 0;
  v_has_win BOOLEAN;
  v_count INTEGER;
  v_multiplier_bomb INTEGER;
  v_cascades JSONB := '[]'::jsonb;
  v_cascade_win NUMERIC;
  v_current_winning_positions JSONB;
  v_positions_to_remove JSONB;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Профиль не найден');
  END IF;

  SELECT * INTO v_freespins FROM user_freespins WHERE user_id = _user_id;
  IF v_freespins IS NOT NULL AND v_freespins.freespins_count > 0 THEN
    v_is_freespin := TRUE;
    v_actual_bet := COALESCE(v_freespins.freespin_bet_amount, 16);
  ELSE
    v_actual_bet := _bet_amount;
    
    IF v_actual_bet < 16 OR v_actual_bet > 100000 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Ставка от 16₽ до 100,000₽');
    END IF;

    IF _use_demo THEN
      v_balance_field := 'demo_balance';
      IF v_profile.demo_balance < v_actual_bet THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно демо баланса');
      END IF;
      UPDATE profiles SET demo_balance = demo_balance - v_actual_bet WHERE id = _user_id;
    ELSIF _use_freebet THEN
      v_balance_field := 'freebet_balance';
      IF COALESCE(v_profile.freebet_balance, 0) < v_actual_bet THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно фрибет баланса');
      END IF;
      UPDATE profiles SET freebet_balance = freebet_balance - v_actual_bet WHERE id = _user_id;
    ELSE
      v_balance_field := 'balance';
      IF v_profile.balance < v_actual_bet THEN
        RETURN jsonb_build_object('success', false, 'message', 'Недостаточно средств');
      END IF;
      UPDATE profiles SET balance = balance - v_actual_bet WHERE id = _user_id;
    END IF;
  END IF;

  IF v_is_freespin THEN
    UPDATE user_freespins SET freespins_count = freespins_count - 1 WHERE user_id = _user_id;
    v_balance_field := 'balance';
  END IF;

  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_game_number := nextval('game_number_seq');

  -- Веса символов
  IF v_is_freespin THEN
    v_weights := ARRAY[22, 20, 17, 15, 12, 10, 8, 5, 3]::NUMERIC[];
  ELSE
    v_weights := ARRAY[18, 16, 15, 14, 12, 10, 8, 5, 4]::NUMERIC[];
  END IF;
  v_total_weight := 0;
  FOR v_k IN 1..9 LOOP
    v_total_weight := v_total_weight + v_weights[v_k];
  END LOOP;

  -- Генерируем начальную сетку 5x6
  v_grid := ARRAY[]::INTEGER[][];
  v_scatter_count := 0;
  v_multiplier_sum := 0;
  
  FOR v_row IN 1..5 LOOP
    v_row_data := ARRAY[]::INTEGER[];
    FOR v_col IN 1..6 LOOP
      IF random() < (CASE WHEN v_is_freespin THEN 0.015 ELSE 0.010 END) THEN
        v_row_data := array_append(v_row_data, 100);
        v_scatter_count := v_scatter_count + 1;
      ELSIF v_is_freespin AND random() < 0.05 THEN
        v_multiplier_bomb := CASE 
          WHEN random() < 0.45 THEN 2
          WHEN random() < 0.70 THEN 3
          WHEN random() < 0.85 THEN 5
          WHEN random() < 0.93 THEN 8
          WHEN random() < 0.97 THEN 15
          WHEN random() < 0.99 THEN 25
          ELSE 50
        END;
        v_row_data := array_append(v_row_data, 200 + v_multiplier_bomb);
        v_multiplier_sum := v_multiplier_sum + v_multiplier_bomb;
      ELSE
        v_random := random() * v_total_weight;
        v_cumulative := 0;
        FOR v_k IN 1..9 LOOP
          v_cumulative := v_cumulative + v_weights[v_k];
          IF v_random < v_cumulative THEN
            v_symbol := v_k - 1;
            EXIT;
          END IF;
        END LOOP;
        v_row_data := array_append(v_row_data, v_symbol);
      END IF;
    END LOOP;
    v_grid := array_cat(v_grid, ARRAY[v_row_data]);
  END LOOP;

  -- Сохраняем начальную сетку
  v_cascades := v_cascades || jsonb_build_object('grid', v_grid, 'winning_positions', '[]'::jsonb, 'win', 0);

  -- Каскады (до 8 раз)
  LOOP
    v_symbol_counts := ARRAY[0,0,0,0,0,0,0,0,0]::INTEGER[];
    FOR v_row IN 1..5 LOOP
      FOR v_col IN 1..6 LOOP
        v_symbol := v_grid[v_row][v_col];
        IF v_symbol >= 0 AND v_symbol <= 8 THEN
          v_symbol_counts[v_symbol + 1] := v_symbol_counts[v_symbol + 1] + 1;
        END IF;
      END LOOP;
    END LOOP;
    
    v_has_win := FALSE;
    v_cascade_win := 0;
    v_current_winning_positions := '[]'::jsonb;
    v_positions_to_remove := '[]'::jsonb;
    
    FOR v_k IN 1..9 LOOP
      v_count := v_symbol_counts[v_k];
      IF v_count >= 8 THEN
        v_has_win := TRUE;
        IF NOT ((v_k - 1) = ANY(v_winning_symbols)) THEN
          v_winning_symbols := array_append(v_winning_symbols, v_k - 1);
        END IF;
        
        -- Собираем позиции ТОЛЬКО этого выигрышного символа
        FOR v_row IN 1..5 LOOP
          FOR v_col IN 1..6 LOOP
            IF v_grid[v_row][v_col] = v_k - 1 THEN
              v_positions_to_remove := v_positions_to_remove || jsonb_build_array(jsonb_build_object('row', v_row - 1, 'col', v_col - 1, 'symbol', v_k - 1));
            END IF;
          END LOOP;
        END LOOP;
        
        v_payout := CASE v_k
          WHEN 1 THEN CASE WHEN v_count >= 12 THEN 2.0 WHEN v_count >= 10 THEN 0.75 ELSE 0.25 END
          WHEN 2 THEN CASE WHEN v_count >= 12 THEN 4.0 WHEN v_count >= 10 THEN 0.9 ELSE 0.4 END
          WHEN 3 THEN CASE WHEN v_count >= 12 THEN 5.0 WHEN v_count >= 10 THEN 1.0 ELSE 0.5 END
          WHEN 4 THEN CASE WHEN v_count >= 12 THEN 8.0 WHEN v_count >= 10 THEN 1.2 ELSE 0.8 END
          WHEN 5 THEN CASE WHEN v_count >= 12 THEN 10.0 WHEN v_count >= 10 THEN 1.5 ELSE 1.0 END
          WHEN 6 THEN CASE WHEN v_count >= 12 THEN 12.0 WHEN v_count >= 10 THEN 2.0 ELSE 1.5 END
          WHEN 7 THEN CASE WHEN v_count >= 12 THEN 15.0 WHEN v_count >= 10 THEN 5.0 ELSE 2.0 END
          WHEN 8 THEN CASE WHEN v_count >= 12 THEN 25.0 WHEN v_count >= 10 THEN 10.0 ELSE 2.5 END
          WHEN 9 THEN CASE WHEN v_count >= 12 THEN 50.0 WHEN v_count >= 10 THEN 25.0 ELSE 10.0 END
          ELSE 0
        END;
        v_cascade_win := v_cascade_win + (v_actual_bet * v_payout);
      END IF;
    END LOOP;
    
    EXIT WHEN NOT v_has_win OR v_cascade_count >= 8;
    
    v_total_win := v_total_win + v_cascade_win;
    v_cascade_count := v_cascade_count + 1;
    
    -- Обновляем каскад с позициями для удаления
    v_cascades := jsonb_set(v_cascades, ARRAY[(jsonb_array_length(v_cascades) - 1)::text], 
      jsonb_build_object('grid', v_grid, 'winning_positions', v_positions_to_remove, 'win', v_cascade_win));
    
    -- Удаляем выигрышные символы и генерируем новые
    FOR v_row IN 1..5 LOOP
      FOR v_col IN 1..6 LOOP
        v_symbol := v_grid[v_row][v_col];
        IF v_symbol >= 0 AND v_symbol <= 8 AND v_symbol_counts[v_symbol + 1] >= 8 THEN
          v_random := random() * v_total_weight;
          v_cumulative := 0;
          FOR v_k IN 1..9 LOOP
            v_cumulative := v_cumulative + v_weights[v_k];
            IF v_random < v_cumulative THEN
              v_grid[v_row][v_col] := v_k - 1;
              EXIT;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
    
    -- Добавляем новую сетку
    v_cascades := v_cascades || jsonb_build_object('grid', v_grid, 'winning_positions', '[]'::jsonb, 'win', 0);
  END LOOP;

  -- Множители бомбочек
  IF v_multiplier_sum > 0 AND v_total_win > 0 THEN
    v_total_win := v_total_win * v_multiplier_sum;
  END IF;

  -- House edge 10%
  v_total_win := v_total_win * 0.90;

  -- Скаттеры
  IF NOT v_is_freespin AND v_scatter_count >= 4 THEN
    v_bonus_spins := 10;
    v_scatter_win := v_actual_bet * CASE 
      WHEN v_scatter_count >= 6 THEN 100 
      WHEN v_scatter_count = 5 THEN 5 
      ELSE 3 
    END;
    v_total_win := v_total_win + v_scatter_win;
    
    INSERT INTO user_freespins (user_id, freespins_count, freespin_bet_amount)
    VALUES (_user_id, v_bonus_spins, v_actual_bet)
    ON CONFLICT (user_id) DO UPDATE SET 
      freespins_count = user_freespins.freespins_count + v_bonus_spins,
      freespin_bet_amount = v_actual_bet;
  ELSIF v_is_freespin AND v_scatter_count >= 3 THEN
    v_bonus_spins := 5;
    UPDATE user_freespins SET freespins_count = freespins_count + v_bonus_spins WHERE user_id = _user_id;
  END IF;

  -- Начисляем выигрыш
  IF v_total_win > 0 THEN
    IF v_balance_field = 'demo_balance' THEN
      UPDATE profiles SET demo_balance = demo_balance + v_total_win WHERE id = _user_id;
    ELSE
      UPDATE profiles SET balance = balance + v_total_win WHERE id = _user_id;
    END IF;
  END IF;

  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, server_seed_hash, game_number)
  VALUES (_user_id, 'sweet_bonanza', v_actual_bet, COALESCE(v_total_win, 0), 
    CASE WHEN v_total_win > 0 THEN v_total_win / v_actual_bet ELSE 0 END,
    encode(digest(v_server_seed, 'sha256'), 'hex'), v_game_number);

  PERFORM add_user_xp(_user_id, v_actual_bet);
  IF v_total_win > 0 THEN
    PERFORM update_game_stats(_user_id, true);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'grid', v_grid,
    'cascades', v_cascades,
    'win_amount', COALESCE(v_total_win, 0),
    'winning_symbols', v_winning_symbols,
    'multiplier_sum', v_multiplier_sum,
    'scatter_count', v_scatter_count,
    'bonus_spins', v_bonus_spins,
    'is_freespin', v_is_freespin,
    'game_number', v_game_number,
    'cascade_count', v_cascade_count
  );
END;
$$;


--
-- Name: prevent_direct_profile_sensitive_updates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_direct_profile_sensitive_updates() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only allow changes through RPC functions
  IF OLD.balance IS DISTINCT FROM NEW.balance THEN
    RAISE EXCEPTION 'Direct balance updates not allowed. Use RPC functions.';
  END IF;

  IF OLD.xp IS DISTINCT FROM NEW.xp THEN
    RAISE EXCEPTION 'Direct XP updates not allowed. Use RPC functions.';
  END IF;

  IF OLD.level IS DISTINCT FROM NEW.level THEN
    RAISE EXCEPTION 'Direct level updates not allowed. Use RPC functions.';
  END IF;

  IF OLD.freebet_balance IS DISTINCT FROM NEW.freebet_balance THEN
    RAISE EXCEPTION 'Direct freebet_balance updates not allowed. Use RPC functions.';
  END IF;

  IF OLD.betting_freebet_balance IS DISTINCT FROM NEW.betting_freebet_balance THEN
    RAISE EXCEPTION 'Direct betting_freebet_balance updates not allowed. Use RPC functions.';
  END IF;

  IF OLD.wager_progress IS DISTINCT FROM NEW.wager_progress THEN
    RAISE EXCEPTION 'Direct wager_progress updates not allowed. Use RPC functions.';
  END IF;

  IF OLD.wager_requirement IS DISTINCT FROM NEW.wager_requirement THEN
    RAISE EXCEPTION 'Direct wager_requirement updates not allowed. Use RPC functions.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: process_bet_referral_commission(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_bet_referral_commission(_user_id uuid, _win_amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  referrer_id UUID;
  commission NUMERIC;
BEGIN
  SELECT referred_by INTO referrer_id FROM profiles WHERE id = _user_id;
  
  IF referrer_id IS NOT NULL THEN
    commission := _win_amount * 0.03; -- 3% commission
    
    UPDATE profiles SET balance = balance + commission WHERE id = referrer_id;
    
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (referrer_id, commission, 'referral_commission', 'Реферальная комиссия 3% с выигрыша');
    
    UPDATE referral_rewards
    SET reward_amount = reward_amount + commission
    WHERE referrer_id = referrer_id AND referred_id = _user_id;
  END IF;
END;
$$;


--
-- Name: process_crash_tick(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_crash_tick(p_round_id uuid, p_current_multiplier numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_round record;
  v_bet record;
  v_win_amount numeric;
  v_profile record;
BEGIN
  SELECT * INTO v_round
  FROM crash_rounds
  WHERE id = p_round_id AND status = 'active';
  
  IF v_round IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Round not found or not active');
  END IF;
  
  -- Process auto-cashouts
  FOR v_bet IN
    SELECT * FROM crash_bets
    WHERE round_id = p_round_id
      AND status = 'active'
      AND cashed_out_at IS NULL
      AND auto_cashout <= p_current_multiplier
  LOOP
    v_win_amount := v_bet.bet_amount * v_bet.auto_cashout;
    
    -- Update bet
    UPDATE crash_bets
    SET cashed_out_at = v_bet.auto_cashout,
        win_amount = v_win_amount,
        status = 'won'
    WHERE id = v_bet.id;
    
    -- Credit winnings based on bet type
    IF v_bet.is_freebet THEN
      SELECT * INTO v_profile FROM profiles WHERE id = v_bet.user_id;
      UPDATE profiles
      SET freebet_balance = COALESCE(freebet_balance, 0) + v_win_amount
      WHERE id = v_bet.user_id;
    ELSE
      PERFORM update_balance(v_bet.user_id, v_win_amount);
    END IF;
    
    -- Add to game history
    INSERT INTO game_history (user_id, game_name, bet_amount, multiplier, win_amount)
    VALUES (v_bet.user_id, 'crash', v_bet.bet_amount, v_bet.auto_cashout, v_win_amount);
  END LOOP;
  
  -- Check if round should crash
  IF p_current_multiplier >= v_round.multiplier THEN
    UPDATE crash_rounds
    SET status = 'crashed', crashed_at = now()
    WHERE id = p_round_id;
    
    -- Mark remaining bets as lost
    FOR v_bet IN
      SELECT * FROM crash_bets
      WHERE round_id = p_round_id AND status = 'active' AND cashed_out_at IS NULL
    LOOP
      UPDATE crash_bets SET status = 'lost' WHERE id = v_bet.id;
      
      INSERT INTO game_history (user_id, game_name, bet_amount, multiplier, win_amount)
      VALUES (v_bet.user_id, 'crash', v_bet.bet_amount, 0, 0);
    END LOOP;
    
    RETURN jsonb_build_object('success', true, 'crashed', true, 'multiplier', v_round.multiplier);
  END IF;
  
  RETURN jsonb_build_object('success', true, 'crashed', false);
END;
$$;


--
-- Name: protect_profile_sensitive_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_profile_sensitive_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only allow changes to cosmetic fields for non-admin users
  -- Check if this is being called by an RPC (SECURITY DEFINER context)
  IF current_setting('role', true) = 'rls_restricted' THEN
    -- Regular user context - protect sensitive fields
    IF OLD.balance IS DISTINCT FROM NEW.balance OR
       OLD.freebet_balance IS DISTINCT FROM NEW.freebet_balance OR
       OLD.demo_balance IS DISTINCT FROM NEW.demo_balance OR
       OLD.betting_freebet_balance IS DISTINCT FROM NEW.betting_freebet_balance OR
       OLD.wager_requirement IS DISTINCT FROM NEW.wager_requirement OR
       OLD.wager_progress IS DISTINCT FROM NEW.wager_progress OR
       OLD.guaranteed_max_win IS DISTINCT FROM NEW.guaranteed_max_win OR
       OLD.is_vip IS DISTINCT FROM NEW.is_vip OR
       OLD.xp IS DISTINCT FROM NEW.xp OR
       OLD.level IS DISTINCT FROM NEW.level OR
       OLD.total_wins IS DISTINCT FROM NEW.total_wins OR
       OLD.total_losses IS DISTINCT FROM NEW.total_losses OR
       OLD.telegram_id IS DISTINCT FROM NEW.telegram_id OR
       OLD.referred_by IS DISTINCT FROM NEW.referred_by OR
       OLD.is_banned IS DISTINCT FROM NEW.is_banned OR
       OLD.is_muted IS DISTINCT FROM NEW.is_muted THEN
      RAISE EXCEPTION 'Cannot directly modify sensitive profile fields';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: pump_balloon(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pump_balloon(_session_id uuid, _user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_pop_point NUMERIC;
  v_current NUMERIC;
  v_new_multiplier NUMERIC;
BEGIN
  IF NOT check_rate_limit(_user_id, 'balloon_pump', 200) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Слишком быстро');
  END IF;
  
  SELECT * INTO v_session FROM game_sessions
  WHERE id = _session_id AND user_id = _user_id AND status = 'active' FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  v_pop_point := (v_session.game_state->>'pop_point')::NUMERIC;
  v_current := COALESCE((v_session.game_state->>'current_multiplier')::NUMERIC, 1.00);
  v_new_multiplier := v_current + 0.15;
  
  IF v_new_multiplier >= v_pop_point THEN
    -- Взрыв!
    UPDATE game_sessions SET 
      status = 'completed',
      win_amount = 0,
      result = jsonb_build_object('popped', true, 'pop_point', v_pop_point, 'at_multiplier', v_new_multiplier),
      completed_at = now()
    WHERE id = _session_id;
    
    INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_session_id)
    VALUES (_user_id, 'balloon', v_session.bet_amount, 0, 0, _session_id);
    
    RETURN jsonb_build_object(
      'success', true,
      'popped', true,
      'pop_point', v_pop_point,
      'multiplier', 0
    );
  END IF;
  
  UPDATE game_sessions SET game_state = game_state || jsonb_build_object('current_multiplier', v_new_multiplier)
  WHERE id = _session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'popped', false,
    'multiplier', v_new_multiplier,
    'potential_win', ROUND(v_session.bet_amount * v_new_multiplier, 2)
  );
END;
$$;


--
-- Name: refund_bet(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_bet(_bet_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _bet_record user_bets%ROWTYPE;
BEGIN
  -- Get bet info
  SELECT * INTO _bet_record FROM user_bets WHERE id = _bet_id;
  
  IF _bet_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ставка не найдена');
  END IF;
  
  IF _bet_record.status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ставка уже возвращена');
  END IF;
  
  -- If bet was won, deduct the winnings first
  IF _bet_record.status = 'won' THEN
    IF _bet_record.is_freebet = true THEN
      UPDATE profiles 
      SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) - _bet_record.potential_win
      WHERE id = _bet_record.user_id;
    ELSE
      UPDATE profiles 
      SET balance = balance - _bet_record.potential_win
      WHERE id = _bet_record.user_id;
    END IF;
  END IF;
  
  -- Refund the bet amount based on freebet or regular bet
  IF _bet_record.is_freebet = true THEN
    UPDATE profiles 
    SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + _bet_record.bet_amount
    WHERE id = _bet_record.user_id;
  ELSE
    UPDATE profiles 
    SET balance = balance + _bet_record.bet_amount
    WHERE id = _bet_record.user_id;
  END IF;
  
  -- Update bet status
  UPDATE user_bets SET status = 'refunded' WHERE id = _bet_id;
  
  -- Add transaction
  INSERT INTO transactions (user_id, amount, type, description)
  VALUES (_bet_record.user_id, _bet_record.bet_amount, 'bet_refund', 'Возврат ставки');
  
  RETURN jsonb_build_object('success', true, 'message', 'Ставка возвращена');
END;
$$;


--
-- Name: refund_parlay_bet(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_parlay_bet(_parlay_bet_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _parlay_record parlay_bets%ROWTYPE;
BEGIN
  -- Get parlay info
  SELECT * INTO _parlay_record FROM parlay_bets WHERE id = _parlay_bet_id;
  
  IF _parlay_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Экспресс не найден');
  END IF;
  
  IF _parlay_record.status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Экспресс уже возвращен');
  END IF;
  
  -- Refund based on freebet or regular bet
  IF _parlay_record.is_freebet THEN
    UPDATE profiles 
    SET betting_freebet_balance = betting_freebet_balance + _parlay_record.total_amount
    WHERE id = _parlay_record.user_id;
  ELSE
    UPDATE profiles 
    SET balance = balance + _parlay_record.total_amount
    WHERE id = _parlay_record.user_id;
  END IF;
  
  -- Update parlay status
  UPDATE parlay_bets SET status = 'refunded' WHERE id = _parlay_bet_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Экспресс возвращен');
END;
$$;


--
-- Name: refund_parlay_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_parlay_item(_parlay_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _item_record parlay_bet_items%ROWTYPE;
  _parlay_record parlay_bets%ROWTYPE;
  _new_total_odds numeric;
  _new_potential_win numeric;
  _items_count int;
BEGIN
  -- Get item info
  SELECT * INTO _item_record FROM parlay_bet_items WHERE id = _parlay_item_id;
  
  IF _item_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Элемент экспресса не найден');
  END IF;
  
  -- Check if already refunded
  IF _item_record.bet_type = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Этот матч уже возвращен');
  END IF;
  
  -- Get parlay info
  SELECT * INTO _parlay_record FROM parlay_bets WHERE id = _item_record.parlay_bet_id;
  
  IF _parlay_record.status NOT IN ('pending', 'partial_refund') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Нельзя вернуть матч в завершенном экспрессе');
  END IF;
  
  -- Count remaining items (excluding refunded ones)
  SELECT COUNT(*) INTO _items_count 
  FROM parlay_bet_items 
  WHERE parlay_bet_id = _parlay_record.id AND bet_type != 'refunded';
  
  IF _items_count <= 1 THEN
    -- If only one item left, refund the whole parlay
    RETURN refund_parlay_bet(_parlay_record.id);
  END IF;
  
  -- Calculate new total odds (divide by refunded item's odds)
  _new_total_odds := ROUND(_parlay_record.total_odds / _item_record.odds, 2);
  
  -- Calculate potential win based on freebet or regular
  IF _parlay_record.is_freebet THEN
    _new_potential_win := ROUND((_parlay_record.total_amount * _new_total_odds) / 2, 2);
  ELSE
    _new_potential_win := ROUND(_parlay_record.total_amount * _new_total_odds, 2);
  END IF;
  
  -- Update parlay
  UPDATE parlay_bets 
  SET 
    total_odds = _new_total_odds,
    potential_win = _new_potential_win,
    status = 'partial_refund'
  WHERE id = _parlay_record.id;
  
  -- Mark item as refunded, store original values
  UPDATE parlay_bet_items 
  SET 
    original_bet_type = bet_type,
    original_odds = odds,
    bet_type = 'refunded'
  WHERE id = _parlay_item_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Матч возвращен из экспресса');
END;
$$;


--
-- Name: release_game_lock(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_game_lock(_user_id uuid, _game_session_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM active_game_locks
  WHERE user_id = _user_id AND game_session_id = _game_session_id;
  
  RETURN true;
END;
$$;


--
-- Name: request_email_verification(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_email_verification(_user_id uuid, _email text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _code TEXT;
  _last_request TIMESTAMPTZ;
  _seconds_since_last INT;
BEGIN
  -- Проверяем валидность email
  IF _email IS NULL OR _email = '' OR _email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN json_build_object('success', false, 'error', 'Неверный формат email');
  END IF;

  -- Проверяем, не используется ли email другим пользователем
  IF EXISTS (SELECT 1 FROM profiles WHERE email = _email AND id != _user_id AND email_verified_at IS NOT NULL) THEN
    RETURN json_build_object('success', false, 'error', 'Этот email уже используется');
  END IF;

  -- Проверяем время последнего запроса (30 секунд кулдаун)
  SELECT created_at INTO _last_request
  FROM verification_codes
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF _last_request IS NOT NULL THEN
    _seconds_since_last := EXTRACT(EPOCH FROM (now() - _last_request))::INT;
    IF _seconds_since_last < 30 THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'Подождите ' || (30 - _seconds_since_last) || ' секунд',
        'wait_seconds', 30 - _seconds_since_last
      );
    END IF;
  END IF;

  -- Генерируем код
  _code := generate_verification_code();

  -- Удаляем старые коды для этого пользователя
  DELETE FROM verification_codes WHERE user_id = _user_id;

  -- Создаем новый код
  INSERT INTO verification_codes (email, code, user_id, expires_at)
  VALUES (_email, _code, _user_id, now() + interval '5 minutes');

  RETURN json_build_object(
    'success', true, 
    'code', _code,
    'email', _email,
    'expires_in_minutes', 5
  );
END;
$_$;


--
-- Name: reset_wager_on_zero_freebet(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_wager_on_zero_freebet() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Если фрибет баланс стал 0 или меньше, сбрасываем прогресс отыгрыша
  IF NEW.freebet_balance <= 0 AND OLD.freebet_balance > 0 THEN
    NEW.wager_requirement := 0;
    NEW.wager_progress := 0;
    NEW.freebet_balance := 0;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: restore_parlay_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_parlay_item(_parlay_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _item_record parlay_bet_items%ROWTYPE;
  _parlay_record parlay_bets%ROWTYPE;
  _new_total_odds numeric;
  _new_potential_win numeric;
  _restore_odds numeric;
BEGIN
  -- Get item info
  SELECT * INTO _item_record FROM parlay_bet_items WHERE id = _parlay_item_id;
  
  IF _item_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Элемент экспресса не найден');
  END IF;
  
  -- Check if it was refunded
  IF _item_record.bet_type != 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Этот матч не был возвращен');
  END IF;
  
  -- REQUIRE original_bet_type - don't use defaults
  IF _item_record.original_bet_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Невозможно восстановить: нет данных о типе ставки. Установите original_bet_type вручную.');
  END IF;
  
  -- Get parlay info
  SELECT * INTO _parlay_record FROM parlay_bets WHERE id = _item_record.parlay_bet_id;
  
  IF _parlay_record.status NOT IN ('pending', 'partial_refund') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Нельзя восстановить матч в завершенном экспрессе');
  END IF;
  
  -- Get restore odds - use original if available, otherwise current
  _restore_odds := COALESCE(_item_record.original_odds, _item_record.odds);
  
  IF _restore_odds IS NULL OR _restore_odds <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Невозможно восстановить: нет данных о коэффициенте');
  END IF;
  
  -- Calculate new total odds (multiply by restored item's odds)
  _new_total_odds := ROUND(_parlay_record.total_odds * _restore_odds, 2);
  
  -- Calculate potential win based on freebet or regular
  IF _parlay_record.is_freebet THEN
    _new_potential_win := ROUND((_parlay_record.total_amount * _new_total_odds) / 2, 2);
  ELSE
    _new_potential_win := ROUND(_parlay_record.total_amount * _new_total_odds, 2);
  END IF;
  
  -- Restore item with original values
  UPDATE parlay_bet_items 
  SET 
    bet_type = _item_record.original_bet_type,
    odds = _restore_odds,
    original_bet_type = NULL,
    original_odds = NULL
  WHERE id = _parlay_item_id;
  
  -- Update parlay
  UPDATE parlay_bets 
  SET 
    total_odds = _new_total_odds,
    potential_win = _new_potential_win,
    status = CASE 
      WHEN (SELECT COUNT(*) FROM parlay_bet_items WHERE parlay_bet_id = _parlay_record.id AND bet_type = 'refunded') = 0 
      THEN 'pending' 
      ELSE 'partial_refund' 
    END
  WHERE id = _parlay_record.id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Матч восстановлен в экспрессе');
END;
$$;


--
-- Name: reveal_mines_cell(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reveal_mines_cell(_session_id uuid, _user_id uuid, _cell_index integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_mines INTEGER[];
  v_revealed INTEGER[];
  v_is_mine BOOLEAN;
  v_mines_count INTEGER;
  v_multiplier NUMERIC;
  v_safe_cells INTEGER;
  v_base_mult NUMERIC;
BEGIN
  -- Get session
  SELECT * INTO v_session FROM game_sessions
  WHERE id = _session_id AND user_id = _user_id AND status = 'active' FOR UPDATE;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  -- Get mines and revealed cells
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_session.game_state->'mines')::int) INTO v_mines;
  SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_session.game_state->'revealed', '[]'::jsonb))::int) INTO v_revealed;
  v_mines_count := array_length(v_mines, 1);
  
  -- Check cell not already revealed
  IF _cell_index = ANY(v_revealed) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Клетка уже открыта');
  END IF;
  
  -- Check if hit mine
  v_is_mine := _cell_index = ANY(v_mines);
  
  IF v_is_mine THEN
    -- Loss
    UPDATE game_sessions SET 
      status = 'completed',
      win_amount = 0,
      result = jsonb_build_object('mines', v_mines, 'revealed', v_revealed, 'hit_mine', _cell_index),
      completed_at = now()
    WHERE id = _session_id;
    
    INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_session_id, server_seed_hash, game_number)
    VALUES (_user_id, 'mines', v_session.bet_amount, 0, 0, _session_id, 
      encode(digest(v_session.server_seed, 'sha256'), 'hex'),
      v_session.game_number);
    
    PERFORM add_user_xp(_user_id, v_session.bet_amount);
    DELETE FROM active_game_locks WHERE user_id = _user_id AND game_name = 'mines';
    
    RETURN jsonb_build_object(
      'success', true,
      'is_mine', true,
      'mines', v_mines,
      'multiplier', 0,
      'win_amount', 0
    );
  END IF;
  
  -- Add to revealed
  v_revealed := array_append(v_revealed, _cell_index);
  v_safe_cells := array_length(v_revealed, 1);
  
  -- Get base multiplier per reveal based on mines count (matching MINES_MULTIPLIERS from client)
  v_base_mult := CASE v_mines_count
    WHEN 2 THEN 1.07 WHEN 3 THEN 1.12 WHEN 4 THEN 1.17 WHEN 5 THEN 1.23
    WHEN 6 THEN 1.30 WHEN 7 THEN 1.37 WHEN 8 THEN 1.45 WHEN 9 THEN 1.54
    WHEN 10 THEN 1.64 WHEN 11 THEN 1.76 WHEN 12 THEN 1.90 WHEN 13 THEN 2.05
    WHEN 14 THEN 2.24 WHEN 15 THEN 2.46 WHEN 16 THEN 2.74 WHEN 17 THEN 3.08
    WHEN 18 THEN 3.52 WHEN 19 THEN 4.11 WHEN 20 THEN 4.93 WHEN 21 THEN 6.16
    WHEN 22 THEN 8.21 WHEN 23 THEN 12.31 WHEN 24 THEN 24.63
    ELSE 1.07
  END;
  
  -- Compound multiplier: base_mult ^ safe_cells
  v_multiplier := ROUND(POWER(v_base_mult, v_safe_cells), 2);
  
  -- Update game state
  UPDATE game_sessions SET game_state = game_state || jsonb_build_object('revealed', to_jsonb(v_revealed))
  WHERE id = _session_id;
  
  -- Check if all safe cells revealed
  IF v_safe_cells >= (25 - v_mines_count) THEN
    RETURN cashout_mines(_session_id, _user_id);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'is_mine', false,
    'revealed', v_revealed,
    'multiplier', v_multiplier,
    'potential_win', ROUND(v_session.bet_amount * v_multiplier, 2)
  );
END;
$$;


--
-- Name: select_tower_tile(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.select_tower_tile(_session_id uuid, _user_id uuid, _column integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
  v_state JSONB;
  v_current_row INTEGER;
  v_path INTEGER[];
  v_mine_map JSONB;
  v_row_mines JSONB;
  v_hit_mine BOOLEAN := FALSE;
  v_rows INTEGER;
  v_cols INTEGER;
  v_multiplier DECIMAL;
  v_win_amount DECIMAL;
  v_mines_arr INTEGER[];
  v_mines_per_row INTEGER;
  v_is_nested BOOLEAN;
  v_flat_start INTEGER;
  v_multipliers DECIMAL[] := ARRAY[1.08, 1.18, 1.35, 1.62, 1.98, 2.60, 3.50, 4.80, 6.80, 10.20, 16.00];
BEGIN
  SELECT * INTO v_session FROM game_sessions 
  WHERE id = _session_id AND user_id = _user_id AND status = 'active';
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  v_state := v_session.game_state;
  v_current_row := COALESCE((v_state->>'current_row')::INTEGER, 0);
  v_path := COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_state->'path')::INTEGER), ARRAY[]::INTEGER[]);
  v_mine_map := v_state->'mine_map';
  v_rows := COALESCE((v_state->>'rows')::INTEGER, 11);
  v_cols := COALESCE((v_state->>'columns')::INTEGER, 5);
  v_mines_per_row := COALESCE((v_state->>'mines_per_row')::INTEGER, 2);
  
  IF v_current_row >= v_rows THEN
    RETURN jsonb_build_object('success', false, 'error', 'Игра уже завершена');
  END IF;
  
  IF _column < 0 OR _column >= v_cols THEN
    RETURN jsonb_build_object('success', false, 'error', 'Неверная колонка');
  END IF;
  
  -- Detect format: check if first element is an array (nested) or integer (flat)
  v_is_nested := jsonb_typeof(v_mine_map->0) = 'array';
  
  IF v_is_nested THEN
    -- New format: mine_map is [[0,2], [1,3], ...]
    v_row_mines := v_mine_map->v_current_row;
    v_mines_arr := ARRAY(SELECT jsonb_array_elements_text(v_row_mines)::INTEGER);
  ELSE
    -- Legacy flat format: mine_map is [0, 2, 1, 3, ...] where each v_mines_per_row elements are one row
    v_flat_start := v_current_row * v_mines_per_row;
    v_mines_arr := ARRAY[]::INTEGER[];
    FOR v_i IN 0..(v_mines_per_row - 1) LOOP
      v_mines_arr := array_append(v_mines_arr, (v_mine_map->(v_flat_start + v_i))::INTEGER);
    END LOOP;
  END IF;
  
  IF _column = ANY(v_mines_arr) THEN
    v_hit_mine := TRUE;
  END IF;
  
  v_path := array_append(v_path, _column);
  v_current_row := v_current_row + 1;
  
  -- Get multiplier
  IF v_current_row <= array_length(v_multipliers, 1) THEN
    v_multiplier := v_multipliers[v_current_row];
  ELSE
    v_multiplier := v_multipliers[array_length(v_multipliers, 1)];
  END IF;
  
  IF v_hit_mine THEN
    -- Lost
    UPDATE game_sessions SET 
      status = 'completed',
      completed_at = now(),
      win_amount = 0,
      result = jsonb_build_object('hit_mine', true, 'row', v_current_row - 1),
      game_state = v_state || jsonb_build_object('current_row', v_current_row, 'path', to_jsonb(v_path))
    WHERE id = _session_id;
    
    DELETE FROM active_game_locks WHERE user_id = _user_id AND game_name = 'towers';
    
    RETURN jsonb_build_object(
      'success', true,
      'hit_mine', true,
      'current_row', v_current_row,
      'multiplier', v_multiplier,
      'win_amount', 0,
      'game_over', true,
      'mines', v_mines_arr
    );
  ELSE
    -- Safe
    UPDATE game_sessions SET 
      game_state = v_state || jsonb_build_object('current_row', v_current_row, 'path', to_jsonb(v_path))
    WHERE id = _session_id;
    
    -- Check if completed all rows
    IF v_current_row >= v_rows THEN
      v_win_amount := v_session.bet_amount * v_multiplier;
      
      UPDATE game_sessions SET 
        status = 'completed',
        completed_at = now(),
        win_amount = v_win_amount,
        result = jsonb_build_object('completed', true, 'multiplier', v_multiplier)
      WHERE id = _session_id;
      
      DELETE FROM active_game_locks WHERE user_id = _user_id AND game_name = 'towers';
      
      IF v_session.is_demo THEN
        UPDATE profiles SET demo_balance = demo_balance + v_win_amount WHERE id = _user_id;
      ELSIF v_session.is_freebet THEN
        UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
      ELSE
        UPDATE profiles SET balance = balance + v_win_amount WHERE id = _user_id;
      END IF;
      
      RETURN jsonb_build_object(
        'success', true,
        'hit_mine', false,
        'current_row', v_current_row,
        'multiplier', v_multiplier,
        'win_amount', v_win_amount,
        'game_over', true
      );
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'hit_mine', false,
      'current_row', v_current_row,
      'multiplier', v_multiplier,
      'win_amount', 0,
      'game_over', false
    );
  END IF;
END;
$$;


--
-- Name: sell_skin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sell_skin(_user_id uuid, _inventory_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_skin_price numeric;
  v_owner_id uuid;
  v_is_demo boolean;
  v_skin_name text;
BEGIN
  -- Проверяем владельца и получаем информацию
  SELECT ui.user_id, s.price, COALESCE(ui.is_demo, false), s.name
  INTO v_owner_id, v_skin_price, v_is_demo, v_skin_name
  FROM user_inventory ui
  JOIN skins s ON s.id = ui.skin_id
  WHERE ui.id = _inventory_id;

  IF v_owner_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Скин не найден');
  END IF;

  IF v_owner_id != _user_id THEN
    RETURN json_build_object('success', false, 'message', 'Это не ваш скин');
  END IF;

  -- Удаляем из инвентаря
  DELETE FROM user_inventory WHERE id = _inventory_id;

  -- Возвращаем на нужный баланс
  IF v_is_demo THEN
    UPDATE profiles SET demo_balance = COALESCE(demo_balance, 0) + v_skin_price WHERE id = _user_id;
    RETURN json_build_object('success', true, 'message', v_skin_name || ' продан за ' || v_skin_price || '₽ (демо)');
  ELSE
    UPDATE profiles SET balance = balance + v_skin_price WHERE id = _user_id;
    RETURN json_build_object('success', true, 'message', v_skin_name || ' продан за ' || v_skin_price || '₽');
  END IF;
END;
$$;


--
-- Name: send_system_notification(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_system_notification(_admin_user_id uuid, _message text, _target_user_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _is_admin boolean;
  _notification_id uuid;
BEGIN
  -- Проверяем, является ли пользователь администратором
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _admin_user_id
    AND role = 'admin'
  ) INTO _is_admin;

  IF NOT _is_admin THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Только администраторы могут отправлять уведомления'
    );
  END IF;

  -- Вставляем уведомление
  INSERT INTO public.system_notifications (message, user_id)
  VALUES (_message, _target_user_id)
  RETURNING id INTO _notification_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Уведомление успешно отправлено',
    'notification_id', _notification_id
  );
END;
$$;


--
-- Name: set_guaranteed_max_win(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_guaranteed_max_win(_user_id uuid, _enabled boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  UPDATE profiles SET guaranteed_max_win = _enabled WHERE id = _user_id;
END;
$$;


--
-- Name: set_parlay_item_original_bet_type(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_parlay_item_original_bet_type(_item_id uuid, _bet_type text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE parlay_bet_items 
  SET original_bet_type = _bet_type
  WHERE id = _item_id AND bet_type = 'refunded';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Элемент не найден или не возвращен');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Тип ставки установлен: ' || _bet_type);
END;
$$;


--
-- Name: set_user_ban(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_ban(_user_id uuid, _is_banned boolean, _ban_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert or update user_moderation record
  INSERT INTO public.user_moderation (user_id, is_banned, ban_reason, updated_at)
  VALUES (_user_id, _is_banned, _ban_reason, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    is_banned = _is_banned,
    ban_reason = _ban_reason,
    updated_at = now();
END;
$$;


--
-- Name: set_user_mute(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_mute(_user_id uuid, _mute_seconds integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If mute_seconds is 0 or NULL, unmute the user
  IF _mute_seconds IS NULL OR _mute_seconds <= 0 THEN
    INSERT INTO public.user_moderation (user_id, muted_until, updated_at)
    VALUES (_user_id, NULL, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      muted_until = NULL,
      updated_at = now();
  ELSE
    -- Set mute expiration time
    INSERT INTO public.user_moderation (user_id, muted_until, updated_at)
    VALUES (_user_id, now() + (_mute_seconds || ' seconds')::interval, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      muted_until = now() + (_mute_seconds || ' seconds')::interval,
      updated_at = now();
  END IF;
END;
$$;


--
-- Name: spin_bonus_wheel(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.spin_bonus_wheel(_user_id uuid, _wheel_id uuid) RETURNS TABLE(success boolean, message text, reward_type text, reward_amount numeric, reward_description text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  random_value numeric;
  _reward_type text;
  _reward_amount numeric;
  _reward_description text;
  v_email_verified timestamp with time zone;
BEGIN
  -- Check email verification
  SELECT email_verified_at INTO v_email_verified FROM profiles WHERE id = _user_id;
  IF v_email_verified IS NULL THEN
    RETURN QUERY SELECT false, 'Подтвердите email для прокрутки колеса'::text, NULL::text, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM bonus_wheels WHERE id = _wheel_id AND user_id = _user_id AND is_used = false) THEN
    RETURN QUERY SELECT false, 'Колесо не найдено или уже использовано', NULL::text, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  random_value := random();

  IF random_value < 0.20 THEN
    _reward_type := 'balance'; _reward_amount := 5; _reward_description := '5₽ на баланс';
  ELSIF random_value < 0.35 THEN
    _reward_type := 'balance'; _reward_amount := 15; _reward_description := '15₽ на баланс';
  ELSIF random_value < 0.47 THEN
    _reward_type := 'balance'; _reward_amount := 25; _reward_description := '25₽ на баланс';
  ELSIF random_value < 0.57 THEN
    _reward_type := 'balance'; _reward_amount := 50; _reward_description := '50₽ на баланс';
  ELSIF random_value < 0.65 THEN
    _reward_type := 'balance'; _reward_amount := 100; _reward_description := '100₽ на баланс';
  ELSIF random_value < 0.75 THEN
    _reward_type := 'betting_freebet'; _reward_amount := 100; _reward_description := '100₽ фрибет на ставки';
  ELSIF random_value < 0.83 THEN
    _reward_type := 'betting_freebet'; _reward_amount := 500; _reward_description := '500₽ фрибет на ставки';
  ELSIF random_value < 0.90 THEN
    _reward_type := 'freespins'; _reward_amount := 50; _reward_description := '50 фриспинов';
  ELSIF random_value < 0.95 THEN
    _reward_type := 'freebet'; _reward_amount := 500; _reward_description := '500₽ фрибет казино';
  ELSIF random_value < 0.99 THEN
    _reward_type := 'freebet'; _reward_amount := 1000; _reward_description := '1000₽ фрибет казино';
  ELSE
    _reward_type := 'balance'; _reward_amount := 10000; _reward_description := '10000₽ ДЖЕКПОТ!';
  END IF;

  UPDATE bonus_wheels 
  SET is_used = true, 
      used_at = now(),
      reward_type = _reward_type,
      reward_amount = _reward_amount,
      reward_description = _reward_description
  WHERE id = _wheel_id;

  IF _reward_type = 'balance' THEN
    UPDATE profiles SET balance = balance + _reward_amount WHERE id = _user_id;
  ELSIF _reward_type = 'freebet' THEN
    UPDATE profiles 
    SET freebet_balance = COALESCE(freebet_balance, 0) + _reward_amount,
        wager_requirement = COALESCE(wager_requirement, 0) + (_reward_amount * 60)
    WHERE id = _user_id;
  ELSIF _reward_type = 'betting_freebet' THEN
    UPDATE profiles 
    SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + _reward_amount
    WHERE id = _user_id;
  ELSIF _reward_type = 'freespins' THEN
    INSERT INTO user_freespins (user_id, freespins_count)
    VALUES (_user_id, _reward_amount::int)
    ON CONFLICT (user_id) DO UPDATE SET freespins_count = user_freespins.freespins_count + _reward_amount::int;
  END IF;

  RETURN QUERY SELECT true, 'Поздравляем!', _reward_type, _reward_amount, _reward_description;
END;
$$;


--
-- Name: spin_buff_wheel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.spin_buff_wheel(_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  last_spin_time TIMESTAMP WITH TIME ZONE;
  hours_since NUMERIC;
  random_num NUMERIC;
  result_type TEXT;
  result_amount NUMERIC := 0;
  result_message TEXT;
  v_preset_id UUID;
  v_preset_result TEXT;
  i INTEGER;
BEGIN
  SELECT last_spin_at INTO last_spin_time
  FROM daily_buff_wheel
  WHERE user_id = _user_id
  ORDER BY last_spin_at DESC
  LIMIT 1;

  IF last_spin_time IS NOT NULL THEN
    hours_since := EXTRACT(EPOCH FROM (now() - last_spin_time)) / 3600;
    IF hours_since < 2 THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Подождите ещё ' || CEIL((2 - hours_since) * 60) || ' минут'
      );
    END IF;
  END IF;

  SELECT pwr.id, pwr.preset_result
  INTO v_preset_id, v_preset_result
  FROM public.preset_wheel_results pwr
  WHERE pwr.user_id = _user_id AND pwr.is_used = false
  ORDER BY pwr.created_at DESC
  LIMIT 1;

  IF v_preset_id IS NOT NULL THEN
    result_type := v_preset_result;
    UPDATE public.preset_wheel_results
    SET is_used = true, used_at = now()
    WHERE id = v_preset_id;
  ELSE
    random_num := random();

    IF random_num < 0.03 THEN
      result_type := 'wins_1000';
    ELSIF random_num < 0.08 THEN
      result_type := 'loses_100';
    ELSIF random_num < 0.23 THEN
      result_type := 'buff_x2';
    ELSIF random_num < 0.35 THEN
      result_type := 'buff_x3';
    ELSIF random_num < 0.44 THEN
      result_type := 'buff_x5';
    ELSIF random_num < 0.59 THEN
      result_type := 'debuff_x05';
    ELSE
      result_type := 'nothing';
    END IF;
  END IF;

  IF result_type = 'wins_1000' THEN
    result_amount := 1000;
    UPDATE profiles SET total_wins = COALESCE(total_wins, 0) + 1000 WHERE id = _user_id;
    result_message := 'ДЖЕКПОТ! +1000 побед!';
    
    FOR i IN 1..1000 LOOP
      INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
      VALUES (_user_id, 'buff_wheel', 0, 1, 1);
    END LOOP;
    
  ELSIF result_type = 'loses_100' THEN
    result_amount := -100;
    UPDATE profiles SET total_wins = GREATEST(0, COALESCE(total_wins, 0) - 100) WHERE id = _user_id;
    result_message := 'Ой! -100 побед';
    -- Don't delete game_history - just reduce the profile counter
    
  ELSIF result_type = 'buff_x2' THEN
    INSERT INTO user_buffs (user_id, buff_type, expires_at)
    VALUES (_user_id, 'x2', now() + INTERVAL '30 minutes');
    result_message := 'Бафф x2 на 30 минут!';
  ELSIF result_type = 'buff_x3' THEN
    INSERT INTO user_buffs (user_id, buff_type, expires_at)
    VALUES (_user_id, 'x3', now() + INTERVAL '30 minutes');
    result_message := 'Бафф x3 на 30 минут!';
  ELSIF result_type = 'buff_x5' THEN
    INSERT INTO user_buffs (user_id, buff_type, expires_at)
    VALUES (_user_id, 'x5', now() + INTERVAL '30 minutes');
    result_message := 'СУПЕР! Бафф x5 на 30 минут!';
  ELSIF result_type = 'debuff_x05' THEN
    INSERT INTO user_buffs (user_id, buff_type, expires_at)
    VALUES (_user_id, 'x0.5', now() + INTERVAL '30 minutes');
    result_message := 'Дебафф x0.5 на 30 минут';
  ELSE
    result_type := 'nothing';
    result_message := 'Пусто... Повезёт в следующий раз!';
  END IF;

  INSERT INTO daily_buff_wheel (user_id, last_spin_at, result_type, result_amount)
  VALUES (_user_id, now(), result_type, result_amount);

  RETURN json_build_object(
    'success', true,
    'result_type', result_type,
    'result_amount', result_amount,
    'message', result_message
  );
END;
$$;


--
-- Name: spin_giveaway_wheel(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.spin_giveaway_wheel(_user_id uuid, _giveaway_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _giveaway RECORD;
  _segments JSONB;
  _segment_count INTEGER;
  _random_index INTEGER;
  _result JSONB;
  _reward_type TEXT;
  _reward_amount NUMERIC;
BEGIN
  -- Get giveaway with wheel settings
  SELECT * INTO _giveaway FROM giveaways WHERE id = _giveaway_id AND has_wheel = true AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Розыгрыш не найден или колесо не активно');
  END IF;

  -- Check if user is participant
  IF NOT EXISTS(SELECT 1 FROM giveaway_participants WHERE giveaway_id = _giveaway_id AND user_id = _user_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Вы не участник этого розыгрыша');
  END IF;

  -- Get wheel segments
  _segments := COALESCE(_giveaway.wheel_segments, '[]'::jsonb);
  _segment_count := jsonb_array_length(_segments);
  
  IF _segment_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Колесо не настроено');
  END IF;

  -- Random selection
  _random_index := floor(random() * _segment_count);
  _result := _segments->_random_index;
  _reward_type := _result->>'type';
  _reward_amount := COALESCE((_result->>'amount')::NUMERIC, 0);

  -- Award prize
  IF _reward_type = 'balance' THEN
    UPDATE profiles SET balance = balance + _reward_amount WHERE id = _user_id;
  ELSIF _reward_type = 'freebet' THEN
    UPDATE profiles SET freebet_balance = COALESCE(freebet_balance, 0) + _reward_amount WHERE id = _user_id;
  ELSIF _reward_type = 'betting_freebet' THEN
    UPDATE profiles SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + _reward_amount WHERE id = _user_id;
  ELSIF _reward_type = 'wheel' THEN
    FOR i IN 1.._reward_amount::INTEGER LOOP
      INSERT INTO bonus_wheels (user_id) VALUES (_user_id);
    END LOOP;
  ELSIF _reward_type = 'xp' THEN
    UPDATE profiles SET xp = xp + _reward_amount::INTEGER WHERE id = _user_id;
  END IF;

  -- Remove participant so they can't spin again
  DELETE FROM giveaway_participants WHERE giveaway_id = _giveaway_id AND user_id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'segment_index', _random_index,
    'reward_type', _reward_type,
    'reward_amount', _reward_amount,
    'reward_label', _result->>'label'
  );
END;
$$;


--
-- Name: spin_registration_wheel(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.spin_registration_wheel(_user_id uuid) RETURNS TABLE(success boolean, message text, reward_type text, reward_amount numeric, reward_description text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  random_value numeric;
  _reward_type text;
  _reward_amount numeric;
  _reward_description text;
  v_email_verified timestamp with time zone;
BEGIN
  -- Check email verification
  SELECT email_verified_at INTO v_email_verified FROM profiles WHERE id = _user_id;
  IF v_email_verified IS NULL THEN
    RETURN QUERY SELECT false, 'Подтвердите email для прокрутки колеса'::text, NULL::text, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM registration_wheel WHERE user_id = _user_id) THEN
    RETURN QUERY SELECT false, 'Вы уже крутили колесо регистрации', NULL::text, NULL::numeric, NULL::text;
    RETURN;
  END IF;

  random_value := random();

  IF random_value < 0.20 THEN
    _reward_type := 'balance'; _reward_amount := 5; _reward_description := '5₽ на баланс';
  ELSIF random_value < 0.35 THEN
    _reward_type := 'balance'; _reward_amount := 15; _reward_description := '15₽ на баланс';
  ELSIF random_value < 0.47 THEN
    _reward_type := 'balance'; _reward_amount := 25; _reward_description := '25₽ на баланс';
  ELSIF random_value < 0.57 THEN
    _reward_type := 'balance'; _reward_amount := 50; _reward_description := '50₽ на баланс';
  ELSIF random_value < 0.65 THEN
    _reward_type := 'balance'; _reward_amount := 100; _reward_description := '100₽ на баланс';
  ELSIF random_value < 0.75 THEN
    _reward_type := 'betting_freebet'; _reward_amount := 100; _reward_description := '100₽ фрибет на ставки';
  ELSIF random_value < 0.83 THEN
    _reward_type := 'betting_freebet'; _reward_amount := 500; _reward_description := '500₽ фрибет на ставки';
  ELSIF random_value < 0.90 THEN
    _reward_type := 'freespins'; _reward_amount := 50; _reward_description := '50 фриспинов';
  ELSIF random_value < 0.95 THEN
    _reward_type := 'freebet'; _reward_amount := 500; _reward_description := '500₽ фрибет казино';
  ELSIF random_value < 0.99 THEN
    _reward_type := 'freebet'; _reward_amount := 1000; _reward_description := '1000₽ фрибет казино';
  ELSE
    _reward_type := 'balance'; _reward_amount := 10000; _reward_description := '10000₽ ДЖЕКПОТ!';
  END IF;

  INSERT INTO registration_wheel (user_id, reward_type, reward_amount, reward_description)
  VALUES (_user_id, _reward_type, _reward_amount, _reward_description);

  IF _reward_type = 'balance' THEN
    UPDATE profiles SET balance = balance + _reward_amount WHERE id = _user_id;
  ELSIF _reward_type = 'freebet' THEN
    UPDATE profiles 
    SET freebet_balance = COALESCE(freebet_balance, 0) + _reward_amount,
        wager_requirement = COALESCE(wager_requirement, 0) + (_reward_amount * 60)
    WHERE id = _user_id;
  ELSIF _reward_type = 'betting_freebet' THEN
    UPDATE profiles 
    SET betting_freebet_balance = COALESCE(betting_freebet_balance, 0) + _reward_amount
    WHERE id = _user_id;
  ELSIF _reward_type = 'freespins' THEN
    INSERT INTO user_freespins (user_id, freespins_count)
    VALUES (_user_id, _reward_amount::int)
    ON CONFLICT (user_id) DO UPDATE SET freespins_count = user_freespins.freespins_count + _reward_amount::int;
  END IF;

  RETURN QUERY SELECT true, 'Поздравляем!', _reward_type, _reward_amount, _reward_description;
END;
$$;


--
-- Name: start_balloon_game(uuid, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_balloon_game(_user_id uuid, _bet_amount numeric, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session JSONB;
  v_session_id UUID;
  v_server_seed TEXT;
  v_pop_point NUMERIC;
BEGIN
  v_session := start_game_session(_user_id, 'balloon', _bet_amount, _is_freebet, _is_demo, '{}'::jsonb);
  
  IF NOT (v_session->>'success')::boolean THEN
    RETURN v_session;
  END IF;
  
  v_session_id := (v_session->>'session_id')::UUID;
  SELECT server_seed INTO v_server_seed FROM game_sessions WHERE id = v_session_id;
  
  -- Генерируем точку взрыва (1.00 - 10.00) с распределением
  v_pop_point := 1.00 + (
    (('x' || substring(hash_seed(v_server_seed) from 1 for 8))::bit(32)::int % 10000) / 1000.0
  );
  v_pop_point := LEAST(v_pop_point, 10.00);
  
  UPDATE game_sessions SET game_state = jsonb_build_object('pop_point', v_pop_point, 'current_multiplier', 1.00)
  WHERE id = v_session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'seed_hash', v_session->>'seed_hash'
  );
END;
$$;


--
-- Name: start_blackjack(uuid, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_blackjack(_user_id uuid, _bet_amount numeric, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session JSON;
  _deck INT[];
  _player_cards INT[];
  _dealer_cards INT[];
  _player_value INT;
  _dealer_value INT;
  _card INT;
BEGIN
  -- Создаем сессию
  _session := start_game_session(_user_id, 'blackjack', _bet_amount, _is_freebet, _is_demo);
  
  IF NOT (_session->>'success')::BOOLEAN THEN
    RETURN _session;
  END IF;

  -- Генерируем колоду (1-52, где 1-13 = первая масть и т.д.)
  _deck := ARRAY(SELECT generate_series(1, 52) ORDER BY random());

  -- Раздаем карты
  _player_cards := ARRAY[_deck[1], _deck[3]];
  _dealer_cards := ARRAY[_deck[2], _deck[4]];

  -- Оставшаяся колода
  _deck := _deck[5:];

  -- Сохраняем состояние
  UPDATE game_sessions
  SET game_state = json_build_object(
    'deck', _deck,
    'player_cards', _player_cards,
    'dealer_cards', _dealer_cards,
    'status', 'playing'
  )
  WHERE id = (_session->>'session_id')::UUID;

  -- Вычисляем значения (покажем только первую карту дилера)
  _player_value := calculate_blackjack_value(_player_cards);

  RETURN json_build_object(
    'success', true,
    'session_id', _session->>'session_id',
    'player_cards', _player_cards,
    'dealer_card', _dealer_cards[1], -- Только первая карта видна
    'player_value', _player_value,
    'can_double', true
  );
END;
$$;


--
-- Name: start_chicken_road(uuid, numeric, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_chicken_road(_user_id uuid, _bet_amount numeric, _difficulty text DEFAULT 'medium'::text, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _session JSON;
  _config RECORD;
  _traps INT[];
  _i INT;
  _trap_chances JSONB;
BEGIN
  -- Получаем конфиг
  SELECT * INTO _config FROM chicken_road_config WHERE difficulty = _difficulty;
  IF _config IS NULL THEN
    SELECT * INTO _config FROM chicken_road_config WHERE difficulty = 'medium';
  END IF;

  _trap_chances := _config.trap_chances;

  -- Генерируем позиции ловушек (3 колонки, 10 рядов)
  _traps := ARRAY[]::INT[];
  FOR _i IN 0..9 LOOP
    -- Случайная колонка для ловушки (0, 1, или 2)
    _traps := _traps || floor(random() * 3)::INT;
  END LOOP;

  -- Создаем сессию
  _session := start_game_session(_user_id, 'chicken_road', _bet_amount, _is_freebet, _is_demo);
  
  IF NOT (_session->>'success')::BOOLEAN THEN
    RETURN _session;
  END IF;

  -- Сохраняем состояние игры
  UPDATE game_sessions
  SET game_state = json_build_object(
    'difficulty', _difficulty,
    'traps', _traps,
    'current_row', 0,
    'multipliers', _config.multipliers
  )
  WHERE id = (_session->>'session_id')::UUID;

  RETURN json_build_object(
    'success', true,
    'session_id', _session->>'session_id',
    'difficulty', _difficulty,
    'total_rows', 10
  );
END;
$$;


--
-- Name: start_crash_round(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_crash_round(p_round_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_round record;
BEGIN
  SELECT * INTO v_round
  FROM crash_rounds
  WHERE id = p_round_id AND status = 'pending';
  
  IF v_round IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Round not found or not pending');
  END IF;
  
  -- Check if betting period has ended (14 seconds)
  IF EXTRACT(EPOCH FROM (now() - v_round.created_at)) < 14 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Betting period not ended');
  END IF;
  
  -- Start the round
  UPDATE crash_rounds
  SET status = 'active', started_at = now()
  WHERE id = p_round_id;
  
  -- Activate all pending bets
  UPDATE crash_bets
  SET status = 'active'
  WHERE round_id = p_round_id AND status = 'pending';
  
  RETURN jsonb_build_object('success', true);
END;
$$;


--
-- Name: start_game_session(uuid, text, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_game_session(_user_id uuid, _game_name text, _bet_amount numeric, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user RECORD;
  _session_id UUID;
  _server_seed TEXT;
  _lock_result JSON;
BEGIN
  -- Проверяем rate limit
  IF NOT check_rate_limit(_user_id, 'game_start') THEN
    RETURN json_build_object('success', false, 'error', 'Слишком быстро! Подождите немного');
  END IF;

  -- Получаем данные пользователя
  SELECT * INTO _user FROM profiles WHERE id = _user_id;
  
  IF _user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Пользователь не найден');
  END IF;

  -- Проверяем баланс
  IF _is_demo THEN
    IF _user.demo_balance < _bet_amount THEN
      RETURN json_build_object('success', false, 'error', 'Недостаточно демо баланса');
    END IF;
  ELSIF _is_freebet THEN
    IF COALESCE(_user.freebet_balance, 0) < _bet_amount THEN
      RETURN json_build_object('success', false, 'error', 'Недостаточно фрибет баланса');
    END IF;
  ELSE
    IF _user.balance < _bet_amount THEN
      RETURN json_build_object('success', false, 'error', 'Недостаточно средств');
    END IF;
  END IF;

  -- Генерируем ID сессии
  _session_id := gen_random_uuid();

  -- Проверяем блокировку игры
  _lock_result := acquire_game_lock(_user_id, _session_id, _game_name);
  
  IF NOT (_lock_result->>'success')::BOOLEAN THEN
    RETURN _lock_result;
  END IF;

  -- Генерируем server seed
  _server_seed := generate_server_seed();

  -- Списываем ставку
  IF _is_demo THEN
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
  ELSIF _is_freebet THEN
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
  ELSE
    UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;
  END IF;

  -- Создаем сессию
  INSERT INTO game_sessions (
    id, user_id, game_name, bet_amount, server_seed, 
    is_freebet, is_demo, status
  )
  VALUES (
    _session_id, _user_id, _game_name, _bet_amount, _server_seed,
    _is_freebet, _is_demo, 'active'
  );

  RETURN json_build_object(
    'success', true,
    'session_id', _session_id,
    'server_seed_hash', hash_seed(_server_seed)
  );
END;
$$;


--
-- Name: start_game_session(uuid, text, numeric, boolean, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_game_session(_user_id uuid, _game_name text, _bet_amount numeric, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false, _initial_state jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_balance NUMERIC;
  v_freebet_balance NUMERIC;
  v_demo_balance NUMERIC;
  v_session_id UUID;
  v_server_seed TEXT;
  v_seed_hash TEXT;
  v_active_session UUID;
BEGIN
  -- Проверяем верификацию email (кроме демо режима)
  IF NOT _is_demo AND NOT is_email_verified(_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Подтвердите email в профиле для игры на реальные деньги', 'need_verification', true);
  END IF;

  -- Проверяем rate limit (минимум 500ms между действиями)
  IF NOT check_rate_limit(_user_id, _game_name || '_start', 500) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Слишком быстро! Подождите немного');
  END IF;
  
  -- Проверяем нет ли уже активной сессии в этой игре
  SELECT id INTO v_active_session
  FROM game_sessions
  WHERE user_id = _user_id AND game_name = _game_name AND status = 'active'
  LIMIT 1;
  
  IF v_active_session IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'У вас уже есть активная игра', 'session_id', v_active_session);
  END IF;
  
  -- Получаем балансы
  SELECT balance, COALESCE(freebet_balance, 0), demo_balance 
  INTO v_balance, v_freebet_balance, v_demo_balance
  FROM profiles WHERE id = _user_id;
  
  -- Проверяем баланс
  IF _is_demo THEN
    IF v_demo_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно демо-баланса');
    END IF;
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
  ELSIF _is_freebet THEN
    IF v_freebet_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно фрибет-баланса');
    END IF;
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
  ELSE
    IF v_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно средств');
    END IF;
    UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;
  END IF;
  
  -- Генерируем server seed
  v_server_seed := generate_server_seed();
  v_seed_hash := hash_seed(v_server_seed);
  
  -- Создаем сессию
  INSERT INTO game_sessions (user_id, game_name, bet_amount, is_freebet, is_demo, game_state, server_seed, status)
  VALUES (_user_id, _game_name, _bet_amount, _is_freebet, _is_demo, _initial_state, v_server_seed, 'active')
  RETURNING id INTO v_session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'seed_hash', v_seed_hash,
    'bet_amount', _bet_amount
  );
END;
$$;


--
-- Name: start_hilo_game(uuid, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_hilo_game(_user_id uuid, _bet_amount numeric, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session JSONB;
  v_session_id UUID;
  v_server_seed TEXT;
  v_first_card INTEGER;
BEGIN
  v_session := start_game_session(_user_id, 'hilo', _bet_amount, _is_freebet, _is_demo, '{}'::jsonb);
  
  IF NOT (v_session->>'success')::boolean THEN
    RETURN v_session;
  END IF;
  
  v_session_id := (v_session->>'session_id')::UUID;
  SELECT server_seed INTO v_server_seed FROM game_sessions WHERE id = v_session_id;
  
  -- Первая карта (2-14, где 11=J, 12=Q, 13=K, 14=A)
  v_first_card := 2 + (('x' || substring(hash_seed(v_server_seed || '0') from 1 for 8))::bit(32)::int % 13);
  
  UPDATE game_sessions SET game_state = jsonb_build_object(
    'current_card', v_first_card,
    'streak', 0,
    'multiplier', 1.00,
    'history', jsonb_build_array(v_first_card)
  )
  WHERE id = v_session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'seed_hash', v_session->>'seed_hash',
    'current_card', v_first_card
  );
END;
$$;


--
-- Name: start_mines_game(uuid, numeric, integer, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_mines_game(_user_id uuid, _bet_amount numeric, _mines_count integer, _use_freebet boolean DEFAULT false, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_balance DECIMAL;
  v_session_id UUID;
  v_server_seed TEXT;
  v_seed_hash TEXT;
  v_mine_positions INTEGER[];
  v_game_number INTEGER;
  v_pos INTEGER;
  v_used INTEGER[];
BEGIN
  -- Delete stale locks for this user/game
  DELETE FROM active_game_locks 
  WHERE user_id = _user_id 
    AND game_name = 'mines'
    AND (
      game_session_id NOT IN (SELECT id FROM game_sessions WHERE status = 'active')
      OR locked_at < now() - interval '30 minutes'
    );

  -- Check for valid active game
  IF EXISTS (
    SELECT 1 FROM active_game_locks agl
    JOIN game_sessions gs ON gs.id = agl.game_session_id
    WHERE agl.user_id = _user_id 
      AND agl.game_name = 'mines'
      AND gs.status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'У вас уже есть активная игра');
  END IF;
  
  -- Delete any orphaned locks
  DELETE FROM active_game_locks WHERE user_id = _user_id AND game_name = 'mines';
  
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Профиль не найден');
  END IF;
  
  IF _use_demo THEN
    v_balance := COALESCE(v_profile.demo_balance, 0);
    IF v_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно демо баланса');
    END IF;
  ELSIF _use_freebet THEN
    v_balance := COALESCE(v_profile.freebet_balance, 0);
    IF v_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно фрибет баланса');
    END IF;
  ELSE
    v_balance := v_profile.balance;
    IF v_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно средств');
    END IF;
  END IF;
  
  IF _mines_count < 2 OR _mines_count > 24 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Количество мин должно быть от 2 до 24');
  END IF;
  
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');
  
  SELECT COALESCE(MAX(game_number), 0) + 1 INTO v_game_number FROM game_sessions;
  
  v_mine_positions := ARRAY[]::INTEGER[];
  v_used := ARRAY[]::INTEGER[];
  WHILE array_length(v_mine_positions, 1) IS NULL OR array_length(v_mine_positions, 1) < _mines_count LOOP
    v_pos := floor(random() * 25)::INTEGER;
    IF NOT (v_pos = ANY(v_used)) THEN
      v_mine_positions := array_append(v_mine_positions, v_pos);
      v_used := array_append(v_used, v_pos);
    END IF;
  END LOOP;
  
  INSERT INTO game_sessions (
    user_id, game_name, bet_amount, server_seed, status, game_number,
    game_state, is_freebet, is_demo
  ) VALUES (
    _user_id, 'mines', _bet_amount, v_server_seed, 'active', v_game_number,
    jsonb_build_object('mines_count', _mines_count, 'mines', v_mine_positions, 'revealed', ARRAY[]::INTEGER[]),
    _use_freebet, _use_demo
  ) RETURNING id INTO v_session_id;
  
  -- Use INSERT with ON CONFLICT to handle race conditions
  INSERT INTO active_game_locks (user_id, game_name, game_session_id)
  VALUES (_user_id, 'mines', v_session_id)
  ON CONFLICT (user_id) DO UPDATE SET 
    game_name = 'mines',
    game_session_id = v_session_id,
    locked_at = now();
  
  IF _use_demo THEN
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
  ELSIF _use_freebet THEN
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
  ELSE
    UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'seed_hash', v_seed_hash,
    'game_number', v_game_number
  );
END;
$$;


--
-- Name: start_towers_game(uuid, numeric, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_towers_game(_user_id uuid, _bet_amount numeric, _is_freebet boolean DEFAULT false, _is_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_balance DECIMAL;
  v_session_id UUID;
  v_server_seed TEXT;
  v_seed_hash TEXT;
  v_game_number INTEGER;
  v_i INTEGER;
  v_pos INTEGER;
  v_rows_count INTEGER := 11;
  v_cols_count INTEGER := 5;
  v_mines_per_row INTEGER := 2;
  v_mine_map JSONB := '[]'::jsonb;
  v_row_mines INTEGER[];
  v_config RECORD;
BEGIN
  -- Delete stale locks
  DELETE FROM active_game_locks 
  WHERE user_id = _user_id 
    AND game_name = 'towers'
    AND (
      game_session_id NOT IN (SELECT id FROM game_sessions WHERE status = 'active')
      OR locked_at < now() - interval '30 minutes'
    );

  -- Check for valid active game
  IF EXISTS (
    SELECT 1 FROM active_game_locks agl
    JOIN game_sessions gs ON gs.id = agl.game_session_id
    WHERE agl.user_id = _user_id 
      AND agl.game_name = 'towers'
      AND gs.status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'У вас уже есть активная игра');
  END IF;
  
  -- Delete orphaned locks for this user
  DELETE FROM active_game_locks WHERE user_id = _user_id AND game_name = 'towers';
  
  SELECT * INTO v_profile FROM profiles WHERE id = _user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Профиль не найден');
  END IF;
  
  -- Check balance
  IF _is_demo THEN
    v_balance := COALESCE(v_profile.demo_balance, 0);
    IF v_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно демо баланса');
    END IF;
  ELSIF _is_freebet THEN
    v_balance := COALESCE(v_profile.freebet_balance, 0);
    IF v_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно фрибет баланса');
    END IF;
  ELSE
    v_balance := v_profile.balance;
    IF v_balance < _bet_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Недостаточно средств');
    END IF;
  END IF;
  
  -- Get config
  SELECT 
    COALESCE(rows_count, 11) as rows_count,
    COALESCE(columns_count, 5) as columns_count,
    COALESCE(mines_per_row, 2) as mines_per_row
  INTO v_config
  FROM towers_config LIMIT 1;
  
  IF v_config IS NOT NULL THEN
    v_rows_count := v_config.rows_count;
    v_cols_count := v_config.columns_count;
    v_mines_per_row := v_config.mines_per_row;
  END IF;
  
  v_server_seed := encode(gen_random_bytes(32), 'hex');
  v_seed_hash := encode(digest(v_server_seed, 'sha256'), 'hex');
  
  SELECT COALESCE(MAX(game_number), 0) + 1 INTO v_game_number FROM game_sessions;
  
  -- Generate mine map as ARRAY OF ARRAYS (each row is an array of mine positions)
  -- FIXED: Use jsonb_insert or proper array building
  FOR v_i IN 0..(v_rows_count - 1) LOOP
    v_row_mines := ARRAY[]::INTEGER[];
    -- Generate unique random positions for mines in this row
    WHILE array_length(v_row_mines, 1) IS NULL OR array_length(v_row_mines, 1) < v_mines_per_row LOOP
      v_pos := floor(random() * v_cols_count)::INTEGER;
      IF NOT (v_pos = ANY(v_row_mines)) THEN
        v_row_mines := array_append(v_row_mines, v_pos);
      END IF;
    END LOOP;
    -- FIXED: Append row as a nested array element, not flattened
    v_mine_map := jsonb_insert(v_mine_map, ARRAY[v_i::text], to_jsonb(v_row_mines));
  END LOOP;
  
  -- Create session
  INSERT INTO game_sessions (
    user_id, game_name, bet_amount, server_seed, status, game_number,
    game_state, is_freebet, is_demo
  ) VALUES (
    _user_id, 'towers', _bet_amount, v_server_seed, 'active', v_game_number,
    jsonb_build_object(
      'current_row', 0, 
      'path', '[]'::jsonb, 
      'mine_map', v_mine_map,
      'rows', v_rows_count,
      'columns', v_cols_count,
      'mines_per_row', v_mines_per_row
    ),
    _is_freebet, _is_demo
  ) RETURNING id INTO v_session_id;
  
  -- Create lock
  INSERT INTO active_game_locks (user_id, game_name, game_session_id)
  VALUES (_user_id, 'towers', v_session_id)
  ON CONFLICT (user_id) DO UPDATE SET 
    game_name = 'towers',
    game_session_id = v_session_id,
    locked_at = now();
  
  -- Deduct balance
  IF _is_demo THEN
    UPDATE profiles SET demo_balance = demo_balance - _bet_amount WHERE id = _user_id;
  ELSIF _is_freebet THEN
    UPDATE profiles SET freebet_balance = freebet_balance - _bet_amount WHERE id = _user_id;
  ELSE
    UPDATE profiles SET balance = balance - _bet_amount WHERE id = _user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'seed_hash', v_seed_hash,
    'game_number', v_game_number
  );
END;
$$;


--
-- Name: update_achievement_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_achievement_progress() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_achievement RECORD;
  v_current_progress NUMERIC;
  v_profile RECORD;
  v_win_streak INTEGER := 0;
  v_total_wins BIGINT;
  v_games_played BIGINT;
  v_total_wagered NUMERIC;
BEGIN
  -- Получаем профиль пользователя
  SELECT * INTO v_profile FROM profiles WHERE id = NEW.user_id;
  
  -- Подсчитываем статистику
  SELECT COUNT(*) INTO v_games_played FROM game_history WHERE user_id = NEW.user_id;
  SELECT COALESCE(SUM(bet_amount), 0) INTO v_total_wagered FROM game_history WHERE user_id = NEW.user_id;
  SELECT COUNT(*) INTO v_total_wins FROM game_history WHERE user_id = NEW.user_id AND win_amount > 0;
  
  -- Считаем текущую серию побед
  SELECT COUNT(*) INTO v_win_streak
  FROM (
    SELECT win_amount, 
           ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
    FROM game_history 
    WHERE user_id = NEW.user_id
  ) sub
  WHERE win_amount > 0 AND rn <= (
    SELECT COALESCE(MIN(rn) - 1, COUNT(*))
    FROM (
      SELECT win_amount,
             ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
      FROM game_history
      WHERE user_id = NEW.user_id
    ) inner_sub
    WHERE win_amount <= 0
  );
  
  -- Проходим по всем ачивкам
  FOR v_achievement IN 
    SELECT * FROM achievements WHERE is_active = true
  LOOP
    -- Определяем прогресс в зависимости от типа условия
    v_current_progress := 0;
    
    CASE v_achievement.condition_type
      WHEN 'first_game' THEN
        v_current_progress := CASE WHEN v_games_played >= 1 THEN 1 ELSE 0 END;
      WHEN 'level_reached' THEN
        v_current_progress := v_profile.level;
      WHEN 'total_wins' THEN
        IF v_achievement.condition_game IS NULL THEN
          v_current_progress := v_total_wins;
        ELSE
          SELECT COUNT(*) INTO v_current_progress 
          FROM game_history 
          WHERE user_id = NEW.user_id 
            AND game_name = v_achievement.condition_game 
            AND win_amount > 0;
        END IF;
      WHEN 'win_streak' THEN
        v_current_progress := v_win_streak;
      WHEN 'single_win' THEN
        SELECT COALESCE(MAX(win_amount), 0) INTO v_current_progress
        FROM game_history WHERE user_id = NEW.user_id;
      WHEN 'games_played' THEN
        IF v_achievement.condition_game IS NULL THEN
          v_current_progress := v_games_played;
        ELSE
          SELECT COUNT(*) INTO v_current_progress 
          FROM game_history 
          WHERE user_id = NEW.user_id AND game_name = v_achievement.condition_game;
        END IF;
      WHEN 'total_wagered' THEN
        v_current_progress := v_total_wagered;
      ELSE
        v_current_progress := 0;
    END CASE;
    
    -- Обновляем или создаём запись прогресса
    INSERT INTO user_achievements (user_id, achievement_id, progress, is_completed, completed_at)
    VALUES (
      NEW.user_id, 
      v_achievement.id, 
      v_current_progress,
      v_current_progress >= v_achievement.condition_value,
      CASE WHEN v_current_progress >= v_achievement.condition_value THEN now() ELSE NULL END
    )
    ON CONFLICT (user_id, achievement_id) DO UPDATE SET
      progress = EXCLUDED.progress,
      is_completed = CASE 
        WHEN user_achievements.is_completed THEN true 
        ELSE EXCLUDED.is_completed 
      END,
      completed_at = CASE 
        WHEN user_achievements.completed_at IS NOT NULL THEN user_achievements.completed_at 
        ELSE EXCLUDED.completed_at 
      END;
  END LOOP;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_balance(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_balance(user_id uuid, amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET balance = balance + amount
  WHERE id = user_id;
END;
$$;


--
-- Name: update_betting_tournament_results(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_betting_tournament_results() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _tournament RECORD;
  _win_amount NUMERIC;
BEGIN
  -- Only process won bets
  IF NEW.status != 'won' THEN
    RETURN NEW;
  END IF;

  _win_amount := COALESCE(NEW.potential_win, 0);

  -- Find active tournaments
  FOR _tournament IN
    SELECT id FROM betting_tournaments
    WHERE status = 'active'
      AND (end_at IS NULL OR end_at > now())
      AND COALESCE(min_bet_amount, 0) <= NEW.bet_amount
  LOOP
    -- Upsert result
    INSERT INTO betting_tournament_results (tournament_id, user_id, total_wins, total_bets, biggest_win)
    VALUES (_tournament.id, NEW.user_id, _win_amount, 1, _win_amount)
    ON CONFLICT (tournament_id, user_id)
    DO UPDATE SET
      total_wins = betting_tournament_results.total_wins + _win_amount,
      total_bets = betting_tournament_results.total_bets + 1,
      biggest_win = GREATEST(betting_tournament_results.biggest_win, _win_amount),
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;


--
-- Name: update_game_stats(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_game_stats(p_user_id uuid, p_won boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_won THEN
    UPDATE profiles
    SET total_wins = COALESCE(total_wins, 0) + 1
    WHERE id = p_user_id;
  ELSE
    UPDATE profiles
    SET total_losses = COALESCE(total_losses, 0) + 1
    WHERE id = p_user_id;
  END IF;
END;
$$;


--
-- Name: update_task_progress(uuid, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_progress(_user_id uuid, _task_type text, _amount numeric DEFAULT 1, _game_name text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO user_task_progress (user_id, task_id, progress)
  SELECT _user_id, t.id, _amount
  FROM tasks t
  WHERE t.is_active = true 
    AND t.task_type = _task_type
    AND (t.target_game IS NULL OR t.target_game = _game_name)
  ON CONFLICT (user_id, task_id) DO UPDATE 
  SET progress = user_task_progress.progress + _amount
  WHERE user_task_progress.is_completed = false;
END;
$$;


--
-- Name: update_task_progress(uuid, text, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_task_progress(_user_id uuid, _task_type text, _game_name text DEFAULT NULL::text, _amount numeric DEFAULT 1) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO user_task_progress (user_id, task_id, progress)
  SELECT _user_id, t.id, _amount
  FROM tasks t
  WHERE t.is_active = true
    AND t.task_type = _task_type
    AND (
      t.target_game IS NULL
      OR t.target_game = ''
      OR public.normalize_game_name(t.target_game) = public.normalize_game_name(_game_name)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_task_progress utp
      WHERE utp.user_id = _user_id
        AND utp.task_id = t.id
        AND utp.is_completed = true
    )
  ON CONFLICT (user_id, task_id) DO UPDATE
  SET progress = user_task_progress.progress + _amount
  WHERE user_task_progress.is_completed = false;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_username(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_username(_user_id uuid, _new_username text) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if username is already taken
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = _new_username AND id != _user_id) THEN
    RETURN QUERY SELECT FALSE, 'Это имя уже занято'::TEXT;
  END IF;
  
  -- Update username
  UPDATE public.profiles
  SET username = _new_username
  WHERE id = _user_id;
  
  RETURN QUERY SELECT TRUE, 'Имя успешно изменено!'::TEXT;
END;
$$;


--
-- Name: update_wager_progress(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_wager_progress(_user_id uuid, _bet_amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_requirement DECIMAL;
  current_progress DECIMAL;
  freebet_bal DECIMAL;
BEGIN
  SELECT wager_requirement, wager_progress, freebet_balance
  INTO current_requirement, current_progress, freebet_bal
  FROM public.profiles
  WHERE id = _user_id;
  
  -- Если есть требование отыгрыша, обновляем прогресс
  IF current_requirement > 0 THEN
    UPDATE public.profiles
    SET wager_progress = wager_progress + _bet_amount
    WHERE id = _user_id;
    
    -- Если отыграли полностью, конвертируем фрибет в обычный баланс
    IF (current_progress + _bet_amount) >= current_requirement THEN
      UPDATE public.profiles
      SET 
        balance = balance + freebet_balance,
        freebet_balance = 0.00,
        wager_requirement = 0.00,
        wager_progress = 0.00
      WHERE id = _user_id;
    END IF;
  END IF;
END;
$$;


--
-- Name: update_win_loss_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_win_loss_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.win_amount > 0 THEN
    UPDATE public.profiles
    SET total_wins = total_wins + 1
    WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles
    SET total_losses = total_losses + 1
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: upgrade_skin(uuid, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upgrade_skin(_user_id uuid, _inventory_id uuid, _target_skin_id uuid, _use_demo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_inventory RECORD;
  v_target_skin RECORD;
  v_from_price NUMERIC;
  v_to_price NUMERIC;
  v_chance NUMERIC;
  v_roll NUMERIC;
  v_won BOOLEAN;
  v_game_number BIGINT;
BEGIN
  -- Rate limiting
  PERFORM enforce_rate_limit(_user_id, 'upgrader_spin', 500);
  
  -- Получаем инвентарный предмет
  SELECT ui.*, s.price, s.name AS skin_name, s.weapon, ui.is_demo
  INTO v_inventory
  FROM user_inventory ui
  JOIN skins s ON s.id = ui.skin_id
  WHERE ui.id = _inventory_id AND ui.user_id = _user_id;
  
  IF v_inventory IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Предмет не найден');
  END IF;
  
  -- Получаем целевой скин
  SELECT * INTO v_target_skin FROM skins WHERE id = _target_skin_id;
  IF v_target_skin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Целевой скин не найден');
  END IF;
  
  v_from_price := v_inventory.price;
  v_to_price := v_target_skin.price;
  
  -- Рассчитываем шанс: (fromPrice / toPrice) * 87, max 70%, min 1%
  v_chance := LEAST(70, GREATEST(1, (v_from_price / v_to_price) * 87));
  
  -- Бросаем кости
  v_roll := random() * 100;
  v_won := v_roll <= v_chance;
  
  -- Получаем номер игры
  v_game_number := nextval('game_number_seq');
  
  -- Удаляем старый предмет
  DELETE FROM user_inventory WHERE id = _inventory_id;
  
  IF v_won THEN
    -- Даем новый скин
    INSERT INTO user_inventory (user_id, skin_id, purchased_price, is_demo)
    VALUES (_user_id, _target_skin_id, v_to_price, COALESCE(v_inventory.is_demo, _use_demo));
  END IF;
  
  -- Записываем в историю и статистику (если не демо)
  IF NOT COALESCE(v_inventory.is_demo, _use_demo) THEN
    INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier, game_number)
    VALUES (_user_id, 'upgrader', v_from_price, CASE WHEN v_won THEN v_to_price ELSE 0 END, v_to_price / v_from_price, v_game_number);
    
    IF v_won THEN
      UPDATE profiles SET total_wins = COALESCE(total_wins, 0) + 1 WHERE id = _user_id;
    ELSE
      UPDATE profiles SET total_losses = COALESCE(total_losses, 0) + 1 WHERE id = _user_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'won', v_won,
    'chance', v_chance,
    'game_number', v_game_number
  );
END;
$$;


--
-- Name: use_freespin(uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.use_freespin(_user_id uuid, _win_amount numeric, _multiplier numeric DEFAULT 0) RETURNS TABLE(success boolean, message text, remaining_spins integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_spins INTEGER;
  spin_bet NUMERIC;
BEGIN
  SELECT freespins_count, freespin_bet_amount INTO current_spins, spin_bet
  FROM user_freespins WHERE user_id = _user_id;
  
  IF current_spins IS NULL OR current_spins <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Нет фриспинов'::TEXT, 0;
    RETURN;
  END IF;
  
  -- Уменьшаем количество фриспинов
  UPDATE user_freespins 
  SET freespins_count = freespins_count - 1
  WHERE user_id = _user_id;
  
  -- Начисляем выигрыш на основной баланс
  IF _win_amount > 0 THEN
    UPDATE profiles SET balance = balance + _win_amount WHERE id = _user_id;
    
    -- Записываем транзакцию
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (_user_id, _win_amount, 'freespin_win', 'Выигрыш фриспина x' || _multiplier::TEXT);
  END IF;
  
  -- История игры
  INSERT INTO game_history (user_id, game_name, bet_amount, win_amount, multiplier)
  VALUES (_user_id, 'slots_freespin', COALESCE(spin_bet, 16), _win_amount, _multiplier);
  
  -- Статистика
  PERFORM update_game_stats(_user_id, _win_amount > 0);
  
  SELECT freespins_count INTO current_spins FROM user_freespins WHERE user_id = _user_id;
  
  RETURN QUERY SELECT TRUE, 'Фриспин использован'::TEXT, COALESCE(current_spins, 0);
END;
$$;


--
-- Name: validate_user_session(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_user_session(p_user_id uuid, p_session_token text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions
    WHERE user_id = p_user_id
      AND session_token = p_session_token
      AND is_active = true
  ) INTO v_valid;

  IF v_valid THEN
    UPDATE public.user_sessions
    SET last_active_at = now()
    WHERE user_id = p_user_id AND session_token = p_session_token;
  END IF;

  RETURN v_valid;
END;
$$;


--
-- Name: verify_email_code(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_email_code(_user_id uuid, _code text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _verification RECORD;
BEGIN
  -- Ищем действующий код
  SELECT * INTO _verification
  FROM verification_codes
  WHERE user_id = _user_id
    AND code = _code
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF _verification IS NULL THEN
    -- Проверяем, не истек ли код
    IF EXISTS (SELECT 1 FROM verification_codes WHERE user_id = _user_id AND code = _code AND expires_at <= now()) THEN
      RETURN json_build_object('success', false, 'error', 'Код истёк. Запросите новый');
    END IF;
    RETURN json_build_object('success', false, 'error', 'Неверный код');
  END IF;

  -- Помечаем код как использованный
  UPDATE verification_codes SET used = true WHERE id = _verification.id;

  -- Обновляем email пользователя
  UPDATE profiles 
  SET email = _verification.email,
      email_verified_at = now()
  WHERE id = _user_id;

  -- Удаляем все коды пользователя
  DELETE FROM verification_codes WHERE user_id = _user_id;

  RETURN json_build_object(
    'success', true, 
    'email', _verification.email
  );
END;
$$;


--
-- Name: verify_game(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_game(_game_session_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_session game_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM game_sessions WHERE id = _game_session_id;
  
  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Сессия не найдена');
  END IF;
  
  IF v_session.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Игра еще не завершена');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'game_name', v_session.game_name,
    'bet_amount', v_session.bet_amount,
    'win_amount', v_session.win_amount,
    'server_seed', v_session.server_seed,
    'server_seed_hash', hash_seed(v_session.server_seed),
    'client_seed', v_session.client_seed,
    'nonce', v_session.nonce,
    'result', v_session.result,
    'created_at', v_session.created_at,
    'completed_at', v_session.completed_at
  );
END;
$$;


SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    icon text DEFAULT '🏆'::text NOT NULL,
    rarity text DEFAULT 'common'::text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    condition_type text NOT NULL,
    condition_value numeric DEFAULT 1 NOT NULL,
    condition_game text,
    reward_type text DEFAULT 'balance'::text NOT NULL,
    reward_amount numeric DEFAULT 0 NOT NULL,
    reward_skin_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT achievements_category_check CHECK ((category = ANY (ARRAY['general'::text, 'wins'::text, 'games'::text, 'social'::text, 'special'::text]))),
    CONSTRAINT achievements_rarity_check CHECK ((rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text]))),
    CONSTRAINT achievements_reward_type_check CHECK ((reward_type = ANY (ARRAY['balance'::text, 'freebet'::text, 'xp'::text, 'skin'::text, 'wheel'::text])))
);


--
-- Name: action_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    action_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: active_game_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_game_locks (
    user_id uuid NOT NULL,
    game_session_id uuid NOT NULL,
    game_name text NOT NULL,
    locked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: betting_tournament_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.betting_tournament_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    total_wins numeric DEFAULT 0 NOT NULL,
    total_bets integer DEFAULT 0 NOT NULL,
    biggest_win numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: betting_tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.betting_tournaments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'active'::text NOT NULL,
    start_at timestamp with time zone DEFAULT now() NOT NULL,
    end_at timestamp with time zone,
    prize_type text DEFAULT 'balance'::text NOT NULL,
    prize_amount numeric DEFAULT 0 NOT NULL,
    min_bet_amount numeric DEFAULT 10,
    created_by uuid,
    winner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT betting_tournaments_prize_type_check CHECK ((prize_type = ANY (ARRAY['balance'::text, 'freebet'::text, 'betting_freebet'::text, 'wheel'::text]))),
    CONSTRAINT betting_tournaments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'finished'::text, 'cancelled'::text])))
);


--
-- Name: black_crow_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.black_crow_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bonus_wheels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bonus_wheels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone,
    reward_type text,
    reward_amount numeric,
    reward_description text
);


--
-- Name: case_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_type_id text NOT NULL,
    skin_id uuid,
    name text NOT NULL,
    weapon text NOT NULL,
    rarity text NOT NULL,
    price numeric NOT NULL,
    chance numeric NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: case_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_types (
    id text NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 100 NOT NULL,
    icon text DEFAULT 'Package'::text NOT NULL,
    color text DEFAULT 'from-gray-500/20 to-gray-600/30 border-gray-500'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reply_to_id uuid
);


--
-- Name: chicken_road_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chicken_road_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    difficulty text NOT NULL,
    multipliers jsonb NOT NULL,
    trap_chances jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crash_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crash_bets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    round_id uuid NOT NULL,
    user_id uuid NOT NULL,
    bet_amount numeric NOT NULL,
    auto_cashout numeric NOT NULL,
    cashed_out_at numeric,
    win_amount numeric DEFAULT 0,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_freebet boolean DEFAULT false
);


--
-- Name: crash_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crash_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chance_1_00 numeric DEFAULT 0.0625 NOT NULL,
    chance_1_01_1_09 numeric DEFAULT 0.1875 NOT NULL,
    chance_1_10_1_40 numeric DEFAULT 0.20 NOT NULL,
    chance_1_40_2_00 numeric DEFAULT 0.20 NOT NULL,
    chance_2_00_5_00 numeric DEFAULT 0.17 NOT NULL,
    chance_5_00_15_00 numeric DEFAULT 0.11 NOT NULL,
    chance_15_00_35_00 numeric DEFAULT 0.07 NOT NULL,
    betting_time_seconds integer DEFAULT 14 NOT NULL,
    min_multiplier numeric DEFAULT 1.00 NOT NULL,
    max_multiplier numeric DEFAULT 35.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crash_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crash_rounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    round_number bigint NOT NULL,
    multiplier numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    started_at timestamp with time zone,
    crashed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crash_rounds_round_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crash_rounds_round_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crash_rounds_round_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crash_rounds_round_number_seq OWNED BY public.crash_rounds.round_number;


--
-- Name: daily_buff_wheel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_buff_wheel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    last_spin_at timestamp with time zone DEFAULT now() NOT NULL,
    result_type text NOT NULL,
    result_amount numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    last_claimed_at timestamp with time zone,
    total_claimed integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: dice_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dice_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    min_target integer DEFAULT 2 NOT NULL,
    max_target integer DEFAULT 98 NOT NULL,
    house_edge numeric DEFAULT 0.01 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    smtp_host text NOT NULL,
    smtp_port integer DEFAULT 587 NOT NULL,
    smtp_user text NOT NULL,
    smtp_password text NOT NULL,
    display_name text DEFAULT 'Lucky Casino'::text,
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    use_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: game_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    game_name text NOT NULL,
    bet_amount numeric(10,2) NOT NULL,
    win_amount numeric(10,2) DEFAULT 0,
    multiplier numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    game_session_id uuid,
    server_seed_hash text,
    client_seed text,
    nonce integer,
    is_verified boolean DEFAULT false,
    game_number bigint
);


--
-- Name: game_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    game_name text NOT NULL,
    bet_amount numeric NOT NULL,
    is_freebet boolean DEFAULT false,
    is_demo boolean DEFAULT false,
    game_state jsonb DEFAULT '{}'::jsonb,
    server_seed text NOT NULL,
    client_seed text,
    nonce integer DEFAULT 0,
    status text DEFAULT 'active'::text NOT NULL,
    result jsonb,
    win_amount numeric,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    game_number bigint,
    CONSTRAINT game_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'expired'::text])))
);


--
-- Name: game_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    game_name text DEFAULT 'dice'::text NOT NULL,
    min_bet numeric DEFAULT 10.00 NOT NULL,
    max_bet numeric DEFAULT 10000.00 NOT NULL,
    is_maintenance boolean DEFAULT false NOT NULL,
    CONSTRAINT game_settings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'maintenance'::text])))
);


--
-- Name: giveaway_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giveaway_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    giveaway_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: giveaways; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giveaways (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    prize_type text NOT NULL,
    prize_amount numeric DEFAULT 0,
    prize_skin_id uuid,
    participation_type text DEFAULT 'free'::text NOT NULL,
    participation_cost numeric DEFAULT 0,
    min_level integer DEFAULT 1,
    status text DEFAULT 'active'::text NOT NULL,
    winner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    created_by uuid NOT NULL,
    giveaway_mode text DEFAULT 'manual'::text NOT NULL,
    end_at timestamp with time zone,
    registration_ends_at timestamp with time zone,
    achievement_type text,
    achievement_game text,
    achievement_start_at timestamp with time zone,
    has_wheel boolean DEFAULT false,
    wheel_segments jsonb
);


--
-- Name: hilo_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hilo_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_multiplier_increment numeric DEFAULT 0.3 NOT NULL,
    max_win_multiplier numeric DEFAULT 50 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: image_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_cache (
    key text NOT NULL,
    source_url text NOT NULL,
    content_type text NOT NULL,
    data_base64 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: level_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.level_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    level integer NOT NULL,
    claimed_at timestamp with time zone DEFAULT now()
);


--
-- Name: level_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.level_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level integer NOT NULL,
    reward_amount numeric NOT NULL,
    reward_type text DEFAULT 'betting_freebet'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sport text NOT NULL,
    team1_id uuid NOT NULL,
    team2_id uuid NOT NULL,
    team1_odds numeric(4,2) DEFAULT 1.50 NOT NULL,
    team2_odds numeric(4,2) DEFAULT 1.50 NOT NULL,
    draw_odds numeric(4,2),
    has_draw boolean DEFAULT false,
    has_total boolean DEFAULT false,
    total_value numeric(3,1),
    over_odds numeric(4,2),
    under_odds numeric(4,2),
    has_both_score boolean DEFAULT false,
    both_score_yes_odds numeric(4,2),
    both_score_no_odds numeric(4,2),
    match_time timestamp with time zone NOT NULL,
    status text DEFAULT 'upcoming'::text NOT NULL,
    team1_score integer,
    team2_score integer,
    winner text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    map1_team1_odds numeric,
    map1_team2_odds numeric,
    map2_team1_odds numeric,
    map2_team2_odds numeric,
    map3_team1_odds numeric,
    map3_team2_odds numeric,
    exact_score_odds jsonb,
    has_handicap boolean DEFAULT false,
    handicap_value numeric,
    team1_handicap_odds numeric,
    team2_handicap_odds numeric,
    bo_format text DEFAULT 'BO1'::text,
    map1_team1_score integer,
    map1_team2_score integer,
    map2_team1_score integer,
    map2_team2_score integer,
    map3_team1_score integer,
    map3_team2_score integer,
    map1_handicaps jsonb DEFAULT '[]'::jsonb,
    map2_handicaps jsonb DEFAULT '[]'::jsonb,
    map3_handicaps jsonb DEFAULT '[]'::jsonb,
    map1_total_value numeric,
    map1_over_odds numeric,
    map1_under_odds numeric,
    map2_total_value numeric,
    map2_over_odds numeric,
    map2_under_odds numeric,
    map3_total_value numeric,
    map3_over_odds numeric,
    map3_under_odds numeric,
    map1_betting_closed boolean DEFAULT false,
    map2_betting_closed boolean DEFAULT false,
    map3_betting_closed boolean DEFAULT false,
    map4_team1_odds numeric,
    map4_team2_odds numeric,
    map4_team1_score integer,
    map4_team2_score integer,
    map4_betting_closed boolean DEFAULT false,
    map4_total_value numeric,
    map4_over_odds numeric,
    map4_under_odds numeric,
    map4_handicaps jsonb DEFAULT '[]'::jsonb,
    map5_team1_odds numeric,
    map5_team2_odds numeric,
    map5_team1_score integer,
    map5_team2_score integer,
    map5_betting_closed boolean DEFAULT false,
    map5_total_value numeric,
    map5_over_odds numeric,
    map5_under_odds numeric,
    map5_handicaps jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT matches_sport_check CHECK ((sport = ANY (ARRAY['football'::text, 'csgo'::text, 'dota2'::text]))),
    CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'live'::text, 'finished'::text]))),
    CONSTRAINT matches_winner_check CHECK ((winner = ANY (ARRAY['team1'::text, 'team2'::text, 'draw'::text])))
);


--
-- Name: mines_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mines_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grid_size integer DEFAULT 25 NOT NULL,
    min_mines integer DEFAULT 2 NOT NULL,
    max_mines integer DEFAULT 24 NOT NULL,
    max_multiplier numeric DEFAULT 24 NOT NULL,
    house_edge_low numeric DEFAULT 0.08 NOT NULL,
    house_edge_medium numeric DEFAULT 0.12 NOT NULL,
    house_edge_high numeric DEFAULT 0.25 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: parlay_bet_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parlay_bet_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parlay_bet_id uuid NOT NULL,
    match_id uuid NOT NULL,
    bet_type text NOT NULL,
    odds numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text,
    original_bet_type text,
    original_odds numeric
);


--
-- Name: parlay_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parlay_bets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    total_amount numeric NOT NULL,
    total_odds numeric NOT NULL,
    potential_win numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_freebet boolean DEFAULT false
);


--
-- Name: preset_wheel_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preset_wheel_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    preset_result text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    is_used boolean DEFAULT false,
    used_at timestamp with time zone
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_id bigint NOT NULL,
    username text DEFAULT ('player'::text || (floor((random() * (1000000)::double precision)))::text) NOT NULL,
    balance numeric(10,2) DEFAULT 0.00 NOT NULL,
    is_banned boolean DEFAULT false,
    is_muted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    total_wins integer DEFAULT 0,
    total_losses integer DEFAULT 0,
    last_seen_message_at timestamp with time zone DEFAULT now(),
    guaranteed_max_win boolean DEFAULT false,
    referral_code text,
    referred_by uuid,
    freebet_balance numeric(10,2) DEFAULT 0.00,
    wager_requirement numeric(10,2) DEFAULT 0.00,
    wager_progress numeric(10,2) DEFAULT 0.00,
    betting_freebet_balance numeric DEFAULT 0.00,
    xp integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    is_vip boolean DEFAULT false,
    gradient_color text DEFAULT 'gold'::text,
    public_id integer NOT NULL,
    demo_balance numeric DEFAULT 0.00 NOT NULL,
    profile_background text DEFAULT 'none'::text,
    avatar_url text,
    email text,
    email_verified_at timestamp with time zone
);


--
-- Name: promocode_activations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promocode_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    promocode_id uuid NOT NULL,
    activated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: promocodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promocodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    reward_type text NOT NULL,
    reward_amount numeric DEFAULT 0 NOT NULL,
    max_uses integer,
    current_uses integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT promocodes_reward_type_check CHECK ((reward_type = ANY (ARRAY['balance'::text, 'money'::text, 'freebet'::text, 'betting_freebet'::text, 'wheel'::text, 'freespins'::text, 'demo_balance'::text, 'admin'::text])))
);


--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_profiles AS
 SELECT id,
    username,
    avatar_url,
    level,
    xp,
    is_vip,
    gradient_color,
    profile_background,
    total_wins,
    total_losses,
    public_id,
    created_at
   FROM public.profiles;


--
-- Name: referral_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referred_id uuid NOT NULL,
    reward_amount numeric DEFAULT 100.00 NOT NULL,
    claimed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    claimed_at timestamp with time zone
);


--
-- Name: registration_wheel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registration_wheel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reward_type text NOT NULL,
    reward_amount numeric NOT NULL,
    reward_description text NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roulette_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roulette_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number_multiplier integer DEFAULT 36 NOT NULL,
    color_multiplier integer DEFAULT 2 NOT NULL,
    dozen_multiplier integer DEFAULT 3 NOT NULL,
    column_multiplier integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: roulette_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roulette_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number integer NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT roulette_history_color_check CHECK ((color = ANY (ARRAY['red'::text, 'black'::text, 'green'::text]))),
    CONSTRAINT roulette_history_number_check CHECK (((number >= 0) AND (number <= 36)))
);


--
-- Name: skins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    weapon text NOT NULL,
    category text NOT NULL,
    rarity text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_read boolean DEFAULT false
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    task_type text NOT NULL,
    target_value numeric DEFAULT 1 NOT NULL,
    target_game text,
    reward_type text NOT NULL,
    reward_amount numeric DEFAULT 0 NOT NULL,
    buff_duration_hours integer DEFAULT 24,
    is_active boolean DEFAULT true NOT NULL,
    is_daily boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tasks_reward_type_check CHECK ((reward_type = ANY (ARRAY['wins'::text, 'buff_x2'::text, 'buff_x3'::text, 'buff_x5'::text, 'buff_x10'::text, 'freebet'::text, 'betting_freebet'::text, 'wheel'::text, 'freespins'::text, 'balance'::text]))),
    CONSTRAINT tasks_task_type_check CHECK ((task_type = ANY (ARRAY['game_wins'::text, 'total_bet'::text, 'daily_login'::text, 'referral'::text, 'deposit'::text, 'custom'::text])))
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    logo_url text NOT NULL,
    sport text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT teams_sport_check CHECK ((sport = ANY (ARRAY['football'::text, 'csgo'::text, 'dota2'::text])))
);


--
-- Name: towers_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.towers_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mines_per_row integer DEFAULT 2 NOT NULL,
    columns_count integer DEFAULT 5 NOT NULL,
    rows_count integer DEFAULT 11 NOT NULL,
    multipliers jsonb DEFAULT '[1.20, 1.50, 2.20, 4.50, 9.0, 15.0, 25.0, 42.0, 70.0, 120.0, 250.0]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    type text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    progress numeric DEFAULT 0 NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    is_claimed boolean DEFAULT false NOT NULL,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_bets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    match_id uuid NOT NULL,
    bet_type text NOT NULL,
    bet_amount numeric NOT NULL,
    odds numeric(4,2) NOT NULL,
    potential_win numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_freebet boolean DEFAULT false,
    handicap_value numeric,
    CONSTRAINT user_bets_bet_type_check CHECK (((bet_type = ANY (ARRAY['team1_win'::text, 'team2_win'::text, 'draw'::text, 'over'::text, 'under'::text, 'both_score_yes'::text, 'both_score_no'::text, 'team1_handicap'::text, 'team2_handicap'::text, 'map1_team1'::text, 'map1_team2'::text, 'map2_team1'::text, 'map2_team2'::text, 'map3_team1'::text, 'map3_team2'::text, 'map1_team1_handicap'::text, 'map1_team2_handicap'::text, 'map2_team1_handicap'::text, 'map2_team2_handicap'::text, 'map3_team1_handicap'::text, 'map3_team2_handicap'::text, 'map1_over'::text, 'map1_under'::text, 'map2_over'::text, 'map2_under'::text, 'map3_over'::text, 'map3_under'::text])) OR (bet_type ~~ 'exact_%'::text))),
    CONSTRAINT user_bets_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'won'::text, 'lost'::text])))
);


--
-- Name: user_buffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_buffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    buff_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    given_by uuid,
    CONSTRAINT user_buffs_buff_type_check CHECK ((buff_type = ANY (ARRAY['x2'::text, 'x3'::text, 'x5'::text, 'x10'::text, 'x0.5'::text])))
);


--
-- Name: user_freespins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_freespins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    freespins_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    freespin_bet_amount numeric DEFAULT 16.00
);


--
-- Name: user_game_restrictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_game_restrictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    game_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    skin_id uuid NOT NULL,
    purchased_at timestamp with time zone DEFAULT now(),
    purchased_price numeric DEFAULT 0 NOT NULL,
    is_demo boolean DEFAULT false
);


--
-- Name: user_moderation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_moderation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    is_banned boolean DEFAULT false NOT NULL,
    muted_until timestamp with time zone,
    banned_by uuid,
    muted_by uuid,
    ban_reason text,
    mute_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    last_action_at timestamp with time zone DEFAULT now(),
    action_count integer DEFAULT 1
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'user'::text])))
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    device_info text,
    created_at timestamp with time zone DEFAULT now(),
    last_active_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);

ALTER TABLE ONLY public.user_sessions REPLICA IDENTITY FULL;


--
-- Name: user_task_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_task_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid NOT NULL,
    progress numeric DEFAULT 0 NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    last_reset_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_task_progress REPLICA IDENTITY FULL;


--
-- Name: verification_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    code text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval) NOT NULL,
    used boolean DEFAULT false
);


--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric NOT NULL,
    payment_details text NOT NULL,
    comment text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT withdrawal_requests_amount_check CHECK ((amount >= (1000)::numeric)),
    CONSTRAINT withdrawal_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: crash_rounds round_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crash_rounds ALTER COLUMN round_number SET DEFAULT nextval('public.crash_rounds_round_number_seq'::regclass);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: action_logs action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_logs
    ADD CONSTRAINT action_logs_pkey PRIMARY KEY (id);


--
-- Name: active_game_locks active_game_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_game_locks
    ADD CONSTRAINT active_game_locks_pkey PRIMARY KEY (user_id);


--
-- Name: betting_tournament_results betting_tournament_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.betting_tournament_results
    ADD CONSTRAINT betting_tournament_results_pkey PRIMARY KEY (id);


--
-- Name: betting_tournament_results betting_tournament_results_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.betting_tournament_results
    ADD CONSTRAINT betting_tournament_results_tournament_id_user_id_key UNIQUE (tournament_id, user_id);


--
-- Name: betting_tournaments betting_tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.betting_tournaments
    ADD CONSTRAINT betting_tournaments_pkey PRIMARY KEY (id);


--
-- Name: black_crow_access black_crow_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.black_crow_access
    ADD CONSTRAINT black_crow_access_pkey PRIMARY KEY (id);


--
-- Name: black_crow_access black_crow_access_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.black_crow_access
    ADD CONSTRAINT black_crow_access_user_id_key UNIQUE (user_id);


--
-- Name: bonus_wheels bonus_wheels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bonus_wheels
    ADD CONSTRAINT bonus_wheels_pkey PRIMARY KEY (id);


--
-- Name: case_items case_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_items
    ADD CONSTRAINT case_items_pkey PRIMARY KEY (id);


--
-- Name: case_types case_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_types
    ADD CONSTRAINT case_types_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chicken_road_config chicken_road_config_difficulty_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chicken_road_config
    ADD CONSTRAINT chicken_road_config_difficulty_key UNIQUE (difficulty);


--
-- Name: chicken_road_config chicken_road_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chicken_road_config
    ADD CONSTRAINT chicken_road_config_pkey PRIMARY KEY (id);


--
-- Name: crash_bets crash_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crash_bets
    ADD CONSTRAINT crash_bets_pkey PRIMARY KEY (id);


--
-- Name: crash_config crash_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crash_config
    ADD CONSTRAINT crash_config_pkey PRIMARY KEY (id);


--
-- Name: crash_rounds crash_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crash_rounds
    ADD CONSTRAINT crash_rounds_pkey PRIMARY KEY (id);


--
-- Name: crash_rounds crash_rounds_round_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crash_rounds
    ADD CONSTRAINT crash_rounds_round_number_key UNIQUE (round_number);


--
-- Name: daily_buff_wheel daily_buff_wheel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_buff_wheel
    ADD CONSTRAINT daily_buff_wheel_pkey PRIMARY KEY (id);


--
-- Name: daily_rewards daily_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_rewards
    ADD CONSTRAINT daily_rewards_pkey PRIMARY KEY (id);


--
-- Name: daily_rewards daily_rewards_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_rewards
    ADD CONSTRAINT daily_rewards_user_id_key UNIQUE (user_id);


--
-- Name: dice_config dice_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dice_config
    ADD CONSTRAINT dice_config_pkey PRIMARY KEY (id);


--
-- Name: email_accounts email_accounts_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_email_key UNIQUE (email);


--
-- Name: email_accounts email_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_pkey PRIMARY KEY (id);


--
-- Name: game_history game_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_history
    ADD CONSTRAINT game_history_pkey PRIMARY KEY (id);


--
-- Name: game_sessions game_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_sessions
    ADD CONSTRAINT game_sessions_pkey PRIMARY KEY (id);


--
-- Name: game_settings game_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_settings
    ADD CONSTRAINT game_settings_pkey PRIMARY KEY (id);


--
-- Name: giveaway_participants giveaway_participants_giveaway_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_participants
    ADD CONSTRAINT giveaway_participants_giveaway_id_user_id_key UNIQUE (giveaway_id, user_id);


--
-- Name: giveaway_participants giveaway_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_participants
    ADD CONSTRAINT giveaway_participants_pkey PRIMARY KEY (id);


--
-- Name: giveaways giveaways_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaways
    ADD CONSTRAINT giveaways_pkey PRIMARY KEY (id);


--
-- Name: hilo_config hilo_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hilo_config
    ADD CONSTRAINT hilo_config_pkey PRIMARY KEY (id);


--
-- Name: image_cache image_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_cache
    ADD CONSTRAINT image_cache_pkey PRIMARY KEY (key);


--
-- Name: level_claims level_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_claims
    ADD CONSTRAINT level_claims_pkey PRIMARY KEY (id);


--
-- Name: level_claims level_claims_user_id_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_claims
    ADD CONSTRAINT level_claims_user_id_level_key UNIQUE (user_id, level);


--
-- Name: level_rewards level_rewards_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_rewards
    ADD CONSTRAINT level_rewards_level_key UNIQUE (level);


--
-- Name: level_rewards level_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_rewards
    ADD CONSTRAINT level_rewards_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: mines_config mines_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mines_config
    ADD CONSTRAINT mines_config_pkey PRIMARY KEY (id);


--
-- Name: parlay_bet_items parlay_bet_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parlay_bet_items
    ADD CONSTRAINT parlay_bet_items_pkey PRIMARY KEY (id);


--
-- Name: parlay_bets parlay_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parlay_bets
    ADD CONSTRAINT parlay_bets_pkey PRIMARY KEY (id);


--
-- Name: preset_wheel_results preset_wheel_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preset_wheel_results
    ADD CONSTRAINT preset_wheel_results_pkey PRIMARY KEY (id);


--
-- Name: preset_wheel_results preset_wheel_results_user_id_is_used_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preset_wheel_results
    ADD CONSTRAINT preset_wheel_results_user_id_is_used_key UNIQUE (user_id, is_used);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: profiles profiles_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_telegram_id_key UNIQUE (telegram_id);


--
-- Name: promocode_activations promocode_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promocode_activations
    ADD CONSTRAINT promocode_activations_pkey PRIMARY KEY (id);


--
-- Name: promocodes promocodes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promocodes
    ADD CONSTRAINT promocodes_code_key UNIQUE (code);


--
-- Name: promocodes promocodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promocodes
    ADD CONSTRAINT promocodes_pkey PRIMARY KEY (id);


--
-- Name: referral_rewards referral_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_pkey PRIMARY KEY (id);


--
-- Name: referral_rewards referral_rewards_referrer_id_referred_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referrer_id_referred_id_key UNIQUE (referrer_id, referred_id);


--
-- Name: registration_wheel registration_wheel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_wheel
    ADD CONSTRAINT registration_wheel_pkey PRIMARY KEY (id);


--
-- Name: registration_wheel registration_wheel_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_wheel
    ADD CONSTRAINT registration_wheel_user_id_key UNIQUE (user_id);


--
-- Name: roulette_config roulette_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roulette_config
    ADD CONSTRAINT roulette_config_pkey PRIMARY KEY (id);


--
-- Name: roulette_history roulette_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roulette_history
    ADD CONSTRAINT roulette_history_pkey PRIMARY KEY (id);


--
-- Name: skins skins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skins
    ADD CONSTRAINT skins_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_notifications system_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_notifications
    ADD CONSTRAINT system_notifications_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: towers_config towers_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.towers_config
    ADD CONSTRAINT towers_config_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_user_id_achievement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id);


--
-- Name: user_bets user_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bets
    ADD CONSTRAINT user_bets_pkey PRIMARY KEY (id);


--
-- Name: user_buffs user_buffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_buffs
    ADD CONSTRAINT user_buffs_pkey PRIMARY KEY (id);


--
-- Name: user_freespins user_freespins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_freespins
    ADD CONSTRAINT user_freespins_pkey PRIMARY KEY (id);


--
-- Name: user_freespins user_freespins_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_freespins
    ADD CONSTRAINT user_freespins_user_id_key UNIQUE (user_id);


--
-- Name: user_game_restrictions user_game_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_game_restrictions
    ADD CONSTRAINT user_game_restrictions_pkey PRIMARY KEY (id);


--
-- Name: user_game_restrictions user_game_restrictions_user_id_game_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_game_restrictions
    ADD CONSTRAINT user_game_restrictions_user_id_game_name_key UNIQUE (user_id, game_name);


--
-- Name: user_inventory user_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_pkey PRIMARY KEY (id);


--
-- Name: user_moderation user_moderation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_moderation
    ADD CONSTRAINT user_moderation_pkey PRIMARY KEY (id);


--
-- Name: user_moderation user_moderation_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_moderation
    ADD CONSTRAINT user_moderation_user_id_key UNIQUE (user_id);


--
-- Name: user_rate_limits user_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rate_limits
    ADD CONSTRAINT user_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: user_rate_limits user_rate_limits_user_id_action_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rate_limits
    ADD CONSTRAINT user_rate_limits_user_id_action_type_key UNIQUE (user_id, action_type);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- Name: user_sessions user_sessions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_key UNIQUE (user_id);


--
-- Name: user_task_progress user_task_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_task_progress
    ADD CONSTRAINT user_task_progress_pkey PRIMARY KEY (id);


--
-- Name: user_task_progress user_task_progress_user_id_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_task_progress
    ADD CONSTRAINT user_task_progress_user_id_task_id_key UNIQUE (user_id, task_id);


--
-- Name: verification_codes verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT verification_codes_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_achievements_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_achievements_category ON public.achievements USING btree (category);


--
-- Name: idx_achievements_rarity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_achievements_rarity ON public.achievements USING btree (rarity);


--
-- Name: idx_action_logs_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_action_type ON public.action_logs USING btree (action_type);


--
-- Name: idx_action_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_created_at ON public.action_logs USING btree (created_at DESC);


--
-- Name: idx_action_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_logs_user_id ON public.action_logs USING btree (user_id);


--
-- Name: idx_case_items_case_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_items_case_type ON public.case_items USING btree (case_type_id);


--
-- Name: idx_game_history_game_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_history_game_number ON public.game_history USING btree (game_number);


--
-- Name: idx_game_sessions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_sessions_created ON public.game_sessions USING btree (created_at);


--
-- Name: idx_game_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_sessions_user_active ON public.game_sessions USING btree (user_id, status) WHERE (status = 'active'::text);


--
-- Name: idx_profiles_guaranteed_max_win; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_guaranteed_max_win ON public.profiles USING btree (guaranteed_max_win) WHERE (guaranteed_max_win = true);


--
-- Name: idx_roulette_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roulette_history_created_at ON public.roulette_history USING btree (created_at DESC);


--
-- Name: idx_support_messages_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_messages_ticket_id ON public.support_messages USING btree (ticket_id);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_support_tickets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_user_id ON public.support_tickets USING btree (user_id);


--
-- Name: idx_user_achievements_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_achievements_completed ON public.user_achievements USING btree (user_id, is_completed);


--
-- Name: idx_user_achievements_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_achievements_user ON public.user_achievements USING btree (user_id);


--
-- Name: idx_verification_codes_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_codes_email ON public.verification_codes USING btree (email);


--
-- Name: idx_verification_codes_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_codes_expires ON public.verification_codes USING btree (expires_at);


--
-- Name: idx_verification_codes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_codes_user_id ON public.verification_codes USING btree (user_id);


--
-- Name: idx_withdrawal_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests USING btree (status);


--
-- Name: idx_withdrawal_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_requests_user_id ON public.withdrawal_requests USING btree (user_id);


--
-- Name: profiles_public_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_public_id_unique ON public.profiles USING btree (public_id);


--
-- Name: user_bets on_bet_win_xp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_bet_win_xp AFTER UPDATE ON public.user_bets FOR EACH ROW EXECUTE FUNCTION public.on_bet_win_add_xp();


--
-- Name: chat_messages on_chat_reply_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_chat_reply_notification AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.notify_chat_reply();


--
-- Name: game_history on_game_win_xp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_game_win_xp AFTER INSERT ON public.game_history FOR EACH ROW EXECUTE FUNCTION public.on_game_win_add_xp();


--
-- Name: parlay_bets on_parlay_win_xp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_parlay_win_xp AFTER UPDATE ON public.parlay_bets FOR EACH ROW EXECUTE FUNCTION public.on_parlay_win_add_xp();


--
-- Name: profiles on_vip_status_given; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_vip_status_given AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.on_vip_status_given();


--
-- Name: profiles protect_profile_sensitive_fields_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_profile_sensitive_fields_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();


--
-- Name: profiles set_referral_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_referral_code BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_generate_referral_code();


--
-- Name: game_history trg_game_history_task_progress; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_game_history_task_progress AFTER INSERT ON public.game_history FOR EACH ROW EXECUTE FUNCTION public.on_game_history_insert_update_tasks();


--
-- Name: user_bets trigger_bet_settled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_bet_settled AFTER UPDATE ON public.user_bets FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.on_bet_settled();


--
-- Name: profiles trigger_freebet_given; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_freebet_given AFTER UPDATE ON public.profiles FOR EACH ROW WHEN (((old.freebet_balance IS DISTINCT FROM new.freebet_balance) OR (old.betting_freebet_balance IS DISTINCT FROM new.betting_freebet_balance))) EXECUTE FUNCTION public.on_freebet_given();


--
-- Name: parlay_bets trigger_parlay_settled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_parlay_settled AFTER UPDATE ON public.parlay_bets FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.on_parlay_settled();


--
-- Name: profiles trigger_reset_wager_on_zero_freebet; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_reset_wager_on_zero_freebet BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.reset_wager_on_zero_freebet();


--
-- Name: support_tickets trigger_support_ticket_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_support_ticket_created AFTER INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.on_support_ticket_created();


--
-- Name: game_history trigger_update_achievements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_achievements AFTER INSERT ON public.game_history FOR EACH ROW EXECUTE FUNCTION public.update_achievement_progress();


--
-- Name: parlay_bets trigger_update_betting_tournament_parlay_bets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_betting_tournament_parlay_bets AFTER UPDATE OF status ON public.parlay_bets FOR EACH ROW WHEN ((new.status = 'won'::text)) EXECUTE FUNCTION public.update_betting_tournament_results();


--
-- Name: user_bets trigger_update_betting_tournament_user_bets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_betting_tournament_user_bets AFTER UPDATE OF status ON public.user_bets FOR EACH ROW WHEN ((new.status = 'won'::text)) EXECUTE FUNCTION public.update_betting_tournament_results();


--
-- Name: withdrawal_requests trigger_withdrawal_request_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_withdrawal_request_created AFTER INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.on_withdrawal_request_created();


--
-- Name: withdrawal_requests trigger_withdrawal_status_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_withdrawal_status_changed AFTER UPDATE ON public.withdrawal_requests FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.on_withdrawal_status_changed();


--
-- Name: chicken_road_config update_chicken_road_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chicken_road_config_updated_at BEFORE UPDATE ON public.chicken_road_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: image_cache update_image_cache_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_image_cache_updated_at BEFORE UPDATE ON public.image_cache FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: matches update_matches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: game_history update_stats_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stats_trigger AFTER INSERT ON public.game_history FOR EACH ROW EXECUTE FUNCTION public.update_win_loss_stats();


--
-- Name: support_tickets update_support_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_moderation update_user_moderation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_moderation_updated_at BEFORE UPDATE ON public.user_moderation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: achievements achievements_reward_skin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_reward_skin_id_fkey FOREIGN KEY (reward_skin_id) REFERENCES public.skins(id);


--
-- Name: active_game_locks active_game_locks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_game_locks
    ADD CONSTRAINT active_game_locks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: betting_tournament_results betting_tournament_results_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.betting_tournament_results
    ADD CONSTRAINT betting_tournament_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.betting_tournaments(id) ON DELETE CASCADE;


--
-- Name: betting_tournament_results betting_tournament_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.betting_tournament_results
    ADD CONSTRAINT betting_tournament_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: betting_tournaments betting_tournaments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.betting_tournaments
    ADD CONSTRAINT betting_tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: betting_tournaments betting_tournaments_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.betting_tournaments
    ADD CONSTRAINT betting_tournaments_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);


--
-- Name: black_crow_access black_crow_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.black_crow_access
    ADD CONSTRAINT black_crow_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id);


--
-- Name: black_crow_access black_crow_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.black_crow_access
    ADD CONSTRAINT black_crow_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: case_items case_items_case_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_items
    ADD CONSTRAINT case_items_case_type_id_fkey FOREIGN KEY (case_type_id) REFERENCES public.case_types(id) ON DELETE CASCADE;


--
-- Name: case_items case_items_skin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_items
    ADD CONSTRAINT case_items_skin_id_fkey FOREIGN KEY (skin_id) REFERENCES public.skins(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: crash_bets crash_bets_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crash_bets
    ADD CONSTRAINT crash_bets_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.crash_rounds(id) ON DELETE CASCADE;


--
-- Name: crash_bets crash_bets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crash_bets
    ADD CONSTRAINT crash_bets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: daily_rewards daily_rewards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_rewards
    ADD CONSTRAINT daily_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: game_history game_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_history
    ADD CONSTRAINT game_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: game_sessions game_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_sessions
    ADD CONSTRAINT game_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: giveaway_participants giveaway_participants_giveaway_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_participants
    ADD CONSTRAINT giveaway_participants_giveaway_id_fkey FOREIGN KEY (giveaway_id) REFERENCES public.giveaways(id) ON DELETE CASCADE;


--
-- Name: giveaway_participants giveaway_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaway_participants
    ADD CONSTRAINT giveaway_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: giveaways giveaways_prize_skin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaways
    ADD CONSTRAINT giveaways_prize_skin_id_fkey FOREIGN KEY (prize_skin_id) REFERENCES public.skins(id);


--
-- Name: giveaways giveaways_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giveaways
    ADD CONSTRAINT giveaways_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);


--
-- Name: level_claims level_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.level_claims
    ADD CONSTRAINT level_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: matches matches_team1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team1_id_fkey FOREIGN KEY (team1_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: matches matches_team2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team2_id_fkey FOREIGN KEY (team2_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: parlay_bet_items parlay_bet_items_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parlay_bet_items
    ADD CONSTRAINT parlay_bet_items_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id);


--
-- Name: parlay_bet_items parlay_bet_items_parlay_bet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parlay_bet_items
    ADD CONSTRAINT parlay_bet_items_parlay_bet_id_fkey FOREIGN KEY (parlay_bet_id) REFERENCES public.parlay_bets(id) ON DELETE CASCADE;


--
-- Name: preset_wheel_results preset_wheel_results_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preset_wheel_results
    ADD CONSTRAINT preset_wheel_results_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: preset_wheel_results preset_wheel_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preset_wheel_results
    ADD CONSTRAINT preset_wheel_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.profiles(id);


--
-- Name: promocode_activations promocode_activations_promocode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promocode_activations
    ADD CONSTRAINT promocode_activations_promocode_id_fkey FOREIGN KEY (promocode_id) REFERENCES public.promocodes(id) ON DELETE CASCADE;


--
-- Name: referral_rewards referral_rewards_referred_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: referral_rewards referral_rewards_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: system_notifications system_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_notifications
    ADD CONSTRAINT system_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_bets user_bets_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bets
    ADD CONSTRAINT user_bets_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: user_buffs user_buffs_given_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_buffs
    ADD CONSTRAINT user_buffs_given_by_fkey FOREIGN KEY (given_by) REFERENCES public.profiles(id);


--
-- Name: user_buffs user_buffs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_buffs
    ADD CONSTRAINT user_buffs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_game_restrictions user_game_restrictions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_game_restrictions
    ADD CONSTRAINT user_game_restrictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_inventory user_inventory_skin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_skin_id_fkey FOREIGN KEY (skin_id) REFERENCES public.skins(id) ON DELETE CASCADE;


--
-- Name: user_inventory user_inventory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_moderation user_moderation_banned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_moderation
    ADD CONSTRAINT user_moderation_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: user_moderation user_moderation_muted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_moderation
    ADD CONSTRAINT user_moderation_muted_by_fkey FOREIGN KEY (muted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: user_moderation user_moderation_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_moderation
    ADD CONSTRAINT user_moderation_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_rate_limits user_rate_limits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_rate_limits
    ADD CONSTRAINT user_rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_task_progress user_task_progress_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_task_progress
    ADD CONSTRAINT user_task_progress_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: user_task_progress user_task_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_task_progress
    ADD CONSTRAINT user_task_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: verification_codes verification_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT verification_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: withdrawal_requests withdrawal_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: giveaways Admin-created giveaways can be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin-created giveaways can be deleted" ON public.giveaways FOR DELETE USING (public.is_admin(created_by));


--
-- Name: giveaways Admin-created giveaways can be inserted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin-created giveaways can be inserted" ON public.giveaways FOR INSERT WITH CHECK (public.is_admin(created_by));


--
-- Name: giveaways Admin-created giveaways can be updated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin-created giveaways can be updated" ON public.giveaways FOR UPDATE USING (public.is_admin(created_by)) WITH CHECK (public.is_admin(created_by));


--
-- Name: matches Admins can delete matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete matches" ON public.matches FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: promocodes Admins can delete promocodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete promocodes" ON public.promocodes FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can delete teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: black_crow_access Admins can grant access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can grant access" ON public.black_crow_access FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chicken_road_config Admins can insert chicken road config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert chicken road config" ON public.chicken_road_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: crash_config Admins can insert crash config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert crash config" ON public.crash_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: dice_config Admins can insert dice config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert dice config" ON public.dice_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hilo_config Admins can insert hilo config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert hilo config" ON public.hilo_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: matches Admins can insert matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert matches" ON public.matches FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: mines_config Admins can insert mines config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert mines config" ON public.mines_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: promocodes Admins can insert promocodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert promocodes" ON public.promocodes FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: roulette_config Admins can insert roulette config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roulette config" ON public.roulette_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can insert teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert teams" ON public.teams FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: towers_config Admins can insert towers config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert towers config" ON public.towers_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_bets Admins can manage bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage bets" ON public.user_bets USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bonus_wheels Admins can manage bonus wheels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage bonus wheels" ON public.bonus_wheels USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_buffs Admins can manage buffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage buffs" ON public.user_buffs USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: case_items Admins can manage case items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage case items" ON public.case_items USING (public.is_admin(auth.uid()));


--
-- Name: case_types Admins can manage case types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage case types" ON public.case_types USING (public.is_admin(auth.uid()));


--
-- Name: crash_bets Admins can manage crash bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage crash bets" ON public.crash_bets USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: daily_rewards Admins can manage daily rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage daily rewards" ON public.daily_rewards USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_freespins Admins can manage freespins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage freespins" ON public.user_freespins USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: giveaways Admins can manage giveaways; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage giveaways" ON public.giveaways USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_inventory Admins can manage inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage inventory" ON public.user_inventory USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_moderation Admins can manage moderation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage moderation" ON public.user_moderation USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: system_notifications Admins can manage notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage notifications" ON public.system_notifications USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: parlay_bet_items Admins can manage parlay bet items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage parlay bet items" ON public.parlay_bet_items USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: parlay_bets Admins can manage parlay bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage parlay bets" ON public.parlay_bets USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: giveaway_participants Admins can manage participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage participants" ON public.giveaway_participants USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: referral_rewards Admins can manage referral rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage referral rewards" ON public.referral_rewards USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_game_restrictions Admins can manage restrictions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage restrictions" ON public.user_game_restrictions USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: skins Admins can manage skins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage skins" ON public.skins USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: support_tickets Admins can manage support tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage support tickets" ON public.support_tickets USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tasks Admins can manage tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage tasks" ON public.tasks USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: betting_tournaments Admins can manage tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage tournaments" ON public.betting_tournaments USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text)))));


--
-- Name: black_crow_access Admins can revoke access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can revoke access" ON public.black_crow_access FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chicken_road_config Admins can update chicken road config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update chicken road config" ON public.chicken_road_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: crash_config Admins can update crash config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update crash config" ON public.crash_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: dice_config Admins can update dice config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update dice config" ON public.dice_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: game_settings Admins can update game settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update game settings" ON public.game_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hilo_config Admins can update hilo config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update hilo config" ON public.hilo_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: matches Admins can update matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update matches" ON public.matches FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: mines_config Admins can update mines config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update mines config" ON public.mines_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: promocodes Admins can update promocodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update promocodes" ON public.promocodes FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: roulette_config Admins can update roulette config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roulette config" ON public.roulette_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can update teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: towers_config Admins can update towers config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update towers config" ON public.towers_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: action_logs Admins can view all action logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all action logs" ON public.action_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: transactions Admins can view all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all transactions" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: action_logs Allow action log inserts via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow action log inserts via RPC" ON public.action_logs FOR INSERT WITH CHECK (true);


--
-- Name: support_tickets Allow all via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all via RPC" ON public.support_tickets USING (true) WITH CHECK (true);


--
-- Name: user_bets Allow bet inserts via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow bet inserts via RPC" ON public.user_bets FOR INSERT WITH CHECK (true);


--
-- Name: user_bets Allow bet updates via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow bet updates via RPC" ON public.user_bets FOR UPDATE USING (true);


--
-- Name: crash_bets Allow crash bet inserts via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow crash bet inserts via RPC" ON public.crash_bets FOR INSERT WITH CHECK (true);


--
-- Name: crash_bets Allow crash bet updates via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow crash bet updates via RPC" ON public.crash_bets FOR UPDATE USING (true);


--
-- Name: user_freespins Allow freespin management via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow freespin management via RPC" ON public.user_freespins USING (true);


--
-- Name: game_history Allow game history inserts via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow game history inserts via RPC" ON public.game_history FOR INSERT WITH CHECK (true);


--
-- Name: parlay_bets Allow parlay bet inserts via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow parlay bet inserts via RPC" ON public.parlay_bets FOR INSERT WITH CHECK (true);


--
-- Name: parlay_bet_items Allow parlay bet item inserts via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow parlay bet item inserts via RPC" ON public.parlay_bet_items FOR INSERT WITH CHECK (true);


--
-- Name: parlay_bet_items Allow parlay bet item updates via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow parlay bet item updates via RPC" ON public.parlay_bet_items FOR UPDATE USING (true);


--
-- Name: parlay_bets Allow parlay bet updates via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow parlay bet updates via RPC" ON public.parlay_bets FOR UPDATE USING (true);


--
-- Name: referral_rewards Allow referral reward inserts via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow referral reward inserts via RPC" ON public.referral_rewards FOR INSERT WITH CHECK (true);


--
-- Name: transactions Allow transaction inserts via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow transaction inserts via RPC" ON public.transactions FOR INSERT WITH CHECK (true);


--
-- Name: level_claims Anyone can insert level claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert level claims" ON public.level_claims FOR INSERT WITH CHECK (true);


--
-- Name: daily_buff_wheel Anyone can insert their wheel spins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert their wheel spins" ON public.daily_buff_wheel FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: daily_buff_wheel Anyone can insert via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert via RPC" ON public.daily_buff_wheel FOR INSERT WITH CHECK (true);


--
-- Name: giveaway_participants Anyone can join giveaways; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can join giveaways" ON public.giveaway_participants FOR INSERT WITH CHECK (true);


--
-- Name: case_items Anyone can read case items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read case items" ON public.case_items FOR SELECT USING (true);


--
-- Name: case_types Anyone can read case types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read case types" ON public.case_types FOR SELECT USING (true);


--
-- Name: tasks Anyone can view active tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active tasks" ON public.tasks FOR SELECT USING ((is_active = true));


--
-- Name: user_buffs Anyone can view buffs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view buffs" ON public.user_buffs FOR SELECT USING (true);


--
-- Name: chicken_road_config Anyone can view chicken road config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view chicken road config" ON public.chicken_road_config FOR SELECT USING (true);


--
-- Name: crash_config Anyone can view crash config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view crash config" ON public.crash_config FOR SELECT USING (true);


--
-- Name: crash_rounds Anyone can view crash rounds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view crash rounds" ON public.crash_rounds FOR SELECT USING (true);


--
-- Name: dice_config Anyone can view dice config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view dice config" ON public.dice_config FOR SELECT USING (true);


--
-- Name: game_history Anyone can view game history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view game history" ON public.game_history FOR SELECT USING (true);


--
-- Name: game_settings Anyone can view game settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view game settings" ON public.game_settings FOR SELECT USING (true);


--
-- Name: giveaways Anyone can view giveaways; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view giveaways" ON public.giveaways FOR SELECT USING (true);


--
-- Name: hilo_config Anyone can view hilo config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view hilo config" ON public.hilo_config FOR SELECT USING (true);


--
-- Name: level_claims Anyone can view level claims; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view level claims" ON public.level_claims FOR SELECT USING (true);


--
-- Name: level_rewards Anyone can view level rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view level rewards" ON public.level_rewards FOR SELECT USING (true);


--
-- Name: matches Anyone can view matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view matches" ON public.matches FOR SELECT USING (true);


--
-- Name: mines_config Anyone can view mines config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view mines config" ON public.mines_config FOR SELECT USING (true);


--
-- Name: giveaway_participants Anyone can view participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view participants" ON public.giveaway_participants FOR SELECT USING (true);


--
-- Name: promocodes Anyone can view promocodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view promocodes" ON public.promocodes FOR SELECT USING (true);


--
-- Name: user_roles Anyone can view roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view roles" ON public.user_roles FOR SELECT USING (true);


--
-- Name: roulette_config Anyone can view roulette config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view roulette config" ON public.roulette_config FOR SELECT USING (true);


--
-- Name: roulette_history Anyone can view roulette history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view roulette history" ON public.roulette_history FOR SELECT TO authenticated USING (true);


--
-- Name: skins Anyone can view skins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view skins" ON public.skins FOR SELECT USING (true);


--
-- Name: teams Anyone can view teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);


--
-- Name: daily_buff_wheel Anyone can view their wheel spins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view their wheel spins" ON public.daily_buff_wheel FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: betting_tournament_results Anyone can view tournament results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view tournament results" ON public.betting_tournament_results FOR SELECT USING (true);


--
-- Name: betting_tournaments Anyone can view tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view tournaments" ON public.betting_tournaments FOR SELECT USING (true);


--
-- Name: towers_config Anyone can view towers config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view towers config" ON public.towers_config FOR SELECT USING (true);


--
-- Name: daily_buff_wheel Anyone can view via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view via RPC" ON public.daily_buff_wheel FOR SELECT USING (true);


--
-- Name: achievements Anyone can view visible achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view visible achievements" ON public.achievements FOR SELECT USING (((is_active = true) AND ((is_hidden = false) OR (EXISTS ( SELECT 1
   FROM public.user_achievements ua
  WHERE ((ua.achievement_id = ua.id) AND (ua.is_completed = true)))))));


--
-- Name: registration_wheel Public access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public access" ON public.registration_wheel USING (true) WITH CHECK (true);


--
-- Name: support_messages Public access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public access" ON public.support_messages USING (true) WITH CHECK (true);


--
-- Name: user_sessions Public access for sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public access for sessions" ON public.user_sessions USING (true) WITH CHECK (true);


--
-- Name: user_task_progress Public task progress access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public task progress access" ON public.user_task_progress USING (true) WITH CHECK (true);


--
-- Name: roulette_history System can insert roulette history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert roulette history" ON public.roulette_history FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: crash_rounds System can manage crash rounds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage crash rounds" ON public.crash_rounds USING (true) WITH CHECK (true);


--
-- Name: betting_tournament_results System can manage results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can manage results" ON public.betting_tournament_results USING (true);


--
-- Name: promocode_activations Users can insert activations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert activations" ON public.promocode_activations FOR INSERT WITH CHECK (true);


--
-- Name: chat_messages Users can insert chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert chat messages" ON public.chat_messages FOR INSERT WITH CHECK (true);


--
-- Name: bonus_wheels Users can insert own bonus wheels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own bonus wheels" ON public.bonus_wheels FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: daily_rewards Users can insert own daily rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own daily rewards" ON public.daily_rewards FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: support_tickets Users can insert support tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert support tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);


--
-- Name: user_inventory Users can manage own inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own inventory" ON public.user_inventory USING ((auth.uid() = user_id));


--
-- Name: bonus_wheels Users can update own bonus wheels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own bonus wheels" ON public.bonus_wheels FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: daily_rewards Users can update own daily rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own daily rewards" ON public.daily_rewards FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: system_notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.system_notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: promocode_activations Users can view activations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view activations" ON public.promocode_activations FOR SELECT USING (true);


--
-- Name: user_achievements Users can view own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own achievements" ON public.user_achievements FOR SELECT USING (true);


--
-- Name: action_logs Users can view own action logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own action logs" ON public.action_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_bets Users can view own bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own bets" ON public.user_bets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: bonus_wheels Users can view own bonus wheels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own bonus wheels" ON public.bonus_wheels FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: crash_bets Users can view own crash bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own crash bets" ON public.crash_bets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: daily_rewards Users can view own daily rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own daily rewards" ON public.daily_rewards FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_freespins Users can view own freespins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own freespins" ON public.user_freespins FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_inventory Users can view own inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own inventory" ON public.user_inventory FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_moderation Users can view own moderation status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own moderation status" ON public.user_moderation FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: system_notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.system_notifications FOR SELECT USING (((user_id IS NULL) OR (auth.uid() = user_id)));


--
-- Name: parlay_bet_items Users can view own parlay bet items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own parlay bet items" ON public.parlay_bet_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.parlay_bets pb
  WHERE ((pb.id = parlay_bet_items.parlay_bet_id) AND (pb.user_id = auth.uid())))));


--
-- Name: parlay_bets Users can view own parlay bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own parlay bets" ON public.parlay_bets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_rate_limits Users can view own rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own rate limits" ON public.user_rate_limits FOR SELECT USING (true);


--
-- Name: referral_rewards Users can view own referral rewards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own referral rewards" ON public.referral_rewards FOR SELECT USING (((auth.uid() = referrer_id) OR (auth.uid() = referred_id)));


--
-- Name: game_sessions Users can view own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sessions" ON public.game_sessions FOR SELECT USING (true);


--
-- Name: transactions Users can view own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: black_crow_access Users can view their own access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own access" ON public.black_crow_access FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::text))))));


--
-- Name: user_game_restrictions Users can view their own restrictions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own restrictions" ON public.user_game_restrictions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_task_progress Users can view their task progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their task progress" ON public.user_task_progress FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: action_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: active_game_locks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.active_game_locks ENABLE ROW LEVEL SECURITY;

--
-- Name: active_game_locks active_game_locks_deny_direct_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY active_game_locks_deny_direct_access ON public.active_game_locks USING (false);


--
-- Name: betting_tournament_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.betting_tournament_results ENABLE ROW LEVEL SECURITY;

--
-- Name: betting_tournaments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.betting_tournaments ENABLE ROW LEVEL SECURITY;

--
-- Name: black_crow_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.black_crow_access ENABLE ROW LEVEL SECURITY;

--
-- Name: bonus_wheels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bonus_wheels ENABLE ROW LEVEL SECURITY;

--
-- Name: case_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_items ENABLE ROW LEVEL SECURITY;

--
-- Name: case_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_types ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chicken_road_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chicken_road_config ENABLE ROW LEVEL SECURITY;

--
-- Name: crash_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crash_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: crash_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crash_config ENABLE ROW LEVEL SECURITY;

--
-- Name: crash_rounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crash_rounds ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_buff_wheel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_buff_wheel ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: preset_wheel_results deny delete presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny delete presets" ON public.preset_wheel_results FOR DELETE USING (false);


--
-- Name: preset_wheel_results deny insert presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny insert presets" ON public.preset_wheel_results FOR INSERT WITH CHECK (false);


--
-- Name: preset_wheel_results deny select presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny select presets" ON public.preset_wheel_results FOR SELECT USING (false);


--
-- Name: preset_wheel_results deny update presets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deny update presets" ON public.preset_wheel_results FOR UPDATE USING (false);


--
-- Name: dice_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dice_config ENABLE ROW LEVEL SECURITY;

--
-- Name: email_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_accounts email_accounts_deny_direct_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_accounts_deny_direct_access ON public.email_accounts USING (false);


--
-- Name: game_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

--
-- Name: game_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: game_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: giveaway_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.giveaway_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: giveaways; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;

--
-- Name: hilo_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hilo_config ENABLE ROW LEVEL SECURITY;

--
-- Name: image_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: image_cache image_cache_deny_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY image_cache_deny_delete ON public.image_cache FOR DELETE USING (false);


--
-- Name: image_cache image_cache_deny_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY image_cache_deny_insert ON public.image_cache FOR INSERT WITH CHECK (false);


--
-- Name: image_cache image_cache_deny_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY image_cache_deny_select ON public.image_cache FOR SELECT USING (false);


--
-- Name: image_cache image_cache_deny_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY image_cache_deny_update ON public.image_cache FOR UPDATE USING (false);


--
-- Name: level_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.level_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: level_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.level_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

--
-- Name: mines_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mines_config ENABLE ROW LEVEL SECURITY;

--
-- Name: parlay_bet_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parlay_bet_items ENABLE ROW LEVEL SECURITY;

--
-- Name: parlay_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parlay_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: preset_wheel_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preset_wheel_results ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_all ON public.profiles FOR INSERT WITH CHECK (true);


--
-- Name: profiles profiles_no_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_no_delete ON public.profiles FOR DELETE USING (false);


--
-- Name: profiles profiles_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_read_all ON public.profiles FOR SELECT USING (true);


--
-- Name: profiles profiles_update_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_all ON public.profiles FOR UPDATE USING (true);


--
-- Name: promocode_activations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promocode_activations ENABLE ROW LEVEL SECURITY;

--
-- Name: promocodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promocodes ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: registration_wheel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registration_wheel ENABLE ROW LEVEL SECURITY;

--
-- Name: roulette_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roulette_config ENABLE ROW LEVEL SECURITY;

--
-- Name: roulette_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roulette_history ENABLE ROW LEVEL SECURITY;

--
-- Name: skins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skins ENABLE ROW LEVEL SECURITY;

--
-- Name: support_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: system_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: towers_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.towers_config ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: user_buffs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_buffs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_freespins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_freespins ENABLE ROW LEVEL SECURITY;

--
-- Name: user_game_restrictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_game_restrictions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: user_moderation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_moderation ENABLE ROW LEVEL SECURITY;

--
-- Name: user_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_task_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_task_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: verification_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: verification_codes verification_codes_deny_direct_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY verification_codes_deny_direct_access ON public.verification_codes USING (false);


--
-- Name: withdrawal_requests withdrawal_delete_via_rpc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY withdrawal_delete_via_rpc ON public.withdrawal_requests FOR DELETE USING (false);


--
-- Name: withdrawal_requests withdrawal_insert_via_rpc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY withdrawal_insert_via_rpc ON public.withdrawal_requests FOR INSERT WITH CHECK (false);


--
-- Name: withdrawal_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawal_requests withdrawal_select_via_rpc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY withdrawal_select_via_rpc ON public.withdrawal_requests FOR SELECT USING (false);


--
-- Name: withdrawal_requests withdrawal_update_via_rpc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY withdrawal_update_via_rpc ON public.withdrawal_requests FOR UPDATE USING (false);


--
-- Name: chat_messages Все могут читать сообщения чата; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Все могут читать сообщения чата" ON public.chat_messages FOR SELECT USING (true);


--
-- PostgreSQL database dump complete
--




COMMIT;