-- Clean up any negative tournament results from old data
UPDATE betting_tournament_results 
SET total_wins = GREATEST(0, total_wins),
    biggest_win = GREATEST(0, biggest_win)
WHERE total_wins < 0 OR biggest_win < 0;

-- Also delete entries with zero wins that shouldn't exist
DELETE FROM betting_tournament_results 
WHERE total_wins = 0 AND total_bets = 0;