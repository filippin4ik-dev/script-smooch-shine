import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBalanceMode } from "@/hooks/useBalanceMode";
import { cn } from "@/lib/utils";

interface PlinkoGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
  isMaintenance?: boolean;
}

const NUM_BINS = 11;
const NUM_ROWS = 12;
const PIN_GAP = 40;
const PIN_RADIUS = 5;
const BALL_RADIUS = 12;

// Server-side multipliers (must match DB)
const MULTIPLIERS = [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110];

const getMultiplierColor = (multiplier: number) => {
  if (multiplier === 0) return "from-gray-700 to-gray-900 text-white";
  if (multiplier <= 0.3) return "from-red-700 to-red-900 text-white";
  if (multiplier <= 0.5) return "from-red-500 to-red-700 text-white";
  if (multiplier <= 1) return "from-orange-500 to-orange-700 text-white";
  if (multiplier <= 1.5) return "from-yellow-500 to-yellow-700 text-black";
  if (multiplier <= 3) return "from-yellow-400 to-yellow-600 text-black";
  if (multiplier <= 5) return "from-green-500 to-green-700 text-white";
  if (multiplier <= 10) return "from-green-400 to-emerald-600 text-white";
  if (multiplier <= 41) return "from-blue-500 to-blue-700 text-white";
  return "from-purple-500 to-pink-600 text-white";
};

interface Ball {
  x: number;
  y: number;
  progress: number;
  id: number;
  resultIndex: number;
  path: number[];
}

export const PlinkoGame = ({ userId, balance, onBalanceUpdate, isMaintenance }: PlinkoGameProps) => {
  const [bet, setBet] = useState(10);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<{ multiplier: number; win: number } | null>(null);
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number?: number; seed_hash: string } | null>(null);
  const { useFreebet, useDemo } = useBalanceMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const ballIdRef = useRef(0);

  const boardWidth = (NUM_BINS + 1) * PIN_GAP;
  const boardHeight = (NUM_ROWS + 2) * PIN_GAP;

  const getPins = useCallback(() => {
    const pins: { x: number; y: number; row: number }[] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      const pinsInRow = row + 3;
      const rowWidth = (pinsInRow - 1) * PIN_GAP;
      const startX = (boardWidth - rowWidth) / 2;
      for (let col = 0; col < pinsInRow; col++) {
        pins.push({
          x: startX + col * PIN_GAP,
          y: (row + 1) * PIN_GAP,
          row,
        });
      }
    }
    return pins;
  }, [boardWidth]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setBalls(prevBalls => {
        const newBalls = prevBalls
          .map(ball => {
            const newProgress = ball.progress + 0.012;
            
            if (newProgress >= 1) {
              return null;
            }
            
            const easedProgress = easeOutBounce(newProgress);
            const startX = boardWidth / 2;
            const startY = BALL_RADIUS + 10;
            
            // Calculate position based on path
            let currentX = startX;
            const pathProgress = newProgress * ball.path.length;
            const currentStep = Math.floor(pathProgress);
            
            for (let i = 0; i < Math.min(currentStep, ball.path.length); i++) {
              currentX += ball.path[i] === 0 ? -PIN_GAP/2 : PIN_GAP/2;
            }
            
            const endX = (ball.resultIndex + 0.5) * (boardWidth / 17);
            const endY = boardHeight - PIN_GAP / 2;
            
            const zigzagAmplitude = 20 * (1 - newProgress);
            const zigzag = Math.sin(newProgress * Math.PI * 6) * zigzagAmplitude;
            
            return {
              ...ball,
              progress: newProgress,
              x: startX + (endX - startX) * easedProgress + zigzag,
              y: startY + (endY - startY) * easedProgress,
            };
          })
          .filter((ball): ball is Ball => ball !== null);
        
        if (newBalls.length === 0 && prevBalls.length > 0) {
          setIsPlaying(false);
        }
        
        return newBalls;
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [boardWidth, boardHeight]);

  const easeOutBounce = (x: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (x < 1 / d1) {
      return n1 * x * x;
    } else if (x < 2 / d1) {
      return n1 * (x -= 1.5 / d1) * x + 0.75;
    } else if (x < 2.5 / d1) {
      return n1 * (x -= 2.25 / d1) * x + 0.9375;
    } else {
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pins = getPins();
    
    ctx.clearRect(0, 0, boardWidth, boardHeight);

    pins.forEach(pin => {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, PIN_RADIUS, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(pin.x - 1, pin.y - 1, 0, pin.x, pin.y, PIN_RADIUS);
      gradient.addColorStop(0, '#fcd34d');
      gradient.addColorStop(1, '#f59e0b');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    balls.forEach(ball => {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 0, ball.x, ball.y, BALL_RADIUS);
      gradient.addColorStop(0, '#ff7b7b');
      gradient.addColorStop(0.7, '#ef4444');
      gradient.addColorStop(1, '#b91c1c');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(ball.x - 3, ball.y - 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    });
  }, [balls, getPins, boardWidth, boardHeight]);

  const dropBall = async () => {
    if (isPlaying || isMaintenance) return;

    if (bet <= 0) {
      toast.error("Минимальная ставка - 1₽");
      return;
    }

    setIsPlaying(true);

    try {
      const { data, error } = await supabase.rpc("play_plinko_server", {
        _user_id: userId,
        _bet_amount: bet,
        _is_freebet: useFreebet,
        _is_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        setIsPlaying(false);
        return;
      }

      const response = data as {
        success: boolean;
        multiplier: number;
        win_amount: number;
        path: number[];
        bin_index: number;
        seed_hash: string;
        game_number?: number;
        error?: string;
      };

      if (!response?.success) {
        toast.error(response?.error || "Ошибка игры");
        setIsPlaying(false);
        return;
      }

      const id = ++ballIdRef.current;
      
      const newBall: Ball = {
        id,
        x: boardWidth / 2,
        y: BALL_RADIUS + 10,
        progress: 0,
        resultIndex: response.bin_index,
        path: response.path,
      };

      setBalls(prev => [...prev, newBall]);
      setLastGameInfo(response.seed_hash ? { seed_hash: response.seed_hash, game_number: response.game_number } : null);

      // Show result after animation
      setTimeout(() => {
        setLastResult({ multiplier: response.multiplier, win: response.win_amount });
        
        if (response.multiplier === 0) {
          toast.error("💀 Полный слив!");
        } else if (response.win_amount > bet) {
          toast.success(`🎉 Выигрыш ${response.win_amount.toFixed(2)}₽! (x${response.multiplier})`);
        } else {
          toast.info(`Множитель x${response.multiplier}: ${response.win_amount.toFixed(2)}₽`);
        }
        
        onBalanceUpdate();
      }, 4000);

    } catch (error) {
      toast.error("Ошибка соединения");
      setIsPlaying(false);
    }
  };

  if (isMaintenance) {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardContent className="py-12 text-center">
          <div className="text-6xl mb-4">🔧</div>
          <h2 className="text-2xl font-bold text-yellow-500 mb-2">Технический перерыв</h2>
          <p className="text-muted-foreground">Plinko временно недоступен</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-to-b from-slate-900 to-slate-950 border-primary/30">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="text-3xl font-black text-center bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
          {lastGameInfo && lastGameInfo.game_number > 0 && (
            <span className="text-sm font-mono bg-yellow-500/20 px-2 py-1 rounded text-yellow-400">
              #{lastGameInfo.game_number}
            </span>
          )}
          🎯 Plinko
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-center text-xs text-muted-foreground">
            Хэш: {lastGameInfo.seed_hash.slice(0, 16)}...
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block text-muted-foreground">Ставка</label>
            <Input
              type="number"
              value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
              disabled={isPlaying}
              min={1}
              className="bg-background/50 border-primary/30"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBet(prev => Math.max(1, prev / 2))}
              disabled={isPlaying}
            >
              ½
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBet(prev => prev * 2)}
              disabled={isPlaying}
            >
              x2
            </Button>
          </div>
          <Button
            onClick={dropBall}
            disabled={isPlaying}
            className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-black font-bold px-6"
          >
            {isPlaying ? "🎱 Летит..." : "🎯 Бросить"}
          </Button>
        </div>

        {lastResult && (
          <div className={cn(
            "text-center py-2 px-4 rounded-lg animate-scale-in",
            lastResult.multiplier === 0 ? "bg-gray-500/20 border border-gray-500" :
            lastResult.win > bet ? "bg-green-500/20 border border-green-500" : "bg-red-500/20 border border-red-500"
          )}>
            <span className="font-bold">
              {lastResult.multiplier === 0 ? "💀 Слив!" : `Множитель: x${lastResult.multiplier} = ${lastResult.win.toFixed(2)}₽`}
            </span>
          </div>
        )}

        <div className="relative bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-xl p-4 border border-primary/20">
          <canvas
            ref={canvasRef}
            width={boardWidth}
            height={boardHeight}
            className="mx-auto block"
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
            }}
          />
          
          <div className="flex justify-between mt-2 px-1">
            {MULTIPLIERS.map((mult, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 mx-0.5 py-2 rounded text-center text-[9px] sm:text-xs font-bold bg-gradient-to-b",
                  getMultiplierColor(mult)
                )}
              >
                {mult === 0 ? "💀" : `${mult}x`}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          💡 Чем ближе к краю - тем выше множитель! x110 на краях
        </div>
      </CardContent>
    </Card>
  );
};