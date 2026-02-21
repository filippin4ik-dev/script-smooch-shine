import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface BlackjackGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

interface ServerCard {
  value: string;
  suit: string;
}

type GameState = "betting" | "playing" | "finished";

// Parse server card string like "A♠" into display object
const parseServerCard = (cardStr: string): ServerCard => {
  const suitMap: Record<string, string> = { '♠': '♠️', '♥': '♥️', '♦': '♦️', '♣': '♣️' };
  const suit = cardStr.slice(-1);
  const value = cardStr.slice(0, -1);
  return { value, suit: suitMap[suit] || suit };
};

export const BlackjackGame = ({ userId, balance, onBalanceUpdate }: BlackjackGameProps) => {
  const [bet, setBet] = useState("");
  const [gameState, setGameState] = useState<GameState>("betting");
  const [playerCards, setPlayerCards] = useState<ServerCard[]>([]);
  const [dealerCards, setDealerCards] = useState<ServerCard[]>([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [resultText, setResultText] = useState("");
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number: number; seed_hash: string } | null>(null);
  const { canAct } = useSpamProtection();
  const { useFreebet, useDemo } = useBalanceMode();

  const startGame = async () => {
    if (!canAct()) return;

    const betAmount = parseFloat(bet);
    if (!betAmount || betAmount < 10 || betAmount > balance) {
      toast.error("Неверная ставка");
      return;
    }

    setGameState("playing");

    try {
      const { data, error } = await supabase.rpc("play_blackjack_server", {
        _user_id: userId,
        _bet_amount: betAmount,
        _is_freebet: useFreebet,
        _is_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        setGameState("betting");
        return;
      }

      const response = data as any;
      if (!response?.success) {
        toast.error(response?.error || "Ошибка игры");
        setGameState("betting");
        return;
      }

      // Parse cards from server
      const pCards = (response.player_cards as string[]).map(parseServerCard);
      const dCards = (response.dealer_cards as string[]).map(parseServerCard);
      
      setPlayerCards(pCards);
      setDealerCards([dCards[0]]); // Show only first dealer card initially
      setPlayerValue(response.player_value);

      // Animate dealer reveal
      setTimeout(() => {
        setDealerCards(dCards);
        setDealerValue(response.dealer_value);
        setGameState("finished");

        setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });

        const netProfit = response.net_profit;
        if (response.result === 'blackjack') {
          setResultText(`БЛЕКДЖЕК! +${netProfit.toFixed(2)}₽`);
          toast.success(`🎰 БЛЕКДЖЕК! +${netProfit.toFixed(2)}₽`);
        } else if (response.result === 'draw') {
          setResultText("Ничья - ставка возвращена");
          toast.info("Ничья!");
        } else if (netProfit > 0) {
          setResultText(`Победа! +${netProfit.toFixed(2)}₽`);
          toast.success(`Победа! +${netProfit.toFixed(2)}₽`);
        } else {
          setResultText(`Проигрыш: -${betAmount.toFixed(2)}₽`);
          toast.error(`Проигрыш: -${betAmount.toFixed(2)}₽`);
        }

        onBalanceUpdate();

        setTimeout(() => {
          setGameState("betting");
          setPlayerCards([]);
          setDealerCards([]);
          setResultText("");
          setPlayerValue(0);
          setDealerValue(0);
        }, 4000);
      }, 1000);
    } catch (error) {
      toast.error("Ошибка игры");
      setGameState("betting");
    }
  };

  const renderCards = (cards: ServerCard[], hideFirst = false) => (
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
          {lastGameInfo && lastGameInfo.game_number > 0 && (
            <span className="text-sm font-mono bg-primary/20 px-2 py-1 rounded text-primary">
              #{lastGameInfo.game_number}
            </span>
          )}
          ♠️ Blackjack
          <Badge variant="secondary" className="text-xs">🔒 Server</Badge>
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-center text-xs text-muted-foreground">
            Хэш: {lastGameInfo.seed_hash}...
          </div>
        )}
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
            <div className="space-y-2 p-3 bg-muted/10 rounded-lg">
              <div className="text-sm font-bold text-center flex items-center justify-center gap-2">
                <span>Дилер</span>
                {dealerValue > 0 && <Badge variant="outline">{dealerValue}</Badge>}
              </div>
              {renderCards(dealerCards, gameState === "playing")}
            </div>

            <div className="space-y-2 p-3 rounded-lg border-2 bg-primary/10 border-primary">
              <div className="text-sm font-bold text-center flex items-center justify-center gap-2">
                <span>Ваша рука</span>
                {playerValue > 0 && <Badge variant="default">{playerValue}</Badge>}
              </div>
              {renderCards(playerCards)}
            </div>

            {resultText && (
              <div className="text-center font-bold text-lg animate-pulse">
                {resultText}
              </div>
            )}
          </div>
        )}

        {gameState === "betting" && (
          <>
            <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <div className="font-bold text-center mb-2">Правила:</div>
              <div>• Блекджек платит 3:2 (1.5x ставки)</div>
              <div>• Дилер берет до 17</div>
              <div>• 🔒 Все расчёты на сервере</div>
            </div>
            <Button
              onClick={startGame}
              disabled={!bet}
              className="w-full bg-gradient-gold hover:opacity-90 font-bold py-6"
            >
              🃏 Раздать карты
            </Button>
          </>
        )}

        {gameState === "playing" && (
          <div className="text-center text-muted-foreground animate-pulse">
            Дилер открывает карты...
          </div>
        )}
      </CardContent>
    </Card>
  );
};
