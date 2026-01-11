import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Bomb, Gem } from "lucide-react";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface MinesGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

// Multipliers table based on mines count
const MINES_MULTIPLIERS: Record<number, number> = {
  2: 1.07, 3: 1.12, 4: 1.17, 5: 1.23, 6: 1.30, 7: 1.37, 8: 1.45, 9: 1.54,
  10: 1.64, 11: 1.76, 12: 1.90, 13: 2.05, 14: 2.24, 15: 2.46, 16: 2.74,
  17: 3.08, 18: 3.52, 19: 4.11, 20: 4.93, 21: 6.16, 22: 8.21, 23: 12.31, 24: 24.63,
};

export const MinesGame = ({ userId, balance, onBalanceUpdate }: MinesGameProps) => {
  const [bet, setBet] = useState("");
  const [minesCount, setMinesCount] = useState(5);
  const [gameStarted, setGameStarted] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [mines, setMines] = useState<number[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number?: number; seed_hash: string } | null>(null);
  const [gridSize] = useState(25);
  const { useFreebet, useDemo } = useBalanceMode();
  const betDeductedRef = useRef(false);

  // Restore active session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const { data } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("game_name", "mines")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSessionId(data.id);
        setBet(data.bet_amount.toString());
        setMinesCount((data.game_state as { mines_count?: number })?.mines_count || 5);
        setRevealed((data.game_state as { revealed?: number[] })?.revealed || []);
        setCurrentMultiplier(1); // Will be updated on first reveal
        setGameStarted(true);
        betDeductedRef.current = true;
        toast.info("Игра восстановлена");
      }
    };
    restoreSession();
  }, [userId]);

  const startGame = async () => {
    if (isProcessing || betDeductedRef.current) return;

    const betAmount = parseFloat(bet);
    if (isNaN(betAmount) || betAmount < 10) {
      toast.error("Минимальная ставка 10₽");
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc("start_mines_game", {
        _user_id: userId,
        _bet_amount: betAmount,
        _mines_count: minesCount,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка при старте игры");
        setIsProcessing(false);
        return;
      }

      const response = data as { success: boolean; session_id?: string; seed_hash?: string; game_number?: number; error?: string };

      if (!response?.success) {
        toast.error(response?.error || "Ошибка при старте игры");
        setIsProcessing(false);
        return;
      }

      betDeductedRef.current = true;
      setSessionId(response.session_id || null);
      setLastGameInfo(response.seed_hash ? { seed_hash: response.seed_hash, game_number: response.game_number } : null);
      setRevealed([]);
      setMines([]);
      setCurrentMultiplier(1);
      setGameStarted(true);
      setGameOver(false);
      onBalanceUpdate();
    } catch (error) {
      toast.error("Ошибка при старте игры");
      betDeductedRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  const revealCell = async (index: number) => {
    if (!gameStarted || gameOver || revealed.includes(index) || isProcessing || !sessionId) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc("reveal_mines_cell", {
        _session_id: sessionId,
        _user_id: userId,
        _cell_index: index,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        setIsProcessing(false);
        return;
      }

      const response = data as {
        success: boolean;
        is_mine: boolean;
        mines?: number[];
        multiplier: number;
        win_amount: number;
        error?: string;
      };

      if (!response?.success) {
        toast.error(response?.error || "Ошибка игры");
        setIsProcessing(false);
        return;
      }

      if (response.is_mine) {
        setRevealed([...revealed, index]);
        setMines(response.mines || []);
        setGameOver(true);
        toast.error(`Бум! Вы проиграли ${parseFloat(bet).toFixed(2)}₽`);
        betDeductedRef.current = false;
        onBalanceUpdate();
      } else {
        setRevealed([...revealed, index]);
        setCurrentMultiplier(response.multiplier);
      }
    } catch (error) {
      toast.error("Ошибка соединения");
    } finally {
      setIsProcessing(false);
    }
  };

  const cashout = async () => {
    if (!gameStarted || gameOver || revealed.length === 0 || isProcessing || !sessionId) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc("cashout_mines", {
        _session_id: sessionId,
        _user_id: userId,
      });

      if (error) {
        toast.error(error.message || "Ошибка при выводе");
        setIsProcessing(false);
        return;
      }

      const response = data as { success: boolean; win_amount: number; multiplier: number; mines?: number[]; error?: string };

      if (!response?.success) {
        toast.error(response?.error || "Ошибка при выводе");
        setIsProcessing(false);
        return;
      }

      setMines(response.mines || []);
      toast.success(`Выигрыш: ${response.win_amount.toFixed(2)}₽ (x${response.multiplier.toFixed(2)})`);
      onBalanceUpdate();
      resetGame();
    } catch (error) {
      toast.error("Ошибка при выводе");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameOver(false);
    setRevealed([]);
    setMines([]);
    setCurrentMultiplier(1);
    setSessionId(null);
    betDeductedRef.current = false;
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
          <Gem className="h-6 w-6 text-primary" />
          Mines
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-center text-xs text-muted-foreground">
            Хэш: {lastGameInfo.seed_hash.slice(0, 16)}...
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!gameStarted ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Ставка (₽)</label>
              <Input
                type="number"
                value={bet}
                onChange={(e) => setBet(e.target.value)}
                placeholder="Введите ставку"
                min="10"
                className="bg-input"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-2">
                Количество мин: {minesCount} (x{MINES_MULTIPLIERS[minesCount]?.toFixed(2) || "1.07"})
              </label>
              <input
                type="range"
                value={minesCount}
                onChange={(e) => setMinesCount(parseInt(e.target.value))}
                min="2"
                max="24"
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>2 (x1.07)</span>
                <span>12 (x1.90)</span>
                <span>24 (x24.63)</span>
              </div>
            </div>
            <Button
              onClick={startGame}
              disabled={!bet || isProcessing}
              className="w-full bg-primary hover:bg-primary/90 font-bold"
            >
              Начать игру
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-card/50 p-4 rounded-lg text-center">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Мин: {minesCount}</span>
                <span className="text-sm text-muted-foreground">
                  Открыто: {revealed.length}/{gridSize - minesCount}
                </span>
              </div>
              <div className="text-3xl font-bold text-primary">
                {currentMultiplier.toFixed(2)}x
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Выигрыш: {(parseFloat(bet) * currentMultiplier).toFixed(2)}₽
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: gridSize }).map((_, i) => {
            const isRevealed = revealed.includes(i);
            const isMine = mines.includes(i);
            const showMine = gameOver && isMine;

            return (
              <button
                key={i}
                onClick={() => revealCell(i)}
                disabled={!gameStarted || gameOver || isRevealed || isProcessing}
                className={cn(
                  "aspect-square rounded-lg border-2 transition-all duration-200 flex items-center justify-center",
                  isRevealed && isMine && "bg-destructive border-destructive",
                  isRevealed && !isMine && "bg-primary/80 border-primary",
                  showMine && !isRevealed && "bg-destructive/50 border-destructive/50",
                  !isRevealed && !showMine && "bg-muted hover:bg-muted/80 border-border hover:border-primary/50",
                  (!gameStarted || gameOver) && "opacity-60 cursor-not-allowed"
                )}
              >
                {isRevealed && isMine && <Bomb className="h-5 w-5 text-destructive-foreground" />}
                {isRevealed && !isMine && <Gem className="h-5 w-5 text-primary-foreground" />}
                {showMine && !isRevealed && <Bomb className="h-4 w-4 text-destructive" />}
              </button>
            );
          })}
        </div>

        {gameStarted && !gameOver && (
          <Button
            onClick={cashout}
            disabled={revealed.length === 0 || isProcessing}
            className="w-full bg-green-600 hover:bg-green-700 font-bold"
          >
            Забрать {(parseFloat(bet) * currentMultiplier).toFixed(2)}₽
          </Button>
        )}

        {gameOver && (
          <Button
            onClick={resetGame}
            className="w-full bg-secondary hover:bg-secondary/90 font-bold"
          >
            Новая игра
          </Button>
        )}
      </CardContent>
    </Card>
  );
};