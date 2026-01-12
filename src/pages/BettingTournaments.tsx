import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Trophy, Clock, ArrowLeft, Flame, Target, Star, TrendingUp, Sparkles } from "lucide-react";
import { VipUsername } from "@/components/VipUsername";
import { TournamentLeaderboard } from "@/components/betting/TournamentLeaderboard";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const BettingTournaments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});

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
      .channel("betting-tournaments-realtime")
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
      case "betting_freebet": return `${amount}₽ фрибет ставки`;
      case "wheel": return `${amount} колёс`;
      default: return `${amount}`;
    }
  };

  const currentTournament = tournaments?.find(t => t.id === selectedTournament);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl shadow-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-amber-500" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Турниры ставок
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => navigate("/bets")} variant="default" size="sm">
                  🎯 К ставкам
                </Button>
                <Button onClick={() => navigate("/")} variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Назад
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
          {/* Active tournaments */}
          {activeTournaments.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Активные турниры
              </h2>
              
              {/* Tournament tabs for mobile */}
              {activeTournaments.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3">
                  {activeTournaments.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTournament(t.id)}
                      className={cn(
                        "flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                        selectedTournament === t.id
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                          : "bg-card/60 text-muted-foreground border border-border/50 hover:border-amber-500/40"
                      )}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Current tournament card */}
              {currentTournament && (
                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/5">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="relative p-4 space-y-4">
                    {/* Header */}
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
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
                        LIVE
                      </Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-500/25">
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-400/80 mb-0.5">
                          <Star className="w-3 h-3" />
                          <span>Приз</span>
                        </div>
                        <div className="font-bold text-lg sm:text-xl text-amber-400">
                          {getPrizeLabel(currentTournament.prize_type, currentTournament.prize_amount)}
                        </div>
                      </div>

                      <div className="relative overflow-hidden rounded-xl p-3 bg-muted/40 border border-border/40">
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground mb-0.5">
                          <Clock className="w-3 h-3" />
                          <span>Осталось</span>
                        </div>
                        <div className="font-bold text-lg sm:text-xl text-foreground font-mono">
                          {timeLeft[currentTournament.id] || "∞"}
                        </div>
                      </div>

                      <div className="relative overflow-hidden rounded-xl p-3 bg-muted/40 border border-border/40">
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground mb-0.5">
                          <TrendingUp className="w-3 h-3" />
                          <span>Мин.</span>
                        </div>
                        <div className="font-bold text-lg sm:text-xl text-foreground">
                          {currentTournament.min_bet_amount || 0}₽
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Leaderboard */}
          {selectedTournament && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg sm:text-xl font-bold">Таблица лидеров</h2>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/40 p-3 sm:p-4">
                <TournamentLeaderboard
                  leaderboard={leaderboard || []}
                  currentUserId={user?.id}
                  isLoading={leaderboardLoading}
                />
              </div>
            </section>
          )}

          {/* Finished tournaments */}
          {finishedTournaments.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground">
                <Trophy className="w-5 h-5" />
                Завершённые турниры
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {finishedTournaments.slice(0, 6).map((tournament) => (
                  <div 
                    key={tournament.id} 
                    className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{tournament.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {getPrizeLabel(tournament.prize_type, tournament.prize_amount)}
                      </p>
                    </div>
                    {tournament.winner && (
                      <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                        <VipUsername
                          username={(tournament.winner as any).username}
                          isVip={(tournament.winner as any).is_vip}
                          gradientColor={(tournament.winner as any).gradient_color}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {tournaments?.length === 0 && (
            <div className="text-center py-12 rounded-2xl border border-border/50 bg-card/30">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-bold mb-2">Пока нет турниров</h3>
              <p className="text-muted-foreground">Следите за обновлениями!</p>
            </div>
          )}

          {/* Info card */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/20 to-transparent rounded-full blur-2xl" />
            <h3 className="font-bold mb-2 flex items-center gap-2 relative">
              <Target className="w-5 h-5 text-amber-500" />
              Как участвовать?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1.5 relative">
              <li className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
                Делайте выигрышные ставки в разделе "Ставки"
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
                Сумма выигрышей автоматически засчитывается
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
                Лидер по выигрышам получает приз!
              </li>
            </ul>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
};

export default BettingTournaments;
