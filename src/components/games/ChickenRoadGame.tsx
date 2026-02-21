import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBalanceMode } from "@/hooks/useBalanceMode";
import { Flame, Footprints, CircleDot, Check, AlertTriangle, Wrench, Loader2 } from "lucide-react";
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

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium", 
  hard: "Hard",
  extreme: "Extreme",
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
  const { canAct } = useSpamProtection();
  
  // Load game config from database
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoadingConfig(true);
      const { data, error } = await supabase
        .from("chicken_road_config")
        .select("*");
      
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
      const { data } = await supabase
        .from("game_settings")
        .select("is_maintenance")
        .eq("game_name", "chicken-road")
        .single();
      setIsMaintenance(data?.is_maintenance || false);
    };
    checkMaintenance();
    
    const channel = supabase.channel("chicken-road-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_settings", filter: "game_name=eq.chicken-road" }, () => checkMaintenance())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const currentConfig = useMemo(() => {
    return gameConfigs.find(c => c.difficulty === difficulty);
  }, [gameConfigs, difficulty]);

  const MULTIPLIERS = currentConfig?.multipliers || [];
  const { useFreebet, useDemo } = useBalanceMode();
  const STEPS = MULTIPLIERS.length;
  
  const startGame = async () => {
    if (!canAct() || !currentConfig) return;

    const betAmount = parseFloat(bet);
    if (!betAmount || betAmount < 10 || betAmount > balance) {
      toast.error("Неверная ставка");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("play_chicken_road_server", {
        _user_id: userId,
        _bet_amount: betAmount,
        _difficulty: difficulty,
        _is_freebet: useFreebet,
        _is_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        return;
      }

      const response = data as any;
      if (!response?.success) {
        toast.error(response?.error || "Ошибка игры");
        return;
      }

      setSessionId(response.session_id);
      setLastGameNumber(response.game_number);
      setCurrentStep(0);
      setGameStarted(true);
      setGameOver(false);
      setShowExplosion(false);
      setExplosionStep(-1);
      onBalanceUpdate();
    } catch (error) {
      toast.error("Ошибка игры");
    }
  };

  const takeStep = async () => {
    if (!canAct() || !gameStarted || gameOver || isAnimating || !sessionId) return;

    setIsAnimating(true);
    
    // Jump animation
    setChickenJump(true);
    await new Promise(resolve => setTimeout(resolve, 150));
    setChickenJump(false);
    
    setChickenWobble(true);
    const legInterval = setInterval(() => {
      setLegFrame(prev => (prev + 1) % 4);
    }, 80);
    await new Promise(resolve => setTimeout(resolve, 300));
    clearInterval(legInterval);
    setLegFrame(0);

    try {
      const { data, error } = await supabase.rpc("chicken_road_step", {
        _user_id: userId,
        _session_id: sessionId,
      });

      if (error) {
        toast.error(error.message || "Ошибка");
        setIsAnimating(false);
        setChickenWobble(false);
        return;
      }

      const response = data as any;
      if (!response?.success) {
        toast.error(response?.error || "Ошибка");
        setIsAnimating(false);
        setChickenWobble(false);
        return;
      }

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
        toast.success(`🐔 Победа! +${response.win_amount.toFixed(2)}₽ (x${response.multiplier.toFixed(2)})`);
        onBalanceUpdate();
      }
    } catch (error) {
      toast.error("Ошибка");
    }
    
    setIsAnimating(false);
  };

  const cashout = async () => {
    if (!canAct() || !gameStarted || currentStep === 0 || isAnimating || !sessionId) return;

    try {
      const { data, error } = await supabase.rpc("chicken_road_cashout", {
        _user_id: userId,
        _session_id: sessionId,
      });

      if (error) {
        toast.error(error.message || "Ошибка");
        return;
      }

      const response = data as any;
      if (!response?.success) {
        toast.error(response?.error || "Ошибка");
        return;
      }

      setGameOver(true);
      toast.success(`🐔 Победа! +${response.win_amount.toFixed(2)}₽ (x${response.multiplier.toFixed(2)})`);
      onBalanceUpdate();
    } catch (error) {
      toast.error("Ошибка");
    }
  };

  const getCurrentMultiplier = () => {
    if (currentStep === 0) return 1;
    return MULTIPLIERS[currentStep - 1] || 1;
  };

  const getNextMultiplier = () => {
    if (currentStep >= STEPS) return MULTIPLIERS[STEPS - 1] || 1;
    return MULTIPLIERS[currentStep] || 1;
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setCurrentStep(0);
    setShowExplosion(false);
    setExplosionStep(-1);
    setSessionId(null);
  };

  // Explosion animation
  const ExplosionEffect = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-48 h-48 bg-gradient-radial from-yellow-300/90 via-orange-500/70 to-transparent rounded-full animate-ping" />
        <div className="absolute w-32 h-32 bg-gradient-radial from-white via-yellow-400 to-orange-600 rounded-full animate-pulse opacity-90" />
      </div>
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className="absolute" style={{
          left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 60}%`,
          animation: `ping ${0.3 + Math.random() * 0.5}s ease-out`, animationDelay: `${Math.random() * 0.2}s`,
        }}>
          <Flame className={cn(
            i % 4 === 0 ? "w-8 h-8 text-yellow-300" : i % 4 === 1 ? "w-6 h-6 text-orange-400" : 
            i % 4 === 2 ? "w-7 h-7 text-red-500" : "w-5 h-5 text-white"
          )} style={{ filter: 'drop-shadow(0 0 8px currentColor)' }} />
        </div>
      ))}
    </div>
  );

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900 border-slate-600/40 shadow-2xl shadow-slate-500/10 overflow-hidden">
      <CardHeader className="pb-2 border-b border-slate-600/30 bg-gradient-to-r from-slate-800/50 to-zinc-800/50">
        <CardTitle className="flex items-center gap-3 text-white">
          {lastGameNumber && (
            <span className="text-sm font-mono bg-yellow-500/20 px-2 py-1 rounded text-yellow-400">
              #{lastGameNumber}
            </span>
          )}
          <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl shadow-lg">
            <img src={chickenImg} alt="Chicken" className="w-6 h-6 object-contain" />
          </div>
          <span className="text-2xl font-black bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-300 bg-clip-text text-transparent tracking-tight">
            CHICKEN ROAD
          </span>
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">🔒 Server</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {isMaintenance ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="p-4 bg-orange-500/20 rounded-full"><Wrench className="w-12 h-12 text-orange-400" /></div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Технический перерыв</h3>
              <p className="text-slate-400">Игра временно недоступна.</p>
            </div>
          </div>
        ) : isLoadingConfig ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
            <p className="text-slate-400">Загрузка игры...</p>
          </div>
        ) : !gameStarted ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300/80 mb-2 block font-medium">Сложность</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((diff) => (
                  <button key={diff} onClick={() => setDifficulty(diff)}
                    className={cn(
                      "py-2 px-3 rounded-xl text-xs font-bold transition-all border-2",
                      difficulty === diff
                        ? diff === "easy" ? "bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/30"
                          : diff === "medium" ? "bg-gradient-to-br from-blue-500 to-cyan-600 border-blue-400 text-white shadow-lg shadow-blue-500/30"
                            : diff === "hard" ? "bg-gradient-to-br from-orange-500 to-red-600 border-orange-400 text-white shadow-lg shadow-orange-500/30"
                              : "bg-gradient-to-br from-purple-500 to-pink-600 border-purple-400 text-white shadow-lg shadow-purple-500/30"
                        : "bg-slate-800/50 border-slate-600/30 text-slate-300/80 hover:bg-slate-700/50"
                    )}
                  >
                    {DIFFICULTY_LABELS[diff]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-300/80 mb-2 block font-medium">Ставка (₽)</label>
              <Input type="number" value={bet} onChange={(e) => setBet(e.target.value)}
                placeholder="Введите ставку" min="10" max={balance}
                className="bg-slate-800/50 border-slate-600/30 text-white" />
            </div>

            {MULTIPLIERS.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-600/20">
                <p className="text-xs text-slate-400 mb-2">Множители:</p>
                <div className="flex flex-wrap gap-1">
                  {MULTIPLIERS.map((m, i) => (
                    <span key={i} className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-bold",
                      m >= 5 ? "bg-yellow-500/20 text-yellow-400" :
                      m >= 2 ? "bg-green-500/20 text-green-400" :
                      "bg-slate-600/30 text-slate-400"
                    )}>x{m}</span>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={startGame} disabled={!bet || !currentConfig}
              className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 hover:opacity-90 text-black font-black py-6 text-lg">
              🐔 НАЧАТЬ ИГРУ
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Game Board */}
            <div className="relative bg-gradient-to-b from-slate-800/60 to-slate-900/80 rounded-2xl p-4 border border-slate-600/30 min-h-[300px]">
              {showExplosion && <ExplosionEffect />}
              
              <div className="flex flex-col-reverse gap-2">
                {MULTIPLIERS.map((mult, i) => {
                  const isCompleted = i < currentStep;
                  const isCurrent = i === currentStep && !gameOver;
                  const isExplosion = i === explosionStep;
                  
                  return (
                    <div key={i} className={cn(
                      "flex items-center gap-3 p-2 rounded-lg transition-all",
                      isExplosion ? "bg-red-900/50 border border-red-500/50" :
                      isCompleted ? "bg-emerald-900/30 border border-emerald-500/30" :
                      isCurrent ? "bg-yellow-900/30 border border-yellow-500/50 animate-pulse" :
                      "bg-slate-800/30 border border-slate-700/30"
                    )}>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                        isExplosion ? "bg-red-500 text-white" :
                        isCompleted ? "bg-emerald-500 text-white" :
                        isCurrent ? "bg-yellow-500 text-black" :
                        "bg-slate-700 text-slate-400"
                      )}>
                        {isExplosion ? "💥" : isCompleted ? <Check className="w-4 h-4" /> : i + 1}
                      </div>
                      
                      {isCurrent && !gameOver && (
                        <img src={chickenImg} alt="Chicken" className={cn(
                          "w-8 h-8 object-contain transition-transform",
                          chickenJump ? "scale-125 -translate-y-2" : "",
                          chickenWobble ? "animate-bounce" : ""
                        )} />
                      )}
                      
                      <span className={cn(
                        "font-bold text-sm ml-auto",
                        isCompleted ? "text-emerald-400" :
                        isCurrent ? "text-yellow-400" :
                        "text-slate-500"
                      )}>x{mult}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Текущий: <span className="text-emerald-400 font-bold">x{getCurrentMultiplier().toFixed(2)}</span></span>
                {!gameOver && currentStep < STEPS && (
                  <span className="text-slate-400">Следующий: <span className="text-yellow-400 font-bold">x{getNextMultiplier().toFixed(2)}</span></span>
                )}
              </div>

              {!gameOver ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={takeStep} disabled={isAnimating}
                    className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold">
                    <Footprints className="w-4 h-4 mr-1" /> Шаг
                  </Button>
                  <Button onClick={cashout} disabled={isAnimating || currentStep === 0} variant="outline"
                    className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 font-bold">
                    💰 Забрать (x{getCurrentMultiplier().toFixed(2)})
                  </Button>
                </div>
              ) : (
                <Button onClick={resetGame}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold">
                  🔄 Играть снова
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
