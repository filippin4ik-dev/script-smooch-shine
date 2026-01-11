import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Rocket, TrendingUp, RefreshCw, Hash } from "lucide-react";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface CrashBet {
  id: string;
  user_id: string;
  bet_amount: number;
  auto_cashout: number;
  cashed_out_at: number | null;
  win_amount: number;
  status: string;
  profiles?: { username: string };
}

interface ServerState {
  status: 'none' | 'betting' | 'playing' | 'crashed';
  round_id?: string;
  countdown_ms?: number;
  betting_ends_at?: number;
  current_multiplier?: number;
  game_start_time?: number;
  crash_multiplier?: number;
  server_time?: number;
}

export const CrashGame = () => {
  const { user } = useTelegramAuth();
  const { profile, refetch: refreshProfile } = useProfile(user?.id);

  const [betAmount, setBetAmount] = useState("");
  const [autoCashout, setAutoCashout] = useState("2.00");
  const [roundId, setRoundId] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [myBet, setMyBet] = useState<CrashBet | null>(null);
  const [recentCrashes, setRecentCrashes] = useState<number[]>([]);
  const [roundBets, setRoundBets] = useState<CrashBet[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [phase, setPhase] = useState<"betting" | "playing" | "crashed">("betting");
  const [stats, setStats] = useState({ highest: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [rocketPosition, setRocketPosition] = useState(0);
  const [isExploded, setIsExploded] = useState(false);
  const [crashMultiplier, setCrashMultiplier] = useState<number | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [roundNumber, setRoundNumber] = useState<number | null>(null);


  const pollIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const animationRef = useRef<number>();
  const serverTimeOffset = useRef<number>(0);
  const startedRoundRef = useRef<string | null>(null);
  const scheduledNextRoundForRef = useRef<string | null>(null);
  const nextRoundTimeoutRef = useRef<number | null>(null);
  const isCreatingRoundRef = useRef(false);

  const getColor = (m: number) =>
    m < 1.2 ? "text-red-500" : m < 2 ? "text-cyan-500" : m < 10 ? "text-purple-500" : "text-yellow-500";

  const { useFreebet, useDemo } = useBalanceMode();

  // Load recent crashes
  const loadCrashes = useCallback(async () => {
    const { data } = await supabase
      .from("crash_rounds")
      .select("multiplier")
      .eq("status", "crashed")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setRecentCrashes(data.map((r) => r.multiplier));
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("crash_rounds")
      .select("multiplier")
      .eq("status", "crashed")
      .gte("created_at", today.toISOString());
    if (data?.length) {
      setStats({ highest: Math.max(...data.map((r) => r.multiplier)), total: data.length });
    }
  }, []);

  // Load round bets
  const loadBets = useCallback(async (rId: string) => {
    const { data } = await supabase
      .from("crash_bets")
      .select("*, profiles!crash_bets_user_id_fkey(username)")
      .eq("round_id", rId);
    if (data) {
      setRoundBets(data as any);
      setMyBet((data.find((b) => b.user_id === user?.id) as any) || null);
    }
  }, [user?.id]);

  // Load round number
  const loadRoundNumber = useCallback(async (rId: string) => {
    const { data } = await supabase
      .from("crash_rounds")
      .select("round_number")
      .eq("id", rId)
      .single();
    if (data) setRoundNumber(data.round_number);
  }, []);

  // Calculate multiplier from elapsed time
  const calculateMultiplier = useCallback((startTime: number): number => {
    const now = Date.now() + serverTimeOffset.current;
    const elapsed = (now - startTime) / 1000;
    let m = 1.00 + elapsed * 0.15;
    if (m > 10) m = 10 + (m - 10) * 3;
    return m;
  }, []);

  // Animation loop for playing phase
  const startAnimation = useCallback((startTime: number, crashAt: number) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const animate = () => {
      const m = calculateMultiplier(startTime);
      const rocketPos = Math.min(100, (m - 1) * 50);
      setRocketPosition(rocketPos);

      if (m >= crashAt) {
        setMultiplier(crashAt);
        setIsExploded(true);
        return;
      }

      setMultiplier(m);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [calculateMultiplier]);

  // Poll server state
  const pollServerState = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_crash_state') as { data: ServerState | null, error: any };

      if (error || !data) {
        console.error('Error getting crash state:', error);
        setIsLoading(false);
        return;
      }

      // Calculate server time offset
      if (data.server_time) {
        serverTimeOffset.current = data.server_time - Date.now();
      }

      const newRoundId = data.round_id || null;

      // Load bets if round changed
      if (newRoundId && newRoundId !== roundId) {
        setRoundId(newRoundId);
        loadBets(newRoundId);
        loadRoundNumber(newRoundId);
        startedRoundRef.current = null;
        scheduledNextRoundForRef.current = null;
        if (nextRoundTimeoutRef.current) {
          clearTimeout(nextRoundTimeoutRef.current);
          nextRoundTimeoutRef.current = null;
        }
      }

      switch (data.status) {
        case 'betting':
          setPhase('betting');
          setIsExploded(false);
          setRocketPosition(0);
          setMultiplier(1.0);
          setCrashMultiplier(null);
          if (data.countdown_ms !== undefined) {
            setCountdown(Math.ceil(data.countdown_ms / 1000));
          }
          // Clear my bet when new round starts
          if (newRoundId !== roundId) {
            setMyBet(null);
          }
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          break;

        case 'playing':
          setPhase('playing');
          setCountdown(0);
          setIsExploded(false);
          if (data.game_start_time && data.crash_multiplier) {
            setGameStartTime(data.game_start_time);
            setCrashMultiplier(data.crash_multiplier);
            startAnimation(data.game_start_time, data.crash_multiplier);
          }
          break;

        case 'crashed':
          setPhase('crashed');
          if (data.crash_multiplier) {
            setMultiplier(data.crash_multiplier);
            setCrashMultiplier(data.crash_multiplier);
            setRocketPosition(Math.min(100, (data.crash_multiplier - 1) * 50));
          }
          setIsExploded(true);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          loadCrashes();
          loadStats();
          if (newRoundId) loadBets(newRoundId);

          // Server auto-creates new round, no need to call from client
          break;

        case 'none':
          // No rounds - server will auto-create on next poll via get_crash_state
          break;
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Poll error:', err);
      setIsLoading(false);
    }
  }, [roundId, loadBets, loadRoundNumber, loadCrashes, loadStats, startAnimation]);

  // Start round when betting ends - now handled server-side in get_crash_state
  // This effect is kept minimal - server auto-starts when countdown expires
  useEffect(() => {
    if (phase === 'betting' && countdown === 0 && roundId) {
      // Server handles auto-start; we just wait for next poll to show 'playing'
      startedRoundRef.current = roundId;
    }
  }, [phase, countdown, roundId]);

  // Initial load and polling
  useEffect(() => {
    loadCrashes();
    loadStats();
    pollServerState();

    // Poll every 200ms for smooth updates (reduced from 100ms to prevent overload)
    pollIntervalRef.current = setInterval(pollServerState, 200);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    };
  }, [pollServerState, loadCrashes, loadStats]);

  // Subscribe to bets changes
  useEffect(() => {
    if (!roundId) return;

    const channel = supabase
      .channel(`crash-bets-${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crash_bets", filter: `round_id=eq.${roundId}` },
        () => loadBets(roundId),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId, loadBets]);

  const placeBet = async () => {
    if (!user?.id || !profile || !roundId || phase !== "betting") return;

    const amt = parseFloat(betAmount);
    const cash = parseFloat(autoCashout);

    if (isNaN(amt) || amt <= 0) {
      toast.error("Введите сумму");
      return;
    }
    if (isNaN(cash) || cash < 1.01) {
      toast.error("Мин. автовыкуп 1.01x");
      return;
    }
    
    const isDemo = useDemo;
    const isFreebet = useFreebet && !isDemo;
    const availableBalance = isDemo 
      ? (profile.demo_balance || 0)
      : isFreebet 
        ? (profile.freebet_balance || 0) 
        : profile.balance;
    
    if (amt > availableBalance) {
      toast.error(isDemo ? "Недостаточно демо баланса" : isFreebet ? "Недостаточно фрибет баланса" : "Недостаточно средств");
      return;
    }

    // Deduct from appropriate balance first
    if (isDemo) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          demo_balance: Math.max(0, (profile.demo_balance || 0) - amt),
          balance: profile.balance + amt
        })
        .eq("id", user.id);
      
      if (updateError) {
        toast.error("Ошибка списания демо баланса");
        return;
      }
    } else if (isFreebet) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          freebet_balance: Math.max(0, (profile.freebet_balance || 0) - amt),
          balance: profile.balance + amt
        })
        .eq("id", user.id);
      
      if (updateError) {
        toast.error("Ошибка списания фрибета");
        return;
      }
    }

    const { error } = await supabase.rpc("place_crash_bet", {
      _user_id: user.id,
      _round_id: roundId,
      _bet_amount: amt,
      _auto_cashout: cash,
    });

    if (error) {
      // Revert balance on error
      if (isDemo) {
        await supabase
          .from("profiles")
          .update({ 
            demo_balance: (profile.demo_balance || 0),
            balance: profile.balance
          })
          .eq("id", user.id);
      } else if (isFreebet) {
        await supabase
          .from("profiles")
          .update({ 
            freebet_balance: (profile.freebet_balance || 0),
            balance: profile.balance
          })
          .eq("id", user.id);
      }
      toast.error(error.message);
    } else {
      // Mark bet as freebet if applicable
      if (isFreebet) {
        const { data: betData } = await supabase
          .from("crash_bets")
          .select("id")
          .eq("round_id", roundId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        
        if (betData) {
          await supabase
            .from("crash_bets")
            .update({ is_freebet: true })
            .eq("id", betData.id);
        }
      }
      toast.success(isDemo ? "Демо ставка принята!" : "Ставка принята!");
      setBetAmount("");
      refreshProfile();
      // Immediately load bets to show user's bet
      loadBets(roundId);
    }
  };

  const cashout = async () => {
    if (!user?.id || !roundId || phase !== "playing") {
      toast.error("Невозможно выкупить сейчас");
      return;
    }

    if (!myBet || myBet.status !== "active") {
      toast.error("Нет активной ставки");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("cashout_crash_bet", {
        _user_id: user.id,
        _round_id: roundId,
        _current_multiplier: multiplier,
      });

      if (error) {
        console.error("Cashout RPC error:", error);
        toast.error(error.message || "Ошибка выкупа");
      } else if (data?.[0]?.success) {
        const winAmount = data[0].win_amount;
        toast.success(`+${winAmount.toFixed(2)}₽`);
        setMyBet((prev) => (prev ? { ...prev, status: "won" } : null));
        refreshProfile();
      } else {
        toast.error(data?.[0]?.message || "Не удалось выкупить");
      }
    } catch (err) {
      console.error("Cashout error:", err);
      toast.error("Ошибка выкупа");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Game Number Header */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Hash className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Раунд:</span>
              <span className="text-primary font-mono">#{roundNumber || '---'}</span>
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Макс. сегодня</div>
              <div className="text-2xl font-bold text-primary">{stats.highest.toFixed(2)}x</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Раундов</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-2">Последние краши</div>
            <div className="flex flex-wrap gap-2">
              {recentCrashes.map((c, i) => (
                <div key={i} className={`px-3 py-1 rounded font-bold ${getColor(c)} bg-card border border-border`}>
                  {c.toFixed(2)}x
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center relative overflow-hidden min-h-[250px]">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10" onClick={pollServerState}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            <div className="absolute inset-0 bg-gradient-to-t from-background via-background to-primary/5 pointer-events-none" />

            <div className="absolute left-8 bottom-20 right-8 top-8 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d="M 0 100 Q 50 50 100 0"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  fill="none"
                  className="text-primary/20"
                  strokeDasharray="2 2"
                />
              </svg>
            </div>

            <div
              className="absolute transition-all duration-100 ease-out"
              style={{
                left: `${8 + rocketPosition * 0.84}%`,
                bottom: `${20 + rocketPosition * 0.72}%`,
                transform: "translate(-50%, 50%) rotate(-45deg)",
              }}
            >
              {isExploded ? (
                <div className="relative">
                  <div className="text-4xl animate-pulse">💥</div>
                  <div className="absolute inset-0 animate-ping text-4xl opacity-50">💥</div>
                </div>
              ) : (
                <div className="relative">
                  <Rocket className={`h-10 w-10 ${phase === "playing" ? "text-primary" : "text-muted-foreground"}`} />
                  {phase === "playing" && (
                    <>
                      <div className="absolute -bottom-2 -right-2 text-xl animate-pulse">🔥</div>
                      <div className="absolute -bottom-4 -right-4 w-6 h-6 bg-orange-500/30 rounded-full blur-md animate-pulse" />
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="relative z-10 py-8">
              {phase === "betting" && (
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-primary animate-pulse">{countdown}с</div>
                  <div className="text-muted-foreground">Делайте ставки!</div>
                </div>
              )}
              {phase === "playing" && (
                <div className={`text-6xl font-bold ${getColor(multiplier)} transition-all`}>
                  {multiplier.toFixed(2)}x
                </div>
              )}
              {phase === "crashed" && (
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-red-500">Краш {crashMultiplier?.toFixed(2)}x</div>
                  <div className="text-sm text-muted-foreground">Новый раунд через 3 сек...</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Сумма</label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={phase !== "betting" || !!myBet}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-2">Автовыкуп</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={autoCashout}
                    onChange={(e) => setAutoCashout(e.target.value)}
                    disabled={phase !== "betting" || !!myBet}
                  />
                </div>
                {!myBet ? (
                  <Button onClick={placeBet} className="w-full" disabled={phase !== "betting"}>
                    <Rocket className="mr-2 h-4 w-4" />
                    Ставка
                  </Button>
                ) : myBet.status === "active" && phase === "playing" ? (
                  <Button onClick={cashout} variant="destructive" className="w-full">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Выкупить {multiplier.toFixed(2)}x
                  </Button>
                ) : myBet.status === "pending" ? (
                  <div className="text-center p-4 bg-primary/10 border border-primary/30 rounded">
                    <div className="text-sm text-primary">⏳ Ставка принята</div>
                    <div className="text-xl font-bold text-primary">
                      {myBet.bet_amount}₽ @ {myBet.auto_cashout.toFixed(2)}x
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Ожидайте старт раунда</div>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-muted rounded">
                    <div className="text-sm text-muted-foreground">Ваша ставка</div>
                    <div className="text-xl font-bold">
                      {myBet.bet_amount}₽ → {myBet.status === "won" ? `+${(myBet.win_amount || 0).toFixed(2)}₽` : myBet.status === "lost" ? "Проигрыш" : "..."}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Ставки ({roundBets.length})</div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {roundBets.map((b) => (
                    <div key={b.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <div className="font-medium">{b.profiles?.username}</div>
                        <div className="text-sm text-muted-foreground">
                          {b.bet_amount}₽ @ {b.auto_cashout.toFixed(2)}x
                        </div>
                      </div>
                      <div
                        className={`font-bold ${b.status === "won" ? "text-green-500" : b.status === "lost" ? "text-red-500" : "text-yellow-500"}`}
                      >
                        {b.status === "won" && `+${b.win_amount.toFixed(2)}₽`}
                        {b.status === "lost" && "💥"}
                        {b.status === "active" && "🚀"}
                        {b.status === "pending" && "⏳"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
