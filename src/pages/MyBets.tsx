import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { Clock, CheckCircle2, XCircle, RotateCcw, Zap, ChevronRight, Target } from "lucide-react";

const MyBets = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Realtime subscription for bet updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('my-bets-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_bets', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["user-bets", user.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parlay_bets', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["parlay-bets", user.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parlay_bet_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ["parlay-bets", user.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const { data: userBets } = useQuery({
    queryKey: ["user-bets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_bets")
        .select(`*, matches!inner(sport, team1:teams!matches_team1_id_fkey(name), team2:teams!matches_team2_id_fkey(name))`)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data || []).sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: !!user?.id,
  });

  const { data: parlayBets } = useQuery({
    queryKey: ["parlay-bets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parlay_bets")
        .select(`*, parlay_bet_items(*, matches!inner(sport, status, winner, team1:teams!matches_team1_id_fkey(name), team2:teams!matches_team2_id_fkey(name)))`)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data || []).sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: !!user?.id,
  });

  const getItemStatus = (item: any) => {
    if (item.status === "won") return "won";
    if (item.status === "lost") return "lost";
    if (item.status === "refunded" || item.bet_type === "refunded") return "refunded";
    return "pending";
  };

  const getBetTypeLabel = (betType: string, handicapValue?: number): string => {
    const labels: Record<string, string> = {
      team1_win: "П1", team2_win: "П2", draw: "Ничья",
      over: "ТБ", under: "ТМ",
      both_score_yes: "ОЗ Да", both_score_no: "ОЗ Нет",
      team1_handicap: handicapValue ? `Ф1 (${handicapValue > 0 ? '+' : ''}${handicapValue})` : "Ф1",
      team2_handicap: handicapValue ? `Ф2 (${handicapValue < 0 ? '+' : ''}${-handicapValue})` : "Ф2",
    };
    return labels[betType] || betType;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "won": return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30", label: "Выигрыш" };
      case "lost": return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", label: "Проигрыш" };
      case "refunded": return { icon: RotateCcw, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Возврат" };
      case "partial_refund": return { icon: RotateCcw, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30", label: "Частичный возврат" };
      default: return { icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Ожидание" };
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background/90">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                  <Target className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-bold">Мои ставки</h1>
              </div>
              <Button onClick={() => navigate("/bets")} variant="outline" size="sm">
                ← К ставкам
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-4 space-y-4">
          {userBets?.length === 0 && parlayBets?.length === 0 ? (
            <Card className="border-border/30 bg-card/80">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-bold text-muted-foreground mb-1">Нет ставок</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Сделайте первую ставку!</p>
                <Button onClick={() => navigate("/bets")}>Перейти к ставкам</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Parlays */}
              {parlayBets?.map((parlay: any) => {
                const status = getStatusConfig(parlay.status);
                const StatusIcon = status.icon;
                return (
                  <Card key={parlay.id} className={cn("overflow-hidden border-2 transition-all", status.border, status.bg)}>
                    <CardContent className="p-0">
                      {/* Parlay Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                        <div className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-purple-500" />
                          <span className="font-bold">Экспресс</span>
                          <Badge variant="outline" className="text-xs">{parlay.parlay_bet_items?.length || 0} событий</Badge>
                          {parlay.is_freebet && <Badge className="bg-green-500/20 text-green-500 text-xs">Фрибет</Badge>}
                        </div>
                        <Badge className={cn("flex items-center gap-1", status.bg, status.color, status.border)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                      </div>

                      {/* Parlay Items */}
                      <div className="divide-y divide-border/10">
                        {parlay.parlay_bet_items?.map((item: any, idx: number) => {
                          const itemStatus = getItemStatus(item);
                          const itemConfig = getStatusConfig(itemStatus);
                          const ItemIcon = itemConfig.icon;
                          return (
                            <div key={idx} className={cn("px-4 py-3 flex items-center gap-3", itemConfig.bg)}>
                              <ItemIcon className={cn("w-4 h-4 flex-shrink-0", itemConfig.color)} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {item.matches?.team1?.name || "Команда 1"} vs {item.matches?.team2?.name || "Команда 2"}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <span>{getBetTypeLabel(item.bet_type)}</span>
                                  <span className="text-primary font-bold">{item.odds}x</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Parlay Footer */}
                      <div className="px-4 py-3 bg-muted/20 border-t border-border/20">
                        <div className="grid grid-cols-3 gap-3 text-center mb-3">
                          <div>
                            <div className="text-xs text-muted-foreground">Коэф.</div>
                            <div className="font-bold text-primary">{parlay.total_odds}x</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Ставка</div>
                            <div className="font-bold">{parlay.total_amount}₽</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Выигрыш</div>
                            <div className="font-bold">{parlay.potential_win}₽</div>
                          </div>
                        </div>

                        {parlay.status === "won" && (
                          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
                            <div className="text-2xl font-black text-green-500">+{parlay.potential_win}₽</div>
                          </div>
                        )}
                        {parlay.status === "lost" && (
                          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                            <div className="text-2xl font-black text-red-500">-{parlay.total_amount}₽</div>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground text-center mt-2">
                          {new Date(parlay.created_at).toLocaleString("ru-RU", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Single Bets */}
              {userBets?.map((bet: any) => {
                const status = getStatusConfig(bet.status);
                const StatusIcon = status.icon;
                return (
                  <Card key={bet.id} className={cn("overflow-hidden border-2 transition-all", status.border, status.bg)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm flex items-center gap-2 mb-1">
                            <span className="truncate">{bet.matches?.team1?.name || "Команда 1"} vs {bet.matches?.team2?.name || "Команда 2"}</span>
                            {bet.is_freebet && <Badge className="bg-green-500/20 text-green-500 text-xs flex-shrink-0">Фрибет</Badge>}
                          </div>
                          <Badge variant="outline" className="text-xs">{bet.matches?.sport || "Спорт"}</Badge>
                        </div>
                        <Badge className={cn("flex items-center gap-1 ml-2", status.bg, status.color, status.border)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 p-3 bg-muted/20 rounded-xl mb-3">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Тип</div>
                          <div className="font-bold text-sm">{getBetTypeLabel(bet.bet_type, bet.handicap_value)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Коэф.</div>
                          <div className="font-bold text-sm text-primary">{bet.odds}x</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Ставка</div>
                          <div className="font-bold text-sm">{bet.bet_amount}₽</div>
                        </div>
                      </div>
                      
                      {bet.status === "won" && (
                        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
                          <div className="text-2xl font-black text-green-500">+{bet.potential_win}₽</div>
                        </div>
                      )}
                      {bet.status === "lost" && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                          <div className="text-2xl font-black text-red-500">-{bet.bet_amount}₽</div>
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground text-center mt-3">
                        {new Date(bet.created_at).toLocaleString("ru-RU", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
};

export default MyBets;
