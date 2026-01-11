import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface DiceGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

interface DiceConfig {
  min_target: number;
  max_target: number;
  house_edge: number;
}

export const DiceGame = ({ userId, balance, onBalanceUpdate }: DiceGameProps) => {
  const [bet, setBet] = useState("");
  const [prediction, setPrediction] = useState<"under" | "over">("under");
  const [target, setTarget] = useState("50");
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [config, setConfig] = useState<DiceConfig>({ min_target: 2, max_target: 98, house_edge: 0.10 });
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number: number; seed_hash: string } | null>(null);
  const { canAct } = useSpamProtection();
  const { useFreebet, useDemo } = useBalanceMode();

  // Load config from database
  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase
        .from("dice_config")
        .select("*")
        .limit(1)
        .single();
      if (data) {
        setConfig({
          min_target: data.min_target,
          max_target: data.max_target,
          house_edge: Number(data.house_edge)
        });
      }
    };
    loadConfig();
  }, []);

  const play = async () => {
    if (!canAct()) return;

    const betAmount = parseFloat(bet);
    const targetNum = parseInt(target);
    
    if (!betAmount || betAmount < 10) {
      toast.error("Минимальная ставка 10₽");
      return;
    }

    setRolling(true);

    try {
      const { data, error } = await supabase.rpc("play_dice_server", {
        _user_id: userId,
        _bet_amount: betAmount,
        _target: targetNum,
        _prediction: prediction,
        _is_freebet: useFreebet,
        _is_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        setRolling(false);
        return;
      }

      const response = data as {
        success: boolean;
        won: boolean;
        dice_result: number;
        multiplier: number;
        win_amount: number;
        game_number: number;
        seed_hash: string;
        error?: string;
      };

      if (!response?.success) {
        toast.error(response?.error || "Ошибка игры");
        setRolling(false);
        return;
      }

      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });
      setResult(response.dice_result);

      if (response.won) {
        const netProfit = response.win_amount - betAmount;
        toast.success(`Победа! +${netProfit.toFixed(2)}₽`);
      } else {
        toast.error(`Проигрыш! -${betAmount.toFixed(2)}₽`);
      }

      onBalanceUpdate();
    } catch (error) {
      console.error("Dice game error:", error);
      toast.error("Ошибка игры");
    } finally {
      setTimeout(() => {
        setRolling(false);
        setResult(null);
      }, 2000);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
          {lastGameInfo && lastGameInfo.game_number > 0 && (
            <span className="text-sm font-mono bg-primary/20 px-2 py-1 rounded text-primary">
              #{lastGameInfo.game_number}
            </span>
          )}
          🎲 Dice
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-center text-xs text-muted-foreground">
            Хэш: {lastGameInfo.seed_hash.slice(0, 16)}...
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground">Ставка (₽)</label>
          <Input
            type="number"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            placeholder="Введите ставку"
            min="10"
            max={balance}
            className="bg-input"
          />
        </div>
        
        <div>
          <label className="text-sm text-muted-foreground">Цель</label>
          <Input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            min="2"
            max="98"
            className="bg-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={prediction === "under" ? "default" : "outline"}
            onClick={() => setPrediction("under")}
            className={prediction === "under" ? "bg-gradient-gold" : ""}
          >
            Меньше {target}
          </Button>
          <Button
            variant={prediction === "over" ? "default" : "outline"}
            onClick={() => setPrediction("over")}
            className={prediction === "over" ? "bg-gradient-gold" : ""}
          >
            Больше {target}
          </Button>
        </div>

        <div className="relative h-64 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 rounded-xl flex items-center justify-center overflow-hidden border border-primary/20">
          {/* Background particles */}
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-primary/20 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 3}s`
                }}
              />
            ))}
          </div>

          {rolling ? (
            <div className="relative w-full h-full">
              {/* Много падающих кубиков */}
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-4xl"
                  style={{
                    left: `${10 + (i % 4) * 25}%`,
                    animation: `dice-fall 0.8s ease-in infinite`,
                    animationDelay: `${(i * 0.15) % 0.6}s`,
                    opacity: 0.7 + Math.random() * 0.3,
                  }}
                >
                  🎲
                </div>
              ))}
              {/* Главный крутящийся кубик */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-8xl animate-bounce" style={{ 
                  animation: 'dice-shake 0.15s ease-in-out infinite',
                }}>
                  🎲
                </div>
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
              </div>
              <style>{`
                @keyframes dice-fall {
                  0% { 
                    transform: translateY(-100px) rotate(0deg); 
                    opacity: 1;
                  }
                  100% { 
                    transform: translateY(300px) rotate(720deg); 
                    opacity: 0;
                  }
                }
                @keyframes dice-shake {
                  0%, 100% { transform: rotate(-15deg) scale(1.1); }
                  50% { transform: rotate(15deg) scale(0.9); }
                }
              `}</style>
            </div>
          ) : result ? (
            <div className="text-center relative z-10">
              <div className="text-9xl mb-4 relative" style={{
                animation: 'dice-land 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}>
                🎲
                {/* Result glow */}
                <div className={cn(
                  "absolute inset-0 blur-3xl animate-pulse",
                  (result < parseInt(target) && prediction === "under") || (result > parseInt(target) && prediction === "over")
                    ? "bg-primary/50"
                    : "bg-destructive/50"
                )} />
              </div>
              <div className={cn(
                "text-5xl font-black",
                (result < parseInt(target) && prediction === "under") || (result > parseInt(target) && prediction === "over")
                  ? "text-primary drop-shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]"
                  : "text-destructive drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              )} style={{ animation: 'fade-in 0.3s ease-out' }}>
                {result}
              </div>
              {/* Celebration particles for win */}
              {((result < parseInt(target) && prediction === "under") || (result > parseInt(target) && prediction === "over")) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {[...Array(16)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-3 h-3 bg-primary rounded-full"
                      style={{
                        animation: `explode-out 0.6s ease-out forwards`,
                        animationDelay: `${i * 0.03}s`,
                        transform: `rotate(${i * 22.5}deg)`,
                      }}
                    />
                  ))}
                </div>
              )}
              <style>{`
                @keyframes dice-land {
                  0% { transform: translateY(-50px) rotate(-180deg) scale(0.5); opacity: 0; }
                  60% { transform: translateY(10px) rotate(10deg) scale(1.1); }
                  100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
                }
                @keyframes explode-out {
                  0% { transform: rotate(inherit) translateX(0); opacity: 1; }
                  100% { transform: rotate(inherit) translateX(80px); opacity: 0; }
                }
              `}</style>
            </div>
          ) : (
            <div className="text-9xl opacity-20 relative">
              🎲
              <div className="absolute inset-0 bg-muted/10 rounded-full blur-2xl" />
            </div>
          )}
        </div>

        <Button
          onClick={play}
          disabled={rolling || !bet}
          className="w-full bg-gradient-gold hover:opacity-90 font-bold"
        >
          {rolling ? "Бросаем..." : "Бросить кости"}
        </Button>
      </CardContent>
    </Card>
  );
};
