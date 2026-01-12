import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Clock, Target, Flame, Crown, Star, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { VipUsername } from "@/components/VipUsername";
import { TournamentLeaderboard } from "@/components/betting/TournamentLeaderboard";
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
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-foreground">Таблица лидеров</span>
              </div>

              <TournamentLeaderboard
                leaderboard={leaderboard || []}
                currentUserId={userId}
                isLoading={leaderboardLoading}
              />
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
