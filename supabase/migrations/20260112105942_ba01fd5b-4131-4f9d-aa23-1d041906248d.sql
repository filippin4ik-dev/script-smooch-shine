-- Function to recalculate tournament results from existing bets
CREATE OR REPLACE FUNCTION recalculate_tournament_results(_tournament_id UUID)
RETURNS void AS $$
DECLARE
  tournament RECORD;
  bet RECORD;
  win_amount NUMERIC;
BEGIN
  -- Get tournament info
  SELECT * INTO tournament FROM betting_tournaments WHERE id = _tournament_id;
  
  IF tournament IS NULL THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;
  
  -- Clear existing results for this tournament
  DELETE FROM betting_tournament_results WHERE tournament_id = _tournament_id;
  
  -- Recalculate from user_bets
  FOR bet IN 
    SELECT 
      user_id,
      SUM(potential_win - bet_amount) as total_wins,
      COUNT(*) as total_bets,
      MAX(potential_win - bet_amount) as biggest_win
    FROM user_bets
    WHERE status = 'won'
      AND created_at >= tournament.start_at
      AND (tournament.end_at IS NULL OR created_at <= tournament.end_at)
      AND (tournament.min_bet_amount IS NULL OR bet_amount >= tournament.min_bet_amount)
    GROUP BY user_id
  LOOP
    INSERT INTO betting_tournament_results (
      tournament_id,
      user_id,
      total_wins,
      total_bets,
      biggest_win
    ) VALUES (
      _tournament_id,
      bet.user_id,
      bet.total_wins,
      bet.total_bets,
      bet.biggest_win
    )
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET
      total_wins = EXCLUDED.total_wins,
      total_bets = EXCLUDED.total_bets,
      biggest_win = EXCLUDED.biggest_win,
      updated_at = NOW();
  END LOOP;
  
  -- Also add parlay bets
  FOR bet IN 
    SELECT 
      user_id,
      SUM(potential_win - total_amount) as total_wins,
      COUNT(*) as total_bets,
      MAX(potential_win - total_amount) as biggest_win
    FROM parlay_bets
    WHERE status = 'won'
      AND created_at >= tournament.start_at
      AND (tournament.end_at IS NULL OR created_at <= tournament.end_at)
      AND (tournament.min_bet_amount IS NULL OR total_amount >= tournament.min_bet_amount)
    GROUP BY user_id
  LOOP
    INSERT INTO betting_tournament_results (
      tournament_id,
      user_id,
      total_wins,
      total_bets,
      biggest_win
    ) VALUES (
      _tournament_id,
      bet.user_id,
      bet.total_wins,
      bet.total_bets,
      bet.biggest_win
    )
    ON CONFLICT (tournament_id, user_id) 
    DO UPDATE SET
      total_wins = betting_tournament_results.total_wins + EXCLUDED.total_wins,
      total_bets = betting_tournament_results.total_bets + EXCLUDED.total_bets,
      biggest_win = GREATEST(betting_tournament_results.biggest_win, EXCLUDED.biggest_win),
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;