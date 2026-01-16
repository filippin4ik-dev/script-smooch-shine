import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Users, Trophy, Search, UserPlus, X, Check, RefreshCw, Clock, HelpCircle, Eye, Users2 } from 'lucide-react';
import { sendTelegramNotification } from '@/lib/telegramNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { APP_CONFIG } from '@/lib/config';
import { PokerResultAnimation } from './PokerResultAnimation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PokerDuelGameProps {
  visitorId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

interface Duel {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  invited_user_id: string | null;
  initial_bet: number;
  pot: number;
  status: string;
  game_phase: string;
  current_turn: string | null;
  creator_current_bet: number;
  opponent_current_bet: number;
  player3_current_bet: number;
  player4_current_bet: number;
  creator_folded: boolean;
  opponent_folded: boolean;
  player3_folded: boolean;
  player4_folded: boolean;
  winner_id: string | null;
  winners: string[] | null;
  creator_hand_rank: string | null;
  opponent_hand_rank: string | null;
  player3_hand_rank: string | null;
  player4_hand_rank: string | null;
  creator_cards: CardData[] | null;
  opponent_cards: CardData[] | null;
  player3_cards: CardData[] | null;
  player4_cards: CardData[] | null;
  community_cards: CardData[] | null;
  is_draw: boolean;
  created_at: string;
  last_action_at: string | null;
  max_players: number;
  current_players: number;
  cards_per_player: number;
  active_players_count: number;
  turn_order: string[] | null;
  creator?: { username: string; public_id: number; avatar_url: string | null };
  opponent?: { username: string; public_id: number; avatar_url: string | null };
  player3?: { username: string; public_id: number; avatar_url: string | null };
  player4?: { username: string; public_id: number; avatar_url: string | null };
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
  value?: string;
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
        className="w-10 h-14 sm:w-12 sm:h-16 rounded-lg border-2 border-blue-500 flex items-center justify-center shadow-xl relative overflow-hidden"
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
        <span className="text-lg sm:text-xl relative z-10 drop-shadow-lg">🂠</span>
      </div>
    );
  }

  const cardValue = card.rank || card.value;
  const suitColor = card.suit === 'hearts' || card.suit === 'diamonds' ? '#dc2626' : '#1f2937';

  return (
    <div 
      className={`w-10 h-14 sm:w-12 sm:h-16 rounded-lg border-2 flex flex-col items-center justify-center shadow-xl transition-all relative overflow-hidden ${highlighted ? 'border-yellow-400 ring-2 ring-yellow-400 scale-110 z-10' : 'border-slate-300'}`}
      style={{ 
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
        boxShadow: highlighted 
          ? '0 0 20px rgba(250, 204, 21, 0.5), 0 4px 6px -1px rgba(0, 0, 0, 0.2)' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255,255,255,1)'
      }}
    >
      <span className="text-sm sm:text-base font-bold relative z-10" style={{ color: suitColor }}>{cardValue}</span>
      <span className="text-base sm:text-lg relative z-10" style={{ color: suitColor }}>{SUITS_EMOJI[card.suit]}</span>
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
    <div className={`text-xs mt-1 px-2 py-0.5 rounded-full font-medium ${isWinner ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-muted text-muted-foreground'}`}>
      {translatedRank}
    </div>
  );
};

const RulesDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>📖 Правила Poker Duel</DialogTitle>
        <DialogDescription>Texas Hold'em для 2-4 игроков</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">🎴 Как играть:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Каждый игрок получает 2 или 3 карты</li>
            <li>На стол выкладываются 5 общих карт</li>
            <li>Составьте лучшую комбинацию из 5 карт</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">👥 Режимы:</h4>
          <ul className="space-y-1 text-muted-foreground">
            <li><Badge variant="outline" className="mr-2">2 игрока</Badge>Классическая дуэль</li>
            <li><Badge variant="secondary" className="mr-2">3 игрока</Badge>Больше тактики</li>
            <li><Badge className="mr-2">4 игрока</Badge>Максимальный азарт</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">🃏 Количество карт:</h4>
          <ul className="space-y-1 text-muted-foreground">
            <li><Badge variant="outline" className="mr-2">2 карты</Badge>Классический Texas Hold'em</li>
            <li><Badge variant="secondary" className="mr-2">3 карты</Badge>Больше комбинаций</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">🎯 Действия:</h4>
          <ul className="space-y-1 text-muted-foreground">
            <li><Badge variant="outline" className="mr-2">Чек</Badge>Пропустить ход</li>
            <li><Badge variant="secondary" className="mr-2">Колл</Badge>Уравнять ставку</li>
            <li><Badge className="mr-2">Рейз</Badge>Повысить ставку</li>
            <li><Badge variant="destructive" className="mr-2">Фолд</Badge>Сбросить карты</li>
            <li><Badge variant="outline" className="mr-2 border-yellow-500 text-yellow-500">Ва-банк</Badge>Поставить всё</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">⏱️ Время:</h4>
          <p className="text-muted-foreground">30 секунд на ход. При истечении — автоматический Чек/Колл.</p>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">💰 Комиссия и Split Pot:</h4>
          <p className="text-muted-foreground">5% комиссия казино. При ничьей банк делится поровну между победителями.</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

const GameHistoryDialog = ({ duel, open, onOpenChange, userId }: { duel: Duel | null; open: boolean; onOpenChange: (open: boolean) => void; userId: string | null }) => {
  if (!duel) return null;
  
  const getPlayerSlot = (id: string) => {
    if (id === duel.creator_id) return 'creator';
    if (id === duel.opponent_id) return 'opponent';
    if (id === duel.player3_id) return 'player3';
    if (id === duel.player4_id) return 'player4';
    return null;
  };
  
  const mySlot = userId ? getPlayerSlot(userId) : null;
  const iWon = duel.winner_id === userId || (duel.winners && duel.winners.includes(userId || ''));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {duel.is_draw ? '🤝 Ничья' : iWon ? '🏆 Победа!' : '❌ Поражение'}
          </DialogTitle>
          <DialogDescription>
            Банк: {duel.pot?.toFixed(2)}₽ • {duel.max_players} игрока
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
          
          {/* All Players Cards */}
          <div className="grid grid-cols-2 gap-2">
            {/* Creator */}
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">{duel.creator?.username}</p>
              <div className="flex justify-center gap-1">
                {duel.creator_cards ? (duel.creator_cards as CardData[]).map((card, i) => (
                  <PlayingCard key={i} card={card} highlighted={duel.winners?.includes(duel.creator_id)} />
                )) : <span className="text-muted-foreground text-xs">Фолд</span>}
              </div>
              {duel.creator_hand_rank && <HandRankDisplay rank={duel.creator_hand_rank} isWinner={duel.winners?.includes(duel.creator_id) || false} />}
            </div>
            
            {/* Opponent */}
            {duel.opponent_id && (
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{duel.opponent?.username}</p>
                <div className="flex justify-center gap-1">
                  {duel.opponent_cards ? (duel.opponent_cards as CardData[]).map((card, i) => (
                    <PlayingCard key={i} card={card} highlighted={duel.winners?.includes(duel.opponent_id!)} />
                  )) : <span className="text-muted-foreground text-xs">Фолд</span>}
                </div>
                {duel.opponent_hand_rank && <HandRankDisplay rank={duel.opponent_hand_rank} isWinner={duel.winners?.includes(duel.opponent_id!) || false} />}
              </div>
            )}
            
            {/* Player 3 */}
            {duel.player3_id && (
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{duel.player3?.username}</p>
                <div className="flex justify-center gap-1">
                  {duel.player3_cards ? (duel.player3_cards as CardData[]).map((card, i) => (
                    <PlayingCard key={i} card={card} highlighted={duel.winners?.includes(duel.player3_id!)} />
                  )) : <span className="text-muted-foreground text-xs">Фолд</span>}
                </div>
                {duel.player3_hand_rank && <HandRankDisplay rank={duel.player3_hand_rank} isWinner={duel.winners?.includes(duel.player3_id!) || false} />}
              </div>
            )}
            
            {/* Player 4 */}
            {duel.player4_id && (
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{duel.player4?.username}</p>
                <div className="flex justify-center gap-1">
                  {duel.player4_cards ? (duel.player4_cards as CardData[]).map((card, i) => (
                    <PlayingCard key={i} card={card} highlighted={duel.winners?.includes(duel.player4_id!)} />
                  )) : <span className="text-muted-foreground text-xs">Фолд</span>}
                </div>
                {duel.player4_hand_rank && <HandRankDisplay rank={duel.player4_hand_rank} isWinner={duel.winners?.includes(duel.player4_id!) || false} />}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Player card component for multiplayer view
const PlayerCardSlot = ({ 
  player, 
  cards, 
  currentBet, 
  handRank, 
  isWinner, 
  isFolded, 
  isCurrentTurn, 
  isMe,
  showCards,
  gamePhase 
}: { 
  player: { username: string; public_id: number } | undefined;
  cards: CardData[] | null;
  currentBet: number;
  handRank: string | null;
  isWinner: boolean;
  isFolded: boolean;
  isCurrentTurn: boolean;
  isMe: boolean;
  showCards: boolean;
  gamePhase: string;
}) => {
  if (!player) return null;
  
  const bgColor = isFolded 
    ? 'bg-gray-900/50 opacity-50' 
    : isCurrentTurn 
    ? 'bg-yellow-900/30 ring-2 ring-yellow-500' 
    : isMe 
    ? 'bg-green-900/30' 
    : 'bg-red-900/20';

  return (
    <div className={`text-center rounded-lg p-2 ${bgColor} transition-all`}>
      <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
        {isMe ? '🎮' : '👤'} {player.username}
        {isFolded && <Badge variant="destructive" className="text-[10px] px-1 py-0">Фолд</Badge>}
        {isCurrentTurn && !isFolded && <Badge variant="default" className="text-[10px] px-1 py-0 animate-pulse">Ход</Badge>}
      </p>
      <div className="flex justify-center gap-0.5">
        {isFolded ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : cards && (showCards || isMe) ? (
          cards.map((card, i) => (
            <PlayingCard key={i} card={card} highlighted={isWinner && gamePhase === 'showdown'} />
          ))
        ) : (
          Array(3).fill(0).map((_, i) => <PlayingCard key={i} card={{ suit: 'spades', rank: '?' }} hidden />)
        )}
      </div>
      {gamePhase === 'showdown' && handRank && !isFolded && (
        <HandRankDisplay rank={handRank} isWinner={isWinner} />
      )}
      <p className="text-[10px] mt-1 text-muted-foreground">
        Ставка: {currentBet?.toFixed(0) || 0}₽
      </p>
    </div>
  );
};

export const PokerDuelGame = ({ visitorId, balance, onBalanceUpdate }: PokerDuelGameProps) => {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState('100');
  const [raiseAmount, setRaiseAmount] = useState('50');
  const [maxPlayers, setMaxPlayers] = useState('2');
  const [cardsPerPlayer, setCardsPerPlayer] = useState('3');
  const [availableDuels, setAvailableDuels] = useState<Duel[]>([]);
  const [myInvitations, setMyInvitations] = useState<Duel[]>([]);
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  const [myCards, setMyCards] = useState<CardData[]>([]);
  const [communityCards, setCommunityCards] = useState<CardData[]>([]);
  const [allPlayerCards, setAllPlayerCards] = useState<Record<string, CardData[]>>({});
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
  const [showResultAnimation, setShowResultAnimation] = useState(false);
  const [resultAnimationType, setResultAnimationType] = useState<'win' | 'lose' | 'draw'>('win');
  const [resultAnimationAmount, setResultAnimationAmount] = useState(0);
  const lastDuelStatusRef = useRef<string | null>(null);
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
    // Try to get cards from the duel itself first for multiplayer
    const { data: duel } = await supabase
      .from('poker_duels')
      .select('creator_id, opponent_id, player3_id, player4_id, creator_cards, opponent_cards, player3_cards, player4_cards, community_cards, game_phase')
      .eq('id', duelId)
      .single();
    
    if (duel) {
      // Set my cards based on my role
      if (userId === duel.creator_id && duel.creator_cards) {
        setMyCards(duel.creator_cards as CardData[]);
      } else if (userId === duel.opponent_id && duel.opponent_cards) {
        setMyCards(duel.opponent_cards as CardData[]);
      } else if (userId === duel.player3_id && duel.player3_cards) {
        setMyCards(duel.player3_cards as CardData[]);
      } else if (userId === duel.player4_id && duel.player4_cards) {
        setMyCards(duel.player4_cards as CardData[]);
      }
      
      setCommunityCards(duel.community_cards as CardData[] || []);
      
      // If showdown, show all cards
      if (duel.game_phase === 'showdown') {
        const allCards: Record<string, CardData[]> = {};
        if (duel.creator_cards) allCards[duel.creator_id] = duel.creator_cards as CardData[];
        if (duel.opponent_id && duel.opponent_cards) allCards[duel.opponent_id] = duel.opponent_cards as CardData[];
        if (duel.player3_id && duel.player3_cards) allCards[duel.player3_id] = duel.player3_cards as CardData[];
        if (duel.player4_id && duel.player4_cards) allCards[duel.player4_id] = duel.player4_cards as CardData[];
        setAllPlayerCards(allCards);
      } else {
        setAllPlayerCards({});
      }
    }
  }, [userId]);

  const fetchDuels = useCallback(async () => {
    if (!userId) return;
    
    // Fetch available duels (waiting for players)
    const { data: available } = await supabase
      .from('poker_duels')
      .select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`)
      .eq('status', 'waiting')
      .neq('creator_id', userId)
      .is('invited_user_id', null)
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Fetch my invitations
    const { data: invitations } = await supabase
      .from('poker_duels')
      .select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`)
      .eq('invited_user_id', userId)
      .eq('status', 'invited')
      .order('created_at', { ascending: false });
    
    // Fetch active game (either playing or waiting with me in it)
    const { data: active } = await supabase
      .from('poker_duels')
      .select(`*, 
        creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url), 
        opponent:profiles!poker_duels_opponent_id_fkey(username, public_id, avatar_url)`)
      .in('status', ['playing', 'betting'])
      .or(`creator_id.eq.${userId},opponent_id.eq.${userId},player3_id.eq.${userId},player4_id.eq.${userId}`)
      .maybeSingle();
    
    // Also fetch waiting games where I'm the creator or already joined
    const { data: myWaiting } = await supabase
      .from('poker_duels')
      .select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`)
      .in('status', ['waiting', 'invited'])
      .or(`creator_id.eq.${userId},opponent_id.eq.${userId},player3_id.eq.${userId},player4_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    // Fetch recent games
    const { data: recent } = await supabase
      .from('poker_duels')
      .select(`*, 
        creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url), 
        opponent:profiles!poker_duels_opponent_id_fkey(username, public_id, avatar_url),
        creator_cards, opponent_cards, player3_cards, player4_cards, community_cards`)
      .eq('status', 'finished')
      .or(`creator_id.eq.${userId},opponent_id.eq.${userId},player3_id.eq.${userId},player4_id.eq.${userId}`)
      .order('finished_at', { ascending: false })
      .limit(10);
    
    setAvailableDuels([...(myWaiting || []), ...(available || [])] as Duel[]);
    setMyInvitations((invitations || []) as Duel[]);
    setRecentGames((recent || []) as Duel[]);
    
    if (active) { 
      // Check if game just ended - trigger animation
      if (active.game_phase === 'showdown' && lastDuelStatusRef.current !== 'showdown') {
        const iWon = active.winner_id === userId || (active.winners && (active.winners as string[]).includes(userId));
        if (active.is_draw || (active.winners && (active.winners as string[]).length > 1)) {
          setResultAnimationType('draw');
          const winnersCount = active.winners ? (active.winners as string[]).length : 2;
          setResultAnimationAmount((active.pot * 0.95) / winnersCount);
        } else if (iWon) {
          setResultAnimationType('win');
          setResultAnimationAmount(active.pot * 0.95);
        } else {
          setResultAnimationType('lose');
          setResultAnimationAmount(0);
        }
        setShowResultAnimation(true);
      }
      lastDuelStatusRef.current = active.game_phase;
      
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
      lastDuelStatusRef.current = null;
      setActiveDuel(null); 
      setMyCards([]); 
      setCommunityCards([]); 
      setAllPlayerCards({});
    }
  }, [userId, fetchMyCards]);

  const searchUsers = async () => {
    if (!searchQuery.trim() || !userId) return;
    setSearchLoading(true);
    const { data, error } = await supabase.rpc('search_users_for_duel', { search_query: searchQuery.trim(), current_user_id: userId });
    if (data) setSearchResults(data as SearchUser[]);
    setSearchLoading(false);
  };

  const createDuel = async (invitedUserId?: string) => {
    if (!userId) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 10) { toast.error('Минимальная ставка 10₽'); return; }
    if (amount > balance) { toast.error('Недостаточно средств'); return; }
    
    setCreatingDuel(true);
    
    const numPlayers = parseInt(maxPlayers);
    const numCards = parseInt(cardsPerPlayer);
    
    console.log('Creating multiplayer duel:', { userId, amount, numPlayers, numCards, invitedUserId });
    
    // Use multiplayer function
    const { data, error } = await supabase.rpc('create_multiplayer_poker_duel', { 
      p_user_id: userId, 
      p_bet_amount: Math.floor(amount), 
      p_max_players: numPlayers,
      p_cards_per_player: numCards
    });
    
    console.log('Create duel result:', data, error);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Лобби на ${numPlayers} игроков создано!`);
      if (invitedUserId && selectedUser) {
        const { data: invitedProfile } = await supabase.from('profiles').select('telegram_id').eq('id', invitedUserId).single();
        if (invitedProfile?.telegram_id) {
          const pokerLink = APP_CONFIG.getPokerDuelLink();
          await sendTelegramNotification({ 
            telegramId: invitedProfile.telegram_id, 
            message: `🃏 Вас приглашают на покер ${numPlayers} игрока!\n\nСтавка: ${amount}₽\nКарт на руках: ${numCards}\n\n👉 Принять: ${pokerLink}`, 
            notificationType: 'custom' 
          });
        }
      }
      onBalanceUpdate(); 
      fetchDuels(); 
      setShowInviteDialog(false); 
      setSelectedUser(null); 
      setSearchQuery(''); 
      setSearchResults([]);
    }
    setCreatingDuel(false);
  };

  const cancelDuel = async (duelId: string) => {
    if (!userId) return;
    const { error } = await supabase.rpc('cancel_poker_duel_v2', { p_duel_id: duelId, p_user_id: userId });
    if (error) toast.error(error.message); 
    else { toast.success('Дуэль отменена'); onBalanceUpdate(); fetchDuels(); }
  };

  const declineDuel = async (duelId: string) => {
    if (!userId) return;
    const { error } = await supabase.rpc('decline_poker_duel', { p_duel_id: duelId, p_user_id: userId });
    if (error) toast.error(error.message); 
    else { toast.success('Приглашение отклонено'); fetchDuels(); }
  };

  const joinDuel = async (duelId: string) => {
    if (!userId) return;
    setJoiningDuelId(duelId);
    
    // Use multiplayer join function
    const { data, error } = await supabase.rpc('join_multiplayer_poker_duel', { 
      p_duel_id: duelId, 
      p_user_id: userId 
    });
    
    if (error) {
      toast.error(error.message);
    } else if (data) {
      if (data.game_started) {
        toast.success('Игра началась!');
      } else {
        toast.success('Вы присоединились к лобби!');
      }
      onBalanceUpdate(); 
      fetchDuels();
    }
    setJoiningDuelId(null);
  };

  const performAction = async (action: string, raiseAmt?: number) => {
    if (!userId || !activeDuel) return;
    setActionLoading(true);
    
    // Use multiplayer action function
    const { data, error } = await supabase.rpc('multiplayer_poker_action', { 
      p_duel_id: activeDuel.id, 
      p_user_id: userId, 
      p_action: action, 
      p_raise_amount: raiseAmt || 0 
    });
    
    if (error) {
      toast.error(error.message);
    } else if (data) {
      if (action === 'fold') toast.info('Вы сбросили карты');
      else if (data.game_ended) {
        const winners = data.winners as string[];
        if (winners && winners.includes(userId)) {
          toast.success('Вы выиграли!');
        } else {
          toast.error('Вы проиграли');
        }
      }
      onBalanceUpdate(); 
      fetchDuels();
      setTimeLeft(TURN_TIME_SECONDS);
    }
    setActionLoading(false);
  };

  // Timer effect
  useEffect(() => {
    if (!activeDuel || activeDuel.game_phase === 'showdown' || activeDuel.status !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const isMyTurn = activeDuel.current_turn === userId;
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-action when time runs out
          if (isMyTurn && !actionLoading) {
            // Calculate call amount based on all players
            const maxBet = Math.max(
              activeDuel.creator_current_bet || 0,
              activeDuel.opponent_current_bet || 0,
              activeDuel.player3_current_bet || 0,
              activeDuel.player4_current_bet || 0
            );
            
            let myBet = 0;
            if (userId === activeDuel.creator_id) myBet = activeDuel.creator_current_bet || 0;
            else if (userId === activeDuel.opponent_id) myBet = activeDuel.opponent_current_bet || 0;
            else if (userId === activeDuel.player3_id) myBet = activeDuel.player3_current_bet || 0;
            else if (userId === activeDuel.player4_id) myBet = activeDuel.player4_current_bet || 0;
            
            const callAmount = maxBet - myBet;
            
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

  useEffect(() => { 
    if (!userId) return; 
    const channel = supabase.channel('poker_duels_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poker_duels' }, () => { fetchDuels(); })
      .subscribe(); 
    return () => { supabase.removeChannel(channel); }; 
  }, [userId, fetchDuels]);
  
  useEffect(() => { fetchUserId(); }, [fetchUserId]);
  useEffect(() => { if (userId) fetchDuels(); }, [userId, fetchDuels]);
  useEffect(() => { if (activeDuel && userId) fetchMyCards(activeDuel.id); }, [activeDuel?.id, activeDuel?.game_phase, userId, fetchMyCards]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  // Determine my role and calculate values
  const getMyRole = () => {
    if (!activeDuel || !userId) return null;
    if (userId === activeDuel.creator_id) return 'creator';
    if (userId === activeDuel.opponent_id) return 'opponent';
    if (userId === activeDuel.player3_id) return 'player3';
    if (userId === activeDuel.player4_id) return 'player4';
    return null;
  };

  const myRole = getMyRole();
  const isMyTurn = activeDuel?.current_turn === userId;
  
  // Calculate call amount
  const maxBet = activeDuel ? Math.max(
    activeDuel.creator_current_bet || 0,
    activeDuel.opponent_current_bet || 0,
    activeDuel.player3_current_bet || 0,
    activeDuel.player4_current_bet || 0
  ) : 0;
  
  const myCurrentBet = activeDuel ? (
    myRole === 'creator' ? activeDuel.creator_current_bet :
    myRole === 'opponent' ? activeDuel.opponent_current_bet :
    myRole === 'player3' ? activeDuel.player3_current_bet :
    myRole === 'player4' ? activeDuel.player4_current_bet : 0
  ) : 0;
  
  const callAmount = Math.max(0, maxBet - (myCurrentBet || 0));
  const canCheck = callAmount === 0;
  
  const iWon = activeDuel?.winner_id === userId || (activeDuel?.winners && activeDuel.winners.includes(userId || ''));

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Result Animation */}
        <PokerResultAnimation
          result={resultAnimationType}
          amount={resultAnimationAmount}
          show={showResultAnimation}
          onComplete={() => {
            setShowResultAnimation(false);
            onBalanceUpdate();
          }}
        />
        
        {/* Header with Rules */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">🃏 Poker Duel</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowRules(true)}>
            <HelpCircle className="w-4 h-4 mr-1" />
            Правила
          </Button>
        </div>

        {/* Active Game */}
        {activeDuel && activeDuel.status === 'playing' && (
          <Card className="p-4 bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-600">
            <div className="space-y-3">
              {/* Game Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold text-green-400">🎴 Активная игра</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                    Банк: {activeDuel.pot?.toFixed(0)}₽
                  </Badge>
                  <Badge variant="secondary">
                    {activeDuel.max_players} игрока • {activeDuel.cards_per_player || 2} карты
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
                  {activeDuel.game_phase === 'preflop' && '📍 Префлоп'}
                  {activeDuel.game_phase === 'flop' && '📍 Флоп'}
                  {activeDuel.game_phase === 'turn' && '📍 Тёрн'}
                  {activeDuel.game_phase === 'river' && '📍 Ривер'}
                  {activeDuel.game_phase === 'showdown' && '🎉 Вскрытие!'}
                </Badge>
              </div>

              {/* Community Cards */}
              {communityCards.length > 0 && (
                <div className="text-center bg-black/20 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground mb-1">🃏 Общие карты</p>
                  <div className="flex justify-center gap-1 flex-wrap">
                    {communityCards.map((card, i) => <PlayingCard key={i} card={card} />)}
                  </div>
                </div>
              )}

              {/* All Players Grid */}
              <div className={`grid gap-2 ${activeDuel.max_players <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                {/* Creator */}
                <PlayerCardSlot
                  player={activeDuel.creator}
                  cards={allPlayerCards[activeDuel.creator_id] || (myRole === 'creator' ? myCards : null)}
                  currentBet={activeDuel.creator_current_bet || 0}
                  handRank={activeDuel.creator_hand_rank}
                  isWinner={activeDuel.winners?.includes(activeDuel.creator_id) || activeDuel.winner_id === activeDuel.creator_id}
                  isFolded={activeDuel.creator_folded}
                  isCurrentTurn={activeDuel.current_turn === activeDuel.creator_id}
                  isMe={myRole === 'creator'}
                  showCards={activeDuel.game_phase === 'showdown'}
                  gamePhase={activeDuel.game_phase}
                />
                
                {/* Opponent */}
                {activeDuel.opponent_id && (
                  <PlayerCardSlot
                    player={activeDuel.opponent}
                    cards={allPlayerCards[activeDuel.opponent_id] || (myRole === 'opponent' ? myCards : null)}
                    currentBet={activeDuel.opponent_current_bet || 0}
                    handRank={activeDuel.opponent_hand_rank}
                    isWinner={activeDuel.winners?.includes(activeDuel.opponent_id) || activeDuel.winner_id === activeDuel.opponent_id}
                    isFolded={activeDuel.opponent_folded}
                    isCurrentTurn={activeDuel.current_turn === activeDuel.opponent_id}
                    isMe={myRole === 'opponent'}
                    showCards={activeDuel.game_phase === 'showdown'}
                    gamePhase={activeDuel.game_phase}
                  />
                )}
                
                {/* Player 3 */}
                {activeDuel.player3_id && (
                  <PlayerCardSlot
                    player={activeDuel.player3}
                    cards={allPlayerCards[activeDuel.player3_id] || (myRole === 'player3' ? myCards : null)}
                    currentBet={activeDuel.player3_current_bet || 0}
                    handRank={activeDuel.player3_hand_rank}
                    isWinner={activeDuel.winners?.includes(activeDuel.player3_id) || activeDuel.winner_id === activeDuel.player3_id}
                    isFolded={activeDuel.player3_folded}
                    isCurrentTurn={activeDuel.current_turn === activeDuel.player3_id}
                    isMe={myRole === 'player3'}
                    showCards={activeDuel.game_phase === 'showdown'}
                    gamePhase={activeDuel.game_phase}
                  />
                )}
                
                {/* Player 4 */}
                {activeDuel.player4_id && (
                  <PlayerCardSlot
                    player={activeDuel.player4}
                    cards={allPlayerCards[activeDuel.player4_id] || (myRole === 'player4' ? myCards : null)}
                    currentBet={activeDuel.player4_current_bet || 0}
                    handRank={activeDuel.player4_hand_rank}
                    isWinner={activeDuel.winners?.includes(activeDuel.player4_id) || activeDuel.winner_id === activeDuel.player4_id}
                    isFolded={activeDuel.player4_folded}
                    isCurrentTurn={activeDuel.current_turn === activeDuel.player4_id}
                    isMe={myRole === 'player4'}
                    showCards={activeDuel.game_phase === 'showdown'}
                    gamePhase={activeDuel.game_phase}
                  />
                )}
              </div>

              {/* Action Buttons */}
              {isMyTurn && activeDuel.game_phase !== 'showdown' && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => performAction('fold')} 
                      variant="destructive" 
                      disabled={actionLoading} 
                      className="flex-1"
                      size="sm"
                    >
                      ❌ Фолд
                    </Button>
                    
                    {canCheck ? (
                      <Button 
                        onClick={() => performAction('check')} 
                        variant="outline" 
                        disabled={actionLoading} 
                        className="flex-1"
                        size="sm"
                      >
                        ✓ Чек
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => performAction('call')} 
                        variant="secondary" 
                        disabled={actionLoading} 
                        className="flex-1"
                        size="sm"
                      >
                        📞 Колл {callAmount}₽
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      value={raiseAmount} 
                      onChange={(e) => setRaiseAmount(e.target.value)} 
                      placeholder="Рейз" 
                      className="flex-1" 
                    />
                    <Button 
                      onClick={() => performAction('raise', parseFloat(raiseAmount) || 0)} 
                      disabled={actionLoading || !raiseAmount} 
                      className="flex-1"
                      size="sm"
                    >
                      ⬆️ Рейз
                    </Button>
                  </div>
                  
                  <Button 
                    onClick={() => performAction('all-in')} 
                    variant="outline" 
                    disabled={actionLoading} 
                    className="w-full border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
                    size="sm"
                  >
                    🔥 Ва-банк
                  </Button>
                </div>
              )}

              {/* Showdown Result */}
              {activeDuel.game_phase === 'showdown' && (
                <div className={`text-center p-3 rounded-lg ${activeDuel.is_draw ? 'bg-blue-900/30' : iWon ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <p className="text-xl font-bold">
                    {activeDuel.is_draw || (activeDuel.winners && activeDuel.winners.length > 1) ? '🤝 Банк поделён!' : iWon ? '🏆 Победа!' : '❌ Поражение'}
                  </p>
                  {iWon && (
                    <p className="text-yellow-400 mt-1">
                      Выигрыш: {((activeDuel.pot * 0.95) / (activeDuel.winners?.length || 1)).toFixed(0)}₽
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Waiting Lobby */}
        {activeDuel && activeDuel.status === 'waiting' && activeDuel.creator_id === userId && (
          <Card className="p-4 bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-600">
            <div className="space-y-3 text-center">
              <h3 className="text-base font-bold text-blue-400">⏳ Ожидание игроков</h3>
              <div className="flex items-center justify-center gap-2">
                <Users2 className="w-5 h-5" />
                <span className="text-lg font-bold">{activeDuel.current_players} / {activeDuel.max_players}</span>
              </div>
              <Badge variant="outline">{activeDuel.cards_per_player} карты • {activeDuel.initial_bet}₽</Badge>
              <Progress value={(activeDuel.current_players / activeDuel.max_players) * 100} className="h-2" />
              <Button variant="destructive" size="sm" onClick={() => cancelDuel(activeDuel.id)}>
                Отменить
              </Button>
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
                    <p className="text-xs text-muted-foreground">
                      {duel.initial_bet}₽ • {duel.max_players} игрока • {duel.cards_per_player} карты
                    </p>
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
            <h3 className="text-base font-semibold mb-3">➕ Создать игру</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Игроков</label>
                  <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 игрока</SelectItem>
                      <SelectItem value="3">3 игрока</SelectItem>
                      <SelectItem value="4">4 игрока</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Карт на руках</label>
                  <Select value={cardsPerPlayer} onValueChange={setCardsPerPlayer}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 карты</SelectItem>
                      <SelectItem value="3">3 карты</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ставка (мин. 10₽)</label>
                <Input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(e.target.value)} 
                  placeholder="100" 
                  min="10" 
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => createDuel()} disabled={creatingDuel} className="flex-1">
                  {creatingDuel ? <Loader2 className="w-4 h-4 animate-spin" /> : '🌐 Создать лобби'}
                </Button>
                <Button onClick={() => setShowInviteDialog(true)} variant="outline" className="flex-1">
                  <Search className="w-4 h-4 mr-1" />
                  Пригласить
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Available Duels */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Доступные игры
            </h3>
            <Button size="sm" variant="ghost" onClick={fetchDuels}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {availableDuels.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">Нет доступных игр</p>
          ) : (
            availableDuels.map((duel) => (
              <Card key={duel.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{duel.creator?.username}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                      <Badge variant="outline" className="text-xs">{duel.initial_bet}₽</Badge>
                      <Badge variant="secondary" className="text-xs">{duel.current_players}/{duel.max_players} 👥</Badge>
                      <Badge variant="secondary" className="text-xs">{duel.cards_per_player || 2} 🃏</Badge>
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
                      {joiningDuelId === duel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Войти'}
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
            {recentGames.map((duel) => {
              const isWinnerInGame = duel.winner_id === userId || (duel.winners && duel.winners.includes(userId || ''));
              return (
                <Card 
                  key={duel.id} 
                  className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedHistoryGame(duel)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {duel.is_draw ? '🤝' : isWinnerInGame ? '🏆' : '❌'}
                      </span>
                      <div>
                        <p className="text-sm">{duel.max_players} игрока</p>
                        <p className="text-xs text-muted-foreground">Банк: {duel.pot?.toFixed(0)}₽</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <Badge variant={duel.is_draw ? 'secondary' : isWinnerInGame ? 'default' : 'destructive'}>
                        {duel.is_draw ? 'Ничья' : isWinnerInGame ? 'Победа' : 'Поражение'}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
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
                  placeholder="Ник или ID" 
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
