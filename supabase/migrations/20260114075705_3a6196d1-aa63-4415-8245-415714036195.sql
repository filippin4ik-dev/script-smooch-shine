-- Update function to ensure win_amount is always positive and freebets are fully excluded
CREATE OR REPLACE FUNCTION update_betting_tournament_results()
RETURNS TRIGGER AS $$
DECLARE
  active_tournament RECORD;
  win_amount NUMERIC;
BEGIN
  -- Only process when bet status changes to 'won' AND it's NOT a freebet
  -- Check is_freebet explicitly - skip if true
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') AND (NEW.is_freebet IS NOT TRUE) THEN
    -- Calculate win amount (ensure non-negative)
    win_amount := GREATEST(0, NEW.potential_win - NEW.bet_amount);
    
    -- Only record if there's actual profit
    IF win_amount > 0 THEN
      -- Find active tournament that matches the bet criteria
      FOR active_tournament IN 
        SELECT id, min_bet_amount 
        FROM betting_tournaments 
        WHERE status = 'active' 
          AND start_at <= NOW() 
          AND (end_at IS NULL OR end_at > NOW())
          AND (min_bet_amount IS NULL OR min_bet_amount <= NEW.bet_amount)
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update function for parlay bets as well
CREATE OR REPLACE FUNCTION update_betting_tournament_results_parlay()
RETURNS TRIGGER AS $$
DECLARE
  active_tournament RECORD;
  win_amount NUMERIC;
BEGIN
  -- Only process when parlay status changes to 'won' AND it's NOT a freebet
  IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') AND (NEW.is_freebet IS NOT TRUE) THEN
    -- Calculate win amount (ensure non-negative)
    win_amount := GREATEST(0, NEW.potential_win - NEW.total_amount);
    
    -- Only record if there's actual profit
    IF win_amount > 0 THEN
      -- Find active tournament
      FOR active_tournament IN 
        SELECT id, min_bet_amount 
        FROM betting_tournaments 
        WHERE status = 'active' 
          AND start_at <= NOW() 
          AND (end_at IS NULL OR end_at > NOW())
          AND (min_bet_amount IS NULL OR min_bet_amount <= NEW.total_amount)
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;