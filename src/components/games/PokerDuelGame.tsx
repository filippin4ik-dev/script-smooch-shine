import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Users, Trophy, Search, UserPlus, X, Check, RefreshCw } from 'lucide-react';
import { sendTelegramNotification } from '@/lib/telegramNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  is_draw: boolean;
  created_at: string;
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
  hearts: '♥️',
  diamonds: '♦️',
  clubs: '♣️',
  spades: '♠️'
};

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-foreground',
  spades: 'text-foreground'
};

const PlayingCard = ({ card, hidden = false }: { card: CardData; hidden?: boolean }) => {
  if (hidden) {
    return (
      <div className="w-14 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-400 flex items-center justify-center shadow-lg">
        <span className="text-2xl">🂠</span>
      </div>
    );
  }

  return (
    <div className="w-14 h-20 bg-white rounded-lg border-2 border-gray-300 flex flex-col items-center justify-center shadow-lg">
      <span className={`text-lg font-bold ${SUIT_COLORS[card.suit]}`}>{card.rank}</span>
      <span className="text-xl">{SUITS_EMOJI[card.suit]}</span>
    </div>
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

  const fetchUserId = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id').eq('telegram_id', parseInt(visitorId)).single();
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
    const { data: active } = await supabase.from('poker_duels').select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url), opponent:profiles!poker_duels_opponent_id_fkey(username, public_id, avatar_url)`).eq('status', 'betting').or(`creator_id.eq.${userId},opponent_id.eq.${userId}`).single();
    const { data: myWaiting } = await supabase.from('poker_duels').select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url)`).eq('creator_id', userId).in('status', ['waiting', 'invited']).order('created_at', { ascending: false });
    const { data: recent } = await supabase.from('poker_duels').select(`*, creator:profiles!poker_duels_creator_id_fkey(username, public_id, avatar_url), opponent:profiles!poker_duels_opponent_id_fkey(username, public_id, avatar_url)`).eq('status', 'finished').or(`creator_id.eq.${userId},opponent_id.eq.${userId}`).order('finished_at', { ascending: false }).limit(10);
    setAvailableDuels([...(myWaiting || []), ...(available || [])] as Duel[]);
    setMyInvitations((invitations || []) as Duel[]);
    setRecentGames((recent || []) as Duel[]);
    if (active) { setActiveDuel(active as Duel); fetchMyCards(active.id); } else { setActiveDuel(null); setMyCards([]); setCommunityCards([]); setOpponentCards(null); }
  }, [userId, fetchMyCards]);

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
    if (isNaN(amount) || amount < 10) { toast.error('Минимальная ставка 10$'); return; }
    if (amount > balance) { toast.error('Недостаточно средств'); return; }
    setCreatingDuel(true);
    const { data, error } = await supabase.rpc('create_poker_duel_v2', { p_creator_id: userId, p_initial_bet: amount, p_invited_user_id: invitedUserId || null });
    if (error) toast.error(error.message);
    else {
      toast.success(invitedUserId ? 'Приглашение отправлено!' : 'Дуэль создана!');
      if (invitedUserId && selectedUser) {
        const { data: invitedProfile } = await supabase.from('profiles').select('telegram_id').eq('id', invitedUserId).single();
        if (invitedProfile?.telegram_id) {
          await sendTelegramNotification({ telegramId: invitedProfile.telegram_id, message: `🃏 Вас приглашают на покерную дуэль!\n\nСтавка: $${amount}`, notificationType: 'custom' });
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
        else if (data.winner_id === userId) toast.success(`Вы выиграли $${data.win_amount?.toFixed(2)}!`);
        else toast.error('Вы проиграли');
      }
      onBalanceUpdate(); fetchDuels();
    }
    setActionLoading(false);
  };

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

  return (
    <div className="space-y-6">
      {activeDuel && (
        <Card className="p-4 bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-600">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-green-400">🎴 Активная игра</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-yellow-400 border-yellow-400">Банк: ${activeDuel.pot?.toFixed(2)}</Badge>
                <Badge variant={isMyTurn ? 'default' : 'secondary'}>{isMyTurn ? 'Ваш ход' : 'Ход противника'}</Badge>
              </div>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {activeDuel.game_phase === 'betting_round_1' && 'Первый раунд ставок'}
              {activeDuel.game_phase === 'betting_round_2' && 'Второй раунд (Флоп)'}
              {activeDuel.game_phase === 'showdown' && 'Вскрытие карт'}
            </div>
            {communityCards.length > 0 && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Общие карты</p>
                <div className="flex justify-center gap-2">
                  {communityCards.map((card, i) => <PlayingCard key={i} card={card} />)}
                  {activeDuel.game_phase === 'betting_round_2' && Array(2).fill(0).map((_, i) => <PlayingCard key={`h-${i}`} card={{ suit: 'spades', rank: '?' }} hidden />)}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{isCreator ? activeDuel.opponent?.username : activeDuel.creator?.username}</p>
                <div className="flex justify-center gap-2">
                  {opponentCards ? opponentCards.map((card, i) => <PlayingCard key={i} card={card} />) : <><PlayingCard card={{ suit: 'spades', rank: '?' }} hidden /><PlayingCard card={{ suit: 'spades', rank: '?' }} hidden /></>}
                </div>
                {activeDuel.game_phase === 'showdown' && <p className="text-sm mt-2 text-yellow-400">{isCreator ? activeDuel.opponent_hand_rank : activeDuel.creator_hand_rank}</p>}
                <p className="text-xs mt-1 text-muted-foreground">Ставка: ${opponentCurrentBet?.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Ваши карты</p>
                <div className="flex justify-center gap-2">{myCards.map((card, i) => <PlayingCard key={i} card={card} />)}</div>
                {activeDuel.game_phase === 'showdown' && <p className="text-sm mt-2 text-yellow-400">{isCreator ? activeDuel.creator_hand_rank : activeDuel.opponent_hand_rank}</p>}
                <p className="text-xs mt-1 text-muted-foreground">Ставка: ${myCurrentBet?.toFixed(2)}</p>
              </div>
            </div>
            {isMyTurn && activeDuel.game_phase !== 'showdown' && (
              <div className="space-y-3 pt-4 border-t border-border/50">
                <div className="flex gap-2">
                  <Button onClick={() => performAction('fold')} variant="destructive" disabled={actionLoading} className="flex-1">Сброс</Button>
                  {canCheck ? <Button onClick={() => performAction('check')} variant="outline" disabled={actionLoading} className="flex-1">Чек</Button> : <Button onClick={() => performAction('call')} variant="secondary" disabled={actionLoading} className="flex-1">Колл ${callAmount.toFixed(2)}</Button>}
                </div>
                <div className="flex gap-2">
                  <Input type="number" value={raiseAmount} onChange={(e) => setRaiseAmount(e.target.value)} placeholder="Рейз" className="flex-1" />
                  <Button onClick={() => performAction('raise', parseFloat(raiseAmount) || 0)} disabled={actionLoading || !raiseAmount} className="flex-1">Рейз</Button>
                </div>
                <Button onClick={() => performAction('all_in')} variant="outline" disabled={actionLoading} className="w-full border-yellow-500 text-yellow-500 hover:bg-yellow-500/10">Ва-банк</Button>
              </div>
            )}
          </div>
        </Card>
      )}
      {myInvitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" />Приглашения ({myInvitations.length})</h3>
          {myInvitations.map((duel) => (
            <Card key={duel.id} className="p-4 bg-primary/10 border-primary/30">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">{duel.creator?.username}</p><p className="text-sm text-muted-foreground">Ставка: ${duel.initial_bet}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => declineDuel(duel.id)}><X className="w-4 h-4" /></Button>
                  <Button size="sm" onClick={() => joinDuel(duel.id)} disabled={joiningDuelId === duel.id || balance < duel.initial_bet}>{joiningDuelId === duel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {!activeDuel && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">Создать дуэль</h3>
          <div className="space-y-4">
            <div><label className="text-sm text-muted-foreground">Начальная ставка</label><Input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} placeholder="Сумма" min="10" /></div>
            <div className="flex gap-2">
              <Button onClick={() => createDuel()} disabled={creatingDuel} className="flex-1">{creatingDuel ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Открытая дуэль'}</Button>
              <Button onClick={() => setShowInviteDialog(true)} variant="outline" className="flex-1"><Search className="w-4 h-4 mr-2" />Пригласить</Button>
            </div>
          </div>
        </Card>
      )}
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-lg font-semibold flex items-center gap-2"><Users className="w-5 h-5" />Доступные дуэли</h3><Button size="sm" variant="ghost" onClick={fetchDuels}><RefreshCw className="w-4 h-4" /></Button></div>
        {availableDuels.length === 0 ? <p className="text-muted-foreground text-center py-4">Нет доступных дуэлей</p> : availableDuels.map((duel) => (
          <Card key={duel.id} className="p-4">
            <div className="flex items-center justify-between">
              <div><p className="font-medium">{duel.creator?.username}</p><div className="flex items-center gap-2 text-sm text-muted-foreground"><span>ID: {duel.creator?.public_id}</span><Badge variant="outline">${duel.initial_bet}</Badge>{duel.status === 'invited' && <Badge variant="secondary">Приглашение</Badge>}</div></div>
              {duel.creator_id === userId ? <Button size="sm" variant="destructive" onClick={() => cancelDuel(duel.id)}>Отмена</Button> : <Button size="sm" onClick={() => joinDuel(duel.id)} disabled={joiningDuelId === duel.id || balance < duel.initial_bet || !!activeDuel}>{joiningDuelId === duel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Принять'}</Button>}
            </div>
          </Card>
        ))}
      </div>
      {recentGames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />Последние игры</h3>
          {recentGames.map((duel) => (<Card key={duel.id} className="p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-lg">{duel.is_draw ? '🤝' : duel.winner_id === userId ? '🏆' : '❌'}</span><div><p className="text-sm">vs {duel.creator_id === userId ? duel.opponent?.username : duel.creator?.username}</p><p className="text-xs text-muted-foreground">Банк: ${duel.pot?.toFixed(2)}</p></div></div><Badge variant={duel.is_draw ? 'secondary' : duel.winner_id === userId ? 'default' : 'destructive'}>{duel.is_draw ? 'Ничья' : duel.winner_id === userId ? 'Победа' : 'Поражение'}</Badge></div></Card>))}
        </div>
      )}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Пригласить игрока</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2"><Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ник или ID" onKeyDown={(e) => e.key === 'Enter' && searchUsers()} /><Button onClick={searchUsers} disabled={searchLoading}>{searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}</Button></div>
            {selectedUser && (<Card className="p-3 bg-primary/10 border-primary"><div className="flex items-center justify-between"><div><p className="font-medium">{selectedUser.username}</p><p className="text-sm text-muted-foreground">ID: {selectedUser.public_id} • Lv.{selectedUser.level}</p></div><Button onClick={() => createDuel(selectedUser.id)} disabled={creatingDuel}>{creatingDuel ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Пригласить'}</Button></div></Card>)}
            {searchResults.length > 0 && !selectedUser && (<div className="space-y-2 max-h-60 overflow-y-auto">{searchResults.map((user) => (<Card key={user.id} className="p-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedUser(user)}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">{user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full rounded-full" /> : <span className="text-sm">{user.username?.[0]?.toUpperCase()}</span>}</div><div><p className="font-medium">{user.username}</p><p className="text-xs text-muted-foreground">ID: {user.public_id} • Lv.{user.level}</p></div></div></Card>))}</div>)}
            {searchResults.length === 0 && searchQuery && !searchLoading && <p className="text-center text-muted-foreground">Игроки не найдены</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
