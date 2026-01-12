-- Table to track giveaway wheel spins
CREATE TABLE public.giveaway_wheel_spins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_id UUID NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  result TEXT NOT NULL,
  reward_type TEXT,
  reward_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(giveaway_id, user_id)
);

-- Enable RLS
ALTER TABLE public.giveaway_wheel_spins ENABLE ROW LEVEL SECURITY;

-- Users can view their own spins
CREATE POLICY "Users can view own spins" ON public.giveaway_wheel_spins
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- RPC function to spin the giveaway wheel
CREATE OR REPLACE FUNCTION public.spin_giveaway_wheel(
  _user_id UUID,
  _giveaway_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giveaway RECORD;
  v_segments JSONB;
  v_segment JSONB;
  v_random_idx INT;
  v_result TEXT;
  v_reward_type TEXT;
  v_reward_amount NUMERIC;
  v_already_spun BOOLEAN;
  v_is_participant BOOLEAN;
BEGIN
  -- Check if giveaway exists and has wheel
  SELECT * INTO v_giveaway FROM giveaways WHERE id = _giveaway_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Розыгрыш не найден');
  END IF;
  
  IF v_giveaway.has_wheel IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Колесо не настроено');
  END IF;
  
  IF v_giveaway.wheel_segments IS NULL OR jsonb_array_length(v_giveaway.wheel_segments) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Сегменты колеса не настроены');
  END IF;
  
  IF v_giveaway.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Розыгрыш не активен');
  END IF;
  
  -- Check if user is participant
  SELECT EXISTS(
    SELECT 1 FROM giveaway_participants 
    WHERE giveaway_id = _giveaway_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RETURN jsonb_build_object('success', false, 'message', 'Вы не участвуете в этом розыгрыше');
  END IF;
  
  -- Check if already spun
  SELECT EXISTS(
    SELECT 1 FROM giveaway_wheel_spins 
    WHERE giveaway_id = _giveaway_id AND user_id = _user_id
  ) INTO v_already_spun;
  
  IF v_already_spun THEN
    RETURN jsonb_build_object('success', false, 'message', 'Вы уже крутили колесо');
  END IF;
  
  -- Pick random segment
  v_segments := v_giveaway.wheel_segments;
  v_random_idx := floor(random() * jsonb_array_length(v_segments))::INT;
  v_segment := v_segments->v_random_idx;
  
  v_result := v_segment->>'key';
  v_reward_type := v_segment->>'rewardType';
  v_reward_amount := (v_segment->>'rewardAmount')::NUMERIC;
  
  -- Record spin
  INSERT INTO giveaway_wheel_spins (giveaway_id, user_id, result, reward_type, reward_amount)
  VALUES (_giveaway_id, _user_id, v_result, v_reward_type, v_reward_amount);
  
  -- Apply reward
  IF v_reward_type = 'balance' AND v_reward_amount > 0 THEN
    UPDATE profiles SET balance = balance + v_reward_amount WHERE id = _user_id;
  ELSIF v_reward_type = 'freebet' AND v_reward_amount > 0 THEN
    UPDATE profiles SET freebet_balance = COALESCE(freebet_balance, 0) + v_reward_amount WHERE id = _user_id;
  ELSIF v_reward_type = 'wheel' AND v_reward_amount > 0 THEN
    FOR i IN 1..v_reward_amount::INT LOOP
      INSERT INTO bonus_wheels (user_id) VALUES (_user_id);
    END LOOP;
  ELSIF v_reward_type = 'xp' AND v_reward_amount > 0 THEN
    UPDATE profiles SET xp = xp + v_reward_amount::INT WHERE id = _user_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'result', v_result);
END;
$$;