import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBalanceMode } from "@/hooks/useBalanceMode";
import { Building2, Bomb, Gem, Star, Zap, Loader2 } from "lucide-react";

interface TowersGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

interface TowersConfig {
  mines_per_row: number;
  columns_count: number;
  rows_count: number;
  multipliers: number[];
}

export const TowersGame = ({ userId, balance, onBalanceUpdate }: TowersGameProps) => {
  const [bet, setBet] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [currentRow, setCurrentRow] = useState(0);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [mineMap, setMineMap] = useState<boolean[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number?: number; seed_hash: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { useFreebet, useDemo } = useBalanceMode();
  
  const [config, setConfig] = useState<TowersConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Restore active session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const { data } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("game_name", "towers")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSessionId(data.id);
        setBet(data.bet_amount.toString());
        const state = data.game_state as { current_row?: number; path?: number[] };
        setCurrentRow(state?.current_row || 0);
        setSelectedPath(state?.path || []);
        setGameStarted(true);
        toast.info("Игра восстановлена");
      }
    };
    restoreSession();
  }, [userId]);

  useEffect(() => {
    const loadConfig = async () => {
      const DEFAULT_CONFIG: TowersConfig = {
        mines_per_row: 2,
        columns_count: 5,
        rows_count: 11,
        multipliers: [1.08, 1.18, 1.35, 1.62, 1.98, 2.6, 3.5, 4.8, 6.8, 10.2, 16],
      };

      const normalizeMultipliers = (raw: unknown): number[] | null => {
        if (Array.isArray(raw)) {
          const arr = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n));
          return arr.length ? arr : null;
        }

        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const arr = parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n));
              return arr.length ? arr : null;
            }
          } catch {
            // ignore
          }
        }

        return null;
      };

      const { data, error } = await supabase.from("towers_config").select("*").limit(1).maybeSingle();

      if (error) {
        console.error("Towers config error:", error);
        toast.error("Ошибка загрузки конфигурации");
        setConfig(DEFAULT_CONFIG);
        setIsLoadingConfig(false);
        return;
      }

      if (!data) {
        setConfig(DEFAULT_CONFIG);
        setIsLoadingConfig(false);
        return;
      }

      const mines = Number((data as any).mines_per_row);
      const cols = Number((data as any).columns_count);
      const rows = Number((data as any).rows_count);
      const multipliers = normalizeMultipliers((data as any).multipliers) ?? DEFAULT_CONFIG.multipliers;

      setConfig({
        mines_per_row: Number.isFinite(mines) ? mines : DEFAULT_CONFIG.mines_per_row,
        columns_count: Number.isFinite(cols) ? cols : DEFAULT_CONFIG.columns_count,
        rows_count: Number.isFinite(rows) ? rows : DEFAULT_CONFIG.rows_count,
        multipliers,
      });

      setIsLoadingConfig(false);
    };

    loadConfig();
  }, []);

  if (isLoadingConfig || !config) {
    return (
      <Card className="bg-gradient-to-br from-indigo-950 via-violet-950/80 to-purple-950 border-violet-500/40">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </CardContent>
      </Card>
    );
  }

  const ROWS = config.rows_count;
  const COLS = config.columns_count;
  const MULTIPLIERS = config.multipliers;
  const MINES_PER_ROW = config.mines_per_row;

  const startGame = async () => {
    if (isProcessing) return;

    const betAmount = parseFloat(bet);
    if (!betAmount || betAmount < 10) {
      toast.error("Минимальная ставка 10₽");
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc("start_towers_game", {
        _user_id: userId,
        _bet_amount: betAmount,
        _is_freebet: useFreebet,
        _is_demo: useDemo,
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

      setSessionId(response.session_id || null);
      setLastGameInfo(response.seed_hash ? { seed_hash: response.seed_hash, game_number: response.game_number } : null);
      setSelectedPath([]);
      setCurrentRow(0);
      setMineMap([]);
      setGameStarted(true);
      setGameOver(false);
      onBalanceUpdate();
    } catch (error) {
      toast.error("Ошибка при старте игры");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectTile = async (col: number) => {
    if (isProcessing || !gameStarted || gameOver || currentRow >= ROWS || !sessionId) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc("select_tower_tile", {
        _session_id: sessionId,
        _user_id: userId,
        _column: col,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        setIsProcessing(false);
        return;
      }

      const response = data as {
        success: boolean;
        hit_mine: boolean;
        current_row: number;
        multiplier: number;
        win_amount: number;
        game_over: boolean;
        mines?: number[];
        error?: string;
      };

      if (!response?.success) {
        toast.error(response?.error || "Ошибка игры");
        setIsProcessing(false);
        return;
      }

      setSelectedPath([...selectedPath, col]);
      setCurrentRow(response.current_row);

      if (response.hit_mine) {
        // Show mines for this row
        const newMineMap = [...mineMap];
        const rowMines: boolean[] = new Array(COLS).fill(false);
        (response.mines || []).forEach(pos => {
          if (pos < COLS) rowMines[pos] = true;
        });
        newMineMap[currentRow] = rowMines;
        setMineMap(newMineMap);
        setGameOver(true);
        toast.error(`💥 Проигрыш! -${parseFloat(bet).toFixed(2)}₽`);
        onBalanceUpdate();
      } else if (response.game_over) {
        // Completed all rows
        setGameOver(true);
        toast.success(`🎉 Победа! +${response.win_amount.toFixed(2)}₽ (x${response.multiplier})`);
        onBalanceUpdate();
      }
    } catch (error) {
      toast.error("Ошибка соединения");
    } finally {
      setIsProcessing(false);
    }
  };

  const cashout = async () => {
    if (isProcessing || !gameStarted || currentRow === 0 || !sessionId) return;

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc("cashout_towers", {
        _session_id: sessionId,
        _user_id: userId,
      });

      if (error) {
        toast.error(error.message || "Ошибка при выводе");
        setIsProcessing(false);
        return;
      }

      const response = data as { success: boolean; win_amount: number; multiplier: number; error?: string };

      if (!response?.success) {
        toast.error(response?.error || "Ошибка при выводе");
        setIsProcessing(false);
        return;
      }

      toast.success(`🎉 Победа! +${response.win_amount.toFixed(2)}₽ (x${response.multiplier})`);
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
    setCurrentRow(0);
    setSelectedPath([]);
    setMineMap([]);
    setSessionId(null);
  };

  const getCurrentMultiplier = () => {
    if (currentRow === 0) return 1;
    return MULTIPLIERS[currentRow - 1];
  };

  const getNextMultiplier = () => {
    if (currentRow >= ROWS) return MULTIPLIERS[ROWS - 1];
    return MULTIPLIERS[currentRow];
  };

  return (
    <Card className="bg-gradient-to-br from-indigo-950 via-violet-950/80 to-purple-950 border-violet-500/40 shadow-2xl shadow-violet-500/20 overflow-hidden">
      <CardHeader className="pb-2 border-b border-violet-500/30 bg-gradient-to-r from-violet-900/30 to-purple-900/30">
        <CardTitle className="flex items-center gap-3 text-white">
          {lastGameInfo && lastGameInfo.game_number > 0 && (
            <span className="text-sm font-mono bg-violet-500/30 px-2 py-1 rounded text-violet-200">
              #{lastGameInfo.game_number}
            </span>
          )}
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black bg-gradient-to-r from-violet-300 via-purple-300 to-pink-300 bg-clip-text text-transparent tracking-tight">
            TOWERS
          </span>
          <span className="ml-auto text-xs font-bold text-violet-300/80 bg-violet-500/20 px-3 py-1.5 rounded-full border border-violet-400/30">
            {MINES_PER_ROW} 💣 • {ROWS} этажей
          </span>
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-xs text-violet-300/60">
            Хэш: {lastGameInfo.seed_hash.slice(0, 16)}...
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {!gameStarted ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-violet-200/80 mb-2 block font-medium">Ставка (₽)</label>
              <Input
                type="number"
                value={bet}
                onChange={(e) => setBet(e.target.value)}
                placeholder="Введите ставку"
                min="10"
                max={balance}
                className="bg-indigo-900/50 border-violet-500/40 text-white h-12 text-lg focus:border-violet-400 focus:ring-violet-400/50"
              />
            </div>
            <Button
              onClick={startGame}
              disabled={!bet || isProcessing}
              className="w-full h-14 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-500 hover:via-purple-500 hover:to-pink-500 font-bold text-lg shadow-xl shadow-purple-500/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Zap className="w-5 h-5 mr-2" />
              Начать игру
            </Button>
            
            <div className="bg-indigo-900/30 rounded-2xl p-4 border border-violet-500/20">
              <div className="text-xs text-violet-300/80 mb-3 text-center font-bold uppercase tracking-wider">
                Таблица выплат
              </div>
              <div className="grid grid-cols-6 gap-1.5 text-[10px]">
                {MULTIPLIERS.slice(0, 6).map((mult, i) => (
                  <div key={i} className="text-center bg-indigo-950/60 rounded-xl p-2 border border-violet-500/10">
                    <div className="text-violet-400/70 font-bold">{i + 1}</div>
                    <div className="text-emerald-400 font-black text-xs">{mult}x</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-[10px] mt-1.5">
                {MULTIPLIERS.slice(6).map((mult, i) => (
                  <div key={i + 6} className="text-center bg-indigo-950/60 rounded-xl p-2 border border-amber-500/20">
                    <div className="text-violet-400/70 font-bold">{i + 7}</div>
                    <div className="text-amber-400 font-black text-xs">{mult}x</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-gradient-to-r from-indigo-900/60 to-violet-900/60 rounded-2xl p-4 border border-violet-500/30">
              <div className="text-center">
                <div className="text-[10px] text-violet-300/70 uppercase tracking-wider font-bold">Этаж</div>
                <div className="text-2xl font-black text-violet-300">{currentRow}/{ROWS}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-emerald-300/70 uppercase tracking-wider font-bold">Текущий</div>
                <div className="text-2xl font-black text-emerald-400">{getCurrentMultiplier().toFixed(2)}x</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-amber-300/70 uppercase tracking-wider font-bold">Следующий</div>
                <div className="text-2xl font-black text-amber-400">{getNextMultiplier().toFixed(2)}x</div>
              </div>
            </div>

            <div className="relative bg-gradient-to-b from-indigo-900/40 via-violet-950/50 to-purple-950/60 rounded-2xl p-3 border border-violet-500/30">
              <div className="flex flex-col-reverse gap-1.5">
                {Array.from({ length: ROWS }).map((_, rowIndex) => (
                  <div key={rowIndex} className="relative flex items-center">
                    <div className="absolute -left-0.5 w-6 text-xs text-violet-400/60 font-bold text-center">
                      {rowIndex + 1}
                    </div>
                    
                    <div className="flex gap-1.5 justify-center flex-1 ml-6 mr-10">
                      {Array.from({ length: COLS }).map((_, colIndex) => {
                        const isSelected = selectedPath[rowIndex] === colIndex;
                        const isMine = mineMap[rowIndex]?.[colIndex];
                        const isCurrentRow = rowIndex === currentRow && !gameOver;
                        const isPastRow = rowIndex < currentRow;
                        const showMine = gameOver && isMine;
                        const isExploded = isSelected && isMine && gameOver;
                        const wasCorrectChoice = isPastRow && isSelected && !isMine;
                        
                        return (
                          <button
                            key={colIndex}
                            onClick={() => isCurrentRow && selectTile(colIndex)}
                            disabled={!isCurrentRow || gameOver || isProcessing}
                            className={cn(
                              "w-14 h-10 rounded-xl flex items-center justify-center transition-all duration-300 transform border-2",
                              isExploded 
                                ? "bg-gradient-to-br from-red-500 to-orange-600 border-red-400 scale-110 animate-pulse shadow-xl shadow-red-500/60" 
                                : wasCorrectChoice
                                  ? "bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 shadow-lg shadow-emerald-500/40"
                                  : showMine && !isSelected
                                    ? "bg-gradient-to-br from-red-900/40 to-red-800/40 border-red-500/40"
                                    : isCurrentRow
                                      ? "bg-gradient-to-br from-violet-500/90 to-purple-600/90 border-violet-400/60 hover:from-violet-400 hover:to-purple-500 hover:scale-110 cursor-pointer shadow-lg shadow-violet-500/40 animate-pulse"
                                      : isPastRow && !isSelected
                                        ? "bg-indigo-900/20 border-indigo-600/20"
                                        : "bg-indigo-950/40 border-indigo-700/30"
                            )}
                          >
                            {isExploded ? (
                              <Bomb className="w-5 h-5 text-white animate-bounce" />
                            ) : wasCorrectChoice ? (
                              <Gem className="w-5 h-5 text-white drop-shadow-lg" />
                            ) : showMine && !isSelected ? (
                              <Bomb className="w-4 h-4 text-red-400/60" />
                            ) : isCurrentRow ? (
                              <Star className="w-5 h-5 text-white/90 drop-shadow-lg" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className={cn(
                      "absolute -right-1 w-12 text-xs font-black text-center",
                      rowIndex >= 6 ? "text-amber-400/80" : "text-emerald-400/80"
                    )}>
                      {MULTIPLIERS[rowIndex]}x
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!gameOver && currentRow > 0 && (
              <Button 
                onClick={cashout}
                disabled={isProcessing}
                className="w-full h-14 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg shadow-xl shadow-emerald-500/40 transition-all hover:scale-[1.02]"
              >
                💰 Забрать {(parseFloat(bet) * getCurrentMultiplier()).toFixed(2)}₽
              </Button>
            )}

            {gameOver && (
              <Button 
                onClick={resetGame}
                className="w-full h-14 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:from-violet-500 hover:via-purple-500 hover:to-pink-500 font-bold text-lg transition-all"
              >
                🔄 Новая игра
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};