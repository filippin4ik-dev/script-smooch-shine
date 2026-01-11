import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Trophy, Clock, Users, Medal, ArrowLeft, Flame, Target } from "lucide-react";
import { VipUsername } from "@/components/VipUsername";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const BettingTournaments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Medal className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-gray-400" />;
      case 3: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="w-5 text-center text-muted-foreground font-bold">#{rank}</span>;
    }
  };

  const myRank = leaderboard?.find((l: any) => l.user_id === user?.id);

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

        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Active tournaments */}
          {activeTournaments.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Активные турниры
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeTournaments.map((tournament) => (
                  <Card
                    key={tournament.id}
                    className={cn(
                      "cursor-pointer transition-all duration-300 border-2",
                      selectedTournament === tournament.id
                        ? "border-amber-500 bg-amber-500/5 shadow-glow"
                        : "border-border/50 hover:border-amber-500/50"
                    )}
                    onClick={() => setSelectedTournament(tournament.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{tournament.title}</CardTitle>
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                          <Target className="w-3 h-3 mr-1" /> Активен
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {tournament.description && (
                        <p className="text-sm text-muted-foreground">{tournament.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-card/50 rounded-lg p-3 text-center">
                          <div className="text-xs text-muted-foreground mb-1">Приз</div>
                          <div className="font-bold text-amber-500">
                            {getPrizeLabel(tournament.prize_type, tournament.prize_amount)}
                          </div>
                        </div>
                        <div className="bg-card/50 rounded-lg p-3 text-center">
                          <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3" /> До конца
                          </div>
                          <div className="font-bold text-primary">
                            {getTimeRemaining(tournament.end_at)}
                          </div>
                        </div>
                      </div>
                      {tournament.min_bet_amount > 0 && (
                        <div className="text-xs text-muted-foreground text-center">
                          Мин. ставка: {tournament.min_bet_amount}₽
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Leaderboard */}
          {selectedTournament && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Таблица лидеров
                </h2>
                {myRank && (
                  <Badge variant="outline" className="bg-primary/10 border-primary/30">
                    Ваше место: #{myRank.rank}
                  </Badge>
                )}
              </div>

              <Card className="border-border/50">
                <CardContent className="p-0">
                  {leaderboard && leaderboard.length > 0 ? (
                    <div className="divide-y divide-border/30">
                      {leaderboard.map((player: any, index: number) => (
                        <div
                          key={player.user_id}
                          className={cn(
                            "flex items-center gap-3 p-4 transition-colors",
                            player.user_id === user?.id && "bg-primary/5",
                            index < 3 && "bg-gradient-to-r from-amber-500/5 to-transparent"
                          )}
                        >
                          <div className="w-8 flex justify-center">
                            {getRankIcon(Number(player.rank))}
                          </div>
                          <div className="flex-1 min-w-0">
                            <VipUsername
                              username={player.username}
                              isVip={player.is_vip}
                              level={player.level}
                              gradientColor={player.gradient_color}
                              className="font-semibold truncate"
                            />
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-primary">{Number(player.total_wins).toFixed(0)}₽</div>
                            <div className="text-xs text-muted-foreground">{player.total_bets} ставок</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Пока нет участников</p>
                      <p className="text-sm mt-1">Делайте ставки, чтобы попасть в турнир!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Finished tournaments */}
          {finishedTournaments.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-muted-foreground">
                <Trophy className="w-5 h-5" />
                Завершённые турниры
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {finishedTournaments.slice(0, 6).map((tournament) => (
                  <Card key={tournament.id} className="border-border/30 bg-card/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold truncate">{tournament.title}</span>
                        <Badge variant="secondary">Завершён</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Приз: {getPrizeLabel(tournament.prize_type, tournament.prize_amount)}
                      </div>
                      {tournament.winner && (
                        <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg">
                          <Medal className="w-4 h-4 text-amber-500" />
                          <VipUsername
                            username={(tournament.winner as any).username}
                            isVip={(tournament.winner as any).is_vip}
                            level={(tournament.winner as any).level}
                            gradientColor={(tournament.winner as any).gradient_color}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {tournaments?.length === 0 && (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-xl font-bold mb-2">Пока нет турниров</h3>
                <p className="text-muted-foreground">Следите за обновлениями!</p>
              </CardContent>
            </Card>
          )}

          {/* Info card */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-500" />
                Как участвовать?
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Делайте выигрышные ставки в разделе "Ставки на спорт"</li>
                <li>• Сумма ваших выигрышей автоматически засчитывается в турнир</li>
                <li>• Игрок с наибольшей суммой выигрышей получает приз!</li>
              </ul>
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
};

export default BettingTournaments;
