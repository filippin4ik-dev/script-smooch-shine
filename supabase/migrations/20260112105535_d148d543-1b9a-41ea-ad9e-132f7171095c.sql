-- Create function to update betting tournament results when bet is won
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for user_bets
DROP TRIGGER IF EXISTS update_tournament_on_bet_win ON user_bets;
CREATE TRIGGER update_tournament_on_bet_win
  AFTER UPDATE ON user_bets
  FOR EACH ROW
  EXECUTE FUNCTION update_betting_tournament_results();

-- Create similar function for parlay bets
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for parlay_bets
DROP TRIGGER IF EXISTS update_tournament_on_parlay_win ON parlay_bets;
CREATE TRIGGER update_tournament_on_parlay_win
  AFTER UPDATE ON parlay_bets
  FOR EACH ROW
  EXECUTE FUNCTION update_betting_tournament_results_parlay();

-- Add unique constraint if not exists for upsert
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'betting_tournament_results_tournament_user_unique'
  ) THEN
    ALTER TABLE betting_tournament_results 
    ADD CONSTRAINT betting_tournament_results_tournament_user_unique 
    UNIQUE (tournament_id, user_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;