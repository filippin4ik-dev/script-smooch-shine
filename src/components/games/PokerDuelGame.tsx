import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Swords, Trophy, X, RefreshCw, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PokerDuel {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  bet_amount: number;
  status: string;
  creator_cards: string[] | null;
  opponent_cards: string[] | null;
  winner_id: string | null;
  is_draw: boolean;
  creator_hand_rank: string | null;
  opponent_hand_rank: string | null;
  created_at: string;
  creator?: { username: string };
}

interface PokerDuelGameProps {
  balance: number;
  visitorId: string;
  onBalanceUpdate: () => void;
}

const PlayingCard: React.FC<{ card: string; revealed?: boolean; delay?: number }> = ({ 
  card, 
  revealed = true,
  delay = 0 
}) => {
  const [isFlipped, setIsFlipped] = useState(!revealed);
  
  useEffect(() => {
    if (revealed && delay > 0) {
      const timer = setTimeout(() => setIsFlipped(false), delay);
      return () => clearTimeout(timer);
    } else if (revealed) {
      setIsFlipped(false);
    }
  }, [revealed, delay]);

  const suit = card.replace(/[^♠♥♦♣]/g, '');
  const value = card.replace(/[♠♥♦♣]/g, '');
  const isRed = suit === '♥' || suit === '♦';

  return (
    <div 
      className={cn(
        "relative w-14 h-20 sm:w-16 sm:h-24 rounded-lg transition-transform duration-500 transform-gpu",
        isFlipped ? "rotate-y-180" : ""
      )}
      style={{ perspective: '1000px' }}
    >
      <div 
        className={cn(
          "absolute inset-0 rounded-lg border-2 flex flex-col items-center justify-center font-bold text-lg sm:text-xl transition-all duration-500",
          isFlipped 
            ? "bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400" 
            : cn(
                "bg-white border-gray-300",
                isRed ? "text-red-500" : "text-gray-900"
              )
        )}
      >
        {isFlipped ? (
          <div className="text-2xl">🎴</div>
        ) : (
          <>
            <span className="text-xs sm:text-sm">{value}</span>
            <span className="text-lg sm:text-2xl">{suit}</span>
          </>
        )}
      </div>
    </div>
  );
};

const HandDisplay: React.FC<{ 
  cards: string[] | null; 
  handRank: string | null;
  isWinner: boolean;
  label: string;
  revealed?: boolean;
}> = ({ cards, handRank, isWinner, label, revealed = true }) => {
  if (!cards) return null;

  return (
    <div className={cn(
      "flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
      isWinner && "bg-yellow-500/20 ring-2 ring-yellow-500"
    )}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex gap-1 sm:gap-2">
        {cards.map((card, i) => (
          <PlayingCard 
            key={i} 
            card={card} 
            revealed={revealed}
            delay={i * 300}
          />
        ))}
      </div>
      {handRank && revealed && (
        <Badge variant={isWinner ? "default" : "secondary"} className={cn(
          isWinner && "bg-yellow-500 text-black"
        )}>
          {handRank}
        </Badge>
      )}
      {isWinner && (
        <div className="flex items-center gap-1 text-yellow-500 font-bold animate-pulse">
          <Trophy className="w-4 h-4" />
          <span>Победа!</span>
        </div>
      )}
    </div>
  );
};

export const PokerDuelGame: React.FC<PokerDuelGameProps> = ({
  balance,
  visitorId,
  onBalanceUpdate
}) => {
  const [duels, setDuels] = useState<PokerDuel[]>([]);
  const [myDuels, setMyDuels] = useState<PokerDuel[]>([]);
  const [betAmount, setBetAmount] = useState('100');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resultDuel, setResultDuel] = useState<PokerDuel | null>(null);
  const [showResult, setShowResult] = useState(false);

  const fetchDuels = async () => {
    try {
      // Получаем ожидающие дуэли (не свои)
      const { data: waitingDuels, error: waitingError } = await supabase
        .from('poker_duels')
        .select('*, creator:profiles!poker_duels_creator_id_fkey(username)')
        .eq('status', 'waiting')
        .neq('creator_id', visitorId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (waitingError) throw waitingError;
      setDuels(waitingDuels || []);

      // Получаем мои дуэли
      const { data: myDuelsData, error: myError } = await supabase
        .from('poker_duels')
        .select('*, creator:profiles!poker_duels_creator_id_fkey(username)')
        .or(`creator_id.eq.${visitorId},opponent_id.eq.${visitorId}`)
        .in('status', ['waiting', 'finished'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (myError) throw myError;
      setMyDuels(myDuelsData || []);
    } catch (error) {
      console.error('Error fetching duels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDuels();

    // Realtime подписка
    const channel = supabase
      .channel('poker_duels_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poker_duels' },
        () => {
          fetchDuels();
          onBalanceUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visitorId]);

  const handleCreateDuel = async () => {
    const amount = parseFloat(betAmount);
    
    if (isNaN(amount) || amount < 10) {
      toast.error('Минимальная ставка: 10₽');
      return;
    }
    
    if (amount > balance) {
      toast.error('Недостаточно средств');
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_poker_duel', {
        p_creator_id: visitorId,
        p_bet_amount: amount
      });

      if (error) throw error;
      
      toast.success('Дуэль создана! Ожидайте соперника');
      onBalanceUpdate();
      fetchDuels();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка создания дуэли');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelDuel = async (duelId: string) => {
    try {
      const { error } = await supabase.rpc('cancel_poker_duel', {
        p_duel_id: duelId,
        p_user_id: visitorId
      });

      if (error) throw error;
      
      toast.success('Дуэль отменена, ставка возвращена');
      onBalanceUpdate();
      fetchDuels();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отмены');
    }
  };

  const handleJoinDuel = async (duel: PokerDuel) => {
    if (duel.bet_amount > balance) {
      toast.error('Недостаточно средств');
      return;
    }

    setIsJoining(duel.id);
    try {
      const { data, error } = await supabase.rpc('join_poker_duel', {
        p_duel_id: duel.id,
        p_opponent_id: visitorId
      });

      if (error) throw error;
      
      // Показываем результат
      const result = data as any;
      
      // Получаем обновлённую дуэль для отображения
      const { data: updatedDuel } = await supabase
        .from('poker_duels')
        .select('*, creator:profiles!poker_duels_creator_id_fkey(username)')
        .eq('id', duel.id)
        .single();
      
      if (updatedDuel) {
        setResultDuel(updatedDuel);
        setShowResult(true);
      }
      
      if (result.is_draw) {
        toast.info('Ничья! Ставки возвращены (минус комиссия)');
      } else if (result.winner_id === visitorId) {
        toast.success(`Победа! Выигрыш: ${result.win_amount.toFixed(2)}₽`);
      } else {
        toast.error('Поражение!');
      }
      
      onBalanceUpdate();
      fetchDuels();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка присоединения');
    } finally {
      setIsJoining(null);
    }
  };

  const myWaitingDuel = myDuels.find(d => d.status === 'waiting' && d.creator_id === visitorId);
  const recentGames = myDuels.filter(d => d.status === 'finished').slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Результат игры */}
      {showResult && resultDuel && (
        <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Swords className="w-5 h-5" />
              Результат дуэли
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8">
              <HandDisplay
                cards={resultDuel.creator_cards}
                handRank={resultDuel.creator_hand_rank}
                isWinner={resultDuel.winner_id === resultDuel.creator_id}
                label={resultDuel.creator_id === visitorId ? 'Вы' : resultDuel.creator?.username || 'Соперник'}
                revealed={true}
              />
              
              <div className="text-3xl font-bold text-muted-foreground">VS</div>
              
              <HandDisplay
                cards={resultDuel.opponent_cards}
                handRank={resultDuel.opponent_hand_rank}
                isWinner={resultDuel.winner_id === resultDuel.opponent_id}
                label={resultDuel.opponent_id === visitorId ? 'Вы' : 'Соперник'}
                revealed={true}
              />
            </div>
            
            {resultDuel.is_draw && (
              <div className="text-center mt-4 text-lg font-medium text-yellow-500">
                🤝 Ничья!
              </div>
            )}
            
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => setShowResult(false)}>
                Закрыть
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Создание дуэли */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Создать дуэль
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myWaitingDuel ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-muted">
              <div>
                <div className="font-medium">Ваша дуэль ожидает соперника</div>
                <div className="text-sm text-muted-foreground">
                  Ставка: {myWaitingDuel.bet_amount}₽
                </div>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => handleCancelDuel(myWaitingDuel.id)}
              >
                <X className="w-4 h-4 mr-1" />
                Отменить
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Ставка"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  min={10}
                  max={balance}
                />
              </div>
              <div className="flex gap-2">
                {[50, 100, 500, 1000].map(amount => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(amount.toString())}
                    className="flex-1 sm:flex-none"
                  >
                    {amount}
                  </Button>
                ))}
              </div>
              <Button 
                onClick={handleCreateDuel}
                disabled={isCreating}
                className="bg-gradient-to-r from-green-500 to-emerald-600"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Создать
                  </>
                )}
              </Button>
            </div>
          )}
          
          <div className="mt-3 text-xs text-muted-foreground">
            💡 3-Card Poker: лучшая комбинация из 3 карт побеждает. Комиссия 5%.
          </div>
        </CardContent>
      </Card>

      {/* Доступные дуэли */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Доступные дуэли
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchDuels}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : duels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет доступных дуэлей. Создайте свою!
            </div>
          ) : (
            <div className="space-y-3">
              {duels.map(duel => (
                <div 
                  key={duel.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                      <Swords className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {duel.creator?.username || 'Игрок'}
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {duel.bet_amount}₽
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleJoinDuel(duel)}
                    disabled={isJoining === duel.id || duel.bet_amount > balance}
                    className="bg-gradient-to-r from-orange-500 to-red-500"
                  >
                    {isJoining === duel.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Swords className="w-4 h-4 mr-1" />
                        Принять
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* История игр */}
      {recentGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Последние игры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentGames.map(game => {
                const isCreator = game.creator_id === visitorId;
                const won = game.winner_id === visitorId;
                const isDraw = game.is_draw;
                
                return (
                  <div 
                    key={game.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg",
                      isDraw ? "bg-yellow-500/10" : won ? "bg-green-500/10" : "bg-red-500/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold",
                        isDraw ? "bg-yellow-500" : won ? "bg-green-500" : "bg-red-500"
                      )}>
                        {isDraw ? '=' : won ? 'W' : 'L'}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {isCreator ? game.creator_hand_rank : game.opponent_hand_rank}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          vs {isCreator ? game.opponent_hand_rank : game.creator_hand_rank}
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      "font-bold",
                      isDraw ? "text-yellow-500" : won ? "text-green-500" : "text-red-500"
                    )}>
                      {isDraw ? '±0₽' : won ? `+${(game.bet_amount * 1.9).toFixed(0)}₽` : `-${game.bet_amount}₽`}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Правила */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Правила 3-Card Poker</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>🎴 Каждому игроку раздаётся по 3 карты</p>
          <p>🏆 Побеждает лучшая комбинация:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><strong>Стрит-флеш</strong> — 3 карты подряд одной масти</li>
            <li><strong>Тройка</strong> — 3 одинаковых карты</li>
            <li><strong>Стрит</strong> — 3 карты подряд</li>
            <li><strong>Флеш</strong> — 3 карты одной масти</li>
            <li><strong>Пара</strong> — 2 одинаковых карты</li>
            <li><strong>Старшая карта</strong> — ничего не собрал</li>
          </ul>
          <p>💰 Победитель получает банк минус 5% комиссии</p>
          <p>🤝 При ничьей ставки возвращаются (минус комиссия)</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PokerDuelGame;
