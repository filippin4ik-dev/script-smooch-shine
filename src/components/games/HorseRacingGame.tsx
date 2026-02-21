import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBalanceMode } from "@/hooks/useBalanceMode";
import { useProfile } from "@/hooks/useProfile";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";
import { useQuery } from "@tanstack/react-query";

const HORSE_COLORS = [
  '#8B4513', '#2F2F2F', '#D2691E', '#F5F5DC', '#8B0000', '#4A4A4A',
];
const JOCKEY_COLORS = [
  '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#db2777',
];
const HORSE_NAMES = ['Молния', 'Буря', 'Ветер', 'Гром', 'Звезда', 'Комета'];

interface HorseState {
  id: number;
  x: number;
  color: string;
  jockeyColor: string;
  name: string;
  lane: number;
  speed: number;
  legPhase: number;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const raceStartTime = useRef<number>(0);
  // Store server-determined winner
  const serverWinnerRef = useRef<number | null>(null);

  const COEFFICIENT = 6;
  const TRACK_START = 80;
  const FINISH_LINE_PERCENT = 0.88;
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

  const initializeHorses = useCallback(() => {
    return HORSE_COLORS.map((color, index) => ({
      id: index + 1,
      x: TRACK_START,
      color,
      jockeyColor: JOCKEY_COLORS[index],
      name: HORSE_NAMES[index],
      lane: index,
      speed: 0,
      legPhase: Math.random() * Math.PI * 2,
    }));
  }, []);

  useEffect(() => {
    setHorses(initializeHorses());
  }, [initializeHorses]);

  const drawTopDownHorse = (
    ctx: CanvasRenderingContext2D, x: number, y: number, color: string,
    jockeyColor: string, id: number, legPhase: number, isRunning: boolean
  ) => {
    ctx.save();
    ctx.translate(x, y);
    const legMove = isRunning ? Math.sin(legPhase) * 4 : 0;
    const legMove2 = isRunning ? Math.sin(legPhase + Math.PI) * 4 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(2, 2, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shadeColor(color, -20);
    ctx.beginPath(); ctx.ellipse(-12 + legMove2, -6, 4, 3, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-12 + legMove2, 6, 4, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10 + legMove, -6, 4, 3, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10 + legMove, 6, 4, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    const tailWave = isRunning ? Math.sin(legPhase * 1.5) * 3 : 0;
    ctx.strokeStyle = shadeColor(color, -30); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.bezierCurveTo(-25, tailWave, -28, -tailWave, -26, tailWave * 0.5); ctx.stroke();
    const bodyGrad = ctx.createLinearGradient(-15, -8, -15, 8);
    bodyGrad.addColorStop(0, shadeColor(color, 15)); bodyGrad.addColorStop(0.5, color); bodyGrad.addColorStop(1, shadeColor(color, -15));
    ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(16, 0, 6, 5, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(24, 0, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shadeColor(color, -10);
    ctx.beginPath(); ctx.ellipse(26, -4, 2, 1.5, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(26, 4, 2, 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shadeColor(color, -25); ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const maneWave = isRunning ? Math.sin(legPhase + i * 0.3) * 2 : 0;
      ctx.beginPath(); ctx.moveTo(12 - i * 3, 0); ctx.lineTo(10 - i * 3 - maneWave, -7 - i * 0.5); ctx.stroke();
    }
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(-2, 0, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = jockeyColor; ctx.beginPath(); ctx.ellipse(-2, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(2, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = jockeyColor; ctx.beginPath(); ctx.arc(2, 0, 2.5, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 6px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(id.toString(), -2, 0);
    ctx.restore();
  };

  const shadeColor = (color: string, percent: number) => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  };

  const drawScene = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, currentHorses: HorseState[], isRunning: boolean) => {
    const dpr = window.devicePixelRatio || 1;
    ctx.save(); ctx.scale(dpr, dpr);
    const w = width / dpr; const h = height / dpr;
    const laneHeight = h / 8; const trackTop = laneHeight; const trackHeight = laneHeight * 6;
    const finishX = w * FINISH_LINE_PERCENT;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, trackTop);
    skyGrad.addColorStop(0, '#87ceeb'); skyGrad.addColorStop(1, '#4ade80');
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, trackTop);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(0, trackTop, w, trackHeight);
    ctx.fillStyle = '#16a34a'; ctx.fillRect(0, trackTop + trackHeight, w, h - trackTop - trackHeight);
    const trackGrad = ctx.createLinearGradient(0, trackTop, 0, trackTop + trackHeight);
    trackGrad.addColorStop(0, '#a3591a'); trackGrad.addColorStop(0.3, '#92400e');
    trackGrad.addColorStop(0.7, '#92400e'); trackGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = trackGrad; ctx.fillRect(TRACK_START - 20, trackTop + 5, w - TRACK_START, trackHeight - 10);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(TRACK_START - 20, trackTop + 5); ctx.lineTo(w, trackTop + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(TRACK_START - 20, trackTop + trackHeight - 5); ctx.lineTo(w, trackTop + trackHeight - 5); ctx.stroke();
    ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = trackTop + 5 + (i * (trackHeight - 10) / 6);
      ctx.beginPath(); ctx.moveTo(TRACK_START, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(TRACK_START, trackTop + 5, 4, trackHeight - 10);
    const checkSize = 8;
    for (let row = 0; row < Math.ceil((trackHeight - 10) / checkSize); row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(finishX + col * checkSize, trackTop + 5 + row * checkSize, checkSize, checkSize);
      }
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(finishX + 10, trackTop - 30, 4, 40);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.moveTo(finishX + 14, trackTop - 30); ctx.lineTo(finishX + 40, trackTop - 20); ctx.lineTo(finishX + 14, trackTop - 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      const y = trackTop + 5 + ((i + 0.5) * (trackHeight - 10) / 6);
      ctx.fillText((i + 1).toString(), TRACK_START - 35, y);
    }
    currentHorses.forEach((horse) => {
      const y = trackTop + 5 + ((horse.lane + 0.5) * (trackHeight - 10) / 6);
      drawTopDownHorse(ctx, horse.x, y, horse.color, horse.jockeyColor, horse.id, horse.legPhase, isRunning);
    });
    ctx.fillStyle = '#374151'; ctx.fillRect(10, trackTop - 25, w - 20, 20);
    for (let i = 0; i < 50; i++) {
      const cx = 20 + (i * ((w - 40) / 50)); const cy = trackTop - 15;
      ctx.fillStyle = `hsl(${Math.random() * 360}, 60%, 50%)`;
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawScene(ctx, canvas.width, canvas.height, horses, isRacing);
  }, [horses, drawScene, isRacing]);

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
      // Call server RPC - determines winner and handles balance
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
      
      // Start animation with server-determined winner
      setWinner(null);
      setIsRacing(true);
      raceStartTime.current = Date.now();

      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const canvasWidth = canvas.width / dpr;
      const finishX = canvasWidth * FINISH_LINE_PERCENT - 30;

      const raceHorses = initializeHorses().map((horse) => {
        const isWinner = horse.id === winningHorse;
        const baseSpeed = (finishX - TRACK_START) / (BASE_RACE_TIME / 16);
        return {
          ...horse,
          speed: isWinner ? baseSpeed * (1.1 + Math.random() * 0.15) : baseSpeed * (0.7 + Math.random() * 0.35),
        };
      });

      let raceFinished = false;

      const animate = () => {
        if (raceFinished) return;
        const elapsed = Date.now() - raceStartTime.current;

        setHorses((prevHorses) => {
          const updated = prevHorses.map((horse, idx) => {
            const raceHorse = raceHorses[idx];
            const variance = Math.sin(elapsed * 0.003 + horse.id) * 2;
            const newX = TRACK_START + (raceHorse.speed * (elapsed / 16)) + variance;
            return { ...horse, x: Math.min(newX, finishX + 50), legPhase: horse.legPhase + 0.4 };
          });
          
          const finishedHorse = updated.find(h => h.x >= finishX);
          if (finishedHorse && !raceFinished) {
            raceFinished = true;
            setTimeout(() => {
              setIsRacing(false);
              setWinner(winningHorse);
              refreshProfile();

              if (response.won) {
                toast.success(`🏆 ${HORSE_NAMES[winningHorse - 1]} победила! Вы выиграли ${formatAmount(response.win_amount)}₽!`);
              } else {
                toast.error(`${HORSE_NAMES[winningHorse - 1]} победила. Вы проиграли.`);
              }

              setTimeout(() => { setHorses(initializeHorses()); setWinner(null); }, 3000);
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
      <div className="text-center">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          {lastGameNumber && (
            <span className="text-sm font-mono bg-primary/20 px-2 py-1 rounded text-primary">#{lastGameNumber}</span>
          )}
          🏇 Скачки
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">🔒 Server</span>
        </h2>
        <p className="text-sm text-muted-foreground">Коэффициент: x{COEFFICIENT}</p>
      </div>

      <canvas ref={canvasRef} className="w-full h-48 rounded-lg border border-border" style={{ imageRendering: 'pixelated' }} />

      {!isRacing && !winner && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {HORSE_NAMES.map((name, i) => (
              <Button key={i} variant={selectedHorse === i + 1 ? "default" : "outline"} size="sm"
                onClick={() => setSelectedHorse(i + 1)}
                className={selectedHorse === i + 1 ? "ring-2 ring-primary" : ""}>
                <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: HORSE_COLORS[i] }} />
                {name}
              </Button>
            ))}
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Ставка (₽)</label>
            <Input type="number" value={betAmount} onChange={(e) => handleBetChange(e.target.value)}
              placeholder="Введите ставку" min={minBet} max={maxBet} />
          </div>

          <Button onClick={startRace} disabled={selectedHorse === null || !betAmount}
            className="w-full bg-gradient-gold hover:opacity-90 font-bold py-6">
            🏁 Начать гонку
          </Button>
        </>
      )}

      {isRacing && (
        <div className="text-center animate-pulse">
          <p className="text-lg font-bold">🏁 Гонка идёт...</p>
        </div>
      )}

      {winner && (
        <div className="text-center">
          <p className="text-lg font-bold">
            🏆 {HORSE_NAMES[winner - 1]} победила!
          </p>
        </div>
      )}
    </div>
  );
};
