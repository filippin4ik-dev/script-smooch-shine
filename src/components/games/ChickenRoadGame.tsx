import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBalanceMode } from "@/hooks/useBalanceMode";
import { Flame, Footprints, Check, Wrench, Loader2, ArrowUp, Coins, Shield } from "lucide-react";
import chickenImg from "@/assets/chicken-road-chicken.webp";

interface ChickenRoadGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

type Difficulty = "easy" | "medium" | "hard" | "extreme";

interface GameConfig {
  difficulty: Difficulty;
  multipliers: number[];
  trapChances: number[];
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; icon: string; color: string; bg: string }> = {
  easy: { label: "Easy", icon: "🟢", color: "text-emerald-400", bg: "from-emerald-600 to-emerald-500 border-emerald-400 shadow-emerald-500/30" },
  medium: { label: "Medium", icon: "🔵", color: "text-blue-400", bg: "from-blue-600 to-blue-500 border-blue-400 shadow-blue-500/30" },
  hard: { label: "Hard", icon: "🟠", color: "text-orange-400", bg: "from-orange-600 to-red-500 border-orange-400 shadow-orange-500/30" },
  extreme: { label: "Extreme", icon: "🔴", color: "text-red-400", bg: "from-red-600 to-pink-600 border-red-400 shadow-red-500/30" },
};

export const ChickenRoadGame = ({ userId, balance, onBalanceUpdate }: ChickenRoadGameProps) => {
  const [bet, setBet] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [isAnimating, setIsAnimating] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [explosionStep, setExplosionStep] = useState(-1);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [chickenJump, setChickenJump] = useState(false);
  const [chickenWobble, setChickenWobble] = useState(false);
  const [legFrame, setLegFrame] = useState(0);
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [lastGameNumber, setLastGameNumber] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wonResult, setWonResult] = useState<{ amount: number; mult: number } | null>(null);
  const { canAct } = useSpamProtection();

  // Load game config from database
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoadingConfig(true);
      const { data, error } = await supabase.from("chicken_road_config").select("*");
      if (data && !error) {
        const configs: GameConfig[] = data.map((row: any) => ({
          difficulty: row.difficulty as Difficulty,
          multipliers: row.multipliers as number[],
          trapChances: row.trap_chances as number[],
        }));
        setGameConfigs(configs);
      } else {
        toast.error("Ошибка загрузки конфигурации игры");
      }
      setIsLoadingConfig(false);
    };
    loadConfig();
  }, []);

  // Check maintenance status
  useEffect(() => {
    const checkMaintenance = async () => {
      const { data } = await supabase.from("game_settings").select("is_maintenance").eq("game_name", "chicken-road").single();
      setIsMaintenance(data?.is_maintenance || false);
    };
    checkMaintenance();
    const channel = supabase.channel("chicken-road-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_settings", filter: "game_name=eq.chicken-road" }, () => checkMaintenance())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const currentConfig = useMemo(() => gameConfigs.find(c => c.difficulty === difficulty), [gameConfigs, difficulty]);
  const MULTIPLIERS = currentConfig?.multipliers || [];
  const { useFreebet, useDemo } = useBalanceMode();
  const STEPS = MULTIPLIERS.length;

  const startGame = async () => {
    if (!canAct() || !currentConfig) return;
    const betAmount = parseFloat(bet);
    if (!betAmount || betAmount < 10 || betAmount > balance) { toast.error("Неверная ставка"); return; }

    try {
      const { data, error } = await supabase.rpc("play_chicken_road_server", {
        _user_id: userId, _bet_amount: betAmount, _difficulty: difficulty, _is_freebet: useFreebet, _is_demo: useDemo,
      });
      if (error) { toast.error(error.message || "Ошибка игры"); return; }
      const response = data as any;
      if (!response?.success) { toast.error(response?.error || "Ошибка игры"); return; }

      setSessionId(response.session_id);
      setLastGameNumber(response.game_number);
      setCurrentStep(0);
      setGameStarted(true);
      setGameOver(false);
      setShowExplosion(false);
      setExplosionStep(-1);
      setWonResult(null);
      onBalanceUpdate();
    } catch { toast.error("Ошибка игры"); }
  };

  const takeStep = async () => {
    if (!canAct() || !gameStarted || gameOver || isAnimating || !sessionId) return;
    setIsAnimating(true);
    setChickenJump(true);
    await new Promise(r => setTimeout(r, 150));
    setChickenJump(false);
    setChickenWobble(true);
    const legInterval = setInterval(() => setLegFrame(prev => (prev + 1) % 4), 80);
    await new Promise(r => setTimeout(r, 300));
    clearInterval(legInterval);
    setLegFrame(0);

    try {
      const { data, error } = await supabase.rpc("chicken_road_step", { _user_id: userId, _session_id: sessionId });
      if (error) { toast.error(error.message || "Ошибка"); setIsAnimating(false); setChickenWobble(false); return; }
      const response = data as any;
      if (!response?.success) { toast.error(response?.error || "Ошибка"); setIsAnimating(false); setChickenWobble(false); return; }

      setCurrentStep(response.step);
      setChickenWobble(false);

      if (response.is_trap) {
        setExplosionStep(response.step - 1);
        setShowExplosion(true);
        setGameOver(true);
        toast.error(`💥 Курица попала в люк! -${parseFloat(bet).toFixed(2)}₽`);
        onBalanceUpdate();
      } else if (response.game_over && response.completed) {
        setGameOver(true);
        setWonResult({ amount: response.win_amount, mult: response.multiplier });
        toast.success(`🐔 Победа! +${response.win_amount.toFixed(2)}₽ (x${response.multiplier.toFixed(2)})`);
        onBalanceUpdate();
      }
    } catch { toast.error("Ошибка"); }
    setIsAnimating(false);
  };

  const cashout = async () => {
    if (!canAct() || !gameStarted || currentStep === 0 || isAnimating || !sessionId) return;
    try {
      const { data, error } = await supabase.rpc("chicken_road_cashout", { _user_id: userId, _session_id: sessionId });
      if (error) { toast.error(error.message || "Ошибка"); return; }
      const response = data as any;
      if (!response?.success) { toast.error(response?.error || "Ошибка"); return; }
      setGameOver(true);
      setWonResult({ amount: response.win_amount, mult: response.multiplier });
      toast.success(`🐔 Победа! +${response.win_amount.toFixed(2)}₽ (x${response.multiplier.toFixed(2)})`);
      onBalanceUpdate();
    } catch { toast.error("Ошибка"); }
  };

  const getCurrentMultiplier = () => currentStep === 0 ? 1 : MULTIPLIERS[currentStep - 1] || 1;
  const getNextMultiplier = () => currentStep >= STEPS ? MULTIPLIERS[STEPS - 1] || 1 : MULTIPLIERS[currentStep] || 1;

  const resetGame = () => {
    setGameStarted(false); setGameOver(false); setCurrentStep(0);
    setShowExplosion(false); setExplosionStep(-1); setSessionId(null); setWonResult(null);
  };

  // Explosion animation
  const ExplosionEffect = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-48 h-48 bg-gradient-radial from-primary/90 via-orange-500/70 to-transparent rounded-full animate-ping" />
        <div className="absolute w-32 h-32 bg-gradient-radial from-white via-primary to-orange-600 rounded-full animate-pulse opacity-90" />
      </div>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute" style={{
          left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 60}%`,
          animation: `ping ${0.3 + Math.random() * 0.5}s ease-out`, animationDelay: `${Math.random() * 0.2}s`,
        }}>
          <Flame className={cn(
            i % 3 === 0 ? "w-7 h-7 text-primary" : i % 3 === 1 ? "w-5 h-5 text-orange-400" : "w-6 h-6 text-destructive"
          )} style={{ filter: 'drop-shadow(0 0 8px currentColor)' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-900/30 via-card to-orange-900/20 border border-amber-500/20 p-4">
        <div className="relative flex items-center gap-3">
          {lastGameNumber && (
            <span className="text-xs font-mono bg-primary/20 px-2 py-1 rounded-lg text-primary font-bold">
              #{lastGameNumber}
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 p-1.5">
            <img src={chickenImg} alt="Chicken" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 bg-clip-text text-transparent">
              CHICKEN ROAD
            </h2>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">🔒 Server</span>
          </div>
        </div>
      </div>

      {isMaintenance ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 rounded-2xl bg-card border border-border">
          <div className="p-4 bg-orange-500/20 rounded-full"><Wrench className="w-12 h-12 text-orange-400" /></div>
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">Технический перерыв</h3>
            <p className="text-muted-foreground">Игра временно недоступна.</p>
          </div>
        </div>
      ) : isLoadingConfig ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 rounded-2xl bg-card border border-border">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Загрузка игры...</p>
        </div>
      ) : !gameStarted ? (
        <div className="space-y-4">
          {/* Difficulty Selection */}
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-2 block">Сложность</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((diff) => {
                const cfg = DIFFICULTY_CONFIG[diff];
                const isActive = difficulty === diff;
                return (
                  <button key={diff} onClick={() => setDifficulty(diff)}
                    className={cn(
                      "py-2.5 px-2 rounded-xl text-xs font-bold transition-all border-2",
                      isActive
                        ? `bg-gradient-to-br ${cfg.bg} text-white shadow-lg`
                        : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                    )}>
                    <span className="block text-base mb-0.5">{cfg.icon}</span>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bet */}
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1 block">Ставка (₽)</label>
            <Input type="number" value={bet} onChange={(e) => setBet(e.target.value)}
              placeholder="Введите ставку" min="10" max={balance}
              className="bg-card border-border" />
            <div className="flex gap-1 mt-1.5">
              {[10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setBet(String(v))}
                  className="flex-1 text-[10px] py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground font-medium transition-colors">
                  {v}₽
                </button>
              ))}
            </div>
          </div>

          {/* Multipliers Preview */}
          {MULTIPLIERS.length > 0 && (
            <div className="bg-card/50 rounded-xl p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Множители по шагам:</p>
              <div className="flex flex-wrap gap-1">
                {MULTIPLIERS.map((m, i) => (
                  <span key={i} className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md font-bold border",
                    m >= 10 ? "bg-primary/20 text-primary border-primary/30" :
                    m >= 3 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                    m >= 1.5 ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                    "bg-muted/30 text-muted-foreground border-border"
                  )}>x{m}</span>
                ))}
              </div>
            </div>
          )}

          <Button onClick={startGame} disabled={!bet || !currentConfig}
            className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:opacity-90 text-white font-black py-6 text-lg shadow-lg shadow-orange-500/30">
            🐔 НАЧАТЬ ИГРУ
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Game Board */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-card via-card/80 to-card border border-border p-3">
            {showExplosion && <ExplosionEffect />}
            
            {/* Road visualization */}
            <div className="flex flex-col-reverse gap-1.5">
              {MULTIPLIERS.map((mult, i) => {
                const isCompleted = i < currentStep;
                const isCurrent = i === currentStep && !gameOver;
                const isExplosion = i === explosionStep;
                const progressPct = STEPS > 0 ? ((i + 1) / STEPS) * 100 : 0;
                const dangerLevel = progressPct / 100;

                return (
                  <div key={i} className={cn(
                    "flex items-center gap-2 p-2 rounded-xl transition-all relative overflow-hidden",
                    isExplosion ? "bg-destructive/20 border-2 border-destructive/50 scale-[1.02]" :
                    isCompleted ? "bg-emerald-500/10 border border-emerald-500/20" :
                    isCurrent ? "bg-primary/10 border-2 border-primary/40" :
                    "bg-muted/20 border border-border/50"
                  )}>
                    {/* Step indicator */}
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0",
                      isExplosion ? "bg-destructive text-white" :
                      isCompleted ? "bg-emerald-500 text-white" :
                      isCurrent ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {isExplosion ? "💥" : isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>

                    {/* Chicken on current step */}
                    {isCurrent && !gameOver && (
                      <img src={chickenImg} alt="Chicken" className={cn(
                        "w-7 h-7 object-contain transition-transform",
                        chickenJump ? "scale-125 -translate-y-1.5" : "",
                        chickenWobble ? "animate-bounce" : ""
                      )} />
                    )}

                    {/* Danger bar */}
                    <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${dangerLevel * 100}%`,
                          background: isCompleted ? 'hsl(var(--success))' :
                            `linear-gradient(90deg, hsl(var(--success)), hsl(45, 100%, 51%), hsl(0, 84%, 60%))`,
                        }} />
                    </div>

                    {/* Multiplier */}
                    <span className={cn(
                      "font-black text-xs min-w-[40px] text-right",
                      isExplosion ? "text-destructive" :
                      isCompleted ? "text-emerald-400" :
                      isCurrent ? "text-primary" :
                      mult >= 5 ? "text-primary/60" :
                      "text-muted-foreground"
                    )}>x{mult}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-card/50 border border-border p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">Текущий</p>
              <p className="text-lg font-black text-emerald-400">x{getCurrentMultiplier().toFixed(2)}</p>
            </div>
            {!gameOver && currentStep < STEPS && (
              <div className="rounded-xl bg-card/50 border border-border p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Следующий</p>
                <p className="text-lg font-black text-primary">x{getNextMultiplier().toFixed(2)}</p>
              </div>
            )}
            {gameOver && wonResult && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Выигрыш</p>
                <p className="text-lg font-black text-emerald-400">+{wonResult.amount.toFixed(2)}₽</p>
              </div>
            )}
          </div>

          {/* Controls */}
          {!gameOver ? (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={takeStep} disabled={isAnimating}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg shadow-orange-500/20">
                <ArrowUp className="w-4 h-4 mr-1" /> Шаг
              </Button>
              <Button onClick={cashout} disabled={isAnimating || currentStep === 0} variant="outline"
                className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-bold">
                <Coins className="w-4 h-4 mr-1" /> Забрать
              </Button>
            </div>
          ) : (
            <Button onClick={resetGame}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold shadow-lg shadow-blue-500/20">
              🔄 Играть снова
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
