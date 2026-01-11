import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface RouletteGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

// Порядок чисел на колесе рулетки (европейская)
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
];

const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

type BetType =
  | "red"
  | "black"
  | "even"
  | "odd"
  | "low"
  | "high"
  | "dozen1"
  | "dozen2"
  | "dozen3"
  | "column1"
  | "column2"
  | "column3"
  | number;

export const RouletteGame = ({ userId, balance, onBalanceUpdate }: RouletteGameProps) => {
  const [bet, setBet] = useState("");
  const [selectedBet, setSelectedBet] = useState<BetType | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [highlightNumber, setHighlightNumber] = useState<number | null>(null);
  const spinCountRef = useRef(0);
  const [history, setHistory] = useState<Array<{ number: number; color: string }>>([]);
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number: number; seed_hash: string } | null>(null);
  const { useFreebet, useDemo } = useBalanceMode();

  // Загружаем историю при монтировании
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("roulette_history")
        .select("number, color")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error loading roulette history:", error);
    }
  };

  const getNumberColor = (num: number): "red" | "black" | "green" => {
    if (num === 0) return "green";
    return RED.includes(num) ? "red" : "black";
  };

  const spin = async () => {
    if (spinning || selectedBet === null) return;

    const betAmount = parseFloat(bet);
    if (isNaN(betAmount) || betAmount < 10) {
      toast.error("Минимальная ставка 10₽");
      return;
    }

    setSpinning(true);
    setLastWin(null);
    setShowResult(false);
    setHighlightNumber(null);
    spinCountRef.current += 1;

    try {
      // Определяем тип ставки и значение для чисел
      const isNumberBet = typeof selectedBet === "number";
      const betType = isNumberBet ? "number" : String(selectedBet);
      const betValue = isNumberBet ? selectedBet : null;

      // Вызываем серверную RPC функцию
      const { data, error } = await supabase.rpc("play_roulette", {
        _user_id: userId,
        _bet_amount: betAmount,
        _bet_type: betType,
        _bet_value: betValue,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        setSpinning(false);
        return;
      }

      const response = data as { 
        success: boolean; 
        result_number: number; 
        won: boolean; 
        win_amount: number; 
        multiplier: number;
        game_number: number;
        seed_hash: string;
        message?: string 
      };

      if (!response || !response.success) {
        toast.error(response?.message || "Ошибка игры");
        setSpinning(false);
        return;
      }

      const spinResult = response.result_number;
      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });

      // Красивая 6-секундная анимация колеса
      const resultIndex = WHEEL_NUMBERS.indexOf(spinResult);
      const segmentAngle = 360 / 37;
      // Шарик должен остановиться точно на выигрышном секторе
      const targetAngle = resultIndex * segmentAngle + segmentAngle / 2;

      // Шарик крутится в обратную сторону от колеса, замедляясь
      setBallRotation((prev) => {
        const baseRotation = prev % 360;
        // 8 полных оборотов + финальная позиция для плавного замедления
        const totalRotation = 8 * 360 + (360 - targetAngle) - baseRotation;
        return prev + totalRotation;
      });

      // Колесо крутится медленнее в ту же сторону
      setWheelRotation((prev) => prev + 3 * 360);
      
      setResult(spinResult);

      // Обновляем локальную историю
      const resultColor = getNumberColor(spinResult);
      setHistory((prev) => [{ number: spinResult, color: resultColor }, ...prev.slice(0, 9)]);

      // Показываем результат после 6 секунд анимации
      setTimeout(() => {
        setShowResult(true);
        setHighlightNumber(spinResult);
      }, 5500);

      // Показываем уведомление после полной остановки
      setTimeout(() => {
        if (response.won) {
          const netProfit = response.win_amount - betAmount;
          setLastWin(response.win_amount);
          toast.success(`Победа! +${netProfit.toFixed(2)}₽ (Игра #${response.game_number})`);
        } else {
          toast.error(`Проигрыш! (Игра #${response.game_number})`);
        }

        onBalanceUpdate();
        setSpinning(false);
      }, 6000);
    } catch (error) {
      console.error("Roulette spin error:", error);
      toast.error("Ошибка игры");
      setSpinning(false);
    }
  };

  const NumberButton = ({ num }: { num: number }) => {
    const color = getNumberColor(num);
    const isSelected = selectedBet === num;
    const isWinningNumber = highlightNumber === num;

    return (
      <button
        onClick={() => setSelectedBet(num)}
        disabled={spinning}
        className={cn(
          "w-9 h-9 rounded text-sm font-bold transition-all relative",
          "flex items-center justify-center",
          color === "red" && "bg-red-600 hover:bg-red-500 text-white",
          color === "black" && "bg-zinc-800 hover:bg-zinc-700 text-white",
          color === "green" && "bg-green-600 hover:bg-green-500 text-white",
          isSelected && "ring-2 ring-yellow-400 ring-offset-2 ring-offset-background scale-110",
          isWinningNumber && "ring-4 ring-yellow-400 scale-125 z-10 shadow-lg shadow-yellow-400/50 animate-pulse",
          spinning && "opacity-50 cursor-not-allowed",
        )}
      >
        {num}
        {isWinningNumber && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping" />
        )}
      </button>
    );
  };

  const BetButton = ({ betType, label, className }: { betType: BetType; label: string; className?: string }) => (
    <Button
      onClick={() => setSelectedBet(betType)}
      disabled={spinning}
      variant={selectedBet === betType ? "default" : "outline"}
      className={cn(
        "font-semibold transition-all h-10",
        selectedBet === betType && "ring-2 ring-yellow-400",
        className,
      )}
    >
      {label}
    </Button>
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
          {lastGameInfo && lastGameInfo.game_number > 0 && (
            <span className="text-sm font-mono bg-primary/20 px-2 py-1 rounded text-primary">
              #{lastGameInfo.game_number}
            </span>
          )}
          🎰 Рулетка
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-center text-xs text-muted-foreground">
            Хэш: {lastGameInfo.seed_hash.slice(0, 16)}...
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* История последних 10 чисел */}
        {history.length > 0 && (
          <div className="bg-card/50 rounded-lg p-3 border border-border/50">
            <div className="text-xs text-muted-foreground mb-2 text-center">Последние числа:</div>
            <div className="flex justify-center gap-1 flex-wrap">
              {history.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg border-2",
                    item.color === "red" && "bg-red-600 border-red-400",
                    item.color === "black" && "bg-zinc-800 border-zinc-600",
                    item.color === "green" && "bg-green-600 border-green-400",
                  )}
                >
                  {item.number}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-sm text-muted-foreground block mb-2">Ставка (₽)</label>
          <Input
            type="number"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            placeholder="Введите ставку"
            min="10"
            className="bg-input"
            disabled={spinning}
          />
        </div>

        {/* Колесо рулетки */}
        <div className="relative flex justify-center items-center py-10">
          <div className="relative w-72 h-72 sm:w-80 sm:h-80">
            {/* Внешняя рамка - золотой ободок */}
            <div className="absolute -inset-4 rounded-full bg-gradient-to-b from-amber-400 via-amber-600 to-amber-800 shadow-2xl" />
            <div className="absolute -inset-2 rounded-full bg-gradient-to-b from-amber-500 via-amber-700 to-amber-900 border-4 border-amber-400" />

            <div
              className="absolute inset-2 rounded-full overflow-hidden shadow-inner"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: spinning ? "transform 6s cubic-bezier(0.15, 0.60, 0.20, 1.00)" : "none",
              }}
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {WHEEL_NUMBERS.map((num, index) => {
                  const angle = (index * 360) / 37;
                  const nextAngle = ((index + 1) * 360) / 37;
                  const midAngle = (angle + nextAngle) / 2;
                  const color = getNumberColor(num);

                  const rad1 = ((angle - 90) * Math.PI) / 180;
                  const rad2 = ((nextAngle - 90) * Math.PI) / 180;
                  const x1 = 100 + 95 * Math.cos(rad1);
                  const y1 = 100 + 95 * Math.sin(rad1);
                  const x2 = 100 + 95 * Math.cos(rad2);
                  const y2 = 100 + 95 * Math.sin(rad2);

                  const textRad = ((midAngle - 90) * Math.PI) / 180;
                  const textX = 100 + 75 * Math.cos(textRad);
                  const textY = 100 + 75 * Math.sin(textRad);

                  const fillColor = color === "red" ? "#dc2626" : color === "black" ? "#18181b" : "#16a34a";

                  return (
                    <g key={num}>
                      <path
                        d={`M 100 100 L ${x1} ${y1} A 95 95 0 0 1 ${x2} ${y2} Z`}
                        fill={fillColor}
                        stroke="#d4a106"
                        strokeWidth="0.5"
                      />
                      <text
                        x={textX}
                        y={textY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize="8"
                        fontWeight="bold"
                        transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}
                      >
                        {num}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Шарик - красивая 6-сек анимация, появляется сверху над колесом */}
            <div
              className="absolute w-6 h-6 bg-gradient-to-br from-white via-gray-100 to-gray-200 rounded-full shadow-xl z-30"
              style={{
                left: "50%",
                top: "50%",
                marginLeft: "-12px",
                marginTop: "-12px",
                transform: `rotate(${ballRotation}deg) translateY(-155px)`,
                transformOrigin: "12px 12px",
                transition: spinning ? "transform 6s cubic-bezier(0.05, 0.70, 0.15, 1.00)" : "none",
                boxShadow: "inset 3px 3px 6px rgba(255,255,255,0.95), inset -1px -1px 4px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.3)",
                background: "radial-gradient(circle at 30% 30%, white, #e5e5e5 60%, #9ca3af 100%)",
              }}
            />

            {/* Центр колеса */}
            <div className="absolute inset-[70px] rounded-full bg-gradient-to-b from-amber-600 via-amber-700 to-amber-800 border-4 border-amber-500 shadow-inner flex items-center justify-center">
              {showResult && result !== null ? (
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white animate-bounce",
                    getNumberColor(result) === "red" && "bg-red-600",
                    getNumberColor(result) === "black" && "bg-zinc-800",
                    getNumberColor(result) === "green" && "bg-green-600",
                  )}
                >
                  {result}
                </div>
              ) : (
                <div className="text-amber-300 text-2xl font-bold">🎰</div>
              )}
            </div>
          </div>
        </div>

        {/* Выигрыш */}
        {lastWin !== null && (
          <div className="text-center py-3 bg-green-500/20 rounded-lg border border-green-500/30 animate-pulse">
            <span className="text-green-400 font-bold text-xl">+{lastWin.toFixed(2)}₽</span>
          </div>
        )}

        {/* Ставки на числа */}
        <div>
          <div className="text-sm text-muted-foreground mb-2 text-center">Числа:</div>
          <div className="grid grid-cols-6 gap-1 mb-2">
            <div className="col-span-6 flex justify-center mb-1">
              <NumberButton num={0} />
            </div>
            {[...Array(12)].map((_, row) => (
              <div key={row} className="contents">
                {[1, 2, 3].map((col) => {
                  const num = row * 3 + col;
                  return <NumberButton key={num} num={num} />;
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Кнопки ставок */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground text-center">Ставки 1:1</div>
          <div className="grid grid-cols-3 gap-2">
            <BetButton betType="red" label="🔴 Красное" className="bg-red-600 hover:bg-red-500 text-white border-red-500" />
            <BetButton betType="black" label="⚫ Чёрное" className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-600" />
            <BetButton betType="even" label="Чётное" />
            <BetButton betType="odd" label="Нечётное" />
            <BetButton betType="low" label="1-18" />
            <BetButton betType="high" label="19-36" />
          </div>

          <div className="text-sm text-muted-foreground text-center mt-4">Дюжины (3x)</div>
          <div className="grid grid-cols-3 gap-2">
            <BetButton betType="dozen1" label="1-12" />
            <BetButton betType="dozen2" label="13-24" />
            <BetButton betType="dozen3" label="25-36" />
          </div>

          <div className="text-sm text-muted-foreground text-center mt-4">Колонки (3x)</div>
          <div className="grid grid-cols-3 gap-2">
            <BetButton betType="column1" label="1ст" />
            <BetButton betType="column2" label="2ст" />
            <BetButton betType="column3" label="3ст" />
          </div>
        </div>

        {/* Кнопка спина */}
        <Button
          onClick={spin}
          disabled={spinning || selectedBet === null}
          className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500 font-bold text-lg py-6 shadow-lg text-black"
        >
          {spinning ? "🎰 Крутится..." : "🎲 Крутить"}
        </Button>
      </CardContent>
    </Card>
  );
};
