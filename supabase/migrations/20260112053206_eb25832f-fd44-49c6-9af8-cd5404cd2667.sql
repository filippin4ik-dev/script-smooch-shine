-- Удаляем старую политику SELECT
DROP POLICY IF EXISTS "Users can view own bets" ON user_bets;

-- Создаём новую политику для чтения своих ставок (без auth.uid())
-- Так как аутентификация идёт через Telegram, используем true и фильтрацию на стороне клиента
CREATE POLICY "Anyone can view bets" 
ON user_bets 
FOR SELECT 
USING (true);

-- То же самое для parlay_bets
DROP POLICY IF EXISTS "Users can view own parlays" ON parlay_bets;

CREATE POLICY "Anyone can view parlays" 
ON parlay_bets 
FOR SELECT 
USING (true);

-- И для parlay_bet_items
DROP POLICY IF EXISTS "Users can view own parlay items" ON parlay_bet_items;

CREATE POLICY "Anyone can view parlay items" 
ON parlay_bet_items 
FOR SELECT 
USING (true);