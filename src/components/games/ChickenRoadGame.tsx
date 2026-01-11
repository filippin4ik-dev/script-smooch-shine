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
import { useGamePersistence } from "@/hooks/useGamePersistence";

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
  const [traps, setTraps] = useState<boolean[]>([]);
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
  const { canAct } = useSpamProtection();
  
  // Game persistence
  const { loadState, saveState, clearState } = useGamePersistence<{
    bet: number;
    gameStarted: boolean;
    gameOver: boolean;
    currentMultiplier: number;
    currentStep: number;
    traps: boolean[];
    difficulty: Difficulty;
  }>("chicken-road", userId);

  // Restore game state on mount
  useEffect(() => {
    const savedState = loadState();
    if (savedState && savedState.gameStarted && !savedState.gameOver) {
      setBet(savedState.bet.toString());
      setGameStarted(true);
      setCurrentStep(savedState.currentStep);
      setTraps(savedState.traps);
      setDifficulty(savedState.difficulty);
      toast.info("Игра восстановлена");
    }
  }, [loadState]);

  // Clear state when game ends
  useEffect(() => {
    if (gameOver || !gameStarted) {
      clearState();
    }
  }, [gameOver, gameStarted, clearState]);

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

  // Get current config
  const currentConfig = useMemo(() => {
    return gameConfigs.find(c => c.difficulty === difficulty);
  }, [gameConfigs, difficulty]);

  const MULTIPLIERS = currentConfig?.multipliers || [];
  const TRAP_CHANCES = currentConfig?.trapChances || [];

  const { useFreebet, useDemo } = useBalanceMode();
  const STEPS = MULTIPLIERS.length;

  // Save game state on changes (after currentConfig is defined)
  useEffect(() => {
    if (gameStarted && !gameOver && currentConfig) {
      const multiplier = currentStep > 0 ? currentConfig.multipliers[currentStep - 1] : 1;
      saveState({
        bet: parseFloat(bet) || 0,
        gameStarted,
        gameOver,
        currentMultiplier: multiplier,
        currentStep,
        traps,
        difficulty,
      });
    }
  }, [gameStarted, gameOver, currentStep, traps, difficulty, bet, currentConfig, saveState]);
  
  const startGame = async () => {
    if (!canAct() || !currentConfig) return;

    const betAmount = parseFloat(bet);
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("guaranteed_max_win, freebet_balance")
      .eq("id", userId)
      .single();
    
    const availableBalance = useFreebet ? (profile?.freebet_balance || 0) : balance;
    
    if (!betAmount || betAmount < 10 || betAmount > availableBalance) {
      toast.error(useFreebet ? "Недостаточно фрибет баланса" : "Неверная ставка");
      return;
    }

    if (useFreebet) {
      await supabase
        .from("profiles")
        .update({ freebet_balance: Math.max(0, (profile?.freebet_balance || 0) - betAmount) })
        .eq("id", userId);
    } else {
      await supabase.rpc("update_balance", {
        user_id: userId,
        amount: -betAmount,
      });
    }

    // Генерируем ловушки - шансы для каждой ячейки берутся из БД
    const newTraps: boolean[] = [];
    
    for (let i = 0; i < STEPS; i++) {
      if (profile?.guaranteed_max_win) {
        newTraps.push(false);
      } else {
        // Шанс ловушки для каждой ячейки берётся из массива trap_chances в БД
        const trapChancePercent = (TRAP_CHANCES[i] || 0) * 100;
        newTraps.push(Math.random() * 100 < trapChancePercent);
      }
    }
    
    setTraps(newTraps);
    setCurrentStep(0);
    setGameStarted(true);
    setGameOver(false);
    setShowExplosion(false);
    setExplosionStep(-1);
    onBalanceUpdate();
  };

  const takeStep = async () => {
    if (!canAct() || !gameStarted || gameOver || isAnimating) return;

    setIsAnimating(true);
    
    // Jump animation
    setChickenJump(true);
    await new Promise(resolve => setTimeout(resolve, 150));
    setChickenJump(false);
    
    // Wobble during movement with leg animation
    setChickenWobble(true);
    
    // Animate legs during movement
    const legInterval = setInterval(() => {
      setLegFrame(prev => (prev + 1) % 4);
    }, 80);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    clearInterval(legInterval);
    setLegFrame(0);
    
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    setChickenWobble(false);
    
    if (traps[currentStep]) {
      setExplosionStep(currentStep);
      setShowExplosion(true);
      setGameOver(true);
      await endGame(true, nextStep);
    } else if (nextStep >= STEPS) {
      setGameOver(true);
      await endGame(false, STEPS);
    }
    
    setIsAnimating(false);
  };

  const cashout = async () => {
    if (!canAct() || !gameStarted || currentStep === 0 || isAnimating) return;
    await endGame(false, currentStep);
  };

  const endGame = async (lost: boolean, completedSteps: number) => {
    const betAmount = parseFloat(bet);
    const multiplier = lost ? 0 : MULTIPLIERS[completedSteps - 1] || 0;
    const winAmount = lost ? -betAmount : betAmount * multiplier - betAmount;

    try {
      await supabase.rpc("set_guaranteed_max_win", {
        _user_id: userId,
        _enabled: false,
      });

      if (useFreebet) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("freebet_balance")
          .eq("id", userId)
          .single();
        
        if (!lost) {
          await supabase
            .from("profiles")
            .update({ freebet_balance: Math.max(0, (currentProfile?.freebet_balance || 0) + betAmount * multiplier) })
            .eq("id", userId);
          
          const netProfit = betAmount * multiplier - betAmount;
          await supabase.rpc("update_wager_progress", {
            _user_id: userId,
            _bet_amount: netProfit,
          });
        }
      } else {
        await supabase.rpc("update_balance", {
          user_id: userId,
          amount: winAmount,
        });
      }

      await supabase.from("game_history").insert({
        user_id: userId,
        game_name: "chicken-road",
        bet_amount: betAmount,
        win_amount: lost ? 0 : betAmount * multiplier,
        multiplier,
      });

      await supabase.rpc("update_game_stats", {
        p_user_id: userId,
        p_won: !lost,
      });

      // XP за выигрыш
      if (!lost) {
        await supabase.rpc("add_user_xp", {
          _user_id: userId,
          _xp_amount: Math.max(1, Math.floor((betAmount * multiplier) / 10))
        });
      }

      if (lost) {
        toast.error(`💥 Курица попала в люк! -${betAmount.toFixed(2)}₽`);
      } else {
        toast.success(`🐔 Победа! +${(betAmount * multiplier).toFixed(2)}₽ (x${multiplier.toFixed(2)})`);
      }

      onBalanceUpdate();
    } catch (error) {
      toast.error("Ошибка игры");
    } finally {
      setGameOver(true);
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
    setTraps([]);
    setShowExplosion(false);
    setExplosionStep(-1);
  };

  // Explosion animation particles - ЯРКИЙ ВЗРЫВ
  const ExplosionEffect = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {/* Центральная вспышка */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-48 h-48 bg-gradient-radial from-yellow-300/90 via-orange-500/70 to-transparent rounded-full animate-ping" />
        <div className="absolute w-32 h-32 bg-gradient-radial from-white via-yellow-400 to-orange-600 rounded-full animate-pulse opacity-90" />
      </div>
      
      {/* Fire particles - больше и ярче */}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${20 + Math.random() * 60}%`,
            animation: `ping ${0.3 + Math.random() * 0.5}s ease-out`,
            animationDelay: `${Math.random() * 0.2}s`,
          }}
        >
          <Flame 
            className={cn(
              i % 4 === 0 ? "w-8 h-8 text-yellow-300" : 
              i % 4 === 1 ? "w-6 h-6 text-orange-400" : 
              i % 4 === 2 ? "w-7 h-7 text-red-500" : 
              "w-5 h-5 text-white"
            )}
            style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
          />
        </div>
      ))}
      
      {/* Искры - больше и ярче */}
      {Array.from({ length: 25 }).map((_, i) => (
        <div
          key={`spark-${i}`}
          className="absolute rounded-full animate-ping"
          style={{
            width: `${4 + Math.random() * 8}px`,
            height: `${4 + Math.random() * 8}px`,
            background: `radial-gradient(circle, ${
              i % 3 === 0 ? '#fff' : i % 3 === 1 ? '#fbbf24' : '#f97316'
            }, transparent)`,
            left: `${15 + Math.random() * 70}%`,
            top: `${15 + Math.random() * 70}%`,
            animationDelay: `${Math.random() * 0.3}s`,
            animationDuration: `${0.2 + Math.random() * 0.4}s`,
            boxShadow: `0 0 10px ${i % 3 === 0 ? '#fff' : i % 3 === 1 ? '#fbbf24' : '#f97316'}`,
          }}
        />
      ))}
      
      {/* Дым */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`smoke-${i}`}
          className="absolute rounded-full bg-slate-600/50 animate-pulse"
          style={{
            width: `${20 + Math.random() * 30}px`,
            height: `${20 + Math.random() * 30}px`,
            left: `${30 + Math.random() * 40}%`,
            top: `${30 + Math.random() * 40}%`,
            animationDelay: `${0.2 + Math.random() * 0.3}s`,
            filter: 'blur(4px)',
          }}
        />
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
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {isMaintenance ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="p-4 bg-orange-500/20 rounded-full">
              <Wrench className="w-12 h-12 text-orange-400" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Технический перерыв</h3>
              <p className="text-slate-400">Игра временно недоступна. Попробуйте позже.</p>
            </div>
          </div>
        ) : isLoadingConfig ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
            <p className="text-slate-400">Загрузка игры...</p>
          </div>
        ) : !gameStarted ? (
          <div className="space-y-4">
            {/* Выбор сложности */}
            <div>
              <label className="text-sm text-slate-300/80 mb-2 block font-medium">Сложность</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={cn(
                      "py-2 px-3 rounded-xl text-xs font-bold transition-all border-2",
                      difficulty === diff
                        ? diff === "easy" 
                          ? "bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/30"
                          : diff === "medium"
                            ? "bg-gradient-to-br from-blue-500 to-cyan-600 border-blue-400 text-white shadow-lg shadow-blue-500/30"
                            : diff === "hard"
                              ? "bg-gradient-to-br from-orange-500 to-red-600 border-orange-400 text-white shadow-lg shadow-orange-500/30"
                              : "bg-gradient-to-br from-purple-500 to-pink-600 border-purple-400 text-white shadow-lg shadow-purple-500/30"
                        : "bg-slate-800/50 border-slate-600/30 text-slate-300/80 hover:bg-slate-700/50"
                    )}
                  >
                    {DIFFICULTY_LABELS[diff]}
                  </button>
                ))}
              </div>
            </div>

            {/* Ставка */}
            <div>
              <label className="text-sm text-slate-300/80 mb-2 block font-medium">Ставка (₽)</label>
              <Input
                type="number"
                value={bet}
                onChange={(e) => setBet(e.target.value)}
                placeholder="Введите ставку"
                min="10"
                max={balance}
                className="bg-slate-800/50 border-slate-600/40 text-white h-12 text-lg focus:border-yellow-400 focus:ring-yellow-400/50"
              />
            </div>

            <Button
              onClick={startGame}
              disabled={!bet || !currentConfig}
              className="w-full h-14 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 hover:from-yellow-400 hover:via-amber-400 hover:to-orange-400 font-bold text-lg shadow-xl shadow-yellow-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] text-slate-900"
            >
              <Footprints className="w-5 h-5 mr-2" />
              Начать игру
            </Button>
            
            {/* Таблица коэффициентов */}
            <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-600/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Таблица выплат ({DIFFICULTY_LABELS[difficulty]})
                </span>
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {Math.round((TRAP_CHANCES[0] || 0) * 100)}% люки
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                {MULTIPLIERS.slice(0, 5).map((mult, i) => (
                  <div key={i} className="text-center bg-slate-900/60 rounded-xl p-2 border border-slate-700/30">
                    <div className="text-slate-500 font-bold">{i + 1}</div>
                    <div className="text-emerald-400 font-black text-xs">{mult.toFixed(2)}x</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[10px] mt-1.5">
                {MULTIPLIERS.slice(5, 10).map((mult, i) => (
                  <div key={i + 5} className="text-center bg-slate-900/60 rounded-xl p-2 border border-yellow-500/20">
                    <div className="text-slate-500 font-bold">{i + 6}</div>
                    <div className="text-yellow-400 font-black text-xs">{mult.toFixed(2)}x</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 relative">
            {/* Explosion overlay */}
            {showExplosion && <ExplosionEffect />}
            
            {/* Текущий статус */}
            <div className="flex justify-between items-center bg-gradient-to-r from-slate-800/60 to-zinc-800/60 rounded-2xl p-4 border border-slate-600/30">
              <div className="text-center">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Шаг</div>
                <div className="text-2xl font-black text-slate-200">{currentStep}/{STEPS}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-bold">Текущий</div>
                <div className="text-2xl font-black text-emerald-400">{getCurrentMultiplier().toFixed(2)}x</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-yellow-400/70 uppercase tracking-wider font-bold">Следующий</div>
                <div className="text-2xl font-black text-yellow-400">{getNextMultiplier().toFixed(2)}x</div>
              </div>
            </div>

            {/* Городская дорога с люками */}
            <div className="relative bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 rounded-2xl p-4 border border-slate-600/30 overflow-hidden">
              {/* Городской фон - асфальт */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0" style={{
                  backgroundImage: `repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 20px,
                    rgba(255,255,255,0.03) 20px,
                    rgba(255,255,255,0.03) 21px
                  ),
                  repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 20px,
                    rgba(255,255,255,0.03) 20px,
                    rgba(255,255,255,0.03) 21px
                  )`
                }} />
              </div>
              
              {/* Разметка дороги */}
              <div className="absolute left-0 right-0 top-1/2 h-1 bg-yellow-400/20 transform -translate-y-1/2" style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(250,204,21,0.3) 10px, rgba(250,204,21,0.3) 30px)'
              }} />

              {/* Дорога с ячейками */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 relative z-10">
                {/* 3D Курица с анимированными ногами */}
                <div 
                  className="flex-shrink-0"
                  style={{ 
                    transform: `translateX(${currentStep * 52}px) translateY(${chickenJump ? -24 : 0}px)`,
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    position: 'absolute',
                    left: '8px',
                    zIndex: 20
                  }}
                >
                  {/* Тень */}
                  {!showExplosion && (
                    <div 
                      className="absolute bottom-0 left-1/2 w-12 h-4 bg-black/40 rounded-full blur-md"
                      style={{ 
                        transform: `translateX(-50%) translateY(${chickenJump ? 12 : 4}px) scaleY(${chickenJump ? 0.4 : 0.8})`,
                        transition: 'transform 0.2s ease-out'
                      }}
                    />
                  )}
                  
                  {/* Курица 3D */}
                  <div className={cn(
                    "relative transition-all",
                    chickenWobble && "animate-pulse"
                  )}
                  style={{
                    transform: `rotate(${chickenWobble ? Math.sin(Date.now() / 50) * 5 : 0}deg)`,
                  }}>
                    {showExplosion ? (
                      <div className="w-16 h-16 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-radial from-yellow-400 via-orange-500 to-red-600 rounded-full animate-ping opacity-75" />
                        <div className="absolute inset-2 bg-gradient-radial from-white via-yellow-300 to-orange-500 rounded-full animate-pulse" />
                        <Flame className="w-10 h-10 text-white relative z-10" style={{ filter: 'drop-shadow(0 0 15px #ff6b35)' }} />
                      </div>
                    ) : (
                      <svg width="56" height="64" viewBox="0 0 56 64" className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
                        {/* Тело курицы - 3D эффект */}
                        <defs>
                          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fef3c7" />
                            <stop offset="30%" stopColor="#fcd34d" />
                            <stop offset="70%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#d97706" />
                          </linearGradient>
                          <linearGradient id="bodyHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
                            <stop offset="50%" stopColor="#fff" stopOpacity="0" />
                          </linearGradient>
                          <radialGradient id="beakGradient" cx="30%" cy="30%">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#ea580c" />
                          </radialGradient>
                          <linearGradient id="combGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fca5a5" />
                            <stop offset="50%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#b91c1c" />
                          </linearGradient>
                          <linearGradient id="legGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fdba74" />
                            <stop offset="100%" stopColor="#ea580c" />
                          </linearGradient>
                          <filter id="chickenShadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.3"/>
                          </filter>
                        </defs>
                        
                        {/* Ноги - анимированные */}
                        <g style={{ transformOrigin: '28px 50px' }}>
                          {/* Левая нога */}
                          <g style={{ 
                            transform: `rotate(${legFrame === 0 ? -15 : legFrame === 1 ? 0 : legFrame === 2 ? 15 : 0}deg)`,
                            transformOrigin: '20px 42px',
                            transition: 'transform 0.08s ease-in-out'
                          }}>
                            <path d="M20 42 L18 54 L14 58 M18 54 L20 58 M18 54 L22 58" 
                              stroke="url(#legGradient)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </g>
                          {/* Правая нога */}
                          <g style={{ 
                            transform: `rotate(${legFrame === 0 ? 15 : legFrame === 1 ? 0 : legFrame === 2 ? -15 : 0}deg)`,
                            transformOrigin: '36px 42px',
                            transition: 'transform 0.08s ease-in-out'
                          }}>
                            <path d="M36 42 L38 54 L34 58 M38 54 L40 58 M38 54 L42 58" 
                              stroke="url(#legGradient)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </g>
                        </g>
                        
                        {/* Тело */}
                        <ellipse cx="28" cy="32" rx="18" ry="16" fill="url(#bodyGradient)" filter="url(#chickenShadow)" />
                        <ellipse cx="26" cy="28" rx="12" ry="10" fill="url(#bodyHighlight)" />
                        
                        {/* Крылья */}
                        <ellipse cx="14" cy="32" rx="6" ry="10" fill="#d97706" opacity="0.8" 
                          style={{ 
                            transform: chickenWobble ? `rotate(${Math.sin(Date.now() / 100) * 10}deg)` : 'none',
                            transformOrigin: '18px 28px'
                          }} />
                        <ellipse cx="42" cy="32" rx="6" ry="10" fill="#d97706" opacity="0.8"
                          style={{ 
                            transform: chickenWobble ? `rotate(${-Math.sin(Date.now() / 100) * 10}deg)` : 'none',
                            transformOrigin: '38px 28px'
                          }} />
                        
                        {/* Голова */}
                        <circle cx="28" cy="16" r="10" fill="url(#bodyGradient)" filter="url(#chickenShadow)" />
                        <ellipse cx="26" cy="13" rx="6" ry="5" fill="url(#bodyHighlight)" />
                        
                        {/* Гребень */}
                        <path d="M24 6 Q26 2, 28 6 Q30 2, 32 6 Q34 3, 35 7 L35 10 Q32 8, 28 8 Q24 8, 21 10 L21 7 Q22 3, 24 6" 
                          fill="url(#combGradient)" />
                        
                        {/* Глаза */}
                        <circle cx="24" cy="14" r="3" fill="white" />
                        <circle cx="32" cy="14" r="3" fill="white" />
                        <circle cx="24.5" cy="14.5" r="1.5" fill="#1f2937" />
                        <circle cx="32.5" cy="14.5" r="1.5" fill="#1f2937" />
                        <circle cx="25" cy="13.5" r="0.5" fill="white" />
                        <circle cx="33" cy="13.5" r="0.5" fill="white" />
                        
                        {/* Клюв */}
                        <path d="M26 18 L28 22 L30 18 Z" fill="url(#beakGradient)" />
                        
                        {/* Бородка */}
                        <ellipse cx="28" cy="23" rx="2" ry="3" fill="#ef4444" />
                        
                        {/* Хвост */}
                        <g>
                          <path d="M44 26 Q52 20, 50 28 Q54 24, 52 32 Q56 28, 52 36 Q48 34, 46 36" 
                            fill="#92400e" />
                          <path d="M44 26 Q50 22, 49 29" stroke="#78350f" strokeWidth="1" fill="none" />
                        </g>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Ячейки дороги - красивые люки */}
                <div className="flex gap-1.5 ml-16">
                  {Array.from({ length: STEPS }).map((_, index) => {
                    const isPassed = index < currentStep;
                    const isTrap = traps[index];
                    const showTrap = gameOver && isTrap && index <= currentStep - 1;
                    const isExploded = gameOver && isTrap && index === currentStep - 1;
                    const isNext = index === currentStep && !gameOver;
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "w-12 h-16 rounded-xl flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden",
                          isExploded
                            ? "shadow-[0_0_40px_rgba(239,68,68,0.9),inset_0_0_20px_rgba(251,146,60,0.5)]"
                            : showTrap
                              ? "shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                              : isPassed && !isTrap
                                ? "shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                                : isNext
                                  ? "shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-pulse"
                                  : ""
                        )}
                      >
                        {/* Металлический люк */}
                        <div className={cn(
                          "absolute inset-0.5 rounded-lg transition-all duration-300",
                          isExploded
                            ? "bg-gradient-to-br from-red-500 via-orange-500 to-yellow-600"
                            : showTrap
                              ? "bg-gradient-to-br from-red-800 via-red-700 to-red-900"
                              : isPassed && !isTrap
                                ? "bg-gradient-to-br from-emerald-500 via-green-600 to-emerald-700"
                                : isNext
                                  ? "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700"
                                  : "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800"
                        )} />
                        
                        {/* Кольца люка */}
                        <div className={cn(
                          "absolute inset-1 rounded-lg border-2 transition-all",
                          isExploded
                            ? "border-yellow-300/80"
                            : showTrap
                              ? "border-red-500/60"
                              : isPassed && !isTrap
                                ? "border-emerald-300/60"
                                : isNext
                                  ? "border-yellow-400/50"
                                  : "border-slate-500/40"
                        )} />
                        <div className={cn(
                          "absolute inset-2 rounded-md border transition-all",
                          isExploded
                            ? "border-orange-300/60"
                            : showTrap
                              ? "border-red-400/40"
                              : isPassed && !isTrap
                                ? "border-green-300/40"
                                : isNext
                                  ? "border-yellow-300/30"
                                  : "border-slate-500/20"
                        )} />
                        
                        {/* Центральный элемент люка */}
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center relative z-10 transition-all",
                          isExploded
                            ? "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 shadow-[0_0_20px_rgba(251,146,60,0.8)]"
                            : showTrap
                              ? "bg-gradient-to-br from-red-600 to-red-800"
                              : isPassed && !isTrap
                                ? "bg-gradient-to-br from-emerald-400 to-green-600"
                                : isNext
                                  ? "bg-gradient-to-br from-slate-400 to-slate-600 border border-yellow-400/50"
                                  : "bg-gradient-to-br from-slate-500 to-slate-700"
                        )}>
                          {isExploded ? (
                            <div className="relative">
                              <Flame className="w-5 h-5 text-white animate-bounce" style={{ filter: 'drop-shadow(0 0 8px #ff6b35)' }} />
                              <div className="absolute inset-0 animate-ping opacity-75">
                                <Flame className="w-5 h-5 text-yellow-300" />
                              </div>
                            </div>
                          ) : showTrap ? (
                            <div className="relative">
                              <div className="w-4 h-4 rounded-full bg-red-900 border-2 border-red-500/80" />
                              <Flame className="w-3 h-3 text-orange-400 absolute -top-2 -right-1 animate-pulse" />
                            </div>
                          ) : isPassed ? (
                            <Check className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 0 4px #34d399)' }} />
                          ) : (
                            <div className={cn(
                              "w-3 h-3 rounded-full border-2",
                              isNext ? "border-yellow-400 bg-yellow-400/20" : "border-slate-400 bg-slate-600/50"
                            )} />
                          )}
                        </div>
                        
                        {/* Коэффициент */}
                        <span className={cn(
                          "text-[9px] font-bold mt-1 relative z-10",
                          isExploded ? "text-yellow-200" :
                          showTrap ? "text-red-300" :
                          isPassed ? "text-emerald-200" : 
                          isNext ? "text-yellow-300" : 
                          "text-slate-400"
                        )}>
                          {(MULTIPLIERS[index] || 0).toFixed(2)}x
                        </span>
                        
                        {/* Усиленный эффект огня при взрыве */}
                        {isExploded && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-t from-red-600/50 via-orange-500/30 to-transparent animate-pulse" />
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <Flame className="w-5 h-5 text-yellow-300 animate-bounce" style={{ filter: 'drop-shadow(0 0 6px #fbbf24)' }} />
                            </div>
                            <div className="absolute -top-2 left-0">
                              <Flame className="w-4 h-4 text-orange-400 animate-pulse" style={{ animationDelay: '0.1s' }} />
                            </div>
                            <div className="absolute -top-2 right-0">
                              <Flame className="w-4 h-4 text-red-400 animate-pulse" style={{ animationDelay: '0.15s' }} />
                            </div>
                            <div className="absolute -bottom-1 left-1">
                              <Flame className="w-3 h-3 text-orange-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
                            </div>
                            <div className="absolute -bottom-1 right-1">
                              <Flame className="w-3 h-3 text-red-500 animate-pulse" style={{ animationDelay: '0.25s' }} />
                            </div>
                          </>
                        )}
                        
                        {/* Болты на люке */}
                        {!isExploded && (
                          <>
                            <div className={cn(
                              "absolute top-1 left-1 w-1.5 h-1.5 rounded-full",
                              isPassed && !isTrap ? "bg-emerald-300/60" : showTrap ? "bg-red-400/60" : "bg-slate-400/40"
                            )} />
                            <div className={cn(
                              "absolute top-1 right-1 w-1.5 h-1.5 rounded-full",
                              isPassed && !isTrap ? "bg-emerald-300/60" : showTrap ? "bg-red-400/60" : "bg-slate-400/40"
                            )} />
                            <div className={cn(
                              "absolute bottom-3 left-1 w-1.5 h-1.5 rounded-full",
                              isPassed && !isTrap ? "bg-emerald-300/60" : showTrap ? "bg-red-400/60" : "bg-slate-400/40"
                            )} />
                            <div className={cn(
                              "absolute bottom-3 right-1 w-1.5 h-1.5 rounded-full",
                              isPassed && !isTrap ? "bg-emerald-300/60" : showTrap ? "bg-red-400/60" : "bg-slate-400/40"
                            )} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Кнопки */}
            {!gameOver && (
              <div className="flex gap-3">
                <Button 
                  onClick={takeStep}
                  disabled={isAnimating}
                  className="flex-1 h-14 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 font-bold text-lg shadow-xl shadow-yellow-500/30 transition-all text-slate-900"
                >
                  <Footprints className="w-5 h-5 mr-2" />
                  Шаг вперёд
                </Button>
                {currentStep > 0 && (
                  <Button 
                    onClick={cashout}
                    disabled={isAnimating}
                    className="flex-1 h-14 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg shadow-xl shadow-emerald-500/40 transition-all"
                  >
                    💰 Забрать {(parseFloat(bet) * getCurrentMultiplier()).toFixed(2)}₽
                  </Button>
                )}
              </div>
            )}

            {gameOver && (
              <Button 
                onClick={resetGame}
                className="w-full h-14 bg-gradient-to-r from-slate-600 via-slate-500 to-zinc-600 hover:from-slate-500 hover:via-slate-400 hover:to-zinc-500 font-bold text-lg transition-all text-white"
              >
                🔄 Играть снова
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
