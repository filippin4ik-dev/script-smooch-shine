import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { useProfile } from "@/hooks/useProfile";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MatchDetailsDialog } from "@/components/betting/MatchDetailsDialog";
import { ParlayCheckoutDialog } from "@/components/betting/ParlayCheckoutDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Trophy, Flame, Clock, Target, ChevronRight, Zap } from "lucide-react";

const Bets = () => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [parlayBets, setParlayBets] = useState<Array<{
    matchId: string;
    betType: string;
    odds: number;
    matchInfo?: any;
  }>>([]);
  const [matchFilter, setMatchFilter] = useState<"upcoming" | "live" | "finished">("upcoming");
  const [showParlayCheckout, setShowParlayCheckout] = useState(false);
  const isMobile = useIsMobile();

  // Realtime подписка на изменения матчей
  useEffect(() => {
    const channel = supabase
      .channel('matches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        queryClient.invalidateQueries({ queryKey: ["matches"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: matches } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          team1:teams!matches_team1_id_fkey(name, logo_url),
          team2:teams!matches_team2_id_fkey(name, logo_url)
        `)
        .order("match_time", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch active tournaments
  const { data: activeTournament } = useQuery({
    queryKey: ["active-betting-tournament"],
    queryFn: async () => {
      const { data } = await supabase
        .from("betting_tournaments")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const filteredMatches = matches?.filter(match => match.status === matchFilter);

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case "football": return "⚽";
      case "csgo": return "🔫";
      case "dota2": return "🎮";
      default: return "🏆";
    }
  };

  const getSportName = (sport: string) => {
    switch (sport) {
      case "football": return "Футбол";
      case "csgo": return "CS2";
      case "dota2": return "Dota 2";
      default: return sport;
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background/90">
        {/* Modern Header */}
        <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                    Ставки на спорт
                  </h1>
                  <p className="text-xs text-muted-foreground">{profile?.balance?.toFixed(2)}₽</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => navigate("/my-bets")} variant="outline" size="sm" className="border-primary/30">
                  📋 Мои ставки
                </Button>
                <Button onClick={() => navigate("/")} variant="ghost" size="sm">
                  ← Назад
                </Button>
              </div>
            </div>

            {/* Tournament Banner */}
            {activeTournament && (
              <div 
                onClick={() => navigate("/betting-tournaments")}
                className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-amber-500/30 cursor-pointer hover:border-amber-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center animate-pulse">
                      <Trophy className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-amber-500">{activeTournament.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Приз: {activeTournament.prize_amount}₽ • Участвуй и выигрывай!
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )}
            
            {/* Filter Tabs */}
            <div className="flex gap-2 p-1 bg-card/50 rounded-2xl border border-border/30">
              {[
                { key: "upcoming", label: "Прематч", icon: <Clock className="w-4 h-4" /> },
                { key: "live", label: "Live", icon: <Flame className="w-4 h-4" /> },
                { key: "finished", label: "Завершены", icon: <Zap className="w-4 h-4" /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMatchFilter(tab.key as any)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
                    transition-all duration-300
                    ${matchFilter === tab.key
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
                      : "hover:bg-muted/50 text-muted-foreground"
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.key === "live" && matches?.filter(m => m.status === "live").length > 0 && (
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 py-4 space-y-3">
          {filteredMatches?.map((match) => (
            <Card
              key={match.id}
              className="overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 border-border/30 bg-card/80 backdrop-blur-sm group"
              onClick={() => setSelectedMatch(match)}
            >
              <CardContent className="p-0">
                {/* Match Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-muted/30 to-transparent border-b border-border/20">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getSportIcon(match.sport)}</span>
                    <span className="text-xs font-medium text-muted-foreground">{getSportName(match.sport)}</span>
                    {match.bo_format && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/30 text-purple-400">
                        {match.bo_format}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {match.status === "live" && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse text-[10px]">
                        🔴 LIVE
                      </Badge>
                    )}
                    <span className="text-xs font-medium text-primary">
                      {format(new Date(match.match_time), "dd.MM HH:mm")}
                    </span>
                  </div>
                </div>

                {/* Teams Section */}
                <div className="px-4 py-4">
                  <div className="flex items-center gap-4">
                    {/* Team 1 */}
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-card to-muted border border-border/50 p-2 flex-shrink-0 group-hover:border-primary/30 transition-colors">
                        <img
                          src={match.team1.logo_url}
                          alt={match.team1.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{match.team1.name}</div>
                        <div className="text-xl font-black bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                          {match.team1_odds.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Score / VS */}
                    <div className="flex flex-col items-center px-4">
                      {(match.status === "finished" || match.status === "live") && match.team1_score !== null ? (
                        <div className="text-2xl font-black tracking-wider bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">
                          {match.team1_score} : {match.team2_score}
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-muted-foreground/50">VS</div>
                      )}
                      {match.has_draw && match.status === "upcoming" && (
                        <div className="text-xs text-muted-foreground mt-1 px-2 py-0.5 rounded-full bg-muted/50">
                          X: <span className="text-primary font-bold">{match.draw_odds}</span>
                        </div>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="flex-1 flex items-center gap-3 justify-end">
                      <div className="min-w-0 text-right">
                        <div className="font-bold text-sm truncate">{match.team2.name}</div>
                        <div className="text-xl font-black bg-gradient-to-r from-primary/70 to-primary bg-clip-text text-transparent">
                          {match.team2_odds.toFixed(2)}
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-card to-muted border border-border/50 p-2 flex-shrink-0 group-hover:border-primary/30 transition-colors">
                        <img
                          src={match.team2.logo_url}
                          alt={match.team2.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center justify-center py-2 border-t border-border/20 bg-gradient-to-r from-transparent via-primary/5 to-transparent">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                    Нажмите для ставки
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}

          {!filteredMatches?.length && (
            <Card className="border-border/30 bg-card/80">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-bold text-muted-foreground mb-1">Нет матчей</h3>
                <p className="text-sm text-muted-foreground/70">
                  {matchFilter === "upcoming" && "Скоро появятся новые матчи"}
                  {matchFilter === "live" && "Сейчас нет лайв-матчей"}
                  {matchFilter === "finished" && "История матчей пуста"}
                </p>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Match Details Dialog */}
        {selectedMatch && user?.id && profile && (
          <MatchDetailsDialog
            match={selectedMatch}
            open={!!selectedMatch}
            onOpenChange={(open) => !open && setSelectedMatch(null)}
            userId={user.id}
            balance={profile.balance}
            parlayBets={parlayBets}
            onAddToParlay={(bet) => {
              const existingIndex = parlayBets.findIndex(b => b.matchId === bet.matchId);
              if (existingIndex >= 0) {
                toast.error("Нельзя добавить второй раз ставку на один матч");
                return;
              }
              setParlayBets([...parlayBets, { ...bet, matchInfo: selectedMatch }]);
              setSelectedMatch(null);
            }}
            onBetPlaced={() => {
              queryClient.invalidateQueries({ queryKey: ["profile"] });
              setParlayBets([]);
            }}
          />
        )}

        {/* Parlay Cart */}
        {parlayBets.length > 0 && (
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 animate-in slide-in-from-bottom-4">
            <Card className="sm:w-80 bg-background/95 backdrop-blur-xl border-2 border-primary/50 shadow-2xl shadow-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Экспресс ({parlayBets.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setParlayBets([])}
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    Очистить
                  </Button>
                </div>
                
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {parlayBets.map((bet, index) => (
                    <div key={index} className="text-sm p-2.5 bg-muted/30 rounded-xl border border-border/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs truncate">
                            {bet.matchInfo?.team1?.name} vs {bet.matchInfo?.team2?.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {bet.betType} • <span className="text-primary font-bold">{bet.odds}x</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setParlayBets(parlayBets.filter((_, i) => i !== index));
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm mb-3 p-2 bg-primary/10 rounded-lg">
                  <span className="text-muted-foreground">Общий коэф:</span>
                  <span className="font-black text-lg text-primary">
                    {parlayBets.reduce((acc, bet) => acc * bet.odds, 1).toFixed(2)}x
                  </span>
                </div>

                <Button className="w-full" onClick={() => setShowParlayCheckout(true)}>
                  Оформить экспресс
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Parlay Checkout Dialog */}
        {showParlayCheckout && user?.id && profile && (
          <ParlayCheckoutDialog
            open={showParlayCheckout}
            onOpenChange={setShowParlayCheckout}
            parlayBets={parlayBets}
            userId={user.id}
            balance={profile.balance}
            onBetPlaced={() => {
              queryClient.invalidateQueries({ queryKey: ["profile"] });
              setParlayBets([]);
              setShowParlayCheckout(false);
            }}
          />
        )}
      </div>
    </AuthGuard>
  );
};

export default Bets;
