import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Gift, Trophy, Clock, Users, Star, Coins, Target, Medal, Timer, PartyPopper, Flame, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { useProfile } from "@/hooks/useProfile";
import { VipUsername, GradientColor } from "@/components/VipUsername";
import { GiveawayWheel } from "@/components/GiveawayWheel";
import { TasksList } from "@/components/TasksList";
import { BettingTournamentsSection } from "@/components/BettingTournamentsSection";
// GiveawayWinStreak temporarily removed
import { cn } from "@/lib/utils";

// Two-phase timer component
const TwoPhaseTimer = ({ 
  registrationEndsAt, 
  endAt, 
  status 
}: { 
  registrationEndsAt: string | null; 
  endAt: string | null; 
  status: string;
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (status !== "active") return null;

  const regEnd = registrationEndsAt ? new Date(registrationEndsAt) : null;
  const end = endAt ? new Date(endAt) : null;
  
  const isRegistrationOpen = regEnd ? regEnd > now : true;
  const isGiveawayActive = end ? end > now : true;

  const formatTime = (diff: number) => {
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { days, hours, minutes, seconds };
  };

  const TimeBlock = ({ value, unit }: { value: number; unit: string }) => (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 rounded-xl flex items-center justify-center">
        <span className="text-xl sm:text-2xl font-bold font-mono text-primary tabular-nums">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-xs text-muted-foreground mt-1">{unit}</span>
    </div>
  );

  const renderTimer = (time: { days: number; hours: number; minutes: number; seconds: number }) => (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {time.days > 0 && <TimeBlock value={time.days} unit="дн" />}
      <TimeBlock value={time.hours} unit="ч" />
      <span className="text-xl font-bold text-primary animate-pulse">:</span>
      <TimeBlock value={time.minutes} unit="мин" />
      <span className="text-xl font-bold text-primary animate-pulse">:</span>
      <TimeBlock value={time.seconds} unit="сек" />
    </div>
  );

  // Phase 1: Registration is open
  if (isRegistrationOpen && regEnd) {
    const regDiff = regEnd.getTime() - now.getTime();
    const regTime = formatTime(regDiff);
    const endDiff = end ? end.getTime() - now.getTime() : 0;
    const endTime = formatTime(endDiff);

    return (
      <div className="space-y-4">
        {/* Registration phase */}
        <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
          <div className="flex items-center gap-2 justify-center mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-400">Регистрация открыта</span>
          </div>
          {regTime && renderTimer(regTime)}
          <p className="text-center text-xs text-muted-foreground mt-2">
            До закрытия регистрации
          </p>
        </div>

        {/* Total end time info */}
        {endTime && end && (
          <div className="text-center text-sm text-muted-foreground">
            <Timer className="inline h-4 w-4 mr-1" />
            Итоги: {end.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК
          </div>
        )}
      </div>
    );
  }

  // Phase 2: Registration closed, waiting for results
  if (!isRegistrationOpen && isGiveawayActive && end) {
    const endDiff = end.getTime() - now.getTime();
    const endTime = formatTime(endDiff);

    return (
      <div className="space-y-4">
        {/* Registration closed badge */}
        <div className="flex items-center justify-center gap-2 text-orange-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">Регистрация закрыта</span>
        </div>

        {/* Game phase */}
        <div className="p-4 bg-primary/10 rounded-xl border border-primary/30">
          <div className="flex items-center gap-2 justify-center mb-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm font-medium text-primary">Розыгрыш идёт</span>
          </div>
          {endTime && renderTimer(endTime)}
          <p className="text-center text-xs text-muted-foreground mt-2">
            До подведения итогов
          </p>
        </div>
      </div>
    );
  }

  // End state - time's up
  return (
    <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30 text-center">
      <PartyPopper className="h-8 w-8 text-yellow-500 mx-auto mb-2 animate-bounce" />
      <span className="text-lg font-bold text-yellow-500">Подведение итогов...</span>
    </div>
  );
};

// Simple timer for cards
const SimpleCardTimer = ({ 
  registrationEndsAt, 
  endAt 
}: { 
  registrationEndsAt: string | null; 
  endAt: string | null;
}) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [phase, setPhase] = useState<"registration" | "game" | "ended">("registration");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const regEnd = registrationEndsAt ? new Date(registrationEndsAt) : null;
      const end = endAt ? new Date(endAt) : null;

      // Check registration phase
      if (regEnd && regEnd > now) {
        setPhase("registration");
        const diff = regEnd.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (hours > 0) {
          setTimeLeft(`${hours}ч ${minutes}м`);
        } else {
          setTimeLeft(`${minutes}м ${seconds}с`);
        }
        return;
      }

      // Check game phase
      if (end && end > now) {
        setPhase("game");
        const diff = end.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (hours > 0) {
          setTimeLeft(`${hours}ч ${minutes}м`);
        } else {
          setTimeLeft(`${minutes}м ${seconds}с`);
        }
        return;
      }

      setPhase("ended");
      setTimeLeft("Итоги...");
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [registrationEndsAt, endAt]);

  const getPhaseStyle = () => {
    switch (phase) {
      case "registration":
        return { icon: Users, color: "text-green-400", label: "Регистрация" };
      case "game":
        return { icon: Timer, color: "text-primary", label: "До итогов" };
      case "ended":
        return { icon: Trophy, color: "text-yellow-500", label: "" };
    }
  };

  const style = getPhaseStyle();
  const Icon = style.icon;

  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      <Icon className={`h-4 w-4 ${style.color} ${phase !== "ended" ? "animate-pulse" : ""}`} />
      <div className="flex flex-col">
        {style.label && <span className="text-xs text-muted-foreground">{style.label}</span>}
        <span className={`font-bold ${style.color}`}>{timeLeft}</span>
      </div>
    </div>
  );
};

const Giveaways = () => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedGiveaway, setSelectedGiveaway] = useState<any>(null);

  // Fetch giveaways
  const { data: giveaways, isLoading } = useQuery({
    queryKey: ["giveaways"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("giveaways")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch participants
  const { data: participants } = useQuery({
    queryKey: ["giveaway-participants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("giveaway_participants")
        .select("*, profiles:user_id(id, username, is_vip, level, gradient_color)");
      if (error) throw error;
      return data;
    },
  });

  // Realtime updates
  useEffect(() => {
    const giveawaysChannel = supabase
      .channel("giveaways-realtime-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "giveaways" },
        (payload) => {
          console.log("Giveaway change:", payload);
          queryClient.invalidateQueries({ queryKey: ["giveaways"] });
          queryClient.invalidateQueries({ queryKey: ["giveaway-winners"] });
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel("giveaway-participants-realtime-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "giveaway_participants" },
        (payload) => {
          console.log("Participant change:", payload);
          queryClient.invalidateQueries({ queryKey: ["giveaway-participants"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(giveawaysChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [queryClient]);

  // Fetch leaderboard for achievement giveaways
  const { data: leaderboard } = useQuery({
    queryKey: ["giveaway-leaderboard", selectedGiveaway?.id],
    queryFn: async () => {
      if (!selectedGiveaway || selectedGiveaway.giveaway_mode !== "achievement") return [];
      const { data, error } = await supabase.rpc("get_giveaway_leaderboard", {
        _giveaway_id: selectedGiveaway.id,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedGiveaway && selectedGiveaway.giveaway_mode === "achievement",
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Real-time subscription for leaderboard updates
  useEffect(() => {
    if (!selectedGiveaway || selectedGiveaway.giveaway_mode !== "achievement") return;

    const gameHistoryChannel = supabase
      .channel('leaderboard-game-history')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_history',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["giveaway-leaderboard", selectedGiveaway.id] });
        }
      )
      .subscribe();

    const buffsChannel = supabase
      .channel('leaderboard-buffs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_buffs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["giveaway-leaderboard", selectedGiveaway.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gameHistoryChannel);
      supabase.removeChannel(buffsChannel);
    };
  }, [selectedGiveaway?.id, queryClient]);

  // Fetch winners
  const { data: winners } = useQuery({
    queryKey: ["giveaway-winners"],
    queryFn: async () => {
      const finishedGiveaways = giveaways?.filter(g => g.status === "finished" && g.winner_id) || [];
      if (finishedGiveaways.length === 0) return {};
      
      const winnerIds = finishedGiveaways.map(g => g.winner_id);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, is_vip, level, gradient_color")
        .in("id", winnerIds);
      
      const winnersMap: Record<string, any> = {};
      data?.forEach(w => { winnersMap[w.id] = w; });
      return winnersMap;
    },
    enabled: !!giveaways,
  });

  // Join mutation
  const joinMutation = useMutation({
    mutationFn: async (giveawayId: string) => {
      if (!profile?.id) throw new Error("Не авторизован");
      const { data, error } = await supabase.rpc("join_giveaway", {
        _user_id: profile.id,
        _giveaway_id: giveawayId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: data.message });
        queryClient.invalidateQueries({ queryKey: ["giveaway-participants"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      } else {
        toast({ title: data?.message || "Ошибка", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      console.error("Join error:", error);
      toast({ title: "Ошибка участия: " + error.message, variant: "destructive" });
    },
  });

  const isParticipating = (giveawayId: string) => {
    return participants?.some(
      (p: any) => p.giveaway_id === giveawayId && p.user_id === profile?.id
    );
  };

  const getParticipantCount = (giveawayId: string) => {
    return participants?.filter((p: any) => p.giveaway_id === giveawayId).length || 0;
  };

  const isRegistrationClosed = (giveaway: any) => {
    if (!giveaway.registration_ends_at) return false;
    return new Date(giveaway.registration_ends_at) < new Date();
  };

  const getPrizeLabel = (type: string, amount: number) => {
    switch (type) {
      case "balance": return `${amount}₽ на баланс`;
      case "freebet": return `${amount}₽ фрибет казино`;
      case "betting_freebet": return `${amount}₽ фрибет ставки`;
      case "wheel": return `${amount} колёс фортуны`;
      case "skin": return "Скин CS2";
      default: return `${amount}₽`;
    }
  };

  const getParticipationInfo = (giveaway: any) => {
    switch (giveaway.participation_type) {
      case "free": return { icon: Gift, text: "Бесплатно", color: "text-green-400" };
      case "balance": return { icon: Coins, text: `${giveaway.participation_cost}₽`, color: "text-yellow-400" };
      case "level": return { icon: Star, text: `Уровень ${giveaway.min_level}+`, color: "text-purple-400" };
      default: return { icon: Gift, text: "Бесплатно", color: "text-green-400" };
    }
  };

  const getAchievementLabel = (type: string, game?: string) => {
    const gameNames: Record<string, string> = {
      dice: "Dice", mines: "Mines", crash: "Crash", roulette: "Рулетка",
      blackjack: "Blackjack", towers: "Towers", hilo: "HiLo", plinko: "Plinko",
      balloon: "Balloon", slots: "Слоты", penalty: "Penalty", chicken_road: "Chicken Road",
      horse_racing: "Скачки", cases: "Кейсы", upgrader: "Апгрейдер", crypto_trading: "Крипто"
    };
    
    switch (type) {
      case "most_wins": return "Больше всего побед";
      case "most_wins_game": return `Побед в ${gameNames[game || ""] || game}`;
      case "biggest_win": return "Самый большой выигрыш";
      case "most_referrals": return "Больше всего рефералов";
      default: return type;
    }
  };

  const getScoreLabel = (type: string) => {
    switch (type) {
      case "most_wins":
      case "most_wins_game": return "Побед";
      case "biggest_win": return "Выигрыш";
      case "most_referrals": return "Рефералов";
      default: return "Очки";
    }
  };

  const activeGiveaways = useMemo(() => giveaways?.filter(g => g.status === "active") || [], [giveaways]);
  const finishedGiveaways = useMemo(() => giveaways?.filter(g => g.status === "finished") || [], [giveaways]);

  // Auto-finish giveaways when end_at expires
  const autoFinishGiveaway = useCallback(async (giveawayId: string) => {
    console.log("Auto-finishing giveaway:", giveawayId);
    try {
      const { data, error } = await supabase.rpc("auto_finish_giveaway", {
        _giveaway_id: giveawayId,
      });
      if (error) {
        console.error("Auto-finish error:", error);
      } else {
        console.log("Auto-finish result:", data);
        // Force immediate refresh (list + winner + participants + balance)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["giveaways"] }),
          queryClient.invalidateQueries({ queryKey: ["giveaway-winners"] }),
          queryClient.invalidateQueries({ queryKey: ["giveaway-participants"] }),
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
        ]);
      }
    } catch (e) {
      console.error("Auto-finish exception:", e);
    }
  }, [queryClient]);

  useEffect(() => {
    const checkAndFinish = () => {
      const now = new Date();
      for (const giveaway of activeGiveaways) {
        // Only auto-finish when end_at expires, NOT registration_ends_at
        if (giveaway.end_at && new Date(giveaway.end_at) <= now && giveaway.giveaway_mode !== "manual") {
          autoFinishGiveaway(giveaway.id);
        }
      }
    };

    // Check immediately
    checkAndFinish();
    
    // Check every 3 seconds
    const interval = setInterval(checkAndFinish, 3000);
    return () => clearInterval(interval);
  }, [activeGiveaways, autoFinishGiveaway]);

  // Update selected giveaway if it changed in the list
  useEffect(() => {
    if (selectedGiveaway && giveaways) {
      const updated = giveaways.find(g => g.id === selectedGiveaway.id);
      if (updated) {
        setSelectedGiveaway(updated);
      }
    }
  }, [giveaways, selectedGiveaway?.id]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <header className="border-b border-primary/30 bg-gradient-to-r from-card/90 via-card/80 to-card/90 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6 text-primary" />
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
                Розыгрыши
              </span>
            </h1>
            <Button onClick={() => navigate("/")} variant="outline">
              ← Назад
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

          {/* Tasks List */}
          {user?.id && (
            <TasksList userId={user.id} />
          )}


          {/* Betting Tournaments Section */}
          <BettingTournamentsSection userId={user?.id} />

          {/* Active giveaways */}
          {activeGiveaways.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                  Активные розыгрыши
                </span>
              </h2>
              {activeGiveaways.map((giveaway: any) => {
                const participationInfo = getParticipationInfo(giveaway);
                const ParticipationIcon = participationInfo.icon;
                const participating = isParticipating(giveaway.id);
                const regClosed = isRegistrationClosed(giveaway);

                return (
                  <Card 
                    key={giveaway.id} 
                    className={`border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-primary/20 ${
                      giveaway.giveaway_mode === "achievement" ? "border-purple-500/30" : ""
                    }`}
                    onClick={() => setSelectedGiveaway(giveaway)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-xl flex items-center gap-2">
                          {giveaway.giveaway_mode === "achievement" ? (
                            <Target className="h-5 w-5 text-purple-500" />
                          ) : giveaway.giveaway_mode === "random" ? (
                            <Clock className="h-5 w-5 text-blue-500" />
                          ) : (
                            <Gift className="h-5 w-5 text-primary" />
                          )}
                          {giveaway.title}
                        </CardTitle>
                        <SimpleCardTimer 
                          registrationEndsAt={giveaway.registration_ends_at} 
                          endAt={giveaway.end_at} 
                        />
                      </div>
                      {giveaway.description && (
                        <p className="text-sm text-muted-foreground">{giveaway.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {giveaway.giveaway_mode === "achievement" && (
                        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                          <div className="flex items-center gap-2 text-purple-400">
                            <Target className="h-4 w-4" />
                            <span className="font-medium">
                              Цель: {getAchievementLabel(giveaway.achievement_type, giveaway.achievement_game)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Нажмите для просмотра таблицы лидеров
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-yellow-500" />
                          <span className="font-bold text-lg">
                            {getPrizeLabel(giveaway.prize_type, giveaway.prize_amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ParticipationIcon className={`h-5 w-5 ${participationInfo.color}`} />
                          <span className={participationInfo.color}>
                            {participationInfo.text}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{getParticipantCount(giveaway.id)} участников</span>
                        </div>
                        
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            joinMutation.mutate(giveaway.id);
                          }}
                          disabled={participating || joinMutation.isPending || regClosed}
                          variant={participating ? "secondary" : "default"}
                        >
                          {regClosed ? "Регистрация закрыта" : participating ? "✓ Вы участвуете" : "Участвовать"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {activeGiveaways.length === 0 && !isLoading && (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Сейчас нет активных розыгрышей</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Следите за обновлениями!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Finished giveaways */}
          {finishedGiveaways.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Завершённые розыгрыши
              </h2>
              {finishedGiveaways.map((giveaway: any) => {
                const winner = winners?.[giveaway.winner_id];
                
                return (
                  <Card key={giveaway.id} className="border-border/30 bg-muted/20">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="font-bold flex items-center gap-2">
                            {giveaway.giveaway_mode === "achievement" && (
                              <Target className="h-4 w-4 text-purple-500" />
                            )}
                            {giveaway.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Приз: {getPrizeLabel(giveaway.prize_type, giveaway.prize_amount)}
                          </p>
                        </div>
                        {winner && (
                          <div className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            <VipUsername
                              username={winner.username}
                              isVip={winner.is_vip}
                              gradientColor={(winner.gradient_color as GradientColor) || "gold"}
                              level={winner.level}
                              showLevel={true}
                            />
                          </div>
                        )}
                        {!winner && giveaway.winner_id === null && (
                          <span className="text-sm text-muted-foreground">Без победителя</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>

        {/* Dialog for giveaway details / leaderboard */}
        <Dialog open={!!selectedGiveaway} onOpenChange={() => setSelectedGiveaway(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            {selectedGiveaway && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    {selectedGiveaway.giveaway_mode === "achievement" ? (
                      <Target className="h-6 w-6 text-purple-500" />
                    ) : selectedGiveaway.giveaway_mode === "random" ? (
                      <Clock className="h-6 w-6 text-blue-500" />
                    ) : (
                      <Gift className="h-6 w-6 text-primary" />
                    )}
                    {selectedGiveaway.title}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Prize info */}
                  <div className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/20">
                    <Trophy className="h-8 w-8 text-yellow-500" />
                    <span className="text-2xl font-bold text-yellow-500">
                      {getPrizeLabel(selectedGiveaway.prize_type, selectedGiveaway.prize_amount)}
                    </span>
                  </div>

                  {/* Two-phase timer */}
                  {selectedGiveaway.status === "active" && (
                    <TwoPhaseTimer 
                      registrationEndsAt={selectedGiveaway.registration_ends_at}
                      endAt={selectedGiveaway.end_at}
                      status={selectedGiveaway.status}
                    />
                  )}

                  {/* Leaderboard for achievement giveaways */}
                  {selectedGiveaway.giveaway_mode === "achievement" && (
                    <div className="space-y-3">
                      <h3 className="font-bold flex items-center gap-2">
                        <Medal className="h-5 w-5 text-yellow-500" />
                        Таблица лидеров
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Цель: {getAchievementLabel(selectedGiveaway.achievement_type, selectedGiveaway.achievement_game)}
                      </p>
                      
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Игрок</TableHead>
                              <TableHead className="text-right">{getScoreLabel(selectedGiveaway.achievement_type)}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leaderboard && leaderboard.length > 0 ? (
                              leaderboard.map((entry: any, index: number) => (
                                <TableRow key={entry.user_id} className={index === 0 ? "bg-yellow-500/10" : ""}>
                                  <TableCell className="font-bold">
                                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <VipUsername
                                        username={entry.username}
                                        isVip={entry.is_vip}
                                        gradientColor={(entry.gradient_color as GradientColor) || "gold"}
                                        level={entry.level}
                                        showLevel={true}
                                      />
                                      {entry.has_buff && entry.buff_type && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold animate-pulse ${
                                          entry.buff_type === 'x5' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' :
                                          entry.buff_type === 'x3' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                          'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                        }`}>
                                          {entry.buff_type}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-bold">
                                    {selectedGiveaway.achievement_type === "biggest_win" 
                                      ? `${entry.score}₽` 
                                      : entry.score}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                  Пока нет участников с результатами
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Participants list for random/manual */}
                  {selectedGiveaway.giveaway_mode !== "achievement" && (
                    <div className="space-y-3">
                      <h3 className="font-bold flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Участники ({getParticipantCount(selectedGiveaway.id)})
                      </h3>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                        {participants
                          ?.filter((p: any) => p.giveaway_id === selectedGiveaway.id)
                          .map((p: any) => (
                            <div key={p.id} className="px-3 py-1 bg-muted rounded-lg">
                              <VipUsername
                                username={p.profiles?.username || "Игрок"}
                                isVip={p.profiles?.is_vip}
                                gradientColor={(p.profiles?.gradient_color as GradientColor) || "gold"}
                                level={p.profiles?.level}
                                showLevel={false}
                              />
                            </div>
                          ))}
                        {getParticipantCount(selectedGiveaway.id) === 0 && (
                          <p className="text-muted-foreground text-sm">Пока нет участников</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Giveaway Wheel for participants */}
                  {selectedGiveaway.has_wheel && 
                   selectedGiveaway.wheel_segments && 
                   Array.isArray(selectedGiveaway.wheel_segments) &&
                   selectedGiveaway.wheel_segments.length >= 2 &&
                   isParticipating(selectedGiveaway.id) &&
                   user?.id && (
                    <GiveawayWheel
                      userId={user.id}
                      giveawayId={selectedGiveaway.id}
                      segments={selectedGiveaway.wheel_segments.map((s: any) => ({
                        key: s.key,
                        label: s.label,
                        color: s.color,
                      }))}
                    />
                  )}

                  {/* Join button */}
                  {selectedGiveaway.status === "active" && (
                    <Button
                      onClick={() => joinMutation.mutate(selectedGiveaway.id)}
                      disabled={isParticipating(selectedGiveaway.id) || joinMutation.isPending || isRegistrationClosed(selectedGiveaway)}
                      className="w-full h-12 text-lg"
                      size="lg"
                    >
                      {isRegistrationClosed(selectedGiveaway) 
                        ? "Регистрация закрыта" 
                        : isParticipating(selectedGiveaway.id) 
                          ? "✓ Вы участвуете" 
                          : "Участвовать"}
                    </Button>
                  )}

                  {/* Winner display for finished */}
                  {selectedGiveaway.status === "finished" && selectedGiveaway.winner_id && winners?.[selectedGiveaway.winner_id] && (
                    <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-lg border border-yellow-500/30 text-center">
                      <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">Победитель:</p>
                      <div className="text-xl font-bold">
                        <VipUsername
                          username={winners[selectedGiveaway.winner_id].username}
                          isVip={winners[selectedGiveaway.winner_id].is_vip}
                          gradientColor={(winners[selectedGiveaway.winner_id].gradient_color as GradientColor) || "gold"}
                          level={winners[selectedGiveaway.winner_id].level}
                          showLevel={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
};

export default Giveaways;
