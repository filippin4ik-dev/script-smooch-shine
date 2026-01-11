import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface HiLoGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

const CARDS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["♠️", "♥️", "♦️", "♣️"];

export const HiLoGame = ({ userId, balance, onBalanceUpdate }: HiLoGameProps) => {
  const [bet, setBet] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [currentCard, setCurrentCard] = useState<string>("");
  const [currentSuit, setCurrentSuit] = useState<string>("");
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastGameInfo, setLastGameInfo] = useState<{ game_number: number; seed_hash: string } | null>(null);
  const { canAct } = useSpamProtection();
  const { useFreebet, useDemo } = useBalanceMode();

  const startGame = async () => {
    if (!canAct()) return;

    const betAmount = parseFloat(bet);
    if (!betAmount || betAmount < 10) {
      toast.error("Минимальная ставка 10₽");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("play_hilo", {
        _user_id: userId,
        _bet_amount: betAmount,
        _action: "start",
        _guess: null,
        _session_id: null,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка начала игры");
        return;
      }

      const response = data as {
        success: boolean;
        session_id: string;
        current_card: string;
        current_suit: string;
        streak: number;
        multiplier: number;
        game_number: number;
        seed_hash: string;
        message?: string;
      };

      if (!response || !response.success) {
        toast.error(response?.message || "Ошибка начала игры");
        return;
      }

      setSessionId(response.session_id);
      setCurrentCard(response.current_card);
      setCurrentSuit(response.current_suit);
      setStreak(response.streak);
      setMultiplier(response.multiplier);
      setGameStarted(true);
      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });
      onBalanceUpdate();
    } catch (err) {
      toast.error("Ошибка соединения");
    }
  };

  const guess = async (isHigh: boolean) => {
    if (!canAct() || !gameStarted || !sessionId) return;

    try {
      const { data, error } = await supabase.rpc("play_hilo", {
        _user_id: userId,
        _bet_amount: parseFloat(bet),
        _action: "guess",
        _guess: isHigh ? "high" : "low",
        _session_id: sessionId,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка игры");
        return;
      }

      const response = data as {
        success: boolean;
        correct: boolean;
        current_card: string;
        current_suit: string;
        streak: number;
        multiplier: number;
        game_over: boolean;
        win_amount: number;
        game_number: number;
        seed_hash: string;
        message?: string;
      };

      if (!response || !response.success) {
        toast.error(response?.message || "Ошибка игры");
        return;
      }

      setCurrentCard(response.current_card);
      setCurrentSuit(response.current_suit);
      setStreak(response.streak);
      setMultiplier(response.multiplier);
      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });

      if (response.game_over) {
        toast.error(`Проигрыш! -${parseFloat(bet).toFixed(2)}₽ (Игра #${response.game_number})`);
        onBalanceUpdate();
        setTimeout(() => resetGame(), 2000);
      }
    } catch (err) {
      toast.error("Ошибка соединения");
    }
  };

  const cashout = async () => {
    if (!canAct() || !gameStarted || streak === 0 || !sessionId) return;

    try {
      const { data, error } = await supabase.rpc("play_hilo", {
        _user_id: userId,
        _bet_amount: parseFloat(bet),
        _action: "cashout",
        _guess: null,
        _session_id: sessionId,
        _use_freebet: useFreebet,
        _use_demo: useDemo,
      });

      if (error) {
        toast.error(error.message || "Ошибка вывода");
        return;
      }

      const response = data as {
        success: boolean;
        win_amount: number;
        game_number: number;
        seed_hash: string;
        message?: string;
      };

      if (!response || !response.success) {
        toast.error(response?.message || "Ошибка вывода");
        return;
      }

      const netProfit = response.win_amount - parseFloat(bet);
      toast.success(`Победа! +${netProfit.toFixed(2)}₽ (Игра #${response.game_number})`);
      setLastGameInfo({ game_number: response.game_number, seed_hash: response.seed_hash });
      onBalanceUpdate();
      setTimeout(() => resetGame(), 2000);
    } catch (err) {
      toast.error("Ошибка соединения");
    }
  };

  const resetGame = () => {
    setGameStarted(false);
    setStreak(0);
    setMultiplier(1);
    setSessionId(null);
    setCurrentCard("");
    setCurrentSuit("");
  };

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700">
        <CardTitle className="text-3xl text-center text-white font-bold flex items-center justify-center gap-2">
          {lastGameInfo && lastGameInfo.game_number > 0 && (
            <span className="text-sm font-mono bg-white/20 px-2 py-1 rounded text-white/90">
              #{lastGameInfo.game_number}
            </span>
          )}
          🃏 HI-LO
        </CardTitle>
        {lastGameInfo && lastGameInfo.seed_hash && (
          <div className="text-center text-xs text-white/70">
            Хэш: {lastGameInfo.seed_hash.slice(0, 16)}...
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6 pt-6 bg-gradient-to-b from-purple-900/20 to-background">
        {!gameStarted && (
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

        {gameStarted && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-4 py-2 bg-card/50 rounded-lg border border-primary/30">
              <span className="text-sm text-muted-foreground">Серия:</span>
              <span className="text-xl font-bold text-primary">{streak}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-primary to-pink-600 rounded-lg">
              <span className="text-sm text-white/90">Множитель:</span>
              <span className="text-3xl font-bold text-white">{multiplier.toFixed(2)}x</span>
            </div>
          </div>
        )}

        <div className="relative min-h-[300px] flex items-center justify-center">
          {gameStarted ? (
            <div className="relative">
              <div 
                className="relative bg-white rounded-2xl p-8 shadow-2xl transform transition-all duration-500 hover:scale-105"
                style={{
                  width: "200px",
                  height: "280px",
                  boxShadow: "0 20px 60px rgba(236, 72, 153, 0.3), 0 0 0 1px rgba(255,255,255,0.1)",
                }}
              >
                <div className="absolute top-4 left-4">
                  <div className="text-3xl">{currentSuit}</div>
                  <div className="text-lg font-bold text-gray-800">{currentCard}</div>
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-8xl drop-shadow-lg">{currentSuit}</div>
                </div>
                
                <div className="absolute bottom-4 right-4 rotate-180">
                  <div className="text-3xl">{currentSuit}</div>
                  <div className="text-lg font-bold text-gray-800">{currentCard}</div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent rounded-2xl pointer-events-none"></div>
              </div>

              <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-pink-500/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: "1s" }}></div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-8xl animate-float">🎴</div>
              <p className="text-muted-foreground">Начните игру, чтобы увидеть карту</p>
            </div>
          )}
        </div>

        {!gameStarted ? (
          <Button
            onClick={startGame}
            disabled={!bet}
            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 hover:opacity-90 font-bold text-lg py-8 shadow-lg"
          >
            🎴 Начать игру
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => guess(true)}
                className="bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 font-bold text-lg py-8 shadow-lg transition-all hover:scale-105"
              >
                ⬆️ Выше
              </Button>
              <Button
                onClick={() => guess(false)}
                className="bg-gradient-to-br from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 font-bold text-lg py-8 shadow-lg transition-all hover:scale-105"
              >
                ⬇️ Ниже
              </Button>
            </div>
            <Button
              onClick={cashout}
              disabled={streak === 0}
              className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 hover:opacity-90 font-bold text-lg py-6 shadow-lg"
            >
              💰 Забрать {(parseFloat(bet) * multiplier).toFixed(2)}₽
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
