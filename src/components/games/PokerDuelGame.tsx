import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Users, Trophy, Search, UserPlus, X, Check, RefreshCw, Clock, HelpCircle, Eye, Users2, LogOut } from 'lucide-react';
import { sendTelegramNotification } from '@/lib/telegramNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { APP_CONFIG } from '@/lib/config';
import { PokerResultAnimation } from './PokerResultAnimation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface PokerDuelGameProps {
  visitorId: string; // Can be telegram_id (string of number) OR profile UUID
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
  max_balance: number;
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

// Poker Chip Component with animation
const PokerChip = ({ 
  value, 
  color = 'gold', 
  animate = false, 
  delay = 0,
  flyDirection = 'up'
}: { 
  value?: number; 
  color?: 'gold' | 'red' | 'blue' | 'green' | 'purple';
  animate?: boolean;
  delay?: number;
  flyDirection?: 'up' | 'left' | 'right';
}) => {
  const colorClasses = {
    gold: 'from-yellow-400 via-yellow-500 to-yellow-600 border-yellow-300 shadow-yellow-500/50',
    red: 'from-red-400 via-red-500 to-red-600 border-red-300 shadow-red-500/50',
    blue: 'from-blue-400 via-blue-500 to-blue-600 border-blue-300 shadow-blue-500/50',
    green: 'from-green-400 via-green-500 to-green-600 border-green-300 shadow-green-500/50',
    purple: 'from-purple-400 via-purple-500 to-purple-600 border-purple-300 shadow-purple-500/50',
  };

  const flyVars: Record<string, string> = {
    up: '--fly-x: 0px; --fly-y: -80px; --fly-x-end: 0px; --fly-y-end: -120px;',
    left: '--fly-x: -60px; --fly-y: -60px; --fly-x-end: -80px; --fly-y-end: -100px;',
    right: '--fly-x: 60px; --fly-y: -60px; --fly-x-end: 80px; --fly-y-end: -100px;',
  };

  return (
    <div 
      className={`
        w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 
        bg-gradient-to-br ${colorClasses[color]}
        flex items-center justify-center
        shadow-lg relative overflow-hidden
        ${animate ? 'animate-chip-fly' : 'animate-chip-bounce'}
      `}
      style={{ 
        animationDelay: `${delay}ms`,
        ...(animate ? { cssText: flyVars[flyDirection] } : {})
      } as React.CSSProperties}
    >
      {/* Inner ring */}
      <div className="absolute inset-1 rounded-full border border-white/30" />
      {/* Center circle */}
      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
        {value && <span className="text-[8px] sm:text-[10px] font-bold text-white drop-shadow-md">{value >= 1000 ? `${(value/1000).toFixed(0)}K` : value}</span>}
        {!value && <span className="text-xs">💰</span>}
      </div>
      {/* Shine effect */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full" />
    </div>
  );
};

// Flying chips animation container
const FlyingChips = ({ 
  show, 
  amount, 
  fromPosition = 'bottom',
  onComplete 
}: { 
  show: boolean; 
  amount: number;
  fromPosition?: 'bottom' | 'left' | 'right';
  onComplete?: () => void;
}) => {
  const [chips, setChips] = useState<{ id: number; color: 'gold' | 'red' | 'blue' | 'green' | 'purple'; delay: number }[]>([]);

  useEffect(() => {
    if (show && amount > 0) {
      const chipCount = Math.min(5, Math.ceil(amount / 100));
      const colors: ('gold' | 'red' | 'blue' | 'green' | 'purple')[] = ['gold', 'red', 'blue', 'green', 'purple'];
      
      const newChips = Array.from({ length: chipCount }, (_, i) => ({
        id: Date.now() + i,
        color: colors[i % colors.length],
        delay: i * 100
      }));
      
      setChips(newChips);
      
      // Clear chips after animation
      const timer = setTimeout(() => {
        setChips([]);
        onComplete?.();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [show, amount, onComplete]);

  if (!chips.length) return null;

  const positionClasses = {
    bottom: 'bottom-0 left-1/2 -translate-x-1/2',
    left: 'bottom-1/2 left-0 translate-y-1/2',
    right: 'bottom-1/2 right-0 translate-y-1/2'
  };

  const flyDirection = fromPosition === 'left' ? 'right' : fromPosition === 'right' ? 'left' : 'up';

  return (
    <div className={`absolute ${positionClasses[fromPosition]} z-50 flex gap-1`}>
      {chips.map((chip) => (
        <PokerChip 
          key={chip.id} 
          color={chip.color} 
          animate 
          delay={chip.delay}
          flyDirection={flyDirection}
        />
      ))}
    </div>
  );
};

// Pot display with stacked chips
const PotDisplay = ({ pot, showAnimation = false }: { pot: number; showAnimation?: boolean }) => {
  const chipStacks = Math.min(5, Math.ceil(pot / 200));
  const colors: ('gold' | 'red' | 'blue' | 'green' | 'purple')[] = ['gold', 'red', 'blue', 'green', 'purple'];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-end justify-center gap-0.5">
        {Array.from({ length: chipStacks }).map((_, i) => (
          <div 
            key={i} 
            className={`${showAnimation ? 'animate-chip-stack' : ''}`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <PokerChip color={colors[i % colors.length]} />
          </div>
        ))}
      </div>
      <span className="text-xs text-yellow-400 font-bold">{pot?.toFixed(0)}₽</span>
    </div>
  );
};

const PlayingCard = ({ 
  card, 
  hidden = false, 
  highlighted = false,
  dealAnimation = false,
  dealDelay = 0,
  dealDirection = 'top'
}: { 
  card: CardData; 
  hidden?: boolean; 
  highlighted?: boolean;
  dealAnimation?: boolean;
  dealDelay?: number;
  dealDirection?: 'top' | 'left' | 'right' | 'bottom';
}) => {
  const [isDealt, setIsDealt] = useState(!dealAnimation);
  
  useEffect(() => {
    if (dealAnimation) {
      const timer = setTimeout(() => setIsDealt(true), dealDelay);
      return () => clearTimeout(timer);
    }
  }, [dealAnimation, dealDelay]);

  const getDealStyles = () => {
    if (!dealAnimation) return {};
    const directions = {
      top: { '--deal-from-x': '0px', '--deal-from-y': '-150px', '--deal-rotate': '-180deg' },
      left: { '--deal-from-x': '-150px', '--deal-from-y': '-50px', '--deal-rotate': '-90deg' },
      right: { '--deal-from-x': '150px', '--deal-from-y': '-50px', '--deal-rotate': '90deg' },
      bottom: { '--deal-from-x': '0px', '--deal-from-y': '150px', '--deal-rotate': '180deg' },
    };
    return directions[dealDirection];
  };

  if (hidden) {
    return (
      <div 
        className={`w-10 h-14 sm:w-12 sm:h-16 rounded-lg border-2 border-blue-500 flex items-center justify-center shadow-xl relative overflow-hidden ${dealAnimation && isDealt ? 'animate-card-deal' : ''} ${!isDealt ? 'opacity-0' : ''}`}
        style={{ 
          background: '#1e3a8a',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
          animationDelay: `${dealDelay}ms`,
          ...getDealStyles()
        } as React.CSSProperties}
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
      className={`w-10 h-14 sm:w-12 sm:h-16 rounded-lg border-2 flex flex-col items-center justify-center shadow-xl transition-all relative overflow-hidden 
        ${highlighted ? 'border-yellow-400 ring-2 ring-yellow-400 scale-110 z-10 animate-card-glow' : 'border-slate-300'}
        ${dealAnimation && isDealt ? 'animate-card-deal' : ''}
        ${!isDealt ? 'opacity-0' : ''}`}
      style={{ 
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
        boxShadow: highlighted 
          ? '0 0 20px rgba(250, 204, 21, 0.5), 0 4px 6px -1px rgba(0, 0, 0, 0.2)' 
          : '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255,255,255,1)',
        animationDelay: `${dealDelay}ms`,
        ...getDealStyles()
      } as React.CSSProperties}
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
            <li>На стол выкладываются 5 общих карт (флоп-тёрн-ривер)</li>
            <li>Составьте лучшую комбинацию из 5 карт</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">💰 Максимальный баланс:</h4>
          <p className="text-muted-foreground">При создании игры выбирается максимальный баланс. Нельзя ставить больше этой суммы за всю игру.</p>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">🔥 Ва-банк:</h4>
          <p className="text-muted-foreground">При ва-банке ставится всё что есть (до лимита). Если у оппонента меньше денег — он ставит сколько может.</p>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">⏱️ Время:</h4>
          <p className="text-muted-foreground">30 секунд на ход. При истечении — автоматический Чек/Колл.</p>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-primary">💎 Комиссия и Split Pot:</h4>
          <p className="text-muted-foreground">5% комиссия казино. При ничьей банк делится поровну.</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

const GameHistoryDialog = ({ duel, open, onOpenChange, userId }: { duel: Duel | null; open: boolean; onOpenChange: (open: boolean) => void; userId: string | null }) => {
  if (!duel) return null;
  
  const iWon = duel.winner_id === userId || (duel.winners && duel.winners.includes(userId || ''));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {duel.is_draw ? '🤝 Ничья' : iWon ? '🏆 Победа!' : '❌ Поражение'}
          </DialogTitle>
          <DialogDescription>
            Банк: {duel.pot?.toFixed(0)}₽ • {duel.max_players} игрока
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
  gamePhase,
  cardsPerPlayer,
  playerIndex = 0,
  showDealAnimation = false
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
  cardsPerPlayer: number;
  playerIndex?: number;
  showDealAnimation?: boolean;
}) => {
  if (!player) return null;
  
  const bgColor = isFolded 
    ? 'bg-gray-900/50 opacity-50' 
    : isCurrentTurn 
    ? 'bg-yellow-900/30 ring-2 ring-yellow-500' 
    : isMe 
    ? 'bg-green-900/30' 
    : 'bg-red-900/20';

  const dealDirections: ('top' | 'left' | 'right' | 'bottom')[] = ['top', 'right', 'bottom', 'left'];
  const dealDirection = dealDirections[playerIndex % 4];

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
            <PlayingCard 
              key={i} 
              card={card} 
              highlighted={isWinner && gamePhase === 'showdown'}
              dealAnimation={showDealAnimation}
              dealDelay={playerIndex * 300 + i * 150}
              dealDirection={dealDirection}
            />
          ))
        ) : (
          Array(cardsPerPlayer).fill(0).map((_, i) => (
            <PlayingCard 
              key={i} 
              card={{ suit: 'spades', rank: '?' }} 
              hidden 
              dealAnimation={showDealAnimation}
              dealDelay={playerIndex * 300 + i * 150}
              dealDirection={dealDirection}
            />
          ))
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

// Community cards display with phase-aware revealing and animation
const CommunityCardsDisplay = ({ cards, gamePhase, prevPhase }: { cards: CardData[]; gamePhase: string; prevPhase?: string }) => {
  // Determine how many cards to show based on phase
  const visibleCount = gamePhase === 'preflop' ? 0 : 
                       gamePhase === 'flop' ? 3 : 
                       gamePhase === 'turn' ? 4 : 
                       gamePhase === 'river' || gamePhase === 'showdown' ? 5 : cards.length;
  
  const hiddenCount = 5 - visibleCount;
  
  // Determine which cards are newly revealed
  const prevVisibleCount = prevPhase === 'preflop' ? 0 : 
                           prevPhase === 'flop' ? 3 : 
                           prevPhase === 'turn' ? 4 : 
                           prevPhase === 'river' || prevPhase === 'showdown' ? 5 : 0;
  
  return (
    <div className="text-center bg-black/20 rounded-lg p-2 relative overflow-hidden">
      <p className="text-xs text-muted-foreground mb-1">🃏 Общие карты</p>
      <div className="flex justify-center gap-1 flex-wrap">
        {cards.slice(0, visibleCount).map((card, i) => {
          const isNewCard = i >= prevVisibleCount;
          return (
            <PlayingCard 
              key={i} 
              card={card}
              dealAnimation={isNewCard}
              dealDelay={isNewCard ? (i - prevVisibleCount) * 200 : 0}
              dealDirection="top"
            />
          );
        })}
        {Array(hiddenCount).fill(0).map((_, i) => (
          <PlayingCard key={`hidden-${i}`} card={{ suit: 'spades', rank: '?' }} hidden />
        ))}
      </div>
    </div>
  );
};

export const PokerDuelGame = ({ visitorId, balance, onBalanceUpdate }: PokerDuelGameProps) => {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState('100');
  const [raiseAmount, setRaiseAmount] = useState('50');
  const [maxPlayers, setMaxPlayers] = useState('2');
  const FIXED_CARDS_PER_PLAYER = 3;
  const [maxBalance, setMaxBalance] = useState(500);
  const [availableDuels, setAvailableDuels] = useState<Duel[]>([]);
  const [myInvitations, setMyInvitations] = useState<Duel[]>([]);
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  const [finishedDuel, setFinishedDuel] = useState<Duel | null>(null);
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
  const [prevGamePhase, setPrevGamePhase] = useState<string>('');
  const [showDealAnimation, setShowDealAnimation] = useState(false);
  const lastDuelStatusRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevDuelIdRef = useRef<string | null>(null);

  const fetchUserId = useCallback(async () => {
    const cleanedVisitorId = String(visitorId).trim().replace(/^"+|"+$/g, '');

    // Check if visitorId is a UUID (profile id) or telegram_id (number string)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanedVisitorId);

    if (isUUID) {
      // visitorId is already a profile UUID
      setUserId(cleanedVisitorId);
      setLoading(false);
      return;
    }

    // visitorId is telegram_id, need to fetch profile UUID
    const telegramId = parseInt(cleanedVisitorId, 10);
    if (isNaN(telegramId)) {
      console.error('Invalid visitorId:', visitorId);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (data?.id) {
      setUserId(String(data.id).trim().replace(/^"+|"+$/g, ''));
    }

    setLoading(false);
  }, [visitorId]);

  const fetchMyCards = useCallback(async (duelId: string) => {
    if (!userId) return;
    const { data: duel } = await supabase
      .from('poker_duels')
      .select('creator_id, opponent_id, player3_id, player4_id, creator_cards, opponent_cards, player3_cards, player4_cards, community_cards, game_phase')
      .eq('id', duelId)
      .single();
    
    if (duel) {
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

    const safeUserId = String(userId).trim().replace(/^"+|"+$/g, '');
    
    const { data: available } = await supabase
      .from('poker_duels')
      .select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`)
      .eq('status', 'waiting')
      .neq('creator_id', safeUserId)
      .is('invited_user_id', null)
      .order('created_at', { ascending: false })
      .limit(20);
    
    const { data: invitations } = await supabase
      .from('poker_duels')
      .select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`)
      .eq('invited_user_id', safeUserId)
      .eq('status', 'invited')
      .order('created_at', { ascending: false });
    
    // Build proper OR filter conditions
    const orFilter = [
      `creator_id.eq.${safeUserId}`,
      `opponent_id.eq.${safeUserId}`,
      `player3_id.eq.${safeUserId}`,
      `player4_id.eq.${safeUserId}`
    ].join(',');
    
    const { data: active } = await supabase
      .from('poker_duels')
      .select(`*, 
        creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url), 
        opponent:profiles!poker_duels_opponent_id_fkey(username, public_id, avatar_url)`)
      .in('status', ['playing', 'betting', 'waiting'])
      .or(orFilter)
      .maybeSingle();
    
    const { data: myWaiting } = await supabase
      .from('poker_duels')
      .select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`)
      .in('status', ['waiting', 'invited'])
      .or(orFilter)
      .order('created_at', { ascending: false });
    
    const { data: recent } = await supabase
      .from('poker_duels')
      .select(`*, 
        creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url), 
        opponent:profiles!poker_duels_opponent_id_fkey(username, public_id, avatar_url),
        creator_cards, opponent_cards, player3_cards, player4_cards, community_cards`)
      .eq('status', 'finished')
      .or(orFilter)
      .order('finished_at', { ascending: false })
      .limit(10);
    
    setAvailableDuels([...(myWaiting?.filter(d => d.creator_id !== userId) || []), ...(available || [])] as Duel[]);
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
        // Save as finished duel for display
        setFinishedDuel(active as Duel);
      }
      lastDuelStatusRef.current = active.game_phase;
      
      if (active.status !== 'finished') {
        setActiveDuel(active as Duel); 
        fetchMyCards(active.id);
      }
      
      if (active.last_action_at) {
        const elapsed = Math.floor((Date.now() - new Date(active.last_action_at).getTime()) / 1000);
        setTimeLeft(Math.max(0, TURN_TIME_SECONDS - elapsed));
      } else {
        setTimeLeft(TURN_TIME_SECONDS);
      }
    } else { 
      lastDuelStatusRef.current = null;
      if (!finishedDuel) {
        setActiveDuel(null); 
        setMyCards([]); 
        setCommunityCards([]); 
        setAllPlayerCards({});
      }
    }
  }, [userId, fetchMyCards, finishedDuel]);

  const exitGame = () => {
    setFinishedDuel(null);
    setActiveDuel(null);
    setMyCards([]);
    setCommunityCards([]);
    setAllPlayerCards({});
    lastDuelStatusRef.current = null;
    fetchDuels();
  };

  const searchUsers = async () => {
    if (!searchQuery.trim() || !userId) return;
    setSearchLoading(true);
    const { data } = await supabase.rpc('search_users_for_duel', { search_query: searchQuery.trim(), current_user_id: userId });
    if (data) setSearchResults(data as SearchUser[]);
    setSearchLoading(false);
  };

  const createDuel = async (invitedUserId?: string) => {
    if (!userId) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 10) { toast.error('Минимальная ставка 10₽'); return; }
    if (amount > balance) { toast.error('Недостаточно средств'); return; }
    if (amount > maxBalance) { toast.error('Ставка превышает максимальный баланс'); return; }
    
    setCreatingDuel(true);
    
    const numPlayers = parseInt(maxPlayers);
    const numCards = FIXED_CARDS_PER_PLAYER;
    
    const { data, error } = await supabase.rpc('create_multiplayer_poker_duel', { 
      p_user_id: userId, 
      p_bet_amount: Math.floor(amount), 
      p_max_players: numPlayers,
      p_cards_per_player: numCards,
      p_max_balance: maxBalance
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Лобби создано! Макс. баланс: ${maxBalance}₽`);
      if (invitedUserId && selectedUser) {
        const { data: invitedProfile } = await supabase.from('profiles').select('telegram_id').eq('id', invitedUserId).single();
        if (invitedProfile?.telegram_id) {
          const pokerLink = APP_CONFIG.getPokerDuelLink();
          await sendTelegramNotification({ 
            telegramId: invitedProfile.telegram_id, 
            message: `🃏 Приглашение на покер!\n\nСтавка: ${amount}₽\nМакс. баланс: ${maxBalance}₽\n\n👉 Принять: ${pokerLink}`, 
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
    // (chip animations removed)
    
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
          if (isMyTurn && !actionLoading) {
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
  
  // Track phase changes for card animation
  useEffect(() => {
    if (activeDuel?.game_phase && activeDuel.game_phase !== prevGamePhase) {
      setPrevGamePhase(activeDuel.game_phase);
    }
  }, [activeDuel?.game_phase, prevGamePhase]);
  
  // Trigger deal animation when game starts
  useEffect(() => {
    if (activeDuel?.id && activeDuel.id !== prevDuelIdRef.current && activeDuel.status === 'playing') {
      prevDuelIdRef.current = activeDuel.id;
      setShowDealAnimation(true);
      // Reset animation after it completes
      const timer = setTimeout(() => setShowDealAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeDuel?.id, activeDuel?.status]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const getMyRole = () => {
    const duel = activeDuel || finishedDuel;
    if (!duel || !userId) return null;
    if (userId === duel.creator_id) return 'creator';
    if (userId === duel.opponent_id) return 'opponent';
    if (userId === duel.player3_id) return 'player3';
    if (userId === duel.player4_id) return 'player4';
    return null;
  };

  const currentDuel = activeDuel || finishedDuel;
  const myRole = getMyRole();
  const isMyTurn = currentDuel?.current_turn === userId;
  
  const maxBet = currentDuel ? Math.max(
    currentDuel.creator_current_bet || 0,
    currentDuel.opponent_current_bet || 0,
    currentDuel.player3_current_bet || 0,
    currentDuel.player4_current_bet || 0
  ) : 0;
  
  const myCurrentBet = currentDuel ? (
    myRole === 'creator' ? currentDuel.creator_current_bet :
    myRole === 'opponent' ? currentDuel.opponent_current_bet :
    myRole === 'player3' ? currentDuel.player3_current_bet :
    myRole === 'player4' ? currentDuel.player4_current_bet : 0
  ) : 0;
  
  const callAmount = Math.max(0, maxBet - (myCurrentBet || 0));
  const canCheck = callAmount === 0;
  
  const iWon = currentDuel?.winner_id === userId || (currentDuel?.winners && currentDuel.winners.includes(userId || ''));

  // Check if viewing finished game
  const isFinishedGame = finishedDuel && (!activeDuel || activeDuel.game_phase === 'showdown');

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

        {/* Active/Finished Game */}
        {currentDuel && (currentDuel.status === 'playing' || isFinishedGame) && (
          <Card className="p-4 bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-600">
            <div className="space-y-3">
              {/* Game Header with Pot Display */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold text-green-400">
                  {isFinishedGame ? '🏁 Игра завершена' : '🎴 Активная игра'}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  Макс: {currentDuel.max_balance || currentDuel.initial_bet}₽
                </Badge>
              </div>

              {/* Pot */}
              <div className="flex justify-center py-2">
                <Badge variant="secondary" className="text-sm">
                  Банк: {(currentDuel.pot || 0).toFixed(0)}₽
                </Badge>
              </div>

              {/* Timer - only show if game is active */}
              {!isFinishedGame && currentDuel.game_phase !== 'showdown' && (
                <TurnTimer timeLeft={timeLeft} isMyTurn={isMyTurn} />
              )}

              {/* Phase Indicator */}
              <div className="text-center">
                <Badge variant="outline" className="text-xs">
                  {currentDuel.game_phase === 'preflop' && '📍 Префлоп'}
                  {currentDuel.game_phase === 'flop' && '📍 Флоп (3 карты)'}
                  {currentDuel.game_phase === 'turn' && '📍 Тёрн (4 карты)'}
                  {currentDuel.game_phase === 'river' && '📍 Ривер (5 карт)'}
                  {currentDuel.game_phase === 'showdown' && '🎉 Вскрытие!'}
                </Badge>
              </div>

              {/* Community Cards */}
              <CommunityCardsDisplay cards={communityCards} gamePhase={currentDuel.game_phase} prevPhase={prevGamePhase} />

              {/* All Players Grid */}
              <div className="grid gap-2 grid-cols-2">
                <PlayerCardSlot
                  player={currentDuel.creator}
                  cards={allPlayerCards[currentDuel.creator_id] || (myRole === 'creator' ? myCards : null)}
                  currentBet={currentDuel.creator_current_bet || 0}
                  handRank={currentDuel.creator_hand_rank}
                  isWinner={currentDuel.winners?.includes(currentDuel.creator_id) || currentDuel.winner_id === currentDuel.creator_id}
                  isFolded={currentDuel.creator_folded}
                  isCurrentTurn={currentDuel.current_turn === currentDuel.creator_id}
                  isMe={myRole === 'creator'}
                  showCards={currentDuel.game_phase === 'showdown'}
                  gamePhase={currentDuel.game_phase}
                  cardsPerPlayer={currentDuel.cards_per_player || 2}
                  playerIndex={0}
                  showDealAnimation={showDealAnimation}
                />
                
                {currentDuel.opponent_id && (
                  <PlayerCardSlot
                    player={currentDuel.opponent}
                    cards={allPlayerCards[currentDuel.opponent_id] || (myRole === 'opponent' ? myCards : null)}
                    currentBet={currentDuel.opponent_current_bet || 0}
                    handRank={currentDuel.opponent_hand_rank}
                    isWinner={currentDuel.winners?.includes(currentDuel.opponent_id) || currentDuel.winner_id === currentDuel.opponent_id}
                    isFolded={currentDuel.opponent_folded}
                    isCurrentTurn={currentDuel.current_turn === currentDuel.opponent_id}
                    isMe={myRole === 'opponent'}
                    showCards={currentDuel.game_phase === 'showdown'}
                    gamePhase={currentDuel.game_phase}
                    cardsPerPlayer={currentDuel.cards_per_player || 2}
                    playerIndex={1}
                    showDealAnimation={showDealAnimation}
                  />
                )}
                
                {currentDuel.player3_id && (
                  <PlayerCardSlot
                    player={currentDuel.player3}
                    cards={allPlayerCards[currentDuel.player3_id] || (myRole === 'player3' ? myCards : null)}
                    currentBet={currentDuel.player3_current_bet || 0}
                    handRank={currentDuel.player3_hand_rank}
                    isWinner={currentDuel.winners?.includes(currentDuel.player3_id) || currentDuel.winner_id === currentDuel.player3_id}
                    isFolded={currentDuel.player3_folded}
                    isCurrentTurn={currentDuel.current_turn === currentDuel.player3_id}
                    isMe={myRole === 'player3'}
                    showCards={currentDuel.game_phase === 'showdown'}
                    gamePhase={currentDuel.game_phase}
                    cardsPerPlayer={currentDuel.cards_per_player || 2}
                    playerIndex={2}
                    showDealAnimation={showDealAnimation}
                  />
                )}
                
                {currentDuel.player4_id && (
                  <PlayerCardSlot
                    player={currentDuel.player4}
                    cards={allPlayerCards[currentDuel.player4_id] || (myRole === 'player4' ? myCards : null)}
                    currentBet={currentDuel.player4_current_bet || 0}
                    handRank={currentDuel.player4_hand_rank}
                    isWinner={currentDuel.winners?.includes(currentDuel.player4_id) || currentDuel.winner_id === currentDuel.player4_id}
                    isFolded={currentDuel.player4_folded}
                    isCurrentTurn={currentDuel.current_turn === currentDuel.player4_id}
                    isMe={myRole === 'player4'}
                    showCards={currentDuel.game_phase === 'showdown'}
                    gamePhase={currentDuel.game_phase}
                    cardsPerPlayer={currentDuel.cards_per_player || 2}
                    playerIndex={3}
                    showDealAnimation={showDealAnimation}
                  />
                )}
              </div>

              {/* Action Buttons - only if game is active */}
              {!isFinishedGame && isMyTurn && currentDuel.game_phase !== 'showdown' && (
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
                      max={currentDuel.max_balance - (myCurrentBet || 0)}
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
                    🔥 Ва-банк (до {Math.min(balance, currentDuel.max_balance - (myCurrentBet || 0))}₽)
                  </Button>
                </div>
              )}

              {/* Showdown Result with Exit Button */}
              {(currentDuel.game_phase === 'showdown' || isFinishedGame) && (
                <div className="space-y-3">
                  <div className={`text-center p-3 rounded-lg ${currentDuel.is_draw ? 'bg-blue-900/30' : iWon ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                    <p className="text-xl font-bold">
                      {currentDuel.is_draw || (currentDuel.winners && currentDuel.winners.length > 1) ? '🤝 Банк поделён!' : iWon ? '🏆 Победа!' : '❌ Поражение'}
                    </p>
                    {iWon && (
                      <p className="text-yellow-400 mt-1">
                        Выигрыш: {((currentDuel.pot * 0.95) / (currentDuel.winners?.length || 1)).toFixed(0)}₽
                      </p>
                    )}
                  </div>
                  
                  <Button 
                    onClick={exitGame} 
                    variant="outline" 
                    className="w-full"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Выйти в меню
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Waiting Lobby */}
        {activeDuel && activeDuel.status === 'waiting' && (
          <Card className="p-4 bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-600">
            <div className="space-y-3 text-center">
              <h3 className="text-base font-bold text-blue-400">⏳ Ожидание игроков</h3>
              <div className="flex items-center justify-center gap-2">
                <Users2 className="w-5 h-5" />
                <span className="text-lg font-bold">{activeDuel.current_players} / {activeDuel.max_players}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline">{activeDuel.cards_per_player} карты</Badge>
                <Badge variant="outline">{activeDuel.initial_bet}₽ ставка</Badge>
                <Badge variant="secondary">Макс: {activeDuel.max_balance}₽</Badge>
              </div>
              <Progress value={(activeDuel.current_players / activeDuel.max_players) * 100} className="h-2" />
              {activeDuel.creator_id === userId && (
                <Button variant="destructive" size="sm" onClick={() => cancelDuel(activeDuel.id)}>
                  Отменить
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Invitations */}
        {myInvitations.length > 0 && !currentDuel && (
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
                      {duel.initial_bet}₽ • Макс: {duel.max_balance}₽
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
        {!currentDuel && (
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
                  <div className="mt-2 text-sm font-medium">
                    {FIXED_CARDS_PER_PLAYER} карты
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Максимальный баланс игры: {maxBalance}₽</label>
                <Slider 
                  value={[maxBalance]} 
                  onValueChange={(v) => {
                    const newMax = v[0];
                    setMaxBalance(newMax);
                    // Adjust betAmount if it exceeds new maxBalance
                    const currentBet = parseFloat(betAmount) || 0;
                    if (currentBet > newMax) {
                      setBetAmount(String(newMax));
                    }
                  }}
                  min={100}
                  max={Math.max(100, Math.min(10000, Math.floor(balance)))}
                  step={50}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">Нельзя ставить больше этой суммы за всю игру</p>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground">Начальная ставка (мин. 10₽, макс. {maxBalance}₽)</label>
                <Input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => {
                    const val = e.target.value;
                    const numVal = parseFloat(val) || 0;
                    // Clamp to maxBalance
                    if (numVal > maxBalance) {
                      setBetAmount(String(maxBalance));
                    } else {
                      setBetAmount(val);
                    }
                  }} 
                  placeholder="100" 
                  min="10"
                  max={maxBalance}
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => createDuel()} disabled={creatingDuel || parseFloat(betAmount) > maxBalance} className="flex-1">
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
        {!currentDuel && (
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
                        <Badge variant="secondary" className="text-xs">Макс: {duel.max_balance}₽</Badge>
                        <Badge variant="secondary" className="text-xs">{duel.current_players}/{duel.max_players} 👥</Badge>
                      </div>
                    </div>
                    {duel.creator_id === userId ? (
                      <Button size="sm" variant="destructive" onClick={() => cancelDuel(duel.id)}>Отмена</Button>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => joinDuel(duel.id)} 
                        disabled={joiningDuelId === duel.id || balance < duel.initial_bet}
                      >
                        {joiningDuelId === duel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Войти'}
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Recent Games */}
        {recentGames.length > 0 && !currentDuel && (
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
