import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Hash, Calendar, Trophy, Coins } from "lucide-react";

interface GameResult {
  game_number: number;
  game_name: string;
  bet_amount: number;
  win_amount: number | null;
  multiplier: number | null;
  server_seed: string | null;
  revealed_seed: string | null;
  created_at: string;
}

export const GameSearchByNumber = () => {
  const [gameNumber, setGameNumber] = useState("");
  const [result, setResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(false);

  const searchGame = async () => {
    if (!gameNumber) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("find_game_by_number", {
        _game_number: parseInt(gameNumber),
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setResult(data[0] as GameResult);
      } else {
        toast.error("Игра не найдена");
        setResult(null);
      }
    } catch (err) {
      toast.error("Ошибка поиска");
    } finally {
      setLoading(false);
    }
  };

  const gameNames: Record<string, string> = {
    roulette: "🎰 Рулетка",
    hilo: "🃏 HI-LO",
    balloon: "🎈 Balloon",
    crypto: "₿ Crypto Trading",
    crypto_trading: "₿ Crypto Trading",
    dice: "🎲 Dice",
    mines: "💣 Mines",
    crash: "🚀 Crash",
    slots: "🎰 Slots",
    blackjack: "🃏 Blackjack",
    towers: "🗼 Towers",
    plinko: "⚫ Plinko",
    penalty: "⚽ Penalty",
    chicken_road: "🐔 Chicken Road",
    horse_racing: "🏇 Horse Racing",
    cases: "📦 Cases",
    upgrader: "⬆️ Upgrader",
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="w-5 h-5" />
          Проверка честности игры
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="number"
            value={gameNumber}
            onChange={(e) => setGameNumber(e.target.value)}
            placeholder="Введите номер игры"
            className="flex-1"
          />
          <Button onClick={searchGame} disabled={loading || !gameNumber}>
            {loading ? "..." : "Найти"}
          </Button>
        </div>

        {result && (
          <div className="bg-card/50 rounded-lg p-4 space-y-3 border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                <span className="font-bold">Игра #{result.game_number}</span>
              </div>
              <span className="text-sm">{gameNames[result.game_name] || result.game_name}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-muted-foreground" />
                <span>Ставка: {result.bet_amount}₽</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                <span className={result.win_amount && result.win_amount > 0 ? "text-green-400" : "text-red-400"}>
                  {result.win_amount && result.win_amount > 0 ? `+${result.win_amount}₽` : "Проигрыш"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{new Date(result.created_at).toLocaleString("ru")}</span>
              </div>
              {result.multiplier && result.multiplier > 0 && (
                <div className="text-primary font-bold">x{result.multiplier}</div>
              )}
            </div>

            {result.server_seed && (
              <div className="pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Server Seed Hash:</div>
                <code className="text-xs bg-background p-2 rounded block break-all">
                  {result.server_seed}
                </code>
              </div>
            )}

            {result.revealed_seed && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Revealed Seed:</div>
                <code className="text-xs bg-background p-2 rounded block break-all">
                  {result.revealed_seed}
                </code>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
