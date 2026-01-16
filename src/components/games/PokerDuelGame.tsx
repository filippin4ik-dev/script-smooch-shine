import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Users, Trophy, Search, UserPlus, X, Check, RefreshCw, Clock, HelpCircle, Eye } from 'lucide-react';
import { sendTelegramNotification } from '@/lib/telegramNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { APP_CONFIG } from '@/lib/config';

interface PokerDuelGameProps {
  visitorId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

interface Duel {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  invited_user_id: string | null;
  initial_bet: number;
  pot: number;
  status: string;
  game_phase: string;
  current_turn: string | null;
  creator_current_bet: number;
  opponent_current_bet: number;
  winner_id: string | null;
  creator_hand_rank: string | null;
  opponent_hand_rank: string | null;
  creator_cards: CardData[] | null;
  opponent_cards: CardData[] | null;
  community_cards: CardData[] | null;
  is_draw: boolean;
  created_at: string;
  last_action_at: string | null;
  creator?: { username: string; public_id: number; avatar_url: string | null };
  opponent?: { username: string; public_id: number; avatar_url: string | null };
}

interface SearchUser {
  id: string;
  username: string;
  public_id: number;
  avatar_url: string | null;
  level: number;
}

interface CardData {
  suit: string;
  rank: string;
}

const SUITS_EMOJI: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-foreground',
  spades: 'text-foreground'
};

const HAND_RANK_RU: Record<string, string> = {
  'Royal Flush': '🏆 Роял Флеш',
  'Straight Flush': '✨ Стрит Флеш',
  'Four of a Kind': '🔥 Каре',
  'Full House': '🏠 Фулл Хаус',
  'Flush': '💎 Флеш',
  'Straight': '📊 Стрит',
  'Three of a Kind': '🎯 Тройка',
  'Two Pair': '👥 Две пары',
  'One Pair': '✌️ Пара',
  'High Card': '🃏 Старшая карта'
};

const TURN_TIME_SECONDS = 30;

const PlayingCard = ({ card, hidden = false, highlighted = false }: { card: CardData; hidden?: boolean; highlighted?: boolean }) => {
  if (hidden) {
    return (
      <div 
        className="w-12 h-16 sm:w-14 sm:h-20 rounded-lg border-2 border-blue-500 flex items-center justify-center shadow-xl relative overflow-hidden"
        style={{ 
          background: '#1e3a8a',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div 
          className="absolute inset-0" 
          style={{ 
            background: 'repeating-linear-gradient(45deg, #1e40af, #1e40af 4px, #1e3a8a 4px, #1e3a8a 8px)',
            opacity: 0.8
          }} 
        />
        <div 
          className="absolute inset-2 rounded border border-blue-400/50"
          style={{ background: 'rgba(30, 64, 175, 0.5)' }}
        />
        <span className="text-xl sm:text-2xl relative z-10 drop-shadow-lg">🂠</span>
      </div>
    );
  }

  const suitColor = card.suit === 'hearts' || card.suit === 'diamonds' ? '#dc2626' : '#1f2937';

  return (
    <div 
      className={`w-12 h-16 sm:w-14 sm:h-20 rounded-lg border-2 flex flex-col items-center justify-center shadow-xl transition-all relative overflow-hidden ${highlighted ? 'border-yellow-400 ring-2 ring-yellow-400 scale-110 z-10' : 'border-slate-300'}`}
      style={{ 
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
        boxShadow: highlighted 
          ? '0 0 20px rgba(250, 204, 21, 0.5), 0 4px 6px -1px rgba(0, 0, 0, 0.2)' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255,255,255,1)'
      }}
    >
      <span className="text-base sm:text-lg font-bold relative z-10" style={{ color: suitColor }}>{card.rank}</span>
      <span className="text-lg sm:text-xl relative z-10" style={{ color: suitColor }}>{SUITS_EMOJI[card.suit]}</span>
    </div>
  );
};

const TurnTimer = ({ timeLeft, isMyTurn }: { timeLeft: number; isMyTurn: boolean }) => {
  const percentage = (timeLeft / TURN_TIME_SECONDS) * 100;
  const isLow = timeLeft <= 10;

  return (
    <div className="flex items-center gap-2">
      <Clock className={`w-4 h-4 ${isLow ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
      <div className="flex-1 min-w-[80px]">
        <Progress 
          value={percentage} 
          className={`h-2 ${isLow ? 'bg-red-900/30' : ''}`}
        />
      </div>
      <span className={`text-sm font-mono min-w-[24px] ${isLow ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
        {timeLeft}с
      </span>
    </div>
  );
};

const HandRankDisplay = ({ rank, isWinner }: { rank: string; isWinner: boolean }) => {
  const translatedRank = HAND_RANK_RU[rank] || rank;
  return (
    <div className={`text-sm mt-2 px-3 py-1 rounded-full font-medium ${isWinner ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-muted text-muted-foreground'}`}>
      {translatedRank}
    </div>
  );
};

const RulesDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>📖 Правила Poker Duel</DialogTitle>
        <DialogDescription>Texas Hold'em 1 на 1</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">🎴 Как играть:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Каждый игрок получает 2 карты</li>
            <li>На стол выкладываются 5 общих карт</li>
            <li>Составьте лучшую комбинацию из 5 карт</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">🎯 Действия:</h4>
          <ul className="space-y-1 text-muted-foreground">
            <li><Badge variant="outline" className="mr-2">Чек</Badge>Пропустить ход (если нечего уравнивать)</li>
            <li><Badge variant="secondary" className="mr-2">Колл</Badge>Уравнять ставку противника</li>
            <li><Badge className="mr-2">Рейз</Badge>Повысить ставку</li>
            <li><Badge variant="destructive" className="mr-2">Фолд</Badge>Сбросить карты (проигрыш)</li>
            <li><Badge variant="outline" className="mr-2 border-yellow-500 text-yellow-500">Ва-банк</Badge>Поставить всё</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">⏱️ Время:</h4>
          <p className="text-muted-foreground">30 секунд на ход. При истечении времени автоматически делается Чек (или Колл если нужно уравнять).</p>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">💰 Комиссия:</h4>
          <p className="text-muted-foreground">5% от выигрыша идёт казино.</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

const GameHistoryDialog = ({ duel, open, onOpenChange, userId }: { duel: Duel | null; open: boolean; onOpenChange: (open: boolean) => void; userId: string | null }) => {
  if (!duel) return null;
  
  const isCreator = duel.creator_id === userId;
  const myCards = isCreator ? duel.creator_cards : duel.opponent_cards;
  const oppCards = isCreator ? duel.opponent_cards : duel.creator_cards;
  const myRank = isCreator ? duel.creator_hand_rank : duel.opponent_hand_rank;
  const oppRank = isCreator ? duel.opponent_hand_rank : duel.creator_hand_rank;
  const iWon = duel.winner_id === userId;
  const oppWon = duel.winner_id && duel.winner_id !== userId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {duel.is_draw ? '🤝 Ничья' : iWon ? '🏆 Победа!' : '❌ Поражение'}
          </DialogTitle>
          <DialogDescription>
            vs {isCreator ? duel.opponent?.username : duel.creator?.username} • Банк: ${duel.pot?.toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Community Cards */}
          {duel.community_cards && duel.community_cards.length > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Общие карты</p>
              <div className="flex justify-center gap-1 flex-wrap">
                {(duel.community_cards as CardData[]).map((card, i) => (
                  <PlayingCard key={i} card={card} />
                ))}
              </div>
            </div>
          )}
          
          {/* My Cards */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Ваши карты</p>
            <div className="flex justify-center gap-2">
              {myCards ? (myCards as CardData[]).map((card, i) => (
                <PlayingCard key={i} card={card} highlighted={iWon} />
              )) : <span className="text-muted-foreground">—</span>}
            </div>
            {myRank && <HandRankDisplay rank={myRank} isWinner={iWon && !duel.is_draw} />}
          </div>
          
          {/* Opponent Cards */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Карты противника</p>
            <div className="flex justify-center gap-2">
              {oppCards ? (oppCards as CardData[]).map((card, i) => (
                <PlayingCard key={i} card={card} highlighted={oppWon} />
              )) : <span className="text-muted-foreground">—</span>}
            </div>
            {oppRank && <HandRankDisplay rank={oppRank} isWinner={oppWon && !duel.is_draw} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const PokerDuelGame = ({ visitorId, balance, onBalanceUpdate }: PokerDuelGameProps) => {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState('100');
  const [raiseAmount, setRaiseAmount] = useState('50');
  const [availableDuels, setAvailableDuels] = useState<Duel[]>([]);
  const [myInvitations, setMyInvitations] = useState<Duel[]>([]);
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  const [myCards, setMyCards] = useState<CardData[]>([]);
  const [communityCards, setCommunityCards] = useState<CardData[]>([]);
  const [opponentCards, setOpponentCards] = useState<CardData[] | null>(null);
  const [recentGames, setRecentGames] = useState<Duel[]>([]);
  const [creatingDuel, setCreatingDuel] = useState(false);
  const [joiningDuelId, setJoiningDuelId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME_SECONDS);
  const [selectedHistoryGame, setSelectedHistoryGame] = useState<Duel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUserId = useCallback(async () => {
    console.log('Fetching user with telegram_id:', visitorId);
    const { data, error } = await supabase.from('profiles').select('id').eq('telegram_id', parseInt(visitorId)).maybeSingle();
    console.log('Profile fetch result:', data, error);
    if (data) setUserId(data.id);
    setLoading(false);
  }, [visitorId]);

  const fetchMyCards = useCallback(async (duelId: string) => {
    if (!userId) return;
    const { data } = await supabase.rpc('get_my_poker_cards', { p_duel_id: duelId, p_user_id: userId });
    if (data) {
      setMyCards(data.my_cards || []);
      setCommunityCards(data.community_cards || []);
      setOpponentCards(data.opponent_cards || null);
    }
  }, [userId]);

  const fetchDuels = useCallback(async () => {
    if (!userId) return;
    const { data: available } = await supabase.from('poker_duels').select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`).eq('status', 'waiting').neq('creator_id', userId).is('invited_user_id', null).order('created_at', { ascending: false }).limit(20);
    const { data: invitations } = await supabase.from('poker_duels').select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`).eq('invited_user_id', userId).eq('status', 'invited').order('created_at', { ascending: false });
    const { data: active } = await supabase.from('poker_duels').select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url), opponent:profiles!poker_duels_opponent_id_fkey(username, public_id, avatar_url)`).eq('status', 'betting').or(`creator_id.eq.${userId},opponent_id.eq.${userId}`).maybeSingle();
    const { data: myWaiting } = await supabase.from('poker_duels').select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`).eq('creator_id', userId).in('status', ['waiting', 'invited']).order('created_at', { ascending: false });
    const { data: recent } = await supabase.from('poker_duels').select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url), opponent:profiles!poker_duels_opponent_id_fkey(username, public_id, avatar_url), creator_cards, opponent_cards, community_cards`).eq('status', 'finished').or(`creator_id.eq.${userId},opponent_id.eq.${userId}`).order('finished_at', { ascending: false }).limit(10);
    setAvailableDuels([...(myWaiting || []), ...(available || [])] as Duel[]);
    setMyInvitations((invitations || []) as Duel[]);
    setRecentGames((recent || []) as Duel[]);
    if (active) { 
      setActiveDuel(active as Duel); 
      fetchMyCards(active.id);
      // Reset timer when turn changes
      if (active.last_action_at) {
        const elapsed = Math.floor((Date.now() - new Date(active.last_action_at).getTime()) / 1000);
        setTimeLeft(Math.max(0, TURN_TIME_SECONDS - elapsed));
      } else {
        setTimeLeft(TURN_TIME_SECONDS);
      }
    } else { 
      setActiveDuel(null); 
      setMyCards([]); 
      setCommunityCards([]); 
      setOpponentCards(null); 
    }
  }, [userId, fetchMyCards]);

  const searchUsers = async () => {
    if (!searchQuery.trim() || !userId) return;
    setSearchLoading(true);
    console.log('Searching users:', searchQuery.trim(), userId);
    const { data, error } = await supabase.rpc('search_users_for_duel', { search_query: searchQuery.trim(), current_user_id: userId });
    console.log('Search result:', data, error);
    if (data) setSearchResults(data as SearchUser[]);
    setSearchLoading(false);
  };

  const createDuel = async (invitedUserId?: string) => {
    if (!userId) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 10) { toast.error('Минимальная ставка 10₽'); return; }
    if (amount > balance) { toast.error('Недостаточно средств'); return; }
    setCreatingDuel(true);
    console.log('Creating duel:', userId, amount, invitedUserId);
    const { data, error } = await supabase.rpc('create_poker_duel_v2', { p_creator_id: userId, p_initial_bet: amount, p_invited_user_id: invitedUserId || null });
    console.log('Create duel result:', data, error);
    if (error) toast.error(error.message);
    else {
      toast.success(invitedUserId ? 'Приглашение отправлено!' : 'Дуэль создана!');
      if (invitedUserId && selectedUser) {
        const { data: invitedProfile } = await supabase.from('profiles').select('telegram_id').eq('id', invitedUserId).single();
        if (invitedProfile?.telegram_id) {
          const pokerLink = APP_CONFIG.getPokerDuelLink();
          await sendTelegramNotification({ 
            telegramId: invitedProfile.telegram_id, 
            message: `🃏 Вас приглашают на покерную дуэль!\n\nСтавка: ${amount}₽\n\n👉 Принять приглашение: ${pokerLink}`, 
            notificationType: 'custom' 
          });
        }
      }
      onBalanceUpdate(); fetchDuels(); setShowInviteDialog(false); setSelectedUser(null); setSearchQuery(''); setSearchResults([]);
    }
    setCreatingDuel(false);
  };

  const cancelDuel = async (duelId: string) => {
    if (!userId) return;
    const { error } = await supabase.rpc('cancel_poker_duel_v2', { p_duel_id: duelId, p_user_id: userId });
    if (error) toast.error(error.message); else { toast.success('Дуэль отменена'); onBalanceUpdate(); fetchDuels(); }
  };

  const declineDuel = async (duelId: string) => {
    if (!userId) return;
    const { error } = await supabase.rpc('decline_poker_duel', { p_duel_id: duelId, p_user_id: userId });
    if (error) toast.error(error.message); else { toast.success('Приглашение отклонено'); fetchDuels(); }
  };

  const joinDuel = async (duelId: string) => {
    if (!userId) return;
    setJoiningDuelId(duelId);
    const { error } = await supabase.rpc('join_poker_duel_v2', { p_duel_id: duelId, p_user_id: userId });
    if (error) toast.error(error.message); else { toast.success('Игра началась!'); onBalanceUpdate(); fetchDuels(); }
    setJoiningDuelId(null);
  };

  const performAction = async (action: string, raiseAmt?: number) => {
    if (!userId || !activeDuel) return;
    setActionLoading(true);
    const { data, error } = await supabase.rpc('poker_betting_action', { p_duel_id: activeDuel.id, p_user_id: userId, p_action: action, p_raise_amount: raiseAmt || 0 });
    if (error) toast.error(error.message);
    else if (data) {
      if (data.action === 'fold') toast.info('Вы сбросили карты');
      else if (data.new_phase === 'showdown') {
        if (data.is_draw) toast.info('Ничья! Банк поделен');
        else if (data.winner_id === userId) toast.success(`Вы выиграли ${data.win_amount?.toFixed(2)}₽!`);
        else toast.error('Вы проиграли');
      }
      onBalanceUpdate(); fetchDuels();
      setTimeLeft(TURN_TIME_SECONDS);
    }
    setActionLoading(false);
  };

  // Timer effect
  useEffect(() => {
    if (!activeDuel || activeDuel.game_phase === 'showdown') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const isMyTurn = activeDuel.current_turn === userId;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-action when time runs out
          if (isMyTurn && !actionLoading) {
            const opponentBet = activeDuel.creator_id === userId ? activeDuel.opponent_current_bet : activeDuel.creator_current_bet;
            const myBet = activeDuel.creator_id === userId ? activeDuel.creator_current_bet : activeDuel.opponent_current_bet;
            const callAmount = Math.max(0, (opponentBet || 0) - (myBet || 0));
            
            if (callAmount === 0) {
              performAction('check');
            } else {
              performAction('call');
            }
          }
          return TURN_TIME_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeDuel?.id, activeDuel?.current_turn, userId, actionLoading]);

  useEffect(() => { if (!userId) return; const channel = supabase.channel('poker_duels_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'poker_duels' }, () => { fetchDuels(); }).subscribe(); return () => { supabase.removeChannel(channel); }; }, [userId, fetchDuels]);
  useEffect(() => { fetchUserId(); }, [fetchUserId]);
  useEffect(() => { if (userId) fetchDuels(); }, [userId, fetchDuels]);
  useEffect(() => { if (activeDuel && userId) fetchMyCards(activeDuel.id); }, [activeDuel?.id, activeDuel?.game_phase, userId, fetchMyCards]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const isMyTurn = activeDuel?.current_turn === userId;
  const isCreator = activeDuel?.creator_id === userId;
  const myCurrentBet = isCreator ? activeDuel?.creator_current_bet : activeDuel?.opponent_current_bet;
  const opponentCurrentBet = isCreator ? activeDuel?.opponent_current_bet : activeDuel?.creator_current_bet;
  const callAmount = Math.max(0, (opponentCurrentBet || 0) - (myCurrentBet || 0));
  const canCheck = callAmount === 0;
  const myHandRank = isCreator ? activeDuel?.creator_hand_rank : activeDuel?.opponent_hand_rank;
  const oppHandRank = isCreator ? activeDuel?.opponent_hand_rank : activeDuel?.creator_hand_rank;
  const iWon = activeDuel?.winner_id === userId;
  const oppWon = activeDuel?.winner_id && activeDuel.winner_id !== userId;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header with Rules */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">🃏 Poker Duel</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowRules(true)}>
            <HelpCircle className="w-4 h-4 mr-1" />
            Правила
          </Button>
        </div>

        {/* Active Game */}
        {activeDuel && (
          <Card className="p-4 bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-600">
            <div className="space-y-4">
              {/* Game Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold text-green-400">🎴 Активная игра</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                    Банк: {activeDuel.pot?.toFixed(2)}₽
                  </Badge>
                  <Badge variant={isMyTurn ? 'default' : 'secondary'}>
                    {isMyTurn ? '🎯 Ваш ход' : '⏳ Ход противника'}
                  </Badge>
                </div>
              </div>

              {/* Timer */}
              {activeDuel.game_phase !== 'showdown' && (
                <TurnTimer timeLeft={timeLeft} isMyTurn={isMyTurn} />
              )}

              {/* Phase Indicator */}
              <div className="text-center">
                <Badge variant="outline" className="text-xs">
                  {activeDuel.game_phase === 'betting_round_1' && '📍 Раунд 1 — Префлоп'}
                  {activeDuel.game_phase === 'betting_round_2' && '📍 Раунд 2 — Флоп'}
                  {activeDuel.game_phase === 'showdown' && '🎉 Вскрытие карт!'}
                </Badge>
              </div>

              {/* Community Cards */}
              {communityCards.length > 0 && (
                <div className="text-center bg-black/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-2">🃏 Общие карты</p>
                  <div className="flex justify-center gap-1 sm:gap-2 flex-wrap">
                    {communityCards.map((card, i) => <PlayingCard key={i} card={card} />)}
                    {activeDuel.game_phase === 'betting_round_2' && Array(2).fill(0).map((_, i) => (
                      <PlayingCard key={`h-${i}`} card={{ suit: 'spades', rank: '?' }} hidden />
                    ))}
                  </div>
                </div>
              )}

              {/* Players Cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Opponent */}
                <div className="text-center bg-red-900/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    👤 {isCreator ? activeDuel.opponent?.username : activeDuel.creator?.username}
                  </p>
                  <div className="flex justify-center gap-1">
                    {opponentCards ? opponentCards.map((card, i) => (
                      <PlayingCard key={i} card={card} highlighted={oppWon && activeDuel.game_phase === 'showdown'} />
                    )) : (
                      <>
                        <PlayingCard card={{ suit: 'spades', rank: '?' }} hidden />
                        <PlayingCard card={{ suit: 'spades', rank: '?' }} hidden />
                      </>
                    )}
                  </div>
                  {activeDuel.game_phase === 'showdown' && oppHandRank && (
                    <HandRankDisplay rank={oppHandRank} isWinner={oppWon && !activeDuel.is_draw} />
                  )}
                  <p className="text-xs mt-2 text-muted-foreground">
                    Ставка: {opponentCurrentBet?.toFixed(2)}₽
                  </p>
                </div>

                {/* Me */}
                <div className="text-center bg-green-900/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-2">🎮 Ваши карты</p>
                  <div className="flex justify-center gap-1">
                    {myCards.map((card, i) => (
                      <PlayingCard key={i} card={card} highlighted={iWon && activeDuel.game_phase === 'showdown'} />
                    ))}
                  </div>
                  {activeDuel.game_phase === 'showdown' && myHandRank && (
                    <HandRankDisplay rank={myHandRank} isWinner={iWon && !activeDuel.is_draw} />
                  )}
                  <p className="text-xs mt-2 text-muted-foreground">
                    Ставка: {myCurrentBet?.toFixed(2)}₽
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {isMyTurn && activeDuel.game_phase !== 'showdown' && (
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          onClick={() => performAction('fold')} 
                          variant="destructive" 
                          disabled={actionLoading} 
                          className="flex-1"
                        >
                          ❌ Фолд
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Сбросить карты и проиграть банк</TooltipContent>
                    </Tooltip>
                    
                    {canCheck ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            onClick={() => performAction('check')} 
                            variant="outline" 
                            disabled={actionLoading} 
                            className="flex-1"
                          >
                            ✓ Чек
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Пропустить ход без ставки</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            onClick={() => performAction('call')} 
                            variant="secondary" 
                            disabled={actionLoading} 
                            className="flex-1"
                          >
                            📞 Колл {callAmount.toFixed(2)}₽
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Уравнять ставку противника</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      value={raiseAmount} 
                      onChange={(e) => setRaiseAmount(e.target.value)} 
                      placeholder="Сумма рейза" 
                      className="flex-1" 
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          onClick={() => performAction('raise', parseFloat(raiseAmount) || 0)} 
                          disabled={actionLoading || !raiseAmount} 
                          className="flex-1"
                        >
                          ⬆️ Рейз
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Повысить ставку</TooltipContent>
                    </Tooltip>
                  </div>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={() => performAction('all_in')} 
                        variant="outline" 
                        disabled={actionLoading} 
                        className="w-full border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
                      >
                        🔥 Ва-банк (All-In)
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Поставить все свои фишки</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Showdown Result */}
              {activeDuel.game_phase === 'showdown' && (
                <div className={`text-center p-4 rounded-lg ${activeDuel.is_draw ? 'bg-blue-900/30' : iWon ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <p className="text-2xl font-bold">
                    {activeDuel.is_draw ? '🤝 Ничья!' : iWon ? '🏆 Победа!' : '❌ Поражение'}
                  </p>
                  {!activeDuel.is_draw && iWon && (
                    <p className="text-yellow-400 mt-1">Выигрыш: {(activeDuel.pot * 0.95).toFixed(2)}₽</p>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Invitations */}
        {myInvitations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Приглашения ({myInvitations.length})
            </h3>
            {myInvitations.map((duel) => (
              <Card key={duel.id} className="p-3 bg-primary/10 border-primary/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{duel.creator?.username}</p>
                    <p className="text-xs text-muted-foreground">Ставка: {duel.initial_bet}₽</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => declineDuel(duel.id)}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => joinDuel(duel.id)} 
                      disabled={joiningDuelId === duel.id || balance < duel.initial_bet}
                    >
                      {joiningDuelId === duel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Create Duel */}
        {!activeDuel && (
          <Card className="p-4">
            <h3 className="text-base font-semibold mb-3">➕ Создать дуэль</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Начальная ставка (мин. 10₽)</label>
                <Input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(e.target.value)} 
                  placeholder="Сумма" 
                  min="10" 
                />
              </div>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => createDuel()} disabled={creatingDuel} className="flex-1">
                      {creatingDuel ? <Loader2 className="w-4 h-4 animate-spin" /> : '🌐 Открытая'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Любой игрок сможет присоединиться</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setShowInviteDialog(true)} variant="outline" className="flex-1">
                      <Search className="w-4 h-4 mr-1" />
                      Пригласить
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Найти и пригласить конкретного игрока</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Card>
        )}

        {/* Available Duels */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Доступные дуэли
            </h3>
            <Button size="sm" variant="ghost" onClick={fetchDuels}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {availableDuels.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">Нет доступных дуэлей</p>
          ) : (
            availableDuels.map((duel) => (
              <Card key={duel.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{duel.creator?.username}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>ID: {duel.creator?.public_id}</span>
                      <Badge variant="outline" className="text-xs">{duel.initial_bet}₽</Badge>
                      {duel.status === 'invited' && <Badge variant="secondary" className="text-xs">Приглашение</Badge>}
                    </div>
                  </div>
                  {duel.creator_id === userId ? (
                    <Button size="sm" variant="destructive" onClick={() => cancelDuel(duel.id)}>Отмена</Button>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => joinDuel(duel.id)} 
                      disabled={joiningDuelId === duel.id || balance < duel.initial_bet || !!activeDuel}
                    >
                      {joiningDuelId === duel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Принять'}
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Recent Games */}
        {recentGames.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              Последние игры
            </h3>
            {recentGames.map((duel) => (
              <Card 
                key={duel.id} 
                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedHistoryGame(duel)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {duel.is_draw ? '🤝' : duel.winner_id === userId ? '🏆' : '❌'}
                    </span>
                    <div>
                      <p className="text-sm">
                        vs {duel.creator_id === userId ? duel.opponent?.username : duel.creator?.username}
                      </p>
                      <p className="text-xs text-muted-foreground">Банк: {duel.pot?.toFixed(2)}₽</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <Badge 
                      variant={duel.is_draw ? 'secondary' : duel.winner_id === userId ? 'default' : 'destructive'}
                    >
                      {duel.is_draw ? 'Ничья' : duel.winner_id === userId ? 'Победа' : 'Поражение'}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Dialogs */}
        <RulesDialog open={showRules} onOpenChange={setShowRules} />
        <GameHistoryDialog 
          duel={selectedHistoryGame} 
          open={!!selectedHistoryGame} 
          onOpenChange={(open) => !open && setSelectedHistoryGame(null)}
          userId={userId}
        />

        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>🔍 Пригласить игрока</DialogTitle>
              <DialogDescription>Найдите игрока по нику или ID</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="Ник или ID игрока" 
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()} 
                />
                <Button onClick={searchUsers} disabled={searchLoading}>
                  {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {selectedUser && (
                <Card className="p-3 bg-primary/10 border-primary">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedUser.username}</p>
                      <p className="text-sm text-muted-foreground">ID: {selectedUser.public_id} • Lv.{selectedUser.level}</p>
                    </div>
                    <Button onClick={() => createDuel(selectedUser.id)} disabled={creatingDuel}>
                      {creatingDuel ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Пригласить'}
                    </Button>
                  </div>
                </Card>
              )}
              {searchResults.length > 0 && !selectedUser && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((user) => (
                    <Card 
                      key={user.id} 
                      className="p-3 cursor-pointer hover:bg-accent/50 transition-colors" 
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full rounded-full" />
                          ) : (
                            <span className="text-sm">{user.username?.[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-xs text-muted-foreground">ID: {user.public_id} • Lv.{user.level}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              {searchResults.length === 0 && searchQuery && !searchLoading && (
                <p className="text-center text-muted-foreground">Игроки не найдены</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};
