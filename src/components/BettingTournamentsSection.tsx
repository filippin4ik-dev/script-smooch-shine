import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Clock, Users, Medal, Target, Flame, Crown, Award, Star, ChevronRight, TrendingUp, Zap, Sparkles } from "lucide-react";
import { VipUsername } from "@/components/VipUsername";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface BettingTournamentsSectionProps {
  userId?: string;
}

export const BettingTournamentsSection = ({ userId }: BettingTournamentsSectionProps) => {
  const queryClient = useQueryClient();
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});

  // Fetch tournaments
  const { data: tournaments, isLoading } = useQuery({
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
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
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

  // Timer update
  useEffect(() => {
    const updateTimers = () => {
      const newTimeLeft: Record<string, string> = {};
      tournaments?.forEach((t) => {
        if (t.end_at && t.status === "active") {
          const end = new Date(t.end_at);
          const now = new Date();
          const diff = end.getTime() - now.getTime();
          
          if (diff <= 0) {
            newTimeLeft[t.id] = "Завершается...";
          } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if (days > 0) {
              newTimeLeft[t.id] = `${days}д ${hours}ч`;
            } else if (hours > 0) {
              newTimeLeft[t.id] = `${hours}ч ${minutes}м`;
            } else {
              newTimeLeft[t.id] = `${minutes}м ${seconds}с`;
            }
          }
        }
      });
      setTimeLeft(newTimeLeft);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [tournaments]);

  // Auto-select first active tournament
  useEffect(() => {
    if (!selectedTournament && tournaments?.some(t => t.status === "active")) {
      const firstActive = tournaments.find(t => t.status === "active");
      if (firstActive) {
        setSelectedTournament(firstActive.id);
      }
    }
  }, [tournaments, selectedTournament]);

  const activeTournaments = tournaments?.filter((t) => t.status === "active") || [];
  const finishedTournaments = tournaments?.filter((t) => t.status === "finished") || [];

  const getPrizeLabel = (type: string, amount: number) => {
    switch (type) {
      case "balance": return `${amount}₽`;
      case "freebet": return `${amount}₽ фрибет`;
      case "betting_freebet": return `${amount}₽ фрибет`;
      case "wheel": return `${amount} колёс`;
      default: return `${amount}`;
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return null;
  };

  const getRankBg = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-primary/50";
    if (rank === 1) return "bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-transparent border-yellow-500/40";
    if (rank === 2) return "bg-gradient-to-r from-slate-400/20 via-slate-400/10 to-transparent border-slate-400/40";
    if (rank === 3) return "bg-gradient-to-r from-amber-600/20 via-amber-600/10 to-transparent border-amber-600/40";
    return "bg-card/60 border-border/40 hover:bg-card/80";
  };

  const myRank = leaderboard?.find((l: any) => l.user_id === userId);
  const myRankIndex = leaderboard?.findIndex((l: any) => l.user_id === userId);

  if (activeTournaments.length === 0 && finishedTournaments.length === 0) {
    return null;
  }

  const currentTournament = tournaments?.find(t => t.id === selectedTournament);

  return (
    <div className="space-y-4">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 p-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-500/20 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-orange-500/15 to-transparent rounded-full blur-xl" />
        
        <div className="relative flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-600 blur-md opacity-60 animate-pulse" />
            <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 shadow-lg">
              <Trophy className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Турниры ставок
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h2>
            <p className="text-sm text-muted-foreground">Делай ставки — побеждай!</p>
          </div>
          {activeTournaments.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/40">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-bold text-green-400">{activeTournaments.length} LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Tournament Tabs */}
      {activeTournaments.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {activeTournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTournament(t.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                selectedTournament === t.id
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                  : "bg-card/60 text-muted-foreground border border-border/50 hover:border-amber-500/40 hover:text-foreground"
              )}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* Active Tournament Card */}
      {currentTournament && currentTournament.status === "active" && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-full blur-xl pointer-events-none" />
          
          <div className="relative p-4 space-y-4">
            {/* Tournament Info */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                  <h3 className="font-bold text-lg text-foreground truncate">{currentTournament.title}</h3>
                </div>
                {currentTournament.description && (
                  <p className="text-sm text-muted-foreground">{currentTournament.description}</p>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              {/* Prize */}
              <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-500/25">
                <div className="flex items-center gap-1 text-xs text-amber-400/80 mb-0.5">
                  <Star className="w-3 h-3" />
                  <span>Приз</span>
                </div>
                <div className="font-bold text-xl text-amber-400">
                  {getPrizeLabel(currentTournament.prize_type, currentTournament.prize_amount)}
                </div>
              </div>

              {/* Time */}
              <div className="relative overflow-hidden rounded-xl p-3 bg-muted/40 border border-border/40">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <Clock className="w-3 h-3" />
                  <span>Осталось</span>
                </div>
                <div className="font-bold text-xl text-foreground font-mono">
                  {timeLeft[currentTournament.id] || "∞"}
                </div>
              </div>

              {/* Min bet */}
              <div className="relative overflow-hidden rounded-xl p-3 bg-muted/40 border border-border/40">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>Мин. ставка</span>
                </div>
                <div className="font-bold text-xl text-foreground">
                  {currentTournament.min_bet_amount || 0}₽
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-foreground">Лидерборд</span>
                </div>
                {myRank && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/30">
                    <Zap className="w-3 h-3 text-primary" />
                    <span className="text-xs font-bold text-primary">Вы #{myRank.rank}</span>
                  </div>
                )}
              </div>

              {leaderboardLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : leaderboard && leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {/* Top 3 Podium */}
                  {leaderboard.length >= 3 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {/* 2nd Place */}
                      <div className="flex flex-col items-center p-3 rounded-xl bg-gradient-to-b from-slate-400/15 to-transparent border border-slate-400/30 order-1">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center mb-2 shadow-lg">
                          <Medal className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-slate-300 mb-1">2nd</div>
                          <div className="text-xs truncate max-w-[70px]">
                            <VipUsername
                              username={leaderboard[1]?.username || "—"}
                              isVip={leaderboard[1]?.is_vip}
                              level={leaderboard[1]?.level}
                              gradientColor={leaderboard[1]?.gradient_color}
                            />
                          </div>
                          <div className="text-sm font-bold text-slate-300 mt-1">
                            {Number(leaderboard[1]?.total_wins || 0).toFixed(0)}₽
                          </div>
                        </div>
                      </div>

                      {/* 1st Place */}
                      <div className="flex flex-col items-center p-3 rounded-xl bg-gradient-to-b from-yellow-500/20 to-amber-500/10 border border-yellow-500/40 order-0 -mt-2 scale-105">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 flex items-center justify-center mb-2 shadow-lg shadow-yellow-500/30">
                          <Crown className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-yellow-400 mb-1">1st</div>
                          <div className="text-xs truncate max-w-[70px]">
                            <VipUsername
                              username={leaderboard[0]?.username || "—"}
                              isVip={leaderboard[0]?.is_vip}
                              level={leaderboard[0]?.level}
                              gradientColor={leaderboard[0]?.gradient_color}
                            />
                          </div>
                          <div className="text-sm font-bold text-yellow-400 mt-1">
                            {Number(leaderboard[0]?.total_wins || 0).toFixed(0)}₽
                          </div>
                        </div>
                      </div>

                      {/* 3rd Place */}
                      <div className="flex flex-col items-center p-3 rounded-xl bg-gradient-to-b from-amber-600/15 to-transparent border border-amber-600/30 order-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center mb-2 shadow-lg">
                          <Award className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-amber-600 mb-1">3rd</div>
                          <div className="text-xs truncate max-w-[70px]">
                            <VipUsername
                              username={leaderboard[2]?.username || "—"}
                              isVip={leaderboard[2]?.is_vip}
                              level={leaderboard[2]?.level}
                              gradientColor={leaderboard[2]?.gradient_color}
                            />
                          </div>
                          <div className="text-sm font-bold text-amber-600 mt-1">
                            {Number(leaderboard[2]?.total_wins || 0).toFixed(0)}₽
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rest of leaderboard */}
                  {leaderboard.slice(3, 10).map((player: any) => {
                    const isCurrentUser = player.user_id === userId;
                    const rank = Number(player.rank);
                    
                    return (
                      <div
                        key={player.user_id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
                          getRankBg(rank, isCurrentUser)
                        )}
                      >
                        {/* Rank */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                          isCurrentUser ? "bg-primary/20 text-primary" : "bg-muted/60 text-muted-foreground"
                        )}>
                          #{rank}
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                          <VipUsername
                            username={player.username}
                            isVip={player.is_vip}
                            level={player.level}
                            gradientColor={player.gradient_color}
                          />
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {player.total_bets} ставок
                          </div>
                        </div>

                        {/* Wins */}
                        <div className="text-right">
                          <div className={cn(
                            "font-bold",
                            isCurrentUser ? "text-primary" : "text-green-500"
                          )}>
                            {Number(player.total_wins).toFixed(0)}₽
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show current user if not in top 10 */}
                  {userId && myRankIndex !== undefined && myRankIndex >= 10 && myRank && (
                    <>
                      <div className="flex items-center justify-center gap-2 py-2">
                        <div className="w-8 border-t border-dashed border-border/50" />
                        <span className="text-xs text-muted-foreground">•••</span>
                        <div className="w-8 border-t border-dashed border-border/50" />
                      </div>
                      <div className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border",
                        getRankBg(Number(myRank.rank), true)
                      )}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-primary/20 text-primary">
                          #{myRank.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <VipUsername
                            username={myRank.username}
                            isVip={myRank.is_vip}
                            level={myRank.level}
                            gradientColor={myRank.gradient_color}
                          />
                          <div className="text-xs text-muted-foreground">{myRank.total_bets} ставок</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">
                            {Number(myRank.total_wins).toFixed(0)}₽
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 rounded-xl bg-muted/20 border border-dashed border-border/50">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted/40 mb-3">
                    <Users className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <p className="font-medium text-muted-foreground">Пока нет участников</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Сделай ставку первым!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finished tournaments */}
      {finishedTournaments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground px-1">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-medium">Завершённые</span>
          </div>
          
          <div className="grid gap-2">
            {finishedTournaments.slice(0, 3).map((tournament) => (
              <div 
                key={tournament.id} 
                className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/30"
              >
                <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{tournament.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Приз: {getPrizeLabel(tournament.prize_type, tournament.prize_amount)}
                  </p>
                </div>
                {tournament.winner && (
                  <div className="flex items-center gap-2 shrink-0 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <Crown className="w-4 h-4 text-yellow-500" />
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
    </div>
  );
};
