import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// Импорт Dogs House символов
import rottweilerImg from "@/assets/slots/dogs-house/rottweiler.png";
import pugImg from "@/assets/slots/dogs-house/pug.png";
import dachshundImg from "@/assets/slots/dogs-house/dachshund.png";
import shihtzuImg from "@/assets/slots/dogs-house/shihtzu.png";
import tenImg from "@/assets/slots/dogs-house/ten.png";
import jackImg from "@/assets/slots/dogs-house/jack.png";
import queenImg from "@/assets/slots/dogs-house/queen.png";
import kingImg from "@/assets/slots/dogs-house/king.png";
import aceImg from "@/assets/slots/dogs-house/ace.png";
import wildImg from "@/assets/slots/dogs-house/wild.png";
import bonusImg from "@/assets/slots/dogs-house/bonus.png";
import boneImg from "@/assets/slots/dogs-house/bone.png";
import backgroundImg from "@/assets/slots/dogs-house/background.jpg";
import reelFrameNewImg from "@/assets/slots/dogs-house/reel-frame-new.png";
import logoImg from "@/assets/slots/dogs-house/logo.png";

interface DogsHouseSlotsProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

type Symbol = number | { type: 'wild'; multiplier: 2 | 3 } | { type: 'bonus' };

// Символы Dogs House
const SYMBOLS: Record<number, string> = {
  1: rottweilerImg,
  2: pugImg,
  3: dachshundImg,
  4: shihtzuImg,
  5: boneImg,
  6: boneImg,
  7: aceImg,
  8: kingImg,
  9: queenImg,
  10: jackImg,
  11: tenImg,
};

// Все символы для барабанов
const ALL_SYMBOL_IMAGES = [
  rottweilerImg, pugImg, dachshundImg, shihtzuImg, boneImg,
  aceImg, kingImg, queenImg, jackImg, tenImg, wildImg, bonusImg
];

// Таблица выплат
const PAYTABLE: Record<number, number[]> = {
  1: [0, 0, 5, 15, 37.5],
  2: [0, 0, 3.75, 10, 25],
  3: [0, 0, 2.5, 7.5, 15],
  4: [0, 0, 1.5, 5, 10],
  5: [0, 0, 1.25, 3.75, 7.5],
  6: [0, 0, 1.25, 3.75, 7.5],
  7: [0, 0, 1, 2.5, 5],
  8: [0, 0, 1, 2.5, 5],
  9: [0, 0, 0.5, 1.25, 2.5],
  10: [0, 0, 0.5, 1.25, 2.5],
  11: [0, 0, 0.5, 1.25, 2.5],
};

// 20 линий выплат
const PAYLINES: number[][][] = [
  [[0,1],[1,1],[2,1],[3,1],[4,1]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]],
  [[0,2],[1,2],[2,2],[3,2],[4,2]],
  [[0,0],[1,1],[2,2],[3,1],[4,0]],
  [[0,2],[1,1],[2,0],[3,1],[4,2]],
  [[0,1],[1,0],[2,0],[3,0],[4,1]],
  [[0,1],[1,2],[2,2],[3,2],[4,1]],
  [[0,0],[1,0],[2,1],[3,2],[4,2]],
  [[0,2],[1,2],[2,1],[3,0],[4,0]],
  [[0,1],[1,0],[2,1],[3,2],[4,1]],
  [[0,1],[1,2],[2,1],[3,0],[4,1]],
  [[0,0],[1,1],[2,0],[3,1],[4,0]],
  [[0,2],[1,1],[2,2],[3,1],[4,2]],
  [[0,0],[1,1],[2,1],[3,1],[4,0]],
  [[0,2],[1,1],[2,1],[3,1],[4,2]],
  [[0,1],[1,1],[2,0],[3,1],[4,1]],
  [[0,1],[1,1],[2,2],[3,1],[4,1]],
  [[0,0],[1,0],[2,2],[3,0],[4,0]],
  [[0,2],[1,2],[2,0],[3,2],[4,2]],
  [[0,0],[1,2],[2,0],[3,2],[4,0]],
];

const ROWS = 3;
const COLS = 5;

// Волновая анимация падения символов (как в SlotsGame)
const animateWaveDrop = (
  setGrid: React.Dispatch<React.SetStateAction<(Symbol | null)[][]>>,
  setFallingCells: React.Dispatch<React.SetStateAction<Set<string>>>,
  finalGrid: Symbol[][],
  animationRef: React.MutableRefObject<boolean>
): Promise<void> => {
  return new Promise((resolve) => {
    animationRef.current = true;

    // Сначала очищаем сетку
    setGrid(
      Array(ROWS)
        .fill(null)
        .map(() => Array(COLS).fill(null))
    );
    setFallingCells(new Set());

    const cellDelay = 50; // Задержка между падением каждой ячейки (мс)
    const colDelay = ROWS * cellDelay; // Задержка между колонками

    // Падаем по колонкам слева направо
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const delay = col * colDelay + row * cellDelay;

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
          }, 150);
        }, delay);
      }
    }

    // Завершаем анимацию
    const totalDuration = COLS * colDelay + 200;
    setTimeout(() => {
      animationRef.current = false;
      resolve();
    }, totalDuration);
  });
};

// Получение изображения символа
const getSymbolImage = (symbol: Symbol | null): string | null => {
  if (symbol === null) return null;
  if (typeof symbol === 'object' && symbol.type === 'wild') return wildImg;
  if (typeof symbol === 'object' && symbol.type === 'bonus') return bonusImg;
  return SYMBOLS[symbol as number] || SYMBOLS[1];
};

export const DogsHouseSlots = ({ userId, balance, onBalanceUpdate }: DogsHouseSlotsProps) => {
  const [bet, setBet] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [lastGameNumber, setLastGameNumber] = useState<number | null>(null);
  const [grid, setGrid] = useState<(Symbol | null)[][]>(
    Array(ROWS).fill(null).map(() => Array(COLS).fill(1))
  );
  const [fallingCells, setFallingCells] = useState<Set<string>>(new Set());
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [showBonusBuy, setShowBonusBuy] = useState(false);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [showBonusGame, setShowBonusGame] = useState(false);
  const [bonusGrid, setBonusGrid] = useState<number[][]>([]);
  const [bonusRevealed, setBonusRevealed] = useState<boolean[][]>([]);
  const [pendingFreespins, setPendingFreespins] = useState(0);
  const [pendingBetAmount, setPendingBetAmount] = useState(0);
  const [stickyWilds, setStickyWilds] = useState<Map<string, number>>(new Map()); // позиция -> множитель
  const { canAct } = useSpamProtection();
  const queryClient = useQueryClient();
  const animationRef = useRef<boolean>(false);

  const { data: freespinsData } = useQuery({
    queryKey: ["user-freespins-dogs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_freespins")
        .select("*")
        .eq("user_id", userId)
        .single();
      return data;
    },
    staleTime: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('freespins-dogs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_freespins', filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["user-freespins-dogs", userId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const freespins = freespinsData?.freespins_count || 0;
  const freespinBetAmount = freespinsData?.freespin_bet_amount || 16;

  const BONUS_PACKAGES = [
    { price: 200, betAmount: 16 },
    { price: 400, betAmount: 32 },
    { price: 750, betAmount: 64 },
    { price: 1500, betAmount: 128 },
    { price: 3000, betAmount: 256 },
    { price: 6000, betAmount: 512 },
    { price: 12000, betAmount: 1024 },
    { price: 25000, betAmount: 2048 },
    { price: 50000, betAmount: 4096 },
    { price: 120000, betAmount: 10000 },
  ];

  // BONUS только на барабанах 0, 2, 4 (1, 3, 5)
  // WILD только на барабанах 1, 2, 3 (2, 3, 4)
  const getWeightedSymbol = (isFreeSpin: boolean, col: number): Symbol => {
    const weights = [15, 20, 25, 30, 35, 35, 40, 40, 45, 45, 45];
    
    // Во фриспинах BONUS не появляется
    // BONUS только на барабанах 0, 2, 4
    const canBonus = !isFreeSpin && (col === 0 || col === 2 || col === 4);
    if (canBonus) weights.push(5);
    
    // WILD только на барабанах 1, 2, 3
    const canWild = col >= 1 && col <= 3;
    if (canWild) weights.push(isFreeSpin ? 40 : 20);
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let sum = 0;
    
    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random < sum) {
        if (i === 11 && canBonus) return { type: 'bonus' };
        if ((i === 11 && !canBonus && canWild) || (i === 12 && canWild)) {
          // Случайный множитель для WILD: 2x или 3x
          return { type: 'wild', multiplier: Math.random() < 0.5 ? 2 : 3 };
        }
        return (i + 1) as number;
      }
    }
    return 1;
  };

  // Генерация сетки 3x3 для бонус-игры (1, 2 или 3 в каждой ячейке)
  const generateBonusGrid = (): number[][] => {
    return Array(3).fill(null).map(() => 
      Array(3).fill(null).map(() => {
        const rnd = Math.random();
        if (rnd < 0.4444) return 1;
        if (rnd < 0.8888) return 2;
        return 3;
      })
    );
  };

  // Запуск бонус-игры
  const startBonusGame = (betAmount: number) => {
    const newBonusGrid = generateBonusGrid();
    setBonusGrid(newBonusGrid);
    setBonusRevealed(Array(3).fill(null).map(() => Array(3).fill(false)));
    setPendingBetAmount(betAmount);
    setShowBonusGame(true);
    
    // Автоматическое открытие ячеек с анимацией
    let delay = 0;
    let total = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        setTimeout(() => {
          setBonusRevealed(prev => {
            const newRevealed = prev.map(r => [...r]);
            newRevealed[row][col] = true;
            return newRevealed;
          });
          total += newBonusGrid[row][col];
          setPendingFreespins(total);
        }, delay);
        delay += 300;
      }
    }
    
    // Завершение бонус-игры
    setTimeout(async () => {
      const finalTotal = newBonusGrid.flat().reduce((a, b) => a + b, 0);
      
      const { data: currentFreespins } = await supabase
        .from("user_freespins")
        .select("freespins_count")
        .eq("user_id", userId)
        .single();

      const newCount = (currentFreespins?.freespins_count || 0) + finalTotal;

      await supabase
        .from("user_freespins")
        .upsert({
          user_id: userId,
          freespins_count: newCount,
          freespin_bet_amount: betAmount,
        }, { onConflict: "user_id" });

      // Очищаем sticky wilds при начале нового бонуса
      setStickyWilds(new Map());
      
      toast.success(`🐕 Бонус! Получено ${finalTotal} фриспинов!`);
      queryClient.invalidateQueries({ queryKey: ["user-freespins-dogs"] });
      
      setTimeout(() => {
        setShowBonusGame(false);
        setPendingFreespins(0);
      }, 1500);
    }, delay + 500);
  };

  const buyBonusRound = async (packageIndex: number) => {
    if (!canAct()) return;
    
    const pkg = BONUS_PACKAGES[packageIndex];
    if (balance < pkg.price) {
      toast.error("Недостаточно средств");
      return;
    }

    const freespinsToAdd = Math.floor(Math.random() * 6) + 10;

    try {
      await supabase.rpc("update_balance", { user_id: userId, amount: -pkg.price });
      
      const { data: currentFreespins } = await supabase
        .from("user_freespins")
        .select("freespins_count")
        .eq("user_id", userId)
        .single();

      const newCount = (currentFreespins?.freespins_count || 0) + freespinsToAdd;

      await supabase
        .from("user_freespins")
        .upsert({
          user_id: userId,
          freespins_count: newCount,
          freespin_bet_amount: pkg.betAmount,
        }, { onConflict: "user_id" });

      setShowBonusBuy(false);
      toast.success(`🎰 Куплено ${freespinsToAdd} фриспинов по ${pkg.betAmount}₽!`);
      onBalanceUpdate();
      queryClient.invalidateQueries({ queryKey: ["user-freespins-dogs"] });
    } catch (error) {
      toast.error("Ошибка покупки");
    }
  };

  const spin = async () => {
    if (!canAct() || spinning) return;

    const amount = parseFloat(bet);
    const hasFreespins = freespins > 0;
    const actualBet = hasFreespins ? freespinBetAmount : amount;

    if (!hasFreespins && (!amount || amount < 10 || amount > 500000)) {
      toast.error("Ставка от 10₽ до 500,000₽");
      return;
    }

    if (!hasFreespins && amount > balance) {
      toast.error("Недостаточно средств");
      return;
    }

    setSpinning(true);
    setWinningCells(new Set());
    setLastWin(null);

    try {
      // Вызываем серверную RPC для Dogs House
      const { data: result, error } = await supabase.rpc("play_dogs_house", {
        _user_id: userId,
        _bet_amount: actualBet,
        _use_freebet: false,
        _use_demo: false,
      });

      if (error || !result?.success) {
        toast.error(result?.message || "Ошибка игры");
        setSpinning(false);
        return;
      }

      // Преобразуем серверную сетку в клиентский формат
      const serverGrid = result.grid as number[][];
      const finalGrid: Symbol[][] = serverGrid.map((row: number[]) =>
        row.map((cell: number) => {
          if (cell === 30) return { type: 'bonus' as const };
          if (cell === 21) return { type: 'wild' as const, multiplier: 2 as const };
          if (cell === 22) return { type: 'wild' as const, multiplier: 3 as const };
          if (cell >= 20 && cell < 30) return { type: 'wild' as const, multiplier: 2 as const };
          return cell as number;
        })
      );

      // Обновляем sticky wilds
      if (result.sticky_wilds && typeof result.sticky_wilds === 'object') {
        const newStickyWilds = new Map<string, number>();
        Object.entries(result.sticky_wilds).forEach(([key, value]) => {
          newStickyWilds.set(key, (value as number) === 22 ? 3 : 2);
        });
        setStickyWilds(newStickyWilds);
      }

      // Запускаем волновую анимацию
      await animateWaveDrop(setGrid, setFallingCells, finalGrid, animationRef);

      // Сохраняем номер игры
      if (result.game_number) {
        setLastGameNumber(result.game_number);
      }

      setLastWin(result.win_amount);

      // Уведомления
      if (result.bonus_spins > 0) {
        toast.success(`🐕 БОНУС! Получено ${result.bonus_spins} фриспинов!`);
        queryClient.invalidateQueries({ queryKey: ["user-freespins-dogs"] });
      }

      if (result.win_amount > 0) {
        const multiplier = result.multiplier;
        toast.success(`${hasFreespins ? '🎰 Фриспин! ' : ''}💰 Выигрыш ${result.win_amount.toFixed(2)}₽ (x${multiplier.toFixed(2)}) 🎉`, {
          duration: 4000,
        });
      } else if (hasFreespins) {
        toast.info(`Фриспин использован`);
      }

      // Сбрасываем sticky wilds если фриспины закончились
      if (hasFreespins) {
        queryClient.invalidateQueries({ queryKey: ["user-freespins-dogs", userId] });
        const updatedFreespins = freespins - 1;
        if (updatedFreespins <= 0) {
          setStickyWilds(new Map());
        }
      }

      onBalanceUpdate();

      setTimeout(() => setWinningCells(new Set()), 4000);
    } catch (err) {
      console.error("Dogs House error:", err);
      toast.error("Ошибка игры");
    }

    setSpinning(false);
  };

  return (
    <Card className="border-amber-500/30 bg-gradient-to-b from-amber-950/50 to-red-950/50 overflow-hidden">
      <CardHeader className="py-2">
        <CardTitle className="text-center flex items-center justify-center gap-2 text-xl">
          🐕 The Dog House
          {lastGameNumber && (
            <span className="text-sm font-mono text-muted-foreground">#{lastGameNumber}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 space-y-4">
        {/* Игровое поле - будка с крышей и костью */}
        <div className="relative w-full max-w-2xl mx-auto">
          {/* Фон будки - ровно в рамке */}
          <div 
            className="absolute inset-0 rounded-2xl overflow-hidden"
            style={{
              backgroundImage: `url(${backgroundImg})`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.7,
            }}
          />
          
          {/* Крыша сверху - наезжает на будку */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-[95%] h-16 z-20">
            <div 
              className="w-full h-full"
              style={{
                background: 'linear-gradient(180deg, #8B4513 0%, #654321 50%, #5D3A1A 100%)',
                clipPath: 'polygon(0% 100%, 50% 0%, 100% 100%)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                border: '3px solid #4A2C0D',
                borderRadius: '4px',
              }}
            />
            {/* Текстура крыши */}
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(0,0,0,0.2) 10px, rgba(0,0,0,0.2) 12px)',
              clipPath: 'polygon(0% 100%, 50% 0%, 100% 100%)',
            }} />
          </div>
          
          {/* Кость на крыше - чуть наезжает */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-30">
            <img 
              src={boneImg} 
              alt="bone" 
              className="w-16 h-16 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] rotate-12"
            />
          </div>
          
          {/* Логотип под крышей */}
          <div className="relative z-10 flex justify-center pt-16 pb-3">
            <img src={logoImg} alt="The Dog House" className="w-44 drop-shadow-2xl" />
          </div>

          {/* Сетка барабанов - будка */}
          <div className="relative z-10 px-2 sm:px-6 pb-4">
            <div 
              className="p-2 sm:p-3 rounded-xl border-4 border-amber-700/70 shadow-2xl overflow-hidden"
              style={{ 
                backgroundImage: `url(${reelFrameNewImg})`, 
                backgroundSize: 'cover',
                boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)'
              }}
            >
              {/* Сетка 3x5 */}
              <div className="flex flex-col gap-1">
                {grid.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-2">
                    {row.map((cell, colIndex) => {
                      const isWinning = winningCells.has(`${colIndex}-${rowIndex}`);
                      const isFalling = fallingCells.has(`${rowIndex}-${colIndex}`);
                      const isWild = cell !== null && typeof cell === 'object' && cell.type === 'wild';
                      const isBonus = cell !== null && typeof cell === 'object' && cell.type === 'bonus';
                      const wildMultiplier = isWild && 'multiplier' in (cell as { type: 'wild'; multiplier: 2 | 3 }) ? (cell as { type: 'wild'; multiplier: 2 | 3 }).multiplier : null;
                      const symbolImage = getSymbolImage(cell);
                      const isEmpty = cell === null;

                      return (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={cn(
                            "relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center rounded-lg border-2 overflow-hidden",
                            isFalling ? "animate-[slideDown_0.15s_ease-out]" : "",
                            isWinning
                              ? "border-yellow-400 bg-gradient-to-br from-yellow-500/40 to-orange-500/40 shadow-[0_0_15px_rgba(234,179,8,0.6)] scale-110"
                              : "border-amber-600/30 bg-amber-900/20",
                            isEmpty ? "opacity-50" : ""
                          )}
                          style={{ transition: "all 0.2s ease-out" }}
                        >
                          {symbolImage && (
                            <img
                              src={symbolImage}
                              alt="symbol"
                              className={cn(
                                "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain",
                                isWinning && "drop-shadow-[0_0_15px_rgba(251,191,36,1)] brightness-110"
                              )}
                            />
                          )}
                          
                          {/* Множитель Wild + индикатор Sticky */}
                          {wildMultiplier && (
                            <div className={cn(
                              "absolute bottom-0.5 right-0.5 text-black text-[9px] font-black px-1 py-0.5 rounded shadow-lg z-20",
                              stickyWilds.has(`${rowIndex}-${colIndex}`)
                                ? "bg-gradient-to-r from-purple-500 to-pink-500"
                                : "bg-gradient-to-r from-yellow-500 to-orange-500"
                            )}>
                              x{wildMultiplier}
                            </div>
                          )}
                          
                          {/* Индикатор Sticky Wild */}
                          {stickyWilds.has(`${rowIndex}-${colIndex}`) && (
                            <div className="absolute top-0.5 left-0.5 text-[8px] font-bold text-purple-300 bg-purple-900/80 px-1 rounded z-20">
                              STICKY
                            </div>
                          )}

                          {/* Эффект выигрыша */}
                          {isWinning && (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 animate-pulse rounded-lg" />
                              <div className="absolute -top-1 -left-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping z-20" />
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping z-20" style={{ animationDelay: '0.1s' }} />
                              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping z-20" style={{ animationDelay: '0.2s' }} />
                              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping z-20" style={{ animationDelay: '0.3s' }} />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Выигрыш */}
          {lastWin !== null && lastWin > 0 && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-40 flex justify-center pointer-events-none">
              <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white text-3xl sm:text-5xl font-black px-8 py-4 rounded-2xl shadow-2xl animate-bounce">
                +{lastWin.toFixed(0)}₽
              </div>
            </div>
          )}
        </div>

        {/* Фриспины */}
        {freespins > 0 && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 p-4 rounded-xl text-center border-2 border-yellow-500 animate-pulse">
            <div className="text-sm text-yellow-400 font-bold">🎰 БОНУСНЫЕ СПИНЫ 🎰</div>
            <div className="text-4xl font-black text-yellow-400">{freespins}</div>
            <div className="text-sm text-muted-foreground">Ставка: {freespinBetAmount}₽</div>
            {stickyWilds.size > 0 && (
              <div className="mt-2 text-xs text-purple-300">
                🔒 Sticky WILD: {stickyWilds.size} шт. (сумма x{Array.from(stickyWilds.values()).reduce((a, b) => a + b, 0)})
              </div>
            )}
          </div>
        )}

        {/* Управление */}
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">
              {freespins > 0 ? `Бонус-спин (${freespinBetAmount}₽)` : "Ставка (₽)"}
            </label>
            <Input
              type="number"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              placeholder={freespins > 0 ? `Бонус по ${freespinBetAmount}₽` : "10 - 500,000₽"}
              disabled={spinning || freespins > 0}
              className="bg-background/50 border-amber-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={spin}
              disabled={spinning || (freespins === 0 && !bet)}
              className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-black font-bold text-lg py-6"
            >
              {spinning ? "🎰 Крутится..." : freespins > 0 ? `🎰 СПИН (${freespins})` : "🎰 КРУТИТЬ"}
            </Button>
            
            <Button
              onClick={() => setShowBonusBuy(!showBonusBuy)}
              disabled={spinning}
              variant="secondary"
              className="font-bold text-lg py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              💎 БОНУС
            </Button>
          </div>
        </div>

        {/* Покупка бонуса */}
        {showBonusBuy && (
          <div className="p-4 bg-gradient-to-b from-purple-900/50 to-pink-900/50 rounded-xl border-2 border-purple-500 space-y-3">
            <h3 className="font-bold text-center text-lg">🎁 Купить бонус раунд</h3>
            <p className="text-xs text-muted-foreground text-center">
              10-15 бонусных спинов с фиксированной ставкой
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {BONUS_PACKAGES.map((pkg, index) => (
                <Button
                  key={index}
                  onClick={() => buyBonusRound(index)}
                  disabled={balance < pkg.price || spinning}
                  variant="outline"
                  className="flex flex-col h-auto py-2 hover:bg-purple-500/20 border-purple-500/50"
                >
                  <div className="text-base font-black text-yellow-400">{pkg.price}₽</div>
                  <div className="text-[10px] text-muted-foreground">по {pkg.betAmount}₽</div>
                </Button>
              ))}
            </div>

            <Button onClick={() => setShowBonusBuy(false)} variant="ghost" className="w-full">
              ❌ Закрыть
            </Button>
          </div>
        )}

        {/* Бонус-игра 3x3 */}
        {showBonusGame && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-amber-950 to-red-950 rounded-2xl p-6 border-4 border-yellow-500 shadow-2xl max-w-sm w-full">
              <div className="text-center mb-4">
                <h3 className="text-2xl font-black text-yellow-400 mb-2">🎰 БОНУС-ИГРА 🎰</h3>
                <p className="text-amber-200 text-sm">Открываются ячейки с фриспинами!</p>
              </div>
              
              {/* Сетка 3x3 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {bonusGrid.map((row, rowIndex) => 
                  row.map((value, colIndex) => {
                    const isRevealed = bonusRevealed[rowIndex]?.[colIndex];
                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={cn(
                          "aspect-square rounded-lg flex items-center justify-center text-3xl font-black transition-all duration-300",
                          isRevealed
                            ? "bg-gradient-to-br from-yellow-500 to-orange-500 text-black scale-100"
                            : "bg-gradient-to-br from-amber-800 to-amber-900 text-transparent scale-90"
                        )}
                        style={{
                          boxShadow: isRevealed ? '0 0 20px rgba(234,179,8,0.6)' : 'inset 0 2px 10px rgba(0,0,0,0.5)'
                        }}
                      >
                        {isRevealed ? value : "?"}
                      </div>
                    );
                  })
                )}
              </div>
              
              {/* Сумма фриспинов */}
              <div className="text-center">
                <div className="text-amber-300 text-sm mb-1">Всего фриспинов:</div>
                <div className="text-5xl font-black text-yellow-400 animate-pulse">
                  {pendingFreespins}
                </div>
                <div className="text-amber-400 text-sm mt-2">
                  Ставка: {pendingBetAmount}₽
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Таблица выплат */}
        <div className="bg-gradient-to-br from-amber-500/10 to-red-500/10 rounded-lg p-3 border border-amber-500/20">
          <div className="text-xs font-bold text-center mb-2 text-amber-300">Таблица выплат (20 линий)</div>
          <div className="grid grid-cols-6 gap-1 text-xs">
            {[1, 2, 3, 4, 5, 7, 8, 9, 10, 11].map((num) => (
              <div key={num} className="flex flex-col items-center bg-black/30 rounded p-1">
                <img src={SYMBOLS[num]} alt="symbol" className="w-8 h-8 object-contain" />
                <span className="text-yellow-400 font-bold text-[8px]">
                  {PAYTABLE[num]?.[2]}-{PAYTABLE[num]?.[4]}x
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center bg-black/30 rounded p-1">
              <img src={wildImg} alt="wild" className="w-8 h-8 object-contain" />
              <span className="text-green-400 font-bold text-[8px]">x2-x3</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
