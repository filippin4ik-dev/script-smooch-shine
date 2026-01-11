import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBalanceMode } from "@/hooks/useBalanceMode";

// Импорт изображений слотов
import appleImg from "@/assets/slots/apple.png";
import bananaImg from "@/assets/slots/banana.png";
import grapeImg from "@/assets/slots/grape.png";
import watermelonImg from "@/assets/slots/watermelon.png";
import greenCandyImg from "@/assets/slots/green-candy.png";
import blueCandyImg from "@/assets/slots/blue-candy.png";
import plumImg from "@/assets/slots/plum.png";
import purpleCandyImg from "@/assets/slots/purple-candy.png";
import heartImg from "@/assets/slots/heart.png";
import scatterImg from "@/assets/slots/scatter-lollipop.png";
import multiplierBombImg from "@/assets/slots/multiplier-bomb.png";
import sweetBonanzaBg from "@/assets/slots/sweet-bonanza-bg.png";

interface SlotsGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

// Тип символа: число (обычный символ), scatter (леденец) или candy (бомбочка-множитель во фриспинах)
type Symbol = number | { type: "scatter" } | { type: "candy"; multiplier: number };

// 10 символов (0-9) - по картинке:
// 0 = банан, 1 = виноград, 2 = арбуз, 3 = слива, 4 = яблоко
// 5 = синяя, 6 = зелёная, 7 = фиолетовая, 8 = сердце
const SYMBOLS: Record<number, string> = {
  0: bananaImg, // Банан (самый частый)
  1: grapeImg, // Виноград
  2: watermelonImg, // Арбуз
  3: plumImg, // Слива
  4: appleImg, // Яблоко
  5: blueCandyImg, // Синяя конфета
  6: greenCandyImg, // Зелёная конфета
  7: purpleCandyImg, // Фиолетовая конфета
  8: heartImg, // Сердце (самый редкий)
};

// Таблица выплат Sweet Bonanza (коэффициенты от ставки)
const PAYTABLE: Record<number, Record<string, number>> = {
  0: { "8-9": 0.25, "10-11": 0.75, "12+": 2 }, // Банан
  1: { "8-9": 0.4, "10-11": 0.9, "12+": 4 }, // Виноград
  2: { "8-9": 0.5, "10-11": 1, "12+": 5 }, // Арбуз
  3: { "8-9": 0.8, "10-11": 1.2, "12+": 8 }, // Персик/Слива
  4: { "8-9": 1, "10-11": 1.5, "12+": 10 }, // Яблоко
  5: { "8-9": 1.5, "10-11": 2, "12+": 12 }, // Синяя конфета
  6: { "8-9": 2, "10-11": 5, "12+": 15 }, // Зелёная конфета
  7: { "8-9": 2.5, "10-11": 10, "12+": 25 }, // Фиолетовая конфета
  8: { "8-9": 10, "10-11": 25, "12+": 50 }, // Сердце
};

// Функция получения коэффициента по количеству символов
const getPayoutMultiplier = (symbol: number, count: number): number => {
  if (count < 8) return 0;
  const table = PAYTABLE[symbol];
  if (!table) return 0;

  if (count >= 12) return table["12+"];
  if (count >= 10) return table["10-11"];
  return table["8-9"];
};

// ВАЖНО: эти веса используются ТОЛЬКО для клиентских анимаций/фолбэков.
// Реальная математика слотов (шансы, каскады, выигрыш) считается на сервере в play_sweet_bonanza.
const WEIGHTS_BASE = [
  14, // 0 - банан
  14, // 1 - виноград
  13, // 2 - арбуз
  12, // 3 - слива
  11, // 4 - яблоко
  10, // 5 - синяя конфета
  10, // 6 - зелёная конфета
  9, // 7 - фиолетовая конфета
  7, // 8 - сердце
];

// Во фриспинах МЕНЕЕ равномерное распределение (для анимаций/фолбэков)
const WEIGHTS_FREESPINS = [
  20, // 0 - банан
  18, // 1 - виноград
  14, // 2 - арбуз
  12, // 3 - слива
  10, // 4 - яблоко
  9, // 5 - синяя конфета
  7, // 6 - зелёная конфета
  6, // 7 - фиолетовая конфета
  4, // 8 - сердце
];

// Бомбочки-множители (появляются только во фриспинах)
const MULTIPLIER_BOMBS = [
  { mult: 2, chance: 28 },
  { mult: 3, chance: 22 },
  { mult: 4, chance: 15 },
  { mult: 5, chance: 12 },
  { mult: 6, chance: 8 },
  { mult: 8, chance: 5 },
  { mult: 10, chance: 4 },
  { mult: 12, chance: 2.5 },
  { mult: 15, chance: 1.5 },
  { mult: 20, chance: 0.9 },
  { mult: 25, chance: 0.5 },
  { mult: 50, chance: 0.08 },
  { mult: 100, chance: 0.02 },
  { mult: 1000, chance: 0.005 }, // Золотая бомбочка 1000x
];

// Скаттеры - фриспины (4+ = 10 спинов фиксированно)
const SCATTER_REWARDS = [
  { count: 4, spins: 10 },
  { count: 5, spins: 10 },
  { count: 6, spins: 10 },
];

// Скаттеры платят: 4=3x, 5=5x, 6=100x от ставки
const SCATTER_PAYOUTS: Record<number, number> = {
  4: 3,
  5: 5,
  6: 100,
};

// НОВЫЕ РАЗМЕРЫ: 5 рядов x 6 колонок
const ROWS = 5;
const COLS = 6;

// Фиксированные ставки
const BET_OPTIONS = [
  16, 32, 48, 64, 80, 96, 100, 112, 128, 144, 160, 200, 300, 400, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800,
  2000, 2400, 2800, 3200, 3600, 4000, 4800, 5600, 6400, 7200, 8000, 9600, 11200, 12800, 14400, 16000, 19200, 22400,
  25600, 28800, 32000, 38400, 44800, 51200, 57600, 64000, 75200,
];

export const SlotsGame = ({ userId, balance, onBalanceUpdate }: SlotsGameProps) => {
  const [selectedBet, setSelectedBet] = useState(16);
  const [showBetPicker, setShowBetPicker] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [lastGameNumber, setLastGameNumber] = useState<number | null>(null);
  const [grid, setGrid] = useState<(Symbol | null)[][]>(
    Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(null)),
  );
  const [fallingCells, setFallingCells] = useState<Set<string>>(new Set());
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [explodingCells, setExplodingCells] = useState<Set<string>>(new Set());
  const [showBonusBuy, setShowBonusBuy] = useState(false);
  const [accumulatedMultiplier, setAccumulatedMultiplier] = useState(0);
  const [cascadeWin, setCascadeWin] = useState(0);
  const { canAct } = useSpamProtection();
  const queryClient = useQueryClient();
  const { useFreebet, useDemo } = useBalanceMode();
  const animationRef = useRef<boolean>(false);

  const { data: freespinsData } = useQuery({
    queryKey: ["user-freespins", userId],
    queryFn: async () => {
      const { data } = await supabase.from("user_freespins").select("*").eq("user_id", userId).single();
      return data;
    },
    staleTime: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("freespins-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_freespins",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["user-freespins", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const freespins = freespinsData?.freespins_count || 0;
  const freespinBetAmount = freespinsData?.freespin_bet_amount || 16;

  // Цена бонуса = ставка × 100
  const bonusPrice = selectedBet * 100;

  // Генерация символа с учетом весов
  const getWeightedSymbol = useCallback((isFreeSpin: boolean): Symbol => {
    // Скаттер (леденец) - уменьшена вероятность
    const scatterChance = isFreeSpin ? 0.003 : 0.005;
    if (Math.random() < scatterChance) {
      return { type: "scatter" };
    }

    // Бомбочки-множители ТОЛЬКО во фриспинах (~3%)
    if (isFreeSpin && Math.random() < 0.03) {
      const roll = Math.random() * 100;
      let cumulative = 0;
      for (const bomb of MULTIPLIER_BOMBS) {
        cumulative += bomb.chance;
        if (roll < cumulative) {
          return { type: "candy", multiplier: bomb.mult };
        }
      }
      return { type: "candy", multiplier: 2 };
    }

    const weights = isFreeSpin ? WEIGHTS_FREESPINS : WEIGHTS_BASE;
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let sum = 0;

    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random < sum) {
        return i;
      }
    }

    return 0;
  }, []);

  const buyBonusRound = async () => {
    if (!canAct()) return;

    if (balance < bonusPrice) {
      toast.error("Недостаточно средств");
      return;
    }

    const freespinsToAdd = 10;

    try {
      const { error } = await supabase.rpc("buy_bonus", {
        _user_id: userId,
        _price: bonusPrice,
        _bonus_type: "freespins",
        _bonus_value: freespinsToAdd,
      });

      if (error) {
        toast.error("Ошибка покупки");
        return;
      }

      await supabase.from("user_freespins").update({ freespin_bet_amount: selectedBet }).eq("user_id", userId);

      setShowBonusBuy(false);
      setAccumulatedMultiplier(0);

      toast.success(`Куплено ${freespinsToAdd} фриспинов по ${selectedBet}₽!`);
      onBalanceUpdate();
      queryClient.invalidateQueries({ queryKey: ["user-freespins"] });
    } catch {
      toast.error("Ошибка покупки");
    }
  };

  // Улучшенная волновая анимация падения символов с 3D эффектом
  const animateWaveDrop = (finalGrid: Symbol[][]): Promise<void> => {
    return new Promise((resolve) => {
      animationRef.current = true;

      // Сначала очищаем сетку
      setGrid(
        Array(ROWS)
          .fill(null)
          .map(() => Array(COLS).fill(null)),
      );
      setFallingCells(new Set());

      const cellDelay = 30; // Быстрее
      const colDelay = 60; // Волна между колонками

      // Падаем по колонкам с волновым эффектом
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          // Волновой паттерн - символы падают с небольшой задержкой по диагонали
          const waveOffset = Math.abs(col - COLS / 2) * 15;
          const delay = waveOffset + row * cellDelay + col * colDelay;

          setTimeout(() => {
            if (!animationRef.current) return;

            // Помечаем ячейку как падающую
            setFallingCells((prev) => {
              const newSet = new Set(prev);
              newSet.add(`${row}-${col}`);
              return newSet;
            });

            // Устанавливаем символ
            setGrid((prevGrid) => {
              const newGrid = prevGrid.map((r) => [...r]);
              newGrid[row][col] = finalGrid[row][col];
              return newGrid;
            });

            // Убираем эффект падения после появления
            setTimeout(() => {
              setFallingCells((prev) => {
                const newSet = new Set(prev);
                newSet.delete(`${row}-${col}`);
                return newSet;
              });
            }, 200);
          }, delay);
        }
      }

      // Завершаем анимацию
      const totalDuration = COLS * colDelay + ROWS * cellDelay + 300;
      setTimeout(() => {
        animationRef.current = false;
        resolve();
      }, totalDuration);
    });
  };

  // Анимация каскадного падения после взрыва - символы сверху падают вниз
  const animateCascadeDrop = (
    newGrid: Symbol[][],
    fallingPositions: Set<string>
  ): Promise<Symbol[][]> => {
    return new Promise((resolve) => {
      // Сначала показываем пустые места
      setGrid(prevGrid => {
        const clearedGrid = prevGrid.map((row, ri) => 
          row.map((cell, ci) => fallingPositions.has(`${ri}-${ci}`) ? null : cell)
        );
        return clearedGrid;
      });
      
      // Пауза чтобы показать пустые места
      setTimeout(() => {
        // Теперь анимируем падение новых символов
        setFallingCells(fallingPositions);
        setGrid(newGrid);
        
        // Долгая анимация падения
        setTimeout(() => {
          setFallingCells(new Set());
          resolve(newGrid);
        }, 500);
      }, 200);
    });
  };

  // Проверка выигрышных комбинаций и возврат позиций
  const findWinningPositions = (currentGrid: (Symbol | null)[][]): {
    positions: Set<string>;
    symbolCounts: Map<number, number>;
    multiplierSum: number;
    scatterCount: number;
  } => {
    const symbolCounts: Map<number, number> = new Map();
    const symbolPositions: Map<number, Set<string>> = new Map();
    let multiplierSum = 0;
    let scatterCount = 0;

    // Подсчитываем символы
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = currentGrid[row][col];
        if (cell === null) continue;

        if (typeof cell === "object" && cell.type === "candy") {
          multiplierSum += cell.multiplier;
        } else if (typeof cell === "object" && cell.type === "scatter") {
          scatterCount++;
        } else if (typeof cell === "number") {
          symbolCounts.set(cell, (symbolCounts.get(cell) || 0) + 1);
          if (!symbolPositions.has(cell)) {
            symbolPositions.set(cell, new Set());
          }
          symbolPositions.get(cell)!.add(`${row}-${col}`);
        }
      }
    }

    // Находим выигрышные позиции (8+ одинаковых символов)
    const winningPositions = new Set<string>();
    symbolCounts.forEach((count, symbol) => {
      if (count >= 8) {
        symbolPositions.get(symbol)?.forEach(pos => winningPositions.add(pos));
      }
    });

    // Добавляем бомбочки если есть выигрыш
    if (winningPositions.size > 0) {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cell = currentGrid[row][col];
          if (typeof cell === "object" && cell.type === "candy") {
            winningPositions.add(`${row}-${col}`);
          }
        }
      }
    }

    return { positions: winningPositions, symbolCounts, multiplierSum, scatterCount };
  };

  // Вычисляем выигрыш для текущей комбинации
  const calculateWinAmount = (symbolCounts: Map<number, number>, betAmount: number): number => {
    let totalWin = 0;
    symbolCounts.forEach((count, symbol) => {
      if (count >= 8) {
        const payout = getPayoutMultiplier(symbol, count);
        if (payout > 0) {
          totalWin += betAmount * payout;
        }
      }
    });
    return totalWin;
  };

  // Каскадная механика - удаление выигрышных символов и падение новых
  const processCascade = async (
    currentGrid: Symbol[][],
    betAmount: number,
    isFreeSpin: boolean,
    cascadeLevel: number = 0
  ): Promise<{ totalWin: number; totalMultiplier: number; scatterCount: number }> => {
    const { positions, symbolCounts, multiplierSum, scatterCount } = findWinningPositions(currentGrid);
    
    if (positions.size === 0) {
      return { totalWin: 0, totalMultiplier: 0, scatterCount };
    }

    // Вычисляем выигрыш для этого каскада
    let cascadeWinAmount = calculateWinAmount(symbolCounts, betAmount);
    
    // Применяем множители бомбочек
    if (multiplierSum > 0 && cascadeWinAmount > 0) {
      cascadeWinAmount *= multiplierSum;
    }

    // Подсвечиваем выигрышные ячейки (долго чтобы было видно)
    setWinningCells(positions);
    await new Promise(resolve => setTimeout(resolve, 600));

    // Анимация взрыва (долгая чтобы было видно частицы)
    setExplodingCells(positions);
    await new Promise(resolve => setTimeout(resolve, 600));
    setExplodingCells(new Set());
    setWinningCells(new Set());
    
    // Пауза перед падением новых символов
    await new Promise(resolve => setTimeout(resolve, 200));

    // Создаём новую сетку с падением символов
    const newGrid: Symbol[][] = Array(ROWS).fill(null).map(() => Array(COLS).fill(null) as Symbol[]);
    const fallingPositions = new Set<string>();

    for (let col = 0; col < COLS; col++) {
      // Собираем все символы в колонке которые НЕ взорвались (снизу вверх)
      const survivingSymbols: Symbol[] = [];
      for (let row = ROWS - 1; row >= 0; row--) {
        if (!positions.has(`${row}-${col}`) && currentGrid[row][col] !== null) {
          survivingSymbols.push(currentGrid[row][col]);
        }
      }

      // Размещаем выжившие символы внизу колонки
      let targetRow = ROWS - 1;
      for (let i = 0; i < survivingSymbols.length; i++) {
        newGrid[targetRow][col] = survivingSymbols[i];
        // Если символ переместился вниз - помечаем как падающий
        const originalRow = ROWS - 1 - i;
        if (targetRow !== originalRow || positions.has(`${originalRow}-${col}`)) {
          fallingPositions.add(`${targetRow}-${col}`);
        }
        targetRow--;
      }

      // Генерируем новые символы для пустых мест сверху
      const emptyCount = ROWS - survivingSymbols.length;
      for (let i = 0; i < emptyCount; i++) {
        const row = i;
        newGrid[row][col] = getWeightedSymbol(isFreeSpin);
        fallingPositions.add(`${row}-${col}`);
      }
    }

    // Анимируем каскадное падение
    await animateCascadeDrop(newGrid, fallingPositions);
    
    // Обновляем отображение каскадного выигрыша
    setCascadeWin(prev => prev + cascadeWinAmount);

    // Пауза между каскадами чтобы игрок успел увидеть
    await new Promise(resolve => setTimeout(resolve, 300));

    // Рекурсивно проверяем новые комбинации (максимум 15 каскадов)
    if (cascadeLevel < 15) {
      const nextCascade = await processCascade(newGrid, betAmount, isFreeSpin, cascadeLevel + 1);
      return {
        totalWin: cascadeWinAmount + nextCascade.totalWin,
        totalMultiplier: multiplierSum + nextCascade.totalMultiplier,
        scatterCount: Math.max(scatterCount, nextCascade.scatterCount)
      };
    }

    return { totalWin: cascadeWinAmount, totalMultiplier: multiplierSum, scatterCount };
  };

  const spin = async () => {
    if (!canAct()) return;
    if (spinning) return;

    const hasFreespins = freespins > 0;
    const actualBet = hasFreespins ? freespinBetAmount : selectedBet;

    if (!hasFreespins && selectedBet > balance) {
      toast.error("Недостаточно средств");
      return;
    }

    setSpinning(true);
    setWinningCells(new Set());
    setExplodingCells(new Set());
    setCascadeWin(0);

    try {
      // Вызываем серверную RPC для Sweet Bonanza
      const { data: result, error } = await supabase.rpc("play_sweet_bonanza", {
        _user_id: userId,
        _bet_amount: actualBet,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error || !result?.success) {
        toast.error(result?.message || "Ошибка игры");
        setSpinning(false);
        return;
      }

      // Получаем каскады от сервера
      const cascades = result.cascades as Array<{
        grid: number[][];
        winning_positions: Array<{ row: number; col: number; symbol?: number }>;
        win: number;
      }>;

      // Анимируем каждый каскад
      for (let i = 0; i < cascades.length; i++) {
        const cascade = cascades[i];
        const cascadeGrid: Symbol[][] = cascade.grid.map((row: number[]) =>
          row.map((cell: number) => {
            if (cell === 100) return { type: "scatter" as const };
            if (cell >= 200) return { type: "candy" as const, multiplier: cell - 200 };
            return cell;
          })
        );

        if (i === 0) {
          // Первая сетка - волновая анимация
          await animateWaveDrop(cascadeGrid);
        }

        // Подсветка выигрышных позиций - группируем по символам
        if (cascade.winning_positions && cascade.winning_positions.length > 0) {
          // Группируем позиции по символу
          const positionsBySymbol = new Map<number, Set<string>>();
          cascade.winning_positions.forEach((pos) => {
            const symbol = pos.symbol ?? -1;
            if (!positionsBySymbol.has(symbol)) {
              positionsBySymbol.set(symbol, new Set());
            }
            positionsBySymbol.get(symbol)!.add(`${pos.row}-${pos.col}`);
          });

          // Анимируем каждую группу символов отдельно
          for (const [, positions] of positionsBySymbol) {
            setWinningCells(positions);
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          
          // Взрываем все выигрышные позиции
          const allWinPositions = new Set<string>();
          cascade.winning_positions.forEach((pos) => {
            allWinPositions.add(`${pos.row}-${pos.col}`);
          });
          
          setCascadeWin((prev) => prev + cascade.win);
          setExplodingCells(allWinPositions);
          await new Promise((resolve) => setTimeout(resolve, 400));
          setExplodingCells(new Set());
          setWinningCells(new Set());
          
          // Анимируем падение новых символов если есть следующий каскад
          if (i + 1 < cascades.length) {
            const nextCascade = cascades[i + 1];
            const nextGrid: Symbol[][] = nextCascade.grid.map((row: number[]) =>
              row.map((cell: number) => {
                if (cell === 100) return { type: "scatter" as const };
                if (cell >= 200) return { type: "candy" as const, multiplier: cell - 200 };
                return cell;
              })
            );
            await animateCascadeDrop(nextGrid, allWinPositions);
          }
        }
      }

      // Сохраняем номер игры
      if (result.game_number) {
        setLastGameNumber(result.game_number);
      }

      // Обновляем накопленный множитель во фриспинах
      if (hasFreespins && result.multiplier_sum > 0) {
        setAccumulatedMultiplier((prev) => prev + result.multiplier_sum);
      }

      // Уведомления
      if (result.bonus_spins > 0) {
        toast.success(`🎲 БОНУС! Получено ${result.bonus_spins} фриспинов!`, {
          description: `${result.scatter_count} скаттеров на поле!`,
        });
        queryClient.invalidateQueries({ queryKey: ["user-freespins"] });
      }

      if (result.win_amount > 0) {
        const bombInfo = result.multiplier_sum > 0 ? ` 💣x${result.multiplier_sum}` : "";
        toast.success(`${hasFreespins ? "🎰 " : ""}Выигрыш ${result.win_amount.toFixed(0)}₽${bombInfo}`);
      } else if (hasFreespins) {
        const bombInfo = result.multiplier_sum > 0 ? ` (💣x${result.multiplier_sum})` : "";
        toast.info(`Фриспин использован${bombInfo}`);
      }

      // Сбрасываем накопленный множитель если фриспины закончились
      if (hasFreespins) {
        queryClient.invalidateQueries({ queryKey: ["user-freespins", userId] });
        const updatedFreespins = freespins - 1;
        if (updatedFreespins <= 0) {
          setAccumulatedMultiplier(0);
        }
      }

      onBalanceUpdate();

    } catch (err) {
      console.error("Slots error:", err);
      toast.error("Ошибка игры");
    }

    setCascadeWin(0);
    setSpinning(false);
  };

  const getSymbolImage = (cell: Symbol | null) => {
    if (cell === null) return null;
    if (typeof cell === "number") {
      return SYMBOLS[cell];
    }
    return null;
  };

  // Получение цвета бомбочки в зависимости от множителя
  const getBombStyle = (multiplier: number) => {
    if (multiplier >= 1000) {
      return {
        filter: "drop-shadow(0 0 8px gold) brightness(1.3) sepia(1) saturate(5) hue-rotate(15deg)",
        className: "animate-pulse",
      };
    } else if (multiplier >= 100) {
      return {
        filter: "drop-shadow(0 0 6px #ff4444) brightness(1.2) hue-rotate(-30deg)",
        className: "",
      };
    } else if (multiplier >= 50) {
      return {
        filter: "drop-shadow(0 0 5px #aa44ff) brightness(1.1) hue-rotate(240deg)",
        className: "",
      };
    } else if (multiplier >= 25) {
      return {
        filter: "drop-shadow(0 0 4px #4488ff) hue-rotate(180deg)",
        className: "",
      };
    } else if (multiplier >= 10) {
      return {
        filter: "drop-shadow(0 0 3px #44ff44) hue-rotate(90deg)",
        className: "",
      };
    }
    return {
      filter: "drop-shadow(0 0 2px #ff8844)",
      className: "",
    };
  };

  const renderCell = (cell: Symbol | null, rowIndex: number, colIndex: number) => {
    const isWinning = winningCells.has(`${rowIndex}-${colIndex}`);
    const isFalling = fallingCells.has(`${rowIndex}-${colIndex}`);
    const isExploding = explodingCells.has(`${rowIndex}-${colIndex}`);
    const isScatter = cell !== null && typeof cell === "object" && cell.type === "scatter";
    const isMultiplierBomb = cell !== null && typeof cell === "object" && cell.type === "candy";
    const symbolImage = getSymbolImage(cell);
    const isEmpty = cell === null;

    const bombStyle = isMultiplierBomb
      ? getBombStyle((cell as { type: "candy"; multiplier: number }).multiplier)
      : null;

    return (
      <div
        key={`${rowIndex}-${colIndex}`}
        className={`relative w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 flex items-center justify-center bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg border-2 overflow-hidden transition-all duration-200 ${
          isFalling ? "animate-cascade-drop" : ""
        } ${
          isExploding ? "animate-explode" : ""
        } ${
          isWinning
            ? "border-yellow-400 bg-gradient-to-br from-yellow-500/40 to-orange-500/40 shadow-[0_0_20px_rgba(234,179,8,0.8)] scale-110 animate-winning-pulse"
            : "border-purple-400/30"
        } ${
          isMultiplierBomb ? "border-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]" : ""
        } ${isEmpty ? "opacity-30" : ""}`}
      >
        {isScatter ? (
          <img 
            src={scatterImg} 
            alt="scatter" 
            className={`w-9 h-9 sm:w-10 sm:h-10 object-contain ${isWinning ? 'animate-bounce' : ''}`} 
          />
        ) : isMultiplierBomb ? (
          <div className={`relative flex items-center justify-center ${bombStyle?.className || ""}`}>
            <img
              src={multiplierBombImg}
              alt="multiplier"
              className={`w-9 h-9 sm:w-10 sm:h-10 object-contain ${isWinning ? 'animate-spin' : ''}`}
              style={{ filter: bombStyle?.filter }}
            />
            <span
              className={`absolute inset-0 flex items-center justify-center text-[10px] sm:text-[11px] font-black drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
                (cell as { multiplier: number }).multiplier >= 1000
                  ? "text-yellow-300"
                  : (cell as { multiplier: number }).multiplier >= 100
                    ? "text-red-300"
                    : (cell as { multiplier: number }).multiplier >= 50
                      ? "text-purple-300"
                      : (cell as { multiplier: number }).multiplier >= 25
                        ? "text-blue-300"
                        : (cell as { multiplier: number }).multiplier >= 10
                          ? "text-green-300"
                          : "text-orange-200"
              }`}
            >
              x{(cell as { multiplier: number }).multiplier}
            </span>
          </div>
        ) : symbolImage ? (
          <img 
            src={symbolImage} 
            alt="symbol" 
            className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 object-contain ${isWinning ? 'animate-bounce' : ''}`} 
          />
        ) : null}
        
        {/* Эффект свечения для выигрышных ячеек */}
        {isWinning && (
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/30 to-orange-400/30 animate-pulse rounded-lg pointer-events-none" />
        )}
        
        {/* Частицы взрыва */}
        {isExploding && (
          <>
            <div className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-particle-1" />
            <div className="absolute w-2 h-2 bg-orange-400 rounded-full animate-particle-2" />
            <div className="absolute w-2 h-2 bg-red-400 rounded-full animate-particle-3" />
            <div className="absolute w-2 h-2 bg-pink-400 rounded-full animate-particle-4" />
          </>
        )}
      </div>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl sm:text-2xl text-center flex items-center justify-center gap-2">
          🍬 Sweet Bonanza
          {lastGameNumber && (
            <span className="text-sm font-mono text-muted-foreground">#{lastGameNumber}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Сетка 5x6 */}
        <div
          className="flex flex-col gap-1 p-2 sm:p-3 rounded-lg border-2 border-purple-500/30 mx-auto"
          style={{
            backgroundImage: `url(${sweetBonanzaBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            maxWidth: "fit-content",
          }}
        >
          {grid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1">
              {row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))}
            </div>
          ))}
        </div>

        {/* Текущий каскадный выигрыш */}
        {cascadeWin > 0 && (
          <div className="text-center p-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30 animate-pulse">
            <span className="text-green-400 font-bold text-lg">💰 Каскад: +{cascadeWin.toFixed(0)}₽</span>
          </div>
        )}

        {/* Накопленный множитель во фриспинах */}
        {freespins > 0 && accumulatedMultiplier > 0 && (
          <div className="text-center p-2 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-lg border border-orange-500/30">
            <span className="text-orange-400 font-bold">💣 Сумма множителей: x{accumulatedMultiplier}</span>
          </div>
        )}

        {/* Таблица выплат краткая */}
        <div className="bg-muted/30 rounded-lg p-2 text-xs">
          <div className="text-center text-muted-foreground mb-1 font-medium text-[11px]">
            Выплаты (8-9 / 10-11 / 12+ символов)
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">
            {[8, 7, 6, 5, 4, 3].map((sym) => (
              <div key={sym} className="flex items-center justify-center gap-1">
                <img src={SYMBOLS[sym]} alt="" className="w-4 h-4" />
                <span className="text-muted-foreground text-[9px]">
                  x{PAYTABLE[sym]["8-9"]}/{PAYTABLE[sym]["10-11"]}/{PAYTABLE[sym]["12+"]}
                </span>
              </div>
            ))}
          </div>
          <div className="text-center text-muted-foreground mt-1 text-[9px]">
            4+ <img src={scatterImg} alt="" className="w-3 h-3 inline" /> = 10 фриспинов | 💣 2x-1000x
          </div>
        </div>

        {/* Фриспины */}
        {freespins > 0 && (
          <div className="flex items-center justify-center gap-2 p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
            <span className="text-lg">🎰</span>
            <span className="text-purple-300 font-bold">
              ФРИСПИНЫ: {freespins} (ставка {freespinBetAmount}₽)
            </span>
          </div>
        )}

        {/* Управление */}
        <div className="flex flex-col gap-2">
          {/* Выбор ставки */}
          {freespins === 0 && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowBetPicker(!showBetPicker)}
                variant="outline"
                className="h-10 flex-1 text-base font-bold"
                disabled={spinning}
              >
                Ставка: {selectedBet}₽
              </Button>
            </div>
          )}

          {/* Сетка выбора ставки */}
          {showBetPicker && freespins === 0 && (
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 p-2 bg-muted/30 rounded-lg max-h-40 overflow-y-auto">
              {BET_OPTIONS.map((betOption) => (
                <Button
                  key={betOption}
                  onClick={() => {
                    setSelectedBet(betOption);
                    setShowBetPicker(false);
                  }}
                  variant={selectedBet === betOption ? "default" : "outline"}
                  size="sm"
                  className={`text-xs ${selectedBet === betOption ? "bg-purple-500" : ""}`}
                  disabled={betOption > balance}
                >
                  {betOption}
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={spin}
              disabled={spinning}
              className="h-10 text-base px-6 flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {spinning ? "🎰..." : freespins > 0 ? `ФРИСПИН (${freespins})` : "КРУТИТЬ"}
            </Button>
            <Button
              onClick={() => setShowBonusBuy(!showBonusBuy)}
              variant="outline"
              className="h-10 text-sm"
              disabled={spinning || freespins > 0}
            >
              💎 {bonusPrice}₽
            </Button>
          </div>
        </div>

        {/* Покупка бонуса */}
        {showBonusBuy && (
          <div className="p-2 bg-muted/30 rounded-lg">
            <div className="text-center mb-2">
              <p className="text-muted-foreground text-sm">Покупка бонуса за {bonusPrice}₽</p>
              <p className="text-xs text-muted-foreground">(100x от ставки {selectedBet}₽)</p>
            </div>
            <Button
              onClick={buyBonusRound}
              disabled={balance < bonusPrice}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              Купить 10 фриспинов
            </Button>
          </div>
        )}
      </CardContent>

      <style>{`
        @keyframes cascade-drop {
          0% {
            opacity: 0;
            transform: translateY(-150%) scale(0.8) rotate(-10deg);
          }
          50% {
            transform: translateY(10%) scale(1.1) rotate(5deg);
          }
          75% {
            transform: translateY(-5%) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
          }
        }
        
        .animate-cascade-drop {
          animation: cascade-drop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes explode {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          30% {
            transform: scale(1.4);
            opacity: 1;
            filter: brightness(2) saturate(2);
          }
          60% {
            transform: scale(1.6);
            opacity: 0.6;
            filter: brightness(3) saturate(3);
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }
        
        .animate-explode {
          animation: explode 0.6s ease-out forwards;
        }
        
        @keyframes winning-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(234, 179, 8, 0.8);
            transform: scale(1.1);
          }
          50% {
            box-shadow: 0 0 35px rgba(234, 179, 8, 1);
            transform: scale(1.15);
          }
        }
        
        .animate-winning-pulse {
          animation: winning-pulse 0.5s ease-in-out infinite;
        }
        
        @keyframes particle-1 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-30px, -35px) scale(0); opacity: 0; }
        }
        
        @keyframes particle-2 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(30px, -35px) scale(0); opacity: 0; }
        }
        
        @keyframes particle-3 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-35px, 25px) scale(0); opacity: 0; }
        }
        
        @keyframes particle-4 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(35px, 25px) scale(0); opacity: 0; }
        }
        
        .animate-particle-1 { animation: particle-1 0.6s ease-out forwards; }
        .animate-particle-2 { animation: particle-2 0.6s ease-out forwards; }
        .animate-particle-3 { animation: particle-3 0.6s ease-out forwards; }
        .animate-particle-4 { animation: particle-4 0.6s ease-out forwards; }
        
        .animate-particle-1 { animation: particle-1 0.4s ease-out forwards; }
        .animate-particle-2 { animation: particle-2 0.4s ease-out forwards; }
        .animate-particle-3 { animation: particle-3 0.4s ease-out forwards; }
        .animate-particle-4 { animation: particle-4 0.4s ease-out forwards; }
      `}</style>
    </Card>
  );
};
