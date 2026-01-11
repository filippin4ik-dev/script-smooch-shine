import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BlackjackCard } from "./BlackjackCard";
import blackjackTable from "@/assets/blackjack-table.webp";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface BlackjackGameNewProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

const CARDS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["♠️", "♥️", "♦️", "♣️"];

interface CardType {
  value: string;
  suit: string;
}

type GameState = "betting" | "playing" | "dealer-turn" | "finished";

export const BlackjackGameNew = ({ userId, balance, onBalanceUpdate }: BlackjackGameNewProps) => {
  const [bet, setBet] = useState("");
  const [gameState, setGameState] = useState<GameState>("betting");
  const [playerCards, setPlayerCards] = useState<CardType[]>([]);
  const [dealerCards, setDealerCards] = useState<CardType[]>([]);
  const [canDouble, setCanDouble] = useState(false);
  const [lastGameNumber, setLastGameNumber] = useState<number | null>(null);
  const { canAct } = useSpamProtection();
  const { useFreebet, useDemo } = useBalanceMode();

  const getRandomCard = (): CardType => ({
    value: CARDS[Math.floor(Math.random() * CARDS.length)],
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
  });

  const calculateHandValue = (cards: CardType[]): number => {
    let value = 0;
    let aces = 0;

    cards.forEach((card) => {
      if (card.value === "A") {
        aces += 1;
        value += 11;
      } else if (["J", "Q", "K"].includes(card.value)) {
        value += 10;
      } else {
        value += parseInt(card.value);
      }
    });

    while (value > 21 && aces > 0) {
      value -= 10;
      aces -= 1;
    }

    return value;
  };

  const isBlackjack = (cards: CardType[]): boolean => {
    return cards.length === 2 && calculateHandValue(cards) === 21;
  };

  const startGame = async () => {
    if (!canAct()) return;

    const betAmount = parseFloat(bet);
    
    // Проверяем баланс в зависимости от режима
    const { data: profile } = await supabase
      .from("profiles")
      .select("freebet_balance, demo_balance")
      .eq("id", userId)
      .single();
    
    const availableBalance = useDemo 
      ? (profile?.demo_balance || 0) 
      : useFreebet 
        ? (profile?.freebet_balance || 0) 
        : balance;
    
    if (!betAmount || betAmount < 10 || betAmount > availableBalance) {
      toast.error(useDemo ? "Недостаточно демо-баланса" : useFreebet ? "Недостаточно фрибет баланса" : "Неверная ставка");
      return;
    }

    // Списываем ставку сразу через RPC
    const { error } = await supabase.rpc("play_game", {
      _user_id: userId,
      _game_name: "blackjack_bet",
      _bet_amount: betAmount,
      _win_amount: 0,
      _multiplier: 0,
      _use_freebet: useFreebet,
      _use_demo: useDemo,
    });
    
    if (error) {
      toast.error("Ошибка списания ставки");
      return;
    }

    const pCards = [getRandomCard(), getRandomCard()];
    const dCards = [getRandomCard(), getRandomCard()];

    setPlayerCards(pCards);
    setDealerCards(dCards);
    setGameState("playing");
    setCanDouble(true);

    // Проверка на блекджек
    if (isBlackjack(pCards)) {
      if (isBlackjack(dCards)) {
        finishGame(pCards, dCards);
      } else {
        finishGame(pCards, dCards);
      }
    }
  };

  const hit = () => {
    if (!canAct() || gameState !== "playing") return;

    const newCards = [...playerCards, getRandomCard()];
    setPlayerCards(newCards);
    setCanDouble(false);

    const value = calculateHandValue(newCards);
    if (value >= 21) {
      playDealerTurn(newCards);
    }
  };

  const stand = () => {
    if (!canAct() || gameState !== "playing") return;
    playDealerTurn(playerCards);
  };

  const doubleDown = async () => {
    if (!canAct() || !canDouble) return;

    const betAmount = parseFloat(bet);
    
    // Проверяем баланс в зависимости от режима
    const { data: profile } = await supabase
      .from("profiles")
      .select("freebet_balance, demo_balance")
      .eq("id", userId)
      .single();
    
    const availableBalance = useDemo 
      ? (profile?.demo_balance || 0) 
      : useFreebet 
        ? (profile?.freebet_balance || 0) 
        : balance;
    
    if (betAmount > availableBalance) {
      toast.error(useDemo ? "Недостаточно демо-баланса" : useFreebet ? "Недостаточно фрибет баланса для удвоения" : "Недостаточно средств для удвоения");
      return;
    }

    // Списываем дополнительную ставку через RPC
    const { error } = await supabase.rpc("play_game", {
      _user_id: userId,
      _game_name: "blackjack_double",
      _bet_amount: betAmount,
      _win_amount: 0,
      _multiplier: 0,
      _use_freebet: useFreebet,
      _use_demo: useDemo,
    });

    if (error) {
      toast.error("Ошибка удвоения");
      return;
    }

    setBet((betAmount * 2).toString());
    const newCards = [...playerCards, getRandomCard()];
    setPlayerCards(newCards);
    setCanDouble(false);

    setTimeout(() => {
      playDealerTurn(newCards);
    }, 1000);
  };

  const playDealerTurn = (finalPlayerCards: CardType[]) => {
    setGameState("dealer-turn");
    
    let currentDealerCards = [...dealerCards];
    const playerValue = calculateHandValue(finalPlayerCards);

    if (playerValue > 21) {
      finishGame(finalPlayerCards, currentDealerCards);
      return;
    }

    const dealerDrawInterval = setInterval(() => {
      const dealerValue = calculateHandValue(currentDealerCards);
      
      if (dealerValue >= 17) {
        clearInterval(dealerDrawInterval);
        finishGame(finalPlayerCards, currentDealerCards);
      } else {
        currentDealerCards = [...currentDealerCards, getRandomCard()];
        setDealerCards(currentDealerCards);
      }
    }, 1000);
  };

  const finishGame = async (finalPlayerCards: CardType[], finalDealerCards: CardType[]) => {
    setGameState("finished");
    
    const betAmount = parseFloat(bet);
    const playerValue = calculateHandValue(finalPlayerCards);
    const dealerValue = calculateHandValue(finalDealerCards);
    const playerBlackjack = isBlackjack(finalPlayerCards);

    let multiplier = 0;
    let message = "";

    if (playerValue > 21) {
      message = "Перебор!";
    } else if (dealerValue > 21) {
      multiplier = 2;
      message = "Дилер перебрал! Победа!";
    } else if (playerBlackjack && !isBlackjack(finalDealerCards)) {
      multiplier = 2.5;
      message = "Блэкджек!";
    } else if (playerValue > dealerValue) {
      multiplier = 2;
      message = "Победа!";
    } else if (playerValue === dealerValue) {
      multiplier = 1;
      message = "Ничья";
    } else {
      message = "Проигрыш";
    }

    // При ничьей: multiplier=1, возвращаем ставку. При победе: multiplier>1, возвращаем ставку*multiplier
    // Ставка уже была списана, так что:
    // multiplier=0 -> проиграл, ничего не возвращаем
    // multiplier=1 -> ничья, возвращаем ставку
    // multiplier>1 -> победа, возвращаем ставку*multiplier
    const winAmount = multiplier > 0 ? betAmount * multiplier : 0;

    try {
      // Начисляем выигрыш через RPC (если есть выигрыш)
      if (winAmount > 0) {
        await supabase.rpc("play_game", {
          _user_id: userId,
          _game_name: "blackjack_win",
          _bet_amount: 0,
          _win_amount: winAmount,
          _multiplier: multiplier,
          _use_freebet: useFreebet,
          _use_demo: useDemo,
        });
      }

      // Get game number
      const gameNumber = await supabase.rpc('nextval', { seq_name: 'game_number_seq' });
      setLastGameNumber(gameNumber.data);

      await supabase.from("game_history").insert({
        user_id: userId,
        game_name: "blackjack",
        game_number: gameNumber.data,
        bet_amount: betAmount,
        win_amount: multiplier > 0 ? winAmount : 0,
        multiplier,
      });

      await supabase.rpc("update_game_stats", {
        p_user_id: userId,
        p_won: multiplier >= 1,
      });

      if (multiplier > 1) {
        const profit = winAmount - betAmount;
        toast.success(`${message} +${profit.toFixed(2)}₽`);
      } else if (multiplier === 1) {
        toast.info(message);
      } else {
        toast.error(`${message} -${betAmount.toFixed(2)}₽`);
      }

      onBalanceUpdate();
    } catch (error) {
      toast.error("Ошибка игры");
    }

    setTimeout(() => {
      setGameState("betting");
      setPlayerCards([]);
      setDealerCards([]);
    }, 3000);
  };

  const playerValue = calculateHandValue(playerCards);
  const dealerValue = calculateHandValue(dealerCards);

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="relative">
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${blackjackTable})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <CardTitle className="text-3xl text-center relative z-10 text-shadow-lg flex items-center justify-center gap-2">
          {lastGameNumber && (
            <span className="text-sm font-mono bg-white/20 px-2 py-1 rounded text-white">
              #{lastGameNumber}
            </span>
          )}
          🃏 Блэкджек
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Betting Phase */}
        {gameState === "betting" && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-6 rounded-lg space-y-4">
              <label className="text-lg font-semibold block text-center">
                Сделайте ставку
              </label>
              <Input
                type="number"
                value={bet}
                onChange={(e) => setBet(e.target.value)}
                placeholder="Введите ставку"
                min="10"
                max={balance}
                className="bg-background text-lg h-14 text-center font-bold"
              />
              <Button
                onClick={startGame}
                disabled={!bet}
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 font-bold text-lg h-14"
              >
                Раздать карты
              </Button>
            </div>

            {/* Game Rules */}
            <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-2">
              <h4 className="font-bold text-center">Правила игры</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Цель: набрать 21 или ближе к 21, чем дилер</li>
                <li>• Блэкджек (туз + 10/картинка) = 2.5x выплата</li>
                <li>• Перебор (больше 21) = проигрыш</li>
                <li>• Удвоить - удвоение ставки с одной доп. картой</li>
              </ul>
            </div>
          </div>
        )}

        {/* Playing Phase */}
        {gameState !== "betting" && (
          <div className="space-y-6">
            {/* Dealer's hand */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Дилер</h3>
                <div className="text-2xl font-bold text-primary">
                  {gameState === "finished" || gameState === "dealer-turn" 
                    ? dealerValue 
                    : "?"}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-center min-h-[120px] items-center">
                {dealerCards.map((card, index) => (
                  <BlackjackCard
                    key={index}
                    value={card.value}
                    suit={card.suit}
                    hidden={gameState === "playing" && index === 1}
                    delay={index * 200}
                  />
                ))}
              </div>
            </div>

            {/* Player's hand */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Ваши карты</h3>
                <div className={`text-2xl font-bold ${
                  playerValue > 21 ? "text-destructive" : 
                  playerValue === 21 ? "text-primary animate-pulse" : 
                  "text-foreground"
                }`}>
                  {playerValue}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-center min-h-[120px] items-center">
                {playerCards.map((card, index) => (
                  <BlackjackCard
                    key={index}
                    value={card.value}
                    suit={card.suit}
                    delay={index * 200}
                  />
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {gameState === "playing" && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={hit}
                  className="bg-primary hover:bg-primary/90 font-bold h-14"
                >
                  Взять (Hit)
                </Button>
                <Button
                  onClick={stand}
                  variant="outline"
                  className="font-bold h-14"
                >
                  Остановиться (Stand)
                </Button>
                {canDouble && (
                  <Button
                    onClick={doubleDown}
                    variant="secondary"
                    className="col-span-2 font-bold h-14"
                  >
                    Удвоить ставку (Double)
                  </Button>
                )}
              </div>
            )}

            {gameState === "dealer-turn" && (
              <div className="text-center text-lg font-semibold animate-pulse">
                Ход дилера...
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
