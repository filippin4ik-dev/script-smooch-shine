import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface PenaltyGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

const ZONES = [
  { id: "tl", row: 0, col: 0, multiplier: 2.5, label: "↖" },
  { id: "tm", row: 0, col: 1, multiplier: 3.0, label: "⬆" },
  { id: "tr", row: 0, col: 2, multiplier: 2.5, label: "↗" },
  { id: "ml", row: 1, col: 0, multiplier: 2.0, label: "⬅" },
  { id: "mm", row: 1, col: 1, multiplier: 5.0, label: "●" },
  { id: "mr", row: 1, col: 2, multiplier: 2.0, label: "➡" },
  { id: "bl", row: 2, col: 0, multiplier: 2.0, label: "↙" },
  { id: "bm", row: 2, col: 1, multiplier: 2.5, label: "⬇" },
  { id: "br", row: 2, col: 2, multiplier: 2.0, label: "↘" },
];

export const PenaltyGame = ({ userId, balance, onBalanceUpdate }: PenaltyGameProps) => {
  const [bet, setBet] = useState("");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [gameState, setGameState] = useState<"idle" | "kicking" | "diving" | "result">("idle");
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 95 });
  const [ballScale, setBallScale] = useState(1);
  const [goalkeeperZone, setGoalkeeperZone] = useState<string | null>(null);
  const [goalkeeperPosition, setGoalkeeperPosition] = useState({ x: 50, y: 50 });
  const [goalkeeperRotation, setGoalkeeperRotation] = useState(0);
  const [result, setResult] = useState<{ won: boolean; winAmount: number } | null>(null);
  const [showTrail, setShowTrail] = useState(false);
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number: number; seed_hash: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { useFreebet, useDemo } = useBalanceMode();

  const getZonePosition = (zoneId: string) => {
    const zone = ZONES.find(z => z.id === zoneId);
    if (!zone) return { x: 50, y: 50 };
    
    const xPositions = [20, 50, 80];
    const yPositions = [25, 45, 65];
    
    return {
      x: xPositions[zone.col],
      y: yPositions[zone.row],
    };
  };

  const shoot = async (zoneId: string) => {
    if (isProcessing || gameState !== "idle") return;

    const betAmount = parseFloat(bet);
    if (!betAmount || betAmount < 10) {
      toast.error("Минимальная ставка 10₽");
      return;
    }

    setIsProcessing(true);
    setSelectedZone(zoneId);
    setGameState("kicking");
    setShowTrail(true);

    try {
      const { data, error } = await supabase.rpc("play_penalty_server", {
        _user_id: userId,
        _bet_amount: betAmount,
        _zone_id: zoneId,
        _is_freebet: useFreebet,
        _is_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        resetGame();
        setIsProcessing(false);
        return;
      }

      const response = data as {
        success: boolean;
        won: boolean;
        goalkeeper_zone: string;
        multiplier: number;
        win_amount: number;
        game_number: number;
        seed_hash: string;
        error?: string;
      };

      if (!response?.success) {
        toast.error(response?.error || "Ошибка игры");
        resetGame();
        setIsProcessing(false);
        return;
      }

      setLastGameInfo(response.game_number ? { game_number: response.game_number, seed_hash: response.seed_hash } : null);

      // Animate ball
      const targetPos = getZonePosition(zoneId);
      await new Promise(r => setTimeout(r, 300));
      setBallPosition(targetPos);
      setBallScale(0.6);

      // Goalkeeper dives
      setTimeout(() => {
        setGameState("diving");
        setGoalkeeperZone(response.goalkeeper_zone);
        const gkPos = getZonePosition(response.goalkeeper_zone);
        setGoalkeeperPosition(gkPos);
        
        const gkZone = ZONES.find(z => z.id === response.goalkeeper_zone);
        if (gkZone?.col === 0) {
          setGoalkeeperRotation(-25);
        } else if (gkZone?.col === 2) {
          setGoalkeeperRotation(25);
        } else {
          setGoalkeeperRotation(0);
        }
      }, 200);

      // Show result
      setTimeout(() => {
        setResult({ won: response.won, winAmount: response.win_amount });
        setGameState("result");
        setShowTrail(false);

        if (response.won) {
          toast.success(`⚽ ГОЛ! +${response.win_amount.toFixed(2)}₽ (${response.multiplier}x)`);
        } else {
          toast.error(`🧤 СЕЙВ! -${betAmount.toFixed(2)}₽`);
        }

        onBalanceUpdate();
      }, 1000);

      // Reset
      setTimeout(() => {
        resetGame();
        setIsProcessing(false);
      }, 3500);

    } catch (error) {
      toast.error("Ошибка соединения");
      resetGame();
      setIsProcessing(false);
    }
  };

  const resetGame = () => {
    setGameState("idle");
    setResult(null);
    setSelectedZone(null);
    setGoalkeeperZone(null);
    setBallPosition({ x: 50, y: 95 });
    setBallScale(1);
    setGoalkeeperPosition({ x: 50, y: 50 });
    setGoalkeeperRotation(0);
  };

  return (
    <Card className="border-border/50 bg-gradient-card backdrop-blur-xl shadow-neon-blue overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl text-center bg-gradient-primary bg-clip-text text-transparent font-black flex items-center justify-center gap-2">
          {lastGameInfo && lastGameInfo.game_number > 0 && (
            <span className="text-sm font-mono bg-primary/20 px-2 py-1 rounded text-primary">
              #{lastGameInfo.game_number}
            </span>
          )}
          ⚽ Пенальти
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-center text-xs text-muted-foreground">
            Хэш: {lastGameInfo.seed_hash.slice(0, 16)}...
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {gameState === "idle" && (
          <div>
            <label className="text-sm text-muted-foreground font-medium mb-2 block">
              Ставка (₽)
            </label>
            <Input
              type="number"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              placeholder="Введите ставку"
              min="10"
              max={balance}
              className="bg-input border-primary/30 h-12 text-lg font-bold"
            />
          </div>
        )}

        {/* Football field */}
        <div className="relative aspect-[4/3] bg-gradient-to-b from-green-600 via-green-700 to-green-800 rounded-xl overflow-hidden border-2 border-primary/30">
          {/* Grass stripes */}
          <div className="absolute inset-0 opacity-20">
            {Array.from({ length: 8 }).map((_, i) => (
              <div 
                key={i}
                className="h-[12.5%]"
                style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.1)' : 'transparent' }}
              />
            ))}
          </div>

          {/* Goal */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[85%] aspect-[2.5/1]">
            <div className="absolute inset-0 border-4 border-white rounded-t-lg shadow-lg">
              <div className="absolute inset-0 opacity-40">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="net" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 0 0 L 20 20 M 20 0 L 0 20" stroke="white" strokeWidth="0.5" fill="none"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#net)"/>
                </svg>
              </div>

              <div className="absolute inset-1 grid grid-cols-3 grid-rows-3 gap-1">
                {ZONES.map((zone) => {
                  const isCovered = goalkeeperZone === zone.id;
                  const isSelected = selectedZone === zone.id;
                  
                  return (
                    <button
                      key={zone.id}
                      onClick={() => shoot(zone.id)}
                      disabled={gameState !== "idle" || !bet || isProcessing}
                      className={cn(
                        "relative rounded transition-all duration-200 text-2xl font-bold flex items-center justify-center",
                        "bg-black/20 hover:bg-primary/40 hover:scale-105",
                        "disabled:hover:scale-100 disabled:cursor-not-allowed",
                        isSelected && "bg-primary/60 ring-2 ring-yellow-400",
                        isCovered && gameState !== "idle" && "bg-red-500/60"
                      )}
                    >
                      <span className="text-white/80">{zone.label}</span>
                      <span className="absolute bottom-0.5 right-1 text-[9px] font-black text-yellow-300 bg-black/50 px-1 rounded">
                        {zone.multiplier}x
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="absolute -left-2 top-0 bottom-0 w-3 bg-gradient-to-r from-gray-200 to-white rounded-full shadow-md" />
            <div className="absolute -right-2 top-0 bottom-0 w-3 bg-gradient-to-l from-gray-200 to-white rounded-full shadow-md" />
            <div className="absolute -top-2 -left-2 -right-2 h-3 bg-gradient-to-b from-white to-gray-200 rounded-full shadow-md" />
          </div>

          {/* Goalkeeper */}
          <div
            className={cn(
              "absolute w-16 h-20 transition-all",
              gameState === "diving" && "duration-500",
              gameState === "idle" && "duration-300"
            )}
            style={{
              left: `calc(${goalkeeperPosition.x}% - 32px)`,
              top: `calc(${goalkeeperPosition.y * 0.5 + 8}% - 40px)`,
              transform: `rotate(${goalkeeperRotation}deg)`,
            }}
          >
            <div className="relative w-full h-full">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 bg-amber-200 rounded-full border-2 border-amber-400">
                <div className="absolute top-2 left-1.5 w-1.5 h-1.5 bg-gray-800 rounded-full" />
                <div className="absolute top-2 right-1.5 w-1.5 h-1.5 bg-gray-800 rounded-full" />
              </div>
              
              <div className="absolute top-7 left-1/2 -translate-x-1/2 w-10 h-8 bg-yellow-400 rounded-lg border-2 border-yellow-600">
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-600 rounded-full" />
              </div>
              
              <div 
                className={cn(
                  "absolute top-8 -left-3 text-2xl transition-all duration-300",
                  (gameState === "diving" || gameState === "result") && goalkeeperRotation < 0 && "-translate-x-2 -translate-y-4"
                )}
              >
                🧤
              </div>
              <div 
                className={cn(
                  "absolute top-8 -right-3 text-2xl scale-x-[-1] transition-all duration-300",
                  (gameState === "diving" || gameState === "result") && goalkeeperRotation > 0 && "translate-x-2 -translate-y-4"
                )}
              >
                🧤
              </div>
              
              <div className="absolute top-14 left-2 w-2.5 h-5 bg-gray-800 rounded-b-lg" />
              <div className="absolute top-14 right-2 w-2.5 h-5 bg-gray-800 rounded-b-lg" />
            </div>
          </div>

          {/* Ball trail */}
          {showTrail && (
            <div 
              className="absolute w-1 h-20 bg-gradient-to-t from-white/0 via-white/30 to-white/0 blur-sm"
              style={{
                left: `${ballPosition.x}%`,
                top: `${ballPosition.y + 15}%`,
                transform: 'translateX(-50%)',
              }}
            />
          )}

          {/* Ball */}
          <div
            className={cn(
              "absolute transition-all z-10",
              gameState === "kicking" && "duration-700 ease-out",
              gameState !== "kicking" && "duration-300"
            )}
            style={{
              left: `calc(${ballPosition.x}% - 20px)`,
              top: `calc(${ballPosition.y}% - 20px)`,
              transform: `scale(${ballScale})`,
            }}
          >
            <div className={cn(
              "w-10 h-10 text-4xl",
              gameState === "kicking" && "animate-spin"
            )}>
              ⚽
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20 animate-fade-in">
              <div className={cn(
                "text-center space-y-3 animate-scale-in p-6 rounded-2xl",
                result.won 
                  ? "bg-gradient-to-br from-green-500/30 to-emerald-600/30 border-2 border-green-400" 
                  : "bg-gradient-to-br from-red-500/30 to-rose-600/30 border-2 border-red-400"
              )}>
                <div className="text-7xl">
                  {result.won ? "⚽" : "🧤"}
                </div>
                <div className={cn(
                  "text-3xl font-black",
                  result.won ? "text-green-400" : "text-red-400"
                )}>
                  {result.won ? "ГОЛ!" : "СЕЙВ!"}
                </div>
                {result.won && (
                  <div className="text-xl font-bold text-yellow-400">
                    +{result.winAmount.toFixed(2)}₽
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hint */}
          {gameState === "idle" && bet && (
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="text-sm text-white/80 bg-black/40 px-3 py-1 rounded-full">
                Выберите зону для удара
              </span>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          💡 Вратарь прыгает в случайную зону
        </div>
      </CardContent>
    </Card>
  );
};
