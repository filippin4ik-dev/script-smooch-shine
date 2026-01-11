import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BlackjackGameProps {
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

export const BlackjackGame = ({ userId, balance, onBalanceUpdate }: BlackjackGameProps) => {
  const [bet, setBet] = useState("");
  const [gameState, setGameState] = useState<GameState>("betting");
  const [playerHands, setPlayerHands] = useState<CardType[][]>([]);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [dealerCards, setDealerCards] = useState<CardType[]>([]);
  const [canDouble, setCanDouble] = useState(false);
  const [canSplit, setCanSplit] = useState(false);
  const [hasInsurance, setHasInsurance] = useState(false);
  const [handsFinished, setHandsFinished] = useState<boolean[]>([]);
  const { canAct } = useSpamProtection();

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

  const startGame = () => {
    if (!canAct()) return;

    const betAmount = parseFloat(bet);
    if (!betAmount || betAmount < 10 || betAmount > balance) {
      toast.error("Неверная ставка");
      return;
    }

    const pCards = [getRandomCard(), getRandomCard()];
    const dCards = [getRandomCard(), getRandomCard()];

    setPlayerHands([pCards]);
    setDealerCards(dCards);
    setCurrentHandIndex(0);
    setHandsFinished([false]);
    setGameState("playing");
    setHasInsurance(false);

    // Проверка на блекджек
    if (isBlackjack(pCards)) {
      if (isBlackjack(dCards)) {
        finishGame([pCards], dCards, [true]);
      } else {
        finishGame([pCards], dCards, [true]);
      }
      return;
    }

    // Проверка возможности Double Down
    setCanDouble(pCards.length === 2);

    // Проверка возможности Split
    const canSplitNow = pCards.length === 2 && 
      pCards[0].value === pCards[1].value &&
      balance >= betAmount * 2;
    setCanSplit(canSplitNow);
  };

  const hit = () => {
    if (!canAct() || gameState !== "playing") return;

    const newHands = [...playerHands];
    const currentHand = [...newHands[currentHandIndex]];
    currentHand.push(getRandomCard());
    newHands[currentHandIndex] = currentHand;
    setPlayerHands(newHands);
    setCanDouble(false);
    setCanSplit(false);

    const value = calculateHandValue(currentHand);
    if (value >= 21) {
      moveToNextHand(newHands);
    }
  };

  const stand = () => {
    if (!canAct() || gameState !== "playing") return;
    moveToNextHand(playerHands);
  };

  const doubleDown = async () => {
    if (!canAct() || gameState !== "playing" || !canDouble) return;

    const betAmount = parseFloat(bet);
    if (balance < betAmount) {
      toast.error("Недостаточно средств для удвоения");
      return;
    }

    setBet((betAmount * 2).toString());
    
    const newHands = [...playerHands];
    const currentHand = [...newHands[currentHandIndex]];
    currentHand.push(getRandomCard());
    newHands[currentHandIndex] = currentHand;
    setPlayerHands(newHands);
    setCanDouble(false);
    setCanSplit(false);

    moveToNextHand(newHands);
  };

  const split = () => {
    if (!canAct() || gameState !== "playing" || !canSplit) return;

    const betAmount = parseFloat(bet);
    if (balance < betAmount * 2) {
      toast.error("Недостаточно средств для разделения");
      return;
    }

    const currentHand = playerHands[currentHandIndex];
    const hand1 = [currentHand[0], getRandomCard()];
    const hand2 = [currentHand[1], getRandomCard()];

    const newHands = [...playerHands];
    newHands[currentHandIndex] = hand1;
    newHands.splice(currentHandIndex + 1, 0, hand2);
    
    setPlayerHands(newHands);
    setHandsFinished([...handsFinished, false]);
    setCanDouble(false);
    setCanSplit(false);
  };

  const moveToNextHand = (hands: CardType[][]) => {
    const newFinished = [...handsFinished];
    newFinished[currentHandIndex] = true;
    setHandsFinished(newFinished);

    if (currentHandIndex < hands.length - 1) {
      setCurrentHandIndex(currentHandIndex + 1);
      const nextHand = hands[currentHandIndex + 1];
      setCanDouble(nextHand.length === 2);
      setCanSplit(false);
    } else {
      playDealerTurn(hands);
    }
  };

  const playDealerTurn = async (hands: CardType[][]) => {
    setGameState("dealer-turn");
    let dCards = [...dealerCards];

    // Дилер берет карты до 17
    while (calculateHandValue(dCards) < 17) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      dCards.push(getRandomCard());
      setDealerCards([...dCards]);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    finishGame(hands, dCards, handsFinished);
  };

  const finishGame = async (
    hands: CardType[][],
    dCards: CardType[],
    finished: boolean[]
  ) => {
    setGameState("finished");
    const betAmount = parseFloat(bet);
    const dealerValue = calculateHandValue(dCards);
    const dealerHasBlackjack = isBlackjack(dCards);
    
    let totalWin = 0;
    const results: string[] = [];

    hands.forEach((hand, idx) => {
      const playerValue = calculateHandValue(hand);
      const playerHasBlackjack = isBlackjack(hand);
      let handWin = 0;

      if (playerValue > 21) {
        // Перебор
        handWin = -betAmount / hands.length;
        results.push(`Рука ${idx + 1}: Перебор`);
      } else if (playerHasBlackjack && !dealerHasBlackjack) {
        // Блекджек игрока
        handWin = (betAmount / hands.length) * 1.5;
        results.push(`Рука ${idx + 1}: БЛЕКДЖЕК! +${handWin.toFixed(2)}₽`);
      } else if (dealerHasBlackjack && !playerHasBlackjack) {
        // Блекджек дилера
        handWin = -betAmount / hands.length;
        results.push(`Рука ${idx + 1}: Дилер блекджек`);
      } else if (playerHasBlackjack && dealerHasBlackjack) {
        // Оба блекджека
        handWin = 0;
        results.push(`Рука ${idx + 1}: Ничья (оба БДЖ)`);
      } else if (dealerValue > 21) {
        // Перебор у дилера
        handWin = (betAmount / hands.length);
        results.push(`Рука ${idx + 1}: Победа! +${handWin.toFixed(2)}₽`);
      } else if (playerValue > dealerValue) {
        // Игрок выше
        handWin = (betAmount / hands.length);
        results.push(`Рука ${idx + 1}: Победа! +${handWin.toFixed(2)}₽`);
      } else if (playerValue === dealerValue) {
        // Ничья
        handWin = 0;
        results.push(`Рука ${idx + 1}: Ничья`);
      } else {
        // Дилер выше
        handWin = -betAmount / hands.length;
        results.push(`Рука ${idx + 1}: Проигрыш`);
      }

      totalWin += handWin;
    });

    try {
      // @ts-ignore
      await supabase.rpc("update_balance", {
        user_id: userId,
        amount: totalWin,
      });

      // @ts-ignore
      await supabase.from("game_history").insert({
        user_id: userId,
        game_name: "blackjack",
        bet_amount: betAmount,
        win_amount: totalWin > 0 ? totalWin : 0,
        multiplier: totalWin > 0 ? (totalWin + betAmount) / betAmount : 0,
        result: { 
          hands: hands.map(h => ({ cards: h, value: calculateHandValue(h) })),
          dealer: { cards: dCards, value: dealerValue },
          totalWin 
        },
      });

      // @ts-ignore
      await supabase.rpc("update_game_stats", {
        p_user_id: userId,
        p_won: totalWin > 0,
      });

      if (totalWin > 0) {
        toast.success(`Итог: +${totalWin.toFixed(2)}₽`, {
          description: results.join('\n')
        });
      } else if (totalWin === 0) {
        toast.info("Ничья!", { description: results.join('\n') });
      } else {
        toast.error(`Итог: ${totalWin.toFixed(2)}₽`, {
          description: results.join('\n')
        });
      }

      onBalanceUpdate();
    } catch (error) {
      toast.error("Ошибка игры");
    } finally {
      setTimeout(() => {
        setGameState("betting");
        setPlayerHands([]);
        setDealerCards([]);
        setCurrentHandIndex(0);
        setHandsFinished([]);
        setCanDouble(false);
        setCanSplit(false);
      }, 4000);
    }
  };

  const renderCards = (cards: CardType[], hideFirst = false) => (
    <div className="flex gap-2 justify-center flex-wrap">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`inline-block p-3 bg-card border-2 rounded-lg min-w-[60px] transition-all duration-300 ${
            hideFirst && idx === 0 
              ? "border-muted" 
              : (card.suit === "♥️" || card.suit === "♦️")
                ? "border-red-500"
                : "border-primary"
          }`}
        >
          {hideFirst && idx === 0 ? (
            <div className="text-3xl">🂠</div>
          ) : (
            <>
              <div className={`text-2xl ${
                (card.suit === "♥️" || card.suit === "♦️") ? "text-red-500" : ""
              }`}>
                {card.suit}
              </div>
              <div className="text-xl font-bold">{card.value}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
          ♠️ Blackjack
          <Badge variant="secondary" className="text-xs">RTP ~99.5%</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {gameState === "betting" && (
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
        )}

        {gameState !== "betting" && (
          <div className="space-y-6">
            {/* Дилер */}
            <div className="space-y-2 p-3 bg-muted/10 rounded-lg">
              <div className="text-sm font-bold text-center flex items-center justify-center gap-2">
                <span>Дилер</span>
                {(gameState === "dealer-turn" || gameState === "finished") && (
                  <Badge variant="outline">
                    {calculateHandValue(dealerCards)}
                    {isBlackjack(dealerCards) && " 🎰"}
                  </Badge>
                )}
              </div>
              {renderCards(dealerCards, gameState === "playing")}
            </div>

            {/* Руки игрока */}
            {playerHands.map((hand, idx) => (
              <div 
                key={idx} 
                className={`space-y-2 p-3 rounded-lg border-2 transition-all ${
                  currentHandIndex === idx && gameState === "playing"
                    ? "bg-primary/10 border-primary"
                    : "bg-muted/10 border-muted"
                }`}
              >
                <div className="text-sm font-bold text-center flex items-center justify-center gap-2">
                  <span>Ваша рука {playerHands.length > 1 ? `#${idx + 1}` : ""}</span>
                  <Badge variant={currentHandIndex === idx ? "default" : "outline"}>
                    {calculateHandValue(hand)}
                    {isBlackjack(hand) && " 🎰"}
                  </Badge>
                  {handsFinished[idx] && gameState !== "finished" && (
                    <Badge variant="secondary">Завершена</Badge>
                  )}
                </div>
                {renderCards(hand)}
              </div>
            ))}
          </div>
        )}

        {/* Правила */}
        {gameState === "betting" && (
          <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <div className="font-bold text-center mb-2">Правила:</div>
            <div>• Блекджек платит 3:2 (1.5x ставки)</div>
            <div>• Дилер берет до 17</div>
            <div>• Double Down - удвоить ставку</div>
            <div>• Split - разделить пару</div>
          </div>
        )}

        {/* Кнопки */}
        {gameState === "betting" ? (
          <Button
            onClick={startGame}
            disabled={!bet}
            className="w-full bg-gradient-gold hover:opacity-90 font-bold py-6"
          >
            🃏 Раздать карты
          </Button>
        ) : gameState === "playing" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={hit}
                className="bg-primary hover:opacity-90 font-bold"
                disabled={calculateHandValue(playerHands[currentHandIndex]) >= 21}
              >
                🃏 Взять
              </Button>
              <Button
                onClick={stand}
                className="bg-secondary hover:opacity-90 font-bold"
              >
                ✋ Хватит
              </Button>
            </div>

            {(canDouble || canSplit) && (
              <div className="grid grid-cols-2 gap-2">
                {canDouble && (
                  <Button
                    onClick={doubleDown}
                    variant="outline"
                    className="font-bold"
                  >
                    ⬆️ x2 Ставка
                  </Button>
                )}
                {canSplit && (
                  <Button
                    onClick={split}
                    variant="outline"
                    className="font-bold"
                  >
                    ✂️ Разделить
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
