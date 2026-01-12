import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Clock, Users, Medal, Target, Flame, Crown, Award, Star, ChevronDown, TrendingUp } from "lucide-react";
import { VipUsername } from "@/components/VipUsername";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface BettingTournamentsSectionProps {
  userId?: string;
}

export const BettingTournamentsSection = ({ userId }: BettingTournamentsSectionProps) => {
  const queryClient = useQueryClient();
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);

  // Fetch tournaments
  const { data: tournaments } = useQuery({
    queryKey: ["betting-tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("betting_tournaments")
        .select("*, winner:profiles!betting_tournaments_winner_id_fkey(username, is_vip, level, gradient_color)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch leaderboard for selected tournament
  const { data: leaderboard } = useQuery({
    queryKey: ["betting-tournament-leaderboard", selectedTournament],
    queryFn: async () => {
      if (!selectedTournament) return [];
      const { data, error } = await supabase.rpc("get_betting_tournament_leaderboard", {
        _tournament_id: selectedTournament,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedTournament,
    refetchInterval: 5000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("betting-tournaments-section-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_tournaments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["betting-tournaments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "betting_tournament_results" }, () => {
        queryClient.invalidateQueries({ queryKey: ["betting-tournament-leaderboard", selectedTournament] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, selectedTournament]);

  const activeTournaments = tournaments?.filter((t) => t.status === "active") || [];
  const finishedTournaments = tournaments?.filter((t) => t.status === "finished") || [];

  const getPrizeLabel = (type: string, amount: number) => {
    switch (type) {
      case "balance": return `${amount}₽`;
      case "freebet": return `${amount}₽ фрибет`;
      case "betting_freebet": return `${amount}₽ фрибет ставки`;
      case "wheel": return `${amount} колёс`;
      default: return `${amount}`;
    }
  };

  const getTimeRemaining = (endAt: string | null) => {
    if (!endAt) return "Без ограничения";
    const end = new Date(endAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return "Завершается...";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}д ${hours % 24}ч`;
    }
    return `${hours}ч ${minutes}м`;
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return (
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 shadow-lg shadow-yellow-500/40">
        <Crown className="w-5 h-5 text-white drop-shadow-md" />
      </div>
    );
    if (rank === 2) return (
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 shadow-lg shadow-slate-400/30">
        <Medal className="w-5 h-5 text-white drop-shadow-md" />
      </div>
    );
    if (rank === 3) return (
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 shadow-lg shadow-amber-600/30">
        <Award className="w-5 h-5 text-white drop-shadow-md" />
      </div>
    );
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/80 border border-border/50">
        <span className="font-bold text-muted-foreground">#{rank}</span>
      </div>
    );
  };

  const myRank = leaderboard?.find((l: any) => l.user_id === userId);
  const myRankIndex = leaderboard?.findIndex((l: any) => l.user_id === userId);

  if (activeTournaments.length === 0 && finishedTournaments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 blur-lg opacity-50" />
          <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <Trophy className="w-5 h-5 text-white" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
            Турниры ставок
          </h2>
          <p className="text-xs text-muted-foreground">Соревнуйся и выигрывай призы</p>
        </div>
      </div>

      {/* Active tournaments */}
      {activeTournaments.length > 0 && (
        <div className="space-y-3">
          {activeTournaments.map((tournament) => (
            <div
              key={tournament.id}
              onClick={() => setSelectedTournament(selectedTournament === tournament.id ? null : tournament.id)}
              className={cn(
                "relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300",
                "border-2",
                selectedTournament === tournament.id
                  ? "border-amber-500/70 shadow-[0_0_30px_rgba(245,158,11,0.2)]"
                  : "border-border/50 hover:border-amber-500/40"
              )}
            >
              {/* Background gradient */}
              <div className={cn(
                "absolute inset-0 transition-opacity duration-300",
                selectedTournament === tournament.id
                  ? "bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent opacity-100"
                  : "bg-gradient-to-br from-card to-card/80 opacity-100"
              )} />
              
              {/* Content */}
              <div className="relative p-4 space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                      <h3 className="font-bold text-foreground truncate">{tournament.title}</h3>
                    </div>
                    {tournament.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{tournament.description}</p>
                    )}
                  </div>
                  
                  {/* Live badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/30 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-semibold text-green-500">LIVE</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Prize */}
                  <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-full blur-xl" />
                    <div className="relative">
                      <div className="flex items-center gap-1 text-xs text-amber-500/80 mb-1">
                        <Star className="w-3 h-3" />
                        <span>Приз</span>
                      </div>
                      <div className="font-bold text-lg text-amber-400">
                        {getPrizeLabel(tournament.prize_type, tournament.prize_amount)}
                      </div>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="relative overflow-hidden rounded-xl p-3 bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Clock className="w-3 h-3" />
                      <span>До конца</span>
                    </div>
                    <div className="font-bold text-lg text-foreground">
                      {getTimeRemaining(tournament.end_at)}
                    </div>
                  </div>
                </div>

                {/* Min bet */}
                {tournament.min_bet_amount > 0 && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="w-3 h-3" />
                    <span>Мин. ставка: {tournament.min_bet_amount}₽</span>
                  </div>
                )}

                {/* Expand indicator */}
                <div className="flex justify-center">
                  <ChevronDown className={cn(
                    "w-5 h-5 text-muted-foreground transition-transform duration-300",
                    selectedTournament === tournament.id && "rotate-180"
                  )} />
                </div>
              </div>

              {/* Leaderboard */}
              {selectedTournament === tournament.id && (
                <div className="relative border-t border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-transparent">
                  <div className="p-4 space-y-4">
                    {/* Leaderboard header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-foreground">Лидерборд</span>
                      </div>
                      {myRank && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30">
                          <span className="text-xs text-primary font-semibold">Ваше место: #{myRank.rank}</span>
                        </div>
                      )}
                    </div>

                    {/* Leaderboard list */}
                    {leaderboard && leaderboard.length > 0 ? (
                      <div className="space-y-2">
                        {leaderboard.slice(0, 10).map((player: any, index: number) => {
                          const isCurrentUser = player.user_id === userId;
                          const rank = Number(player.rank);
                          
                          return (
                            <div
                              key={player.user_id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
                                isCurrentUser 
                                  ? "bg-primary/10 border-2 border-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.15)]" 
                                  : rank <= 3
                                    ? "bg-gradient-to-r from-amber-500/8 to-transparent border border-amber-500/20"
                                    : "bg-card/50 border border-border/30 hover:bg-card/80"
                              )}
                            >
                              {/* Rank */}
                              {getRankDisplay(rank)}

                              {/* User info */}
                              <div className="flex-1 min-w-0">
                                <VipUsername
                                  username={player.username}
                                  isVip={player.is_vip}
                                  level={player.level}
                                  gradientColor={player.gradient_color}
                                />
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">
                                    {player.total_bets} ставок
                                  </span>
                                </div>
                              </div>

                              {/* Wins */}
                              <div className="text-right">
                                <div className={cn(
                                  "font-bold text-lg",
                                  rank === 1 ? "text-amber-400" : 
                                  rank === 2 ? "text-slate-300" :
                                  rank === 3 ? "text-amber-600" : "text-green-500"
                                )}>
                                  {Number(player.total_wins).toFixed(0)}₽
                                </div>
                                <div className="text-xs text-muted-foreground">выигрыш</div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Show current user if not in top 10 */}
                        {userId && myRankIndex !== undefined && myRankIndex >= 10 && myRank && (
                          <>
                            <div className="flex items-center gap-2 px-4 text-muted-foreground">
                              <div className="flex-1 border-t border-dashed border-border/50" />
                              <span className="text-xs">...</span>
                              <div className="flex-1 border-t border-dashed border-border/50" />
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border-2 border-primary/40">
                              {getRankDisplay(Number(myRank.rank))}
                              <div className="flex-1 min-w-0">
                                <VipUsername
                                  username={myRank.username}
                                  isVip={myRank.is_vip}
                                  level={myRank.level}
                                  gradientColor={myRank.gradient_color}
                                />
                                <span className="text-xs text-muted-foreground">{myRank.total_bets} ставок</span>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-lg text-green-500">
                                  {Number(myRank.total_wins).toFixed(0)}₽
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-3">
                          <Users className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="font-medium text-muted-foreground">Пока нет участников</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Сделай ставку первым!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Finished tournaments */}
      {finishedTournaments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-medium">Завершённые турниры</span>
          </div>
          
          <div className="grid gap-2 sm:grid-cols-2">
            {finishedTournaments.slice(0, 4).map((tournament) => (
              <div 
                key={tournament.id} 
                className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/30"
              >
                <div className="p-2 rounded-lg bg-muted/50">
                  <Trophy className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate text-sm">{tournament.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {getPrizeLabel(tournament.prize_type, tournament.prize_amount)}
                  </p>
                </div>
                {tournament.winner && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <VipUsername
                      username={(tournament.winner as any).username}
                      isVip={(tournament.winner as any).is_vip}
                      gradientColor={(tournament.winner as any).gradient_color}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20">
            <Target className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-amber-500 mb-1">Как участвовать?</p>
            <p className="text-sm text-muted-foreground">
              Делайте выигрышные ставки — сумма выигрышей засчитывается автоматически!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
