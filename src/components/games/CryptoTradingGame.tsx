import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";
import { useBalanceMode } from "@/hooks/useBalanceMode";
import { TrendingUp, TrendingDown, Minus, Bitcoin, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";

interface ChartPoint {
  x: number;
  y: number;
  price: number;
}

type BetType = "long" | "short" | "flat" | null;
type Outcome = "up" | "down" | "flat" | null;

const BASE_BTC_PRICE = 91500;
const PRICE_RANGE = 3000;

export const CryptoTradingGame = () => {
  const { user } = useTelegramAuth();
  const { profile, refetch: refreshProfile } = useProfile(user?.id);
  const { useFreebet, useDemo } = useBalanceMode();

  const [betAmount, setBetAmount] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBet, setCurrentBet] = useState<BetType>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [bitcoinPrice, setBitcoinPrice] = useState(BASE_BTC_PRICE + Math.random() * 1000 - 500);
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [animationPhase, setAnimationPhase] = useState<"idle" | "building" | "result">("idle");
  const [resultMessage, setResultMessage] = useState("");
  const [winAmount, setWinAmount] = useState(0);
  const [currentTrend, setCurrentTrend] = useState<"up" | "down" | "neutral">("neutral");
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number: number; seed_hash: string } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: gameSettings } = useQuery({
    queryKey: ["game-settings", "crypto"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_settings")
        .select("*")
        .eq("game_name", "crypto")
        .maybeSingle();
      return data;
    },
  });

  const isMaintenance = gameSettings?.is_maintenance || gameSettings?.status === "maintenance";
  const minBet = gameSettings?.min_bet || 10;
  const maxBet = gameSettings?.max_bet || 10000;

  useEffect(() => {
    const initialPrice = BASE_BTC_PRICE + Math.random() * 1000 - 500;
    setBitcoinPrice(initialPrice);
    generateIdleChart(initialPrice);
  }, []);

  const generateIdleChart = (startPrice: number) => {
    const points: ChartPoint[] = [];
    let price = startPrice;
    const minY = 50;
    const maxY = 250;
    
    for (let x = 0; x <= 400; x += 3) {
      const volatility = 150 + Math.random() * 100;
      const direction = Math.random() > 0.5 ? 1 : -1;
      price += direction * volatility * (0.3 + Math.random() * 0.7);
      price = Math.max(BASE_BTC_PRICE - PRICE_RANGE/2, Math.min(BASE_BTC_PRICE + PRICE_RANGE/2, price));
      const y = maxY - ((price - (BASE_BTC_PRICE - PRICE_RANGE/2)) / PRICE_RANGE) * (maxY - minY);
      points.push({ x, y, price });
    }
    setChartPoints(points);
  };

  const drawChart = useCallback((points: ChartPoint[], currentOutcome?: Outcome) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, "rgba(0, 0, 0, 0.4)");
    bgGradient.addColorStop(1, "rgba(0, 0, 0, 0.7)");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const scaleX = width / 400;
    const scaleY = height / 300;

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    
    const priceLabels = [
      BASE_BTC_PRICE + PRICE_RANGE/2,
      BASE_BTC_PRICE + PRICE_RANGE/4,
      BASE_BTC_PRICE,
      BASE_BTC_PRICE - PRICE_RANGE/4,
      BASE_BTC_PRICE - PRICE_RANGE/2
    ];
    
    priceLabels.forEach((price, i) => {
      const y = (50 + i * 50) * scaleY;
      ctx.fillText(`$${price.toLocaleString()}`, width - 8, y);
      
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width - 80, y);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    const firstPrice = points[0]?.price || BASE_BTC_PRICE;
    const lastPrice = points[points.length - 1]?.price || BASE_BTC_PRICE;
    const priceDiff = lastPrice - firstPrice;
    
    let lineColor: string;
    let glowColor: string;
    
    if (currentOutcome === "flat" || Math.abs(priceDiff) < 30) {
      lineColor = "#facc15";
      glowColor = "rgba(250, 204, 21, 0.6)";
      setCurrentTrend("neutral");
    } else if (priceDiff > 0) {
      lineColor = "#22c55e";
      glowColor = "rgba(34, 197, 94, 0.6)";
      setCurrentTrend("up");
    } else {
      lineColor = "#ef4444";
      glowColor = "rgba(239, 68, 68, 0.6)";
      setCurrentTrend("down");
    }

    const scaledPoints = points.map(p => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
      price: p.price
    }));

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    for (let i = 1; i < scaledPoints.length; i++) {
      ctx.lineTo(scaledPoints[i].x, scaledPoints[i].y);
    }
    ctx.stroke();

    ctx.shadowBlur = 0;
    const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
    if (currentOutcome === "flat" || Math.abs(priceDiff) < 30) {
      fillGradient.addColorStop(0, "rgba(250, 204, 21, 0.25)");
      fillGradient.addColorStop(1, "rgba(250, 204, 21, 0)");
    } else if (priceDiff > 0) {
      fillGradient.addColorStop(0, "rgba(34, 197, 94, 0.25)");
      fillGradient.addColorStop(1, "rgba(34, 197, 94, 0)");
    } else {
      fillGradient.addColorStop(0, "rgba(239, 68, 68, 0.25)");
      fillGradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    }

    ctx.fillStyle = fillGradient;
    ctx.beginPath();
    ctx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    for (let i = 1; i < scaledPoints.length; i++) {
      ctx.lineTo(scaledPoints[i].x, scaledPoints[i].y);
    }
    ctx.lineTo(scaledPoints[scaledPoints.length - 1].x, height);
    ctx.lineTo(scaledPoints[0].x, height);
    ctx.closePath();
    ctx.fill();

    const lastPoint = scaledPoints[scaledPoints.length - 1];
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    const priceText = `$${points[points.length - 1].price.toFixed(0)}`;
    ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const textWidth = ctx.measureText(priceText).width;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.roundRect(lastPoint.x + 8, lastPoint.y - 10, textWidth + 8, 20, 4);
    ctx.fill();
    
    ctx.fillStyle = lineColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(priceText, lastPoint.x + 12, lastPoint.y);
  }, []);

  useEffect(() => {
    drawChart(chartPoints, outcome);
  }, [chartPoints, outcome, drawChart]);

  const animateOutcome = async (serverOutcome: Outcome, amt: number, winAmt: number, gameNum: number, seedHash: string) => {
    setAnimationPhase("building");
    
    const startPrice = bitcoinPrice;
    const minY = 50;
    const maxY = 250;
    
    let targetPrice: number;
    if (serverOutcome === "up") {
      targetPrice = startPrice + 800 + Math.random() * 700;
    } else if (serverOutcome === "down") {
      targetPrice = startPrice - 800 - Math.random() * 700;
    } else {
      targetPrice = startPrice + (Math.random() - 0.5) * 30;
    }

    const points: ChartPoint[] = [];
    let currentPrice = startPrice;
    const totalSteps = 80;
    const xStep = 320 / totalSteps;
    
    const fluctuationSteps = Math.floor(totalSteps * 0.6);
    
    for (let i = 0; i <= fluctuationSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 35));
      
      const x = i * xStep;
      const volatility = 180 + Math.random() * 120;
      const direction = Math.random() > 0.5 ? 1 : -1;
      currentPrice += direction * volatility * (0.4 + Math.random() * 0.6);
      currentPrice = Math.max(BASE_BTC_PRICE - PRICE_RANGE/2, Math.min(BASE_BTC_PRICE + PRICE_RANGE/2, currentPrice));
      
      const y = maxY - ((currentPrice - (BASE_BTC_PRICE - PRICE_RANGE/2)) / PRICE_RANGE) * (maxY - minY);
      points.push({ x, y, price: currentPrice });
      setChartPoints([...points]);
      setBitcoinPrice(currentPrice);
    }

    const sharpSteps = totalSteps - fluctuationSteps;
    
    for (let i = 1; i <= sharpSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 35));
      
      const x = (fluctuationSteps + i) * xStep;
      
      if (serverOutcome === "flat") {
        currentPrice = startPrice + (Math.random() - 0.5) * 5;
      } else {
        const progress = i / sharpSteps;
        const easing = progress * progress;
        currentPrice = startPrice + (targetPrice - startPrice) * easing + (Math.random() - 0.5) * 20;
      }
      
      currentPrice = Math.max(BASE_BTC_PRICE - PRICE_RANGE, Math.min(BASE_BTC_PRICE + PRICE_RANGE, currentPrice));
      const y = maxY - ((currentPrice - (BASE_BTC_PRICE - PRICE_RANGE/2)) / PRICE_RANGE) * (maxY - minY);
      points.push({ x, y, price: currentPrice });
      setChartPoints([...points]);
      setBitcoinPrice(currentPrice);
    }

    setOutcome(serverOutcome);
    setAnimationPhase("result");

    let message = "";
    if (winAmt > 0) {
      const multiplier = winAmt / amt;
      message = `✅ ${serverOutcome === "up" ? "Рост!" : serverOutcome === "down" ? "Падение!" : "FLAT!"} Выигрыш ${winAmt.toFixed(2)}₽ (${multiplier}x) (Игра #${gameNum})`;
      toast.success(message);
    } else {
      message = serverOutcome === "flat" 
        ? `❌ FLAT - ставка не сыграла (Игра #${gameNum})`
        : `❌ ${serverOutcome === "up" ? "Рост" : "Падение"} - проигрыш (Игра #${gameNum})`;
      toast.error(message);
    }

    setWinAmount(winAmt);
    setResultMessage(message);
    setLastGameInfo({ game_number: gameNum, seed_hash: seedHash });

    await refreshProfile();
    
    setTimeout(() => {
      setIsPlaying(false);
      setCurrentBet(null);
      setOutcome(null);
      setAnimationPhase("idle");
      setResultMessage("");
      setWinAmount(0);
      const newPrice = BASE_BTC_PRICE + Math.random() * 1000 - 500;
      setBitcoinPrice(newPrice);
      generateIdleChart(newPrice);
    }, 3000);
  };

  const placeBet = async (betType: BetType) => {
    if (!user?.id || !profile || isPlaying) return;

    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Введите сумму ставки");
      return;
    }

    if (amt < minBet) {
      toast.error(`Минимальная ставка: ${minBet}₽`);
      return;
    }

    if (amt > maxBet) {
      toast.error(`Максимальная ставка: ${maxBet}₽`);
      return;
    }

    setIsPlaying(true);
    setCurrentBet(betType);

    try {
      const { data, error } = await supabase.rpc("play_crypto_trading", {
        _user_id: user.id,
        _bet_amount: amt,
        _bet_type: betType,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        setIsPlaying(false);
        setCurrentBet(null);
        return;
      }

      const response = data as {
        success: boolean;
        outcome: string;
        win_amount: number;
        game_number: number;
        seed_hash: string;
        message?: string;
      };

      if (!response || !response.success) {
        toast.error(response?.message || "Ошибка игры");
        setIsPlaying(false);
        setCurrentBet(null);
        return;
      }

      // Set game info immediately to show game number
      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });

      // DO NOT refresh balance here - wait until animation ends
      animateOutcome(response.outcome as Outcome, amt, response.win_amount, response.game_number, response.seed_hash);
    } catch (err) {
      toast.error("Ошибка соединения");
      setIsPlaying(false);
      setCurrentBet(null);
    }
  };

  if (isMaintenance) {
    return (
      <Card className="border-yellow-500/30 bg-card/80 backdrop-blur">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
          <h3 className="text-xl font-bold text-yellow-500 mb-2">Технический перерыв</h3>
          <p className="text-muted-foreground">Crypto Trading временно недоступен</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-950/50 via-background to-orange-950/30 overflow-hidden">
        <CardHeader className="pb-2 border-b border-amber-500/20">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            {lastGameInfo && lastGameInfo.game_number > 0 && (
              <span className="text-sm font-mono bg-amber-500/20 px-2 py-1 rounded text-amber-400">
                #{lastGameInfo.game_number}
              </span>
            )}
            <Bitcoin className="w-6 h-6 text-amber-500" />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Crypto Trading
            </span>
          </CardTitle>
          {lastGameInfo && lastGameInfo.seed_hash && (
            <div className="text-xs text-muted-foreground font-mono">
              Хэш: {lastGameInfo.seed_hash?.slice(0, 16)}...
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-4 space-y-4">
          {/* Bitcoin Price Display */}
          <div className="flex items-center justify-between bg-black/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                <Bitcoin className="w-5 h-5 text-black" />
              </div>
              <span className="font-bold">BTC/USD</span>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono font-bold text-amber-400">
                ${bitcoinPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className={`text-xs flex items-center gap-1 ${
                currentTrend === "up" ? "text-green-400" : 
                currentTrend === "down" ? "text-red-400" : "text-yellow-400"
              }`}>
                {currentTrend === "up" && <TrendingUp className="w-3 h-3" />}
                {currentTrend === "down" && <TrendingDown className="w-3 h-3" />}
                {currentTrend === "neutral" && <Minus className="w-3 h-3" />}
                {currentTrend === "up" ? "Растёт" : currentTrend === "down" ? "Падает" : "Стабильно"}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="relative rounded-xl overflow-hidden border border-amber-500/20">
            <canvas 
              ref={canvasRef} 
              className="w-full h-48"
              style={{ display: 'block' }}
            />
            
            {animationPhase === "result" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className={`text-center p-6 rounded-2xl ${
                  winAmount > 0 
                    ? "bg-green-500/20 border-2 border-green-500" 
                    : "bg-red-500/20 border-2 border-red-500"
                }`}>
                  <div className="text-4xl mb-2">{winAmount > 0 ? "🎉" : "📉"}</div>
                  <div className={`text-2xl font-bold ${winAmount > 0 ? "text-green-400" : "text-red-400"}`}>
                    {winAmount > 0 ? `+${winAmount.toFixed(2)}₽` : "Проигрыш"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Coefficients */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2">
              <div className="text-xs text-green-400">LONG</div>
              <div className="font-bold text-green-500">2.0x</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
              <div className="text-xs text-yellow-400">FLAT</div>
              <div className="font-bold text-yellow-500">14.0x</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
              <div className="text-xs text-red-400">SHORT</div>
              <div className="font-bold text-red-500">2.0x</div>
            </div>
          </div>

          {/* Bet Input */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Ставка (₽)</Label>
            <Input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="Введите ставку"
              min={minBet}
              max={maxBet}
              disabled={isPlaying}
              className="bg-black/30 border-amber-500/30 text-lg font-bold"
            />
          </div>

          {/* Bet Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => placeBet("long")}
              disabled={isPlaying || !betAmount}
              className="bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 font-bold py-6"
            >
              <TrendingUp className="w-5 h-5 mr-1" />
              LONG
            </Button>
            <Button
              onClick={() => placeBet("flat")}
              disabled={isPlaying || !betAmount}
              className="bg-gradient-to-br from-yellow-600 to-amber-700 hover:from-yellow-500 hover:to-amber-600 font-bold py-6"
            >
              <Minus className="w-5 h-5 mr-1" />
              FLAT
            </Button>
            <Button
              onClick={() => placeBet("short")}
              disabled={isPlaying || !betAmount}
              className="bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 font-bold py-6"
            >
              <TrendingDown className="w-5 h-5 mr-1" />
              SHORT
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
