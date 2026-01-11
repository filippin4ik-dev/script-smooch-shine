import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Wind, Sparkles } from "lucide-react";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface BalloonGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

export const BalloonGame = ({ userId, balance, onBalanceUpdate }: BalloonGameProps) => {
  const [bet, setBet] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [balloonSize, setBalloonSize] = useState(1.0);
  const [popped, setPopped] = useState(false);
  const [isInflating, setIsInflating] = useState(false);
  const [pumpCount, setPumpCount] = useState(0);
  const [wobble, setWobble] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number: number; seed_hash: string } | null>(null);
  const { canAct } = useSpamProtection();
  const { useFreebet, useDemo } = useBalanceMode();

  useEffect(() => {
    if (wobble) {
      const timer = setTimeout(() => setWobble(false), 300);
      return () => clearTimeout(timer);
    }
  }, [wobble]);

  const startGame = async () => {
    if (!canAct()) return;

    const betAmount = parseFloat(bet);
    if (!betAmount || betAmount < 10) {
      toast.error("Минимальная ставка 10₽");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("play_balloon", {
        _user_id: userId,
        _bet_amount: betAmount,
        _action: "start",
        _session_id: null,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка начала игры");
        return;
      }

      const response = data as {
        success: boolean;
        session_id: string;
        multiplier: number;
        game_number: number;
        seed_hash: string;
        message?: string;
      };

      if (!response || !response.success) {
        toast.error(response?.message || "Ошибка начала игры");
        return;
      }

      setSessionId(response.session_id);
      setGameStarted(true);
      setMultiplier(1.0);
      setBalloonSize(1.0);
      setPopped(false);
      setPumpCount(0);
      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });
      onBalanceUpdate();
    } catch (err) {
      toast.error("Ошибка соединения");
    }
  };

  const pump = async () => {
    if (!canAct() || !gameStarted || popped || isInflating || !sessionId) return;

    setIsInflating(true);
    setWobble(true);

    try {
      const { data, error } = await supabase.rpc("play_balloon", {
        _user_id: userId,
        _bet_amount: parseFloat(bet),
        _action: "pump",
        _session_id: sessionId,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        setIsInflating(false);
        return;
      }

      const response = data as {
        success: boolean;
        multiplier: number;
        popped: boolean;
        win_amount: number;
        game_number: number;
        seed_hash: string;
        message?: string;
      };

      if (!response || !response.success) {
        toast.error(response?.message || "Ошибка игры");
        setIsInflating(false);
        return;
      }

      setMultiplier(response.multiplier);
      setBalloonSize(1 + (response.multiplier - 1) * 0.2);
      setPumpCount(prev => prev + 1);
      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });

      if (response.popped) {
        setPopped(true);
        setBalloonSize(prev => prev * 1.5);
        toast.error(`Шар лопнул! -${parseFloat(bet).toFixed(2)}₽ (Игра #${response.game_number})`);
        onBalanceUpdate();
        setTimeout(() => resetGame(), 2000);
      }

      setIsInflating(false);
    } catch (err) {
      toast.error("Ошибка соединения");
      setIsInflating(false);
    }
  };

  const cashout = async () => {
    if (!canAct() || !gameStarted || popped || multiplier <= 1.0 || !sessionId) return;

    try {
      const { data, error } = await supabase.rpc("play_balloon", {
        _user_id: userId,
        _bet_amount: parseFloat(bet),
        _action: "cashout",
        _session_id: sessionId,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка вывода");
        return;
      }

      const response = data as {
        success: boolean;
        win_amount: number;
        game_number: number;
        seed_hash: string;
        message?: string;
      };

      if (!response || !response.success) {
        toast.error(response?.message || "Ошибка вывода");
        return;
      }

      toast.success(`Успешно! +${response.win_amount.toFixed(2)}₽ на ${multiplier.toFixed(2)}x (Игра #${response.game_number})`);
      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });
      onBalanceUpdate();
      setTimeout(() => resetGame(), 2000);
    } catch (err) {
      toast.error("Ошибка соединения");
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setPopped(false);
    setMultiplier(1.0);
    setBalloonSize(1.0);
    setPumpCount(0);
    setSessionId(null);
  };

  const getBalloonGradient = () => {
    if (multiplier < 1.5) return "from-emerald-400 via-green-500 to-teal-600";
    if (multiplier < 2.5) return "from-yellow-400 via-amber-500 to-orange-500";
    if (multiplier < 5) return "from-orange-400 via-red-500 to-rose-600";
    return "from-red-500 via-pink-600 to-purple-700";
  };

  const getBalloonShadow = () => {
    if (multiplier < 1.5) return "shadow-emerald-500/50";
    if (multiplier < 2.5) return "shadow-amber-500/50";
    if (multiplier < 5) return "shadow-red-500/50";
    return "shadow-pink-500/50";
  };

  return (
    <Card className="border-sky-500/30 bg-gradient-to-br from-sky-950 via-blue-950/80 to-indigo-950 shadow-2xl overflow-hidden">
      <CardHeader className="pb-2 border-b border-sky-500/20 bg-gradient-to-r from-sky-900/30 to-blue-900/30">
        <CardTitle className="text-2xl font-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            {lastGameInfo && lastGameInfo.game_number > 0 && (
              <span className="text-sm font-mono bg-sky-500/20 px-2 py-1 rounded text-sky-300">
                #{lastGameInfo.game_number}
              </span>
            )}
            <span className="text-4xl">🎈</span>
            <span className="bg-gradient-to-r from-sky-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
              BALLOON
            </span>
          </div>
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-xs text-sky-200/50 mt-1">
            Хэш: {lastGameInfo.seed_hash.slice(0, 24)}...
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {!gameStarted && (
          <div>
            <label className="text-sm text-sky-200/80 font-medium mb-2 block">Ставка (₽)</label>
            <Input
              type="number"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              placeholder="Введите ставку"
              min="10"
              max={balance}
              className="bg-sky-900/40 border-sky-500/40 h-12 text-lg font-bold text-white focus:border-sky-400"
            />
          </div>
        )}

        {/* Игровое поле */}
        <div className="relative h-[400px] rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600" />
          
          <div className="absolute top-6 right-6">
            <div className="relative">
              <div className="absolute inset-0 w-20 h-20 bg-yellow-300 rounded-full blur-xl opacity-60 animate-pulse" />
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-300 to-orange-400 shadow-2xl shadow-yellow-400/60" />
            </div>
          </div>
          
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white/80 rounded-full blur-[2px]"
              style={{
                width: `${60 + i * 20}px`,
                height: `${30 + i * 10}px`,
                left: `${(i * 18) % 100}%`,
                top: `${15 + (i * 12) % 40}%`,
                animation: `cloudFloat ${12 + i * 2}s ease-in-out infinite`,
                animationDelay: `${i * 1.2}s`
              }}
            />
          ))}
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className={cn(
                "relative transition-all duration-200 ease-out",
                wobble && "animate-wiggle"
              )}
              style={{
                transform: `scale(${balloonSize}) translateY(${-balloonSize * 15}px)`,
                opacity: popped ? 0 : 1,
              }}
            >
              <div 
                className={cn(
                  "relative w-32 h-40 rounded-full shadow-2xl transition-all duration-300",
                  `bg-gradient-to-br ${getBalloonGradient()}`,
                  getBalloonShadow()
                )}
                style={{
                  boxShadow: `0 20px 60px currentColor, inset -12px -12px 40px rgba(0,0,0,0.25), inset 8px 8px 20px rgba(255,255,255,0.3)`,
                }}
              >
                <div className="absolute top-5 left-6 w-12 h-16 bg-white/50 rounded-full blur-md" />
                <div className="absolute top-8 left-8 w-6 h-10 bg-white/70 rounded-full blur-sm" />
                <div className="absolute bottom-12 right-6 w-4 h-4 bg-white/40 rounded-full blur-sm" />
                <div 
                  className={cn(
                    "absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full shadow-lg",
                    `bg-gradient-to-br ${getBalloonGradient()}`
                  )}
                />
              </div>
              
              {!popped && (
                <svg 
                  className="absolute top-full left-1/2 -translate-x-1/2" 
                  width="30" 
                  height="100" 
                  viewBox="0 0 30 100"
                >
                  <path
                    d="M15 0 Q8 30 15 50 Q22 70 15 100"
                    fill="none"
                    stroke="#78350f"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="drop-shadow-sm"
                  />
                </svg>
              )}
            </div>
          </div>
          
          {popped && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="absolute w-80 h-80 bg-white/90 rounded-full animate-ping" style={{ animationDuration: '0.4s' }} />
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full border-4 border-white/60"
                  style={{
                    width: `${100 + i * 60}px`,
                    height: `${100 + i * 60}px`,
                    animation: 'ringExpand 0.8s ease-out forwards',
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
              <div className="text-8xl font-black animate-bounce drop-shadow-2xl z-10">💥</div>
            </div>
          )}
          
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20">
            <div 
              className={cn(
                "px-6 py-3 rounded-2xl shadow-2xl transition-all duration-300 border-2 border-white/20",
                `bg-gradient-to-br ${getBalloonGradient()}`
              )}
            >
              <div className="text-4xl font-black text-white drop-shadow-lg tabular-nums tracking-tight">
                {multiplier.toFixed(2)}x
              </div>
            </div>
          </div>

          {gameStarted && !popped && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
                <Wind className="w-4 h-4 text-white/80" />
                <span className="text-white font-bold">{pumpCount} качков</span>
              </div>
            </div>
          )}
        </div>

        {!gameStarted ? (
          <Button
            onClick={startGame}
            disabled={!bet}
            className="w-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 hover:from-sky-400 hover:via-blue-400 hover:to-indigo-500 font-bold text-lg py-6 shadow-xl shadow-blue-500/30 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Начать игру
          </Button>
        ) : !popped ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={pump}
              disabled={isInflating}
              className={cn(
                "w-full font-bold text-lg py-6 transition-all shadow-xl",
                "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/30",
                isInflating && "scale-95 opacity-80"
              )}
            >
              <Wind className="w-5 h-5 mr-2" />
              Надуть
            </Button>
            <Button
              onClick={cashout}
              disabled={multiplier <= 1.0}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 font-bold text-lg py-6 text-black shadow-xl shadow-amber-500/30"
            >
              💰 {(parseFloat(bet) * multiplier).toFixed(0)}₽
            </Button>
          </div>
        ) : null}
      </CardContent>

      <style>{`
        @keyframes cloudFloat {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(20px) translateY(-10px); }
        }
        @keyframes ringExpand {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
        .animate-wiggle {
          animation: wiggle 0.3s ease-in-out;
        }
      `}</style>
    </Card>
  );
};
