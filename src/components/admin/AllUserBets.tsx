import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RotateCcw, Undo2, Settings, Check, X, Trophy, XCircle, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const AllUserBets = () => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedBetType, setSelectedBetType] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch profiles for username and public_id lookup
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, public_id");
      if (error) return {};
      const map: Record<string, { username: string; public_id: number }> = {};
      data?.forEach((p) => { map[p.id] = { username: p.username, public_id: p.public_id }; });
      return map;
    },
  });

  const { data: allBets, isLoading } = useQuery({
    queryKey: ["admin-all-bets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_bets")
        .select(`
          *,
          matches!inner(
            sport,
            team1_score,
            team2_score,
            team1:teams!matches_team1_id_fkey(name),
            team2:teams!matches_team2_id_fkey(name)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) {
        console.error("Error fetching all bets:", error);
        return [];
      }
      return data || [];
    },
  });

  const { data: allParlayBets, isLoading: parlayLoading } = useQuery({
    queryKey: ["admin-all-parlay-bets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parlay_bets")
        .select(`
          *,
          parlay_bet_items(
            *,
            matches!inner(
              sport,
              status,
              winner,
              team1_score,
              team2_score,
              team1:teams!matches_team1_id_fkey(name),
              team2:teams!matches_team2_id_fkey(name)
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) {
        console.error("Error fetching all parlay bets:", error);
        return [];
      }
      return data || [];
    },
  });

  const refundBetMutation = useMutation({
    mutationFn: async (betId: string) => {
      const { data, error } = await supabase.rpc("refund_bet", { _bet_id: betId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success("Ставка возвращена");
        queryClient.invalidateQueries({ queryKey: ["admin-all-bets"] });
      } else {
        toast.error(data?.message || "Ошибка возврата");
      }
    },
    onError: () => {
      toast.error("Ошибка возврата ставки");
    },
  });

  const refundParlayMutation = useMutation({
    mutationFn: async (parlayId: string) => {
      const { data, error } = await supabase.rpc("refund_parlay_bet", { _parlay_bet_id: parlayId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success("Экспресс возвращен");
        queryClient.invalidateQueries({ queryKey: ["admin-all-parlay-bets"] });
      } else {
        toast.error(data?.message || "Ошибка возврата");
      }
    },
    onError: () => {
      toast.error("Ошибка возврата экспресса");
    },
  });

  const refundParlayItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc("refund_parlay_item", { _parlay_item_id: itemId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success("Матч возвращен из экспресса");
        queryClient.invalidateQueries({ queryKey: ["admin-all-parlay-bets"] });
      } else {
        toast.error(data?.message || "Ошибка возврата");
      }
    },
    onError: () => {
      toast.error("Ошибка возврата матча");
    },
  });

  const calculateParlayMutation = useMutation({
    mutationFn: async (parlayId: string) => {
      const { data, error } = await supabase.rpc("auto_calculate_parlay_bets", { _parlay_bet_id: parlayId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.[0]?.success) {
        toast.success(data[0].message || "Экспресс рассчитан");
        queryClient.invalidateQueries({ queryKey: ["admin-all-parlay-bets"] });
      } else {
        toast.error(data?.[0]?.message || "Ошибка расчета");
      }
    },
    onError: () => {
      toast.error("Ошибка расчета экспресса");
    },
  });

  const restoreParlayItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc("restore_parlay_item" as any, { _parlay_item_id: itemId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success("Матч восстановлен");
        queryClient.invalidateQueries({ queryKey: ["admin-all-parlay-bets"] });
        setEditingItemId(null);
      } else {
        toast.error(data?.message || "Ошибка восстановления");
      }
    },
    onError: () => {
      toast.error("Ошибка восстановления матча");
    },
  });

  const setBetTypeMutation = useMutation({
    mutationFn: async ({ itemId, betType }: { itemId: string; betType: string }) => {
      const { data, error } = await supabase.rpc("set_parlay_item_original_bet_type" as any, { 
        _item_id: itemId, 
        _bet_type: betType 
      });
      if (error) throw error;
      return { data, itemId };
    },
    onSuccess: async ({ data, itemId }) => {
      if (data?.success) {
        toast.success("Тип ставки установлен");
        restoreParlayItemMutation.mutate(itemId);
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: () => {
      toast.error("Ошибка установки типа ставки");
    },
  });

  // Manual status control for single bets
  const setBetStatusMutation = useMutation({
    mutationFn: async ({ betId, status }: { betId: string; status: string }) => {
      const { data, error } = await supabase.rpc("admin_set_bet_status" as any, { 
        _bet_id: betId, 
        _status: status,
        _is_parlay: false
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(data.message || "Статус изменен");
        queryClient.invalidateQueries({ queryKey: ["admin-all-bets"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: () => {
      toast.error("Ошибка изменения статуса");
    },
  });

  // Manual status control for parlays
  const setParlayStatusMutation = useMutation({
    mutationFn: async ({ parlayId, status }: { parlayId: string; status: string }) => {
      const { data, error } = await supabase.rpc("admin_set_bet_status" as any, { 
        _bet_id: parlayId, 
        _status: status,
        _is_parlay: true
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(data.message || "Статус изменен");
        queryClient.invalidateQueries({ queryKey: ["admin-all-parlay-bets"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: () => {
      toast.error("Ошибка изменения статуса");
    },
  });

  // Manual status control for parlay items
  const setParlayItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const { data, error } = await supabase.rpc("admin_set_parlay_item_status" as any, { 
        _item_id: itemId, 
        _status: status
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success("Статус элемента изменен");
        queryClient.invalidateQueries({ queryKey: ["admin-all-parlay-bets"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: () => {
      toast.error("Ошибка изменения статуса элемента");
    },
  });

  const handleRestoreWithBetType = (itemId: string) => {
    if (!selectedBetType) {
      toast.error("Выберите тип ставки");
      return;
    }
    setBetTypeMutation.mutate({ itemId, betType: selectedBetType });
  };

  const betTypeLabels: Record<string, string> = {
    team1_win: "П1",
    team2_win: "П2",
    draw: "Ничья",
    over: "Тотал Больше",
    under: "Тотал Меньше",
    both_score_yes: "Обе забьют - Да",
    both_score_no: "Обе забьют - Нет",
    team1_handicap: "Фора 1",
    team2_handicap: "Фора 2",
    refunded: "🔄 Возврат",
  };

  const formatBetType = (betType: string) => {
    if (betType.startsWith("exact_")) {
      const score = betType.replace("exact_", "");
      return `Точный счет: ${score.replace("-", ":")}`;
    }
    return betTypeLabels[betType] || betType;
  };

  const getItemStatus = (item: any) => {
    if (item.bet_type === "refunded" || item.status === "refunded") return "refunded";
    if (item.status === "won") return "won";
    if (item.status === "lost") return "lost";
    const match = item.matches;
    if (!match || match.status !== "finished") return "pending";
    
    const betType = item.bet_type;
    const winner = match.winner;
    
    if (betType === "team1_win" && winner === "team1") return "won";
    if (betType === "team2_win" && winner === "team2") return "won";
    if (betType === "draw" && winner === "draw") return "won";
    
    // Exact score check
    if (betType.startsWith("exact_")) {
      const parts = betType.replace("exact_", "").split("-");
      if (parts.length === 2) {
        const t1 = parseInt(parts[0]);
        const t2 = parseInt(parts[1]);
        if (match.team1_score === t1 && match.team2_score === t2) return "won";
      }
    }
    
    if (match.status === "finished") return "lost";
    return "pending";
  };

  if (isLoading || parlayLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allParlayBets?.map((parlay: any) => (
        <Card key={parlay.id} className={cn(
          "border-2 transition-all",
          parlay.status === "won" && "border-primary/50 bg-primary/5",
          parlay.status === "lost" && "border-destructive/50 bg-destructive/5",
          parlay.status === "refunded" && "border-yellow-500/50 bg-yellow-500/5",
          parlay.status === "pending" && "border-secondary/50 bg-secondary/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-purple-500/20 text-purple-700 dark:text-purple-300">
                    🎯 ЭКСПРЕСС ({parlay.parlay_bet_items?.length || 0})
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    👤 {profiles?.[parlay.user_id]?.username || parlay.user_id?.slice(0, 8)} (ID: {profiles?.[parlay.user_id]?.public_id})
                  </Badge>
                  {parlay.is_freebet && (
                    <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300">
                      🎁 ФРИБЕТ
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {parlay.status === "pending" && (
                  <Badge className="bg-secondary/20 text-secondary-foreground border-secondary">⏳ Ожидание</Badge>
                )}
                {parlay.status === "won" && (
                  <Badge className="bg-primary/20 text-primary-foreground border-primary">✅ Выигрыш</Badge>
                )}
                {parlay.status === "lost" && (
                  <Badge className="bg-destructive/20 text-destructive-foreground border-destructive">❌ Проигрыш</Badge>
                )}
                {parlay.status === "refunded" && (
                  <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500">🔄 Возвращен</Badge>
                )}
                {parlay.status === "partial_refund" && (
                  <Badge className="bg-orange-500/20 text-orange-700 border-orange-500">⚡ Частичный возврат</Badge>
                )}
              </div>
            </div>

            {/* Admin manual controls for parlay */}
            <div className="flex flex-wrap gap-1 mb-3 p-2 bg-muted/50 rounded">
              <span className="text-xs text-muted-foreground mr-2">Управление:</span>
              {parlay.status !== "refunded" && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs text-yellow-600"
                  onClick={() => refundParlayMutation.mutate(parlay.id)}
                  disabled={refundParlayMutation.isPending}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Возврат
                </Button>
              )}
              {parlay.status !== "won" && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs text-green-600"
                  onClick={() => setParlayStatusMutation.mutate({ parlayId: parlay.id, status: "won" })}
                  disabled={setParlayStatusMutation.isPending}
                >
                  <Trophy className="w-3 h-3 mr-1" />
                  Победа
                </Button>
              )}
              {parlay.status !== "lost" && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs text-red-600"
                  onClick={() => setParlayStatusMutation.mutate({ parlayId: parlay.id, status: "lost" })}
                  disabled={setParlayStatusMutation.isPending}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Проигрыш
                </Button>
              )}
              {parlay.status !== "pending" && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs text-blue-600"
                  onClick={() => setParlayStatusMutation.mutate({ parlayId: parlay.id, status: "pending" })}
                  disabled={setParlayStatusMutation.isPending}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Откат
                </Button>
              )}
              {(parlay.status === "pending" || parlay.status === "partial_refund") && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs text-purple-600"
                  onClick={() => calculateParlayMutation.mutate(parlay.id)}
                  disabled={calculateParlayMutation.isPending}
                >
                  Рассчитать
                </Button>
              )}
            </div>

            {/* Матчи в экспрессе */}
            <div className="space-y-2 mb-3">
              {parlay.parlay_bet_items?.map((item: any, idx: number) => {
                const itemStatus = getItemStatus(item);
                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-2 rounded text-sm flex items-center justify-between",
                      itemStatus === "won" && "bg-primary/20 border border-primary/30",
                      itemStatus === "lost" && "bg-destructive/20 border border-destructive/30",
                      itemStatus === "refunded" && "bg-yellow-500/20 border border-yellow-500/30",
                      itemStatus === "pending" && "bg-muted/20"
                    )}
                  >
                    <div className="flex-1">
                      <div className="font-bold flex items-center gap-2">
                        {itemStatus === "won" && <span>✅</span>}
                        {itemStatus === "lost" && <span>❌</span>}
                        {itemStatus === "refunded" && <span>🔄</span>}
                        {itemStatus === "pending" && <span>⏳</span>}
                        {item.matches?.team1?.name || "Команда 1"} vs {item.matches?.team2?.name || "Команда 2"}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{item.matches?.sport}</Badge>
                        <span>{formatBetType(item.bet_type)}</span>
                        <span className="text-primary font-bold">{item.odds}x</span>
                        {item.matches?.team1_score !== null && (
                          <span className="text-xs">
                            Счет: {item.matches.team1_score}:{item.matches.team2_score}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {/* Item status controls - compact icon buttons */}
                      {itemStatus !== "refunded" ? (
                        <>
                          <button 
                            className="h-4 w-4 flex items-center justify-center text-green-600 hover:bg-green-500/20 rounded"
                            onClick={() => setParlayItemStatusMutation.mutate({ itemId: item.id, status: "won" })}
                            title="Победа"
                          >
                            <Check className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            className="h-4 w-4 flex items-center justify-center text-red-600 hover:bg-red-500/20 rounded"
                            onClick={() => setParlayItemStatusMutation.mutate({ itemId: item.id, status: "lost" })}
                            title="Проигрыш"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            className="h-4 w-4 flex items-center justify-center text-yellow-600 hover:bg-yellow-500/20 rounded disabled:opacity-50"
                            onClick={() => refundParlayItemMutation.mutate(item.id)}
                            disabled={refundParlayItemMutation.isPending}
                            title="Возврат"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                          </button>
                          <button 
                            className="h-4 w-4 flex items-center justify-center text-blue-600 hover:bg-blue-500/20 rounded"
                            onClick={() => setParlayItemStatusMutation.mutate({ itemId: item.id, status: "pending" })}
                            title="Сбросить статус"
                          >
                            <Clock className="w-2.5 h-2.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {editingItemId === item.id ? (
                            <div className="flex items-center gap-0.5">
                              <Select value={selectedBetType} onValueChange={setSelectedBetType}>
                                <SelectTrigger className="h-4 w-14 text-[9px]">
                                  <SelectValue placeholder="Тип" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="team1_win">П1</SelectItem>
                                  <SelectItem value="team2_win">П2</SelectItem>
                                  <SelectItem value="draw">Ничья</SelectItem>
                                  <SelectItem value="over">ТБ</SelectItem>
                                  <SelectItem value="under">ТМ</SelectItem>
                                </SelectContent>
                              </Select>
                              <button 
                                className="h-4 w-4 flex items-center justify-center text-green-600 hover:bg-green-500/20 rounded disabled:opacity-50"
                                onClick={() => handleRestoreWithBetType(item.id)}
                                disabled={setBetTypeMutation.isPending || restoreParlayItemMutation.isPending}
                              >
                                <Check className="w-2.5 h-2.5" />
                              </button>
                              <button 
                                className="h-4 w-4 flex items-center justify-center text-red-600 hover:bg-red-500/20 rounded"
                                onClick={() => setEditingItemId(null)}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              {item.original_bet_type ? (
                                <button 
                                  className="h-4 w-4 flex items-center justify-center text-green-600 hover:bg-green-500/20 rounded disabled:opacity-50"
                                  onClick={() => restoreParlayItemMutation.mutate(item.id)}
                                  disabled={restoreParlayItemMutation.isPending}
                                  title="Восстановить матч"
                                >
                                  <Undo2 className="w-2.5 h-2.5" />
                                </button>
                              ) : (
                                <button 
                                  className="h-4 w-4 flex items-center justify-center text-orange-600 hover:bg-orange-500/20 rounded"
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setSelectedBetType("");
                                  }}
                                  title="Выбрать тип ставки и восстановить"
                                >
                                  <Settings className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg mb-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Общий коэф.</div>
                <div className="font-bold text-sm text-primary">{parlay.total_odds}x</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Ставка</div>
                <div className="font-bold text-sm">{parlay.total_amount}₽</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Возможный выигрыш</div>
                <div className="font-bold text-sm">{parlay.potential_win}₽</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              {new Date(parlay.created_at).toLocaleString("ru-RU", { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Одиночные ставки */}
      {allBets?.map((bet: any) => (
        <Card key={bet.id} className={cn(
          "border-2 transition-all",
          bet.status === "won" && "border-primary/50 bg-primary/5",
          bet.status === "lost" && "border-destructive/50 bg-destructive/5",
          bet.status === "refunded" && "border-yellow-500/50 bg-yellow-500/5",
          bet.status === "pending" && "border-secondary/50 bg-secondary/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-700 dark:text-orange-300">
                    🎯 ОДИНОЧНАЯ
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    👤 {profiles?.[bet.user_id]?.username || bet.user_id?.slice(0, 8)} (ID: {profiles?.[bet.user_id]?.public_id})
                  </Badge>
                  {bet.is_freebet && (
                    <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300">
                      🎁 ФРИБЕТ
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-bold mt-1">
                  {bet.matches?.team1?.name || "Команда 1"} vs {bet.matches?.team2?.name || "Команда 2"}
                  {bet.matches?.team1_score !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({bet.matches.team1_score}:{bet.matches.team2_score})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {bet.status === "pending" && (
                  <Badge className="bg-secondary/20 text-secondary-foreground border-secondary">⏳ Ожидание</Badge>
                )}
                {bet.status === "won" && (
                  <Badge className="bg-primary/20 text-primary-foreground border-primary">✅ Выигрыш</Badge>
                )}
                {bet.status === "lost" && (
                  <Badge className="bg-destructive/20 text-destructive-foreground border-destructive">❌ Проигрыш</Badge>
                )}
                {bet.status === "refunded" && (
                  <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500">🔄 Возвращен</Badge>
                )}
              </div>
            </div>

            {/* Admin manual controls for single bets */}
            <div className="flex flex-wrap gap-2 mb-3 p-2 bg-muted/50 rounded">
              <span className="text-xs text-muted-foreground">Управление:</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 px-2 text-xs text-yellow-600 hover:bg-yellow-500/20"
                onClick={() => refundBetMutation.mutate(bet.id)}
                disabled={refundBetMutation.isPending || bet.status === "refunded"}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Возврат
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 px-2 text-xs text-green-600 hover:bg-green-500/20"
                onClick={() => setBetStatusMutation.mutate({ betId: bet.id, status: "won" })}
                disabled={setBetStatusMutation.isPending || bet.status === "won"}
              >
                <Trophy className="w-3 h-3 mr-1" />
                Победа
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 px-2 text-xs text-red-600 hover:bg-red-500/20"
                onClick={() => setBetStatusMutation.mutate({ betId: bet.id, status: "lost" })}
                disabled={setBetStatusMutation.isPending || bet.status === "lost"}
              >
                <XCircle className="w-3 h-3 mr-1" />
                Проигрыш
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 px-2 text-xs text-blue-600 hover:bg-blue-500/20"
                onClick={() => setBetStatusMutation.mutate({ betId: bet.id, status: "pending" })}
                disabled={setBetStatusMutation.isPending || bet.status === "pending"}
              >
                <Clock className="w-3 h-3 mr-1" />
                Сброс
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg mb-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Тип ставки</div>
                <div className="font-bold text-sm">{formatBetType(bet.bet_type)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Коэффициент</div>
                <div className="font-bold text-sm text-primary">{bet.odds}x</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Ставка</div>
                <div className="font-bold text-sm">{bet.bet_amount}₽</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground mb-1">
              Возможный выигрыш: <span className="font-semibold">{bet.potential_win}₽</span>
            </div>
            
            <div className="text-xs text-muted-foreground pt-2 border-t">
              {new Date(bet.created_at).toLocaleString("ru-RU", { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
