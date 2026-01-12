-- Update function to only count bets placed after tournament started
CREATE OR REPLACE FUNCTION update_betting_tournament_results()
RETURNS TRIGGER AS $$
DECLARE
  active_tournament RECORD;
  win_amount NUMERIC;
BEGIN
  -- Only process when bet status changes to 'won'
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
    -- Calculate win amount
    win_amount := NEW.potential_win - NEW.bet_amount;
    
    -- Find active tournament that matches the bet criteria
    -- Only count if bet was placed AFTER tournament start_at
    FOR active_tournament IN 
      SELECT id, min_bet_amount, start_at
      FROM betting_tournaments 
      WHERE status = 'active' 
        AND start_at <= NOW() 
        AND (end_at IS NULL OR end_at > NOW())
        AND (min_bet_amount IS NULL OR min_bet_amount <= NEW.bet_amount)
        AND NEW.created_at >= start_at  -- Bet must be placed after tournament started
    LOOP
      -- Upsert the tournament result
      INSERT INTO betting_tournament_results (
        tournament_id,
        user_id,
        total_wins,
        total_bets,
        biggest_win
      ) VALUES (
        active_tournament.id,
        NEW.user_id,
        win_amount,
        1,
        win_amount
      )
      ON CONFLICT (tournament_id, user_id) 
      DO UPDATE SET
        total_wins = betting_tournament_results.total_wins + win_amount,
        total_bets = betting_tournament_results.total_bets + 1,
        biggest_win = GREATEST(betting_tournament_results.biggest_win, win_amount),
        updated_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update parlay function similarly
CREATE OR REPLACE FUNCTION update_betting_tournament_results_parlay()
RETURNS TRIGGER AS $$
DECLARE
  active_tournament RECORD;
  win_amount NUMERIC;
BEGIN
  -- Only process when parlay status changes to 'won'
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
    -- Calculate win amount
    win_amount := NEW.potential_win - NEW.total_amount;
    
    -- Find active tournament - only count if parlay was placed after tournament started
    FOR active_tournament IN 
      SELECT id, min_bet_amount, start_at
      FROM betting_tournaments 
      WHERE status = 'active' 
        AND start_at <= NOW() 
        AND (end_at IS NULL OR end_at > NOW())
        AND (min_bet_amount IS NULL OR min_bet_amount <= NEW.total_amount)
        AND NEW.created_at >= start_at  -- Parlay must be placed after tournament started
    LOOP
      -- Upsert the tournament result
      INSERT INTO betting_tournament_results (
        tournament_id,
        user_id,
        total_wins,
        total_bets,
        biggest_win
      ) VALUES (
        active_tournament.id,
        NEW.user_id,
        win_amount,
        1,
        win_amount
      )
      ON CONFLICT (tournament_id, user_id) 
      DO UPDATE SET
        total_wins = betting_tournament_results.total_wins + win_amount,
        total_bets = betting_tournament_results.total_bets + 1,
        biggest_win = GREATEST(betting_tournament_results.biggest_win, win_amount),
        updated_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;