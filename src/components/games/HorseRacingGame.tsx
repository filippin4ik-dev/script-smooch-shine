import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBalanceMode } from "@/hooks/useBalanceMode";
import { useProfile } from "@/hooks/useProfile";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Zap, Timer } from "lucide-react";

const HORSE_COLORS = [
  { main: '#C41E3A', accent: '#FF6B6B', name: 'from-red-600 to-red-400' },
  { main: '#1E40AF', accent: '#60A5FA', name: 'from-blue-700 to-blue-400' },
  { main: '#15803D', accent: '#4ADE80', name: 'from-green-700 to-green-400' },
  { main: '#B45309', accent: '#FCD34D', name: 'from-amber-700 to-yellow-300' },
  { main: '#7C3AED', accent: '#C084FC', name: 'from-violet-600 to-purple-300' },
  { main: '#0E7490', accent: '#22D3EE', name: 'from-cyan-700 to-cyan-300' },
];

const HORSE_NAMES = ['Молния', 'Буря', 'Ветер', 'Гром', 'Звезда', 'Комета'];
const HORSE_EMOJI = ['⚡', '🌪️', '💨', '⛈️', '⭐', '☄️'];

interface HorseState {
  id: number;
  progress: number; // 0-100%
  speed: number;
  animPhase: number;
}

export const HorseRacingGame = () => {
  const { user } = useTelegramAuth();
  const { profile, refetch: refreshProfile } = useProfile(user?.id);
  const { useFreebet, useDemo } = useBalanceMode();

  const [betAmount, setBetAmount] = useState("10");
  const [selectedHorse, setSelectedHorse] = useState<number | null>(null);
  const [isRacing, setIsRacing] = useState(false);
  const [horses, setHorses] = useState<HorseState[]>([]);
  const [winner, setWinner] = useState<number | null>(null);
  const [lastGameNumber, setLastGameNumber] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [wonAmount, setWonAmount] = useState<number | null>(null);
  const animationRef = useRef<number>();
  const raceStartTime = useRef<number>(0);
  const serverWinnerRef = useRef<number | null>(null);

  const COEFFICIENT = 6;
  const BASE_RACE_TIME = 6000;

  const { data: gameSettings } = useQuery({
    queryKey: ["game-settings", "horse-racing"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_settings")
        .select("*")
        .eq("game_name", "horse-racing")
        .maybeSingle();
      return data;
    },
  });

  const isMaintenance = gameSettings?.is_maintenance || gameSettings?.status === "maintenance";
  const minBet = gameSettings?.min_bet || 10;
  const maxBet = gameSettings?.max_bet || 100000;

  const balance = profile?.balance || 0;
  const freebetBalance = profile?.freebet_balance || 0;
  const currentBalance = useFreebet ? freebetBalance : balance;

  const initializeHorses = useCallback((): HorseState[] => {
    return HORSE_COLORS.map((_, index) => ({
      id: index + 1,
      progress: 0,
      speed: 0,
      animPhase: Math.random() * Math.PI * 2,
    }));
  }, []);

  useEffect(() => {
    setHorses(initializeHorses());
  }, [initializeHorses]);

  const formatAmount = (amount: number): string => {
    if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(2) + ' млрд';
    if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + ' млн';
    if (amount >= 10_000) return (amount / 1_000).toFixed(1) + 'к';
    return amount.toFixed(2);
  };

  const handleBetChange = (value: string) => {
    setBetAmount(value.replace(/[^0-9.]/g, ''));
  };

  const startRace = async () => {
    if (!user?.id) { toast.error("Не удалось определить пользователя"); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet < minBet || bet > maxBet) { toast.error(`Ставка должна быть от ${minBet} до ${maxBet}`); return; }
    if (bet > currentBalance) { toast.error("Недостаточно средств"); return; }
    if (selectedHorse === null) { toast.error("Выберите лошадь"); return; }

    try {
      const { data, error } = await supabase.rpc("play_horse_racing_server", {
        _user_id: user.id,
        _bet_amount: bet,
        _selected_horse: selectedHorse,
        _is_freebet: useFreebet,
        _is_demo: useDemo,
      });

      if (error) { toast.error(error.message || "Ошибка"); return; }
      const response = data as any;
      if (!response?.success) { toast.error(response?.error || "Ошибка"); return; }

      const winningHorse = response.winning_horse;
      serverWinnerRef.current = winningHorse;
      setLastGameNumber(response.game_number);
      setWonAmount(response.won ? response.win_amount : null);

      // Countdown
      setCountdown(3);
      for (let i = 2; i >= 0; i--) {
        await new Promise(r => setTimeout(r, 800));
        setCountdown(i);
      }
      await new Promise(r => setTimeout(r, 400));
      setCountdown(null);

      // Start animation
      setWinner(null);
      setIsRacing(true);
      raceStartTime.current = Date.now();

      const raceHorses = initializeHorses().map((horse) => {
        const isWinner = horse.id === winningHorse;
        const baseSpeed = 100 / (BASE_RACE_TIME / 16);
        return {
          ...horse,
          speed: isWinner ? baseSpeed * (1.1 + Math.random() * 0.15) : baseSpeed * (0.65 + Math.random() * 0.35),
        };
      });

      let raceFinished = false;

      const animate = () => {
        if (raceFinished) return;
        const elapsed = Date.now() - raceStartTime.current;

        setHorses((prevHorses) => {
          const updated = prevHorses.map((horse, idx) => {
            const raceHorse = raceHorses[idx];
            const variance = Math.sin(elapsed * 0.003 + horse.id) * 1.5;
            const newProgress = Math.min(100, (raceHorse.speed * (elapsed / 16)) + variance);
            return { ...horse, progress: newProgress, animPhase: horse.animPhase + 0.3 };
          });

          const finishedHorse = updated.find(h => h.progress >= 98);
          if (finishedHorse && !raceFinished) {
            raceFinished = true;
            setTimeout(() => {
              setIsRacing(false);
              setWinner(winningHorse);
              refreshProfile();

              if (response.won) {
                toast.success(`🏆 ${HORSE_NAMES[winningHorse - 1]} победила! +${formatAmount(response.win_amount)}₽!`);
              } else {
                toast.error(`${HORSE_NAMES[winningHorse - 1]} победила. Вы проиграли.`);
              }

              setTimeout(() => { setHorses(initializeHorses()); setWinner(null); setWonAmount(null); }, 4000);
            }, 100);
          }
          return updated;
        });

        if (!raceFinished) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    } catch (error) {
      console.error("Error starting race:", error);
      toast.error("Ошибка при старте гонки");
    }
  };

  useEffect(() => {
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

  if (isMaintenance) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive font-bold text-lg">Игра на техническом перерыве</p>
        <p className="text-muted-foreground">Попробуйте позже</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-900/40 via-card to-emerald-900/30 border border-amber-500/20 p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDIxNSwwLDAuMDUpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30">
              🏇
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground">СКАЧКИ</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400 font-bold">x{COEFFICIENT}</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">🔒 Server</span>
              </div>
            </div>
          </div>
          {lastGameNumber && (
            <span className="text-xs font-mono bg-primary/20 px-2 py-1 rounded-lg text-primary font-bold">
              #{lastGameNumber}
            </span>
          )}
        </div>
      </div>

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="relative rounded-2xl overflow-hidden bg-card/90 border border-border p-12 flex items-center justify-center">
          <div className="text-center">
            <div className="text-7xl font-black text-primary animate-bounce-in" key={countdown}>
              {countdown === 0 ? '🏁' : countdown}
            </div>
            <p className="text-muted-foreground text-sm mt-2 font-medium">
              {countdown === 0 ? 'СТАРТ!' : 'Приготовьтесь...'}
            </p>
          </div>
        </div>
      )}

      {/* Race Track */}
      {countdown === null && (
        <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-emerald-950/60 via-emerald-900/40 to-emerald-950/60 border border-emerald-500/20 p-3">
          <div className="space-y-1.5">
            {horses.map((horse, i) => {
              const isWinnerHorse = winner === horse.id;
              const isSelected = selectedHorse === horse.id;
              const colorData = HORSE_COLORS[i];

              return (
                <div key={horse.id} className="relative">
                  {/* Lane */}
                  <div className={`relative h-10 rounded-lg overflow-hidden transition-all ${
                    isWinnerHorse ? 'ring-2 ring-primary shadow-lg shadow-primary/30' : 
                    isSelected ? 'ring-1 ring-primary/40' : ''
                  }`}
                    style={{ background: `linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.3) 100%)` }}
                  >
                    {/* Track pattern */}
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 21px)',
                    }} />

                    {/* Lane number */}
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold z-10"
                      style={{ background: colorData.main, color: 'white' }}>
                      {horse.id}
                    </div>

                    {/* Finish line */}
                    <div className="absolute right-2 top-0 bottom-0 w-1 opacity-30"
                      style={{ background: 'repeating-linear-gradient(180deg, white 0px, white 3px, black 3px, black 6px)' }} />

                    {/* Horse runner */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-8 flex items-center transition-none z-10"
                      style={{ left: `calc(${Math.min(horse.progress, 95)}% - 10px)` }}
                    >
                      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg shadow-lg ${isRacing ? 'animate-pulse' : ''}`}
                        style={{ background: `linear-gradient(135deg, ${colorData.main}, ${colorData.accent})` }}>
                        <span className="text-lg" style={{ 
                          transform: isRacing ? `scaleX(${1 + Math.sin(horse.animPhase) * 0.1})` : 'none',
                        }}>🏇</span>
                      </div>
                      {/* Speed trail */}
                      {isRacing && horse.progress > 5 && (
                        <div className="absolute right-full top-1/2 -translate-y-1/2 flex gap-0.5 opacity-40">
                          {[...Array(3)].map((_, j) => (
                            <div key={j} className="w-1 h-0.5 rounded-full"
                              style={{ background: colorData.accent, opacity: 1 - j * 0.3 }} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Progress bar bg */}
                    <div className="absolute bottom-0 left-8 right-4 h-0.5 bg-white/5">
                      <div className="h-full transition-none rounded-full"
                        style={{ width: `${horse.progress}%`, background: `linear-gradient(90deg, ${colorData.main}, ${colorData.accent})` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Winner Banner */}
      {winner && (
        <div className={`rounded-2xl p-4 text-center border ${
          wonAmount ? 'bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-primary/40' : 
          'bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/20 border-destructive/40'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Trophy className={`w-5 h-5 ${wonAmount ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-lg font-black">
              {HORSE_EMOJI[winner - 1]} {HORSE_NAMES[winner - 1]}
            </span>
          </div>
          {wonAmount ? (
            <p className="text-primary font-bold text-xl">+{formatAmount(wonAmount)}₽</p>
          ) : (
            <p className="text-muted-foreground text-sm">Вы проиграли</p>
          )}
        </div>
      )}

      {/* Controls */}
      {!isRacing && !winner && countdown === null && (
        <div className="space-y-3">
          {/* Horse Selection */}
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-2 block">Выберите лошадь</label>
            <div className="grid grid-cols-3 gap-2">
              {HORSE_NAMES.map((name, i) => {
                const colorData = HORSE_COLORS[i];
                const isSelected = selectedHorse === i + 1;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedHorse(i + 1)}
                    className={`relative p-2.5 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]'
                        : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-card/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full shadow-inner" 
                        style={{ background: `linear-gradient(135deg, ${colorData.main}, ${colorData.accent})` }} />
                      <span className="text-xs font-bold truncate">{HORSE_EMOJI[i]} {name}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Zap className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bet Input */}
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1 block">Ставка (₽)</label>
            <Input type="number" value={betAmount} onChange={(e) => handleBetChange(e.target.value)}
              placeholder="Введите ставку" min={minBet} max={maxBet}
              className="bg-card border-border" />
            <div className="flex gap-1 mt-1.5">
              {[10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setBetAmount(String(v))}
                  className="flex-1 text-[10px] py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground font-medium transition-colors">
                  {v}₽
                </button>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <Button onClick={startRace} disabled={selectedHorse === null || !betAmount}
            className="w-full bg-gradient-to-r from-primary via-primary to-amber-500 hover:opacity-90 font-black py-6 text-lg text-primary-foreground shadow-lg shadow-primary/30">
            🏁 СТАРТ
          </Button>
        </div>
      )}

      {/* Racing indicator */}
      {isRacing && countdown === null && (
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Timer className="w-4 h-4 text-primary animate-spin" />
            <span className="text-sm font-bold text-primary">Гонка идёт...</span>
          </div>
        </div>
      )}
    </div>
  );
};
