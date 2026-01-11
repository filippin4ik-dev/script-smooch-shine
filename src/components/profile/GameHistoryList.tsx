import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface GameHistoryItem {
  id: string;
  game_name: string;
  game_number?: number | null;
  bet_amount: number;
  win_amount: number;
  multiplier?: number;
  created_at: string;
}

interface GameHistoryListProps {
  games: GameHistoryItem[];
  maxItems?: number;
}

const gameIcons: Record<string, string> = {
  dice: "🎲",
  mines: "💎",
  towers: "🗼",
  hilo: "🃏",
  roulette: "🎡",
  blackjack: "♠️",
  crash: "🚀",
  slots: "🎰",
  plinko: "⚪",
  chicken_road: "🐔",
  balloon: "🎈",
  penalty: "⚽",
  cases: "📦",
  buff_wheel: "🎡",
  horse_racing: "🏇",
  dogs_house: "🐕",
};

const gameNames: Record<string, string> = {
  dice: "Кости",
  mines: "Мины",
  towers: "Башни",
  hilo: "Hi-Lo",
  roulette: "Рулетка",
  blackjack: "Блэкджек",
  crash: "Краш",
  slots: "Слоты",
  plinko: "Плинко",
  chicken_road: "Chicken Road",
  balloon: "Шарик",
  penalty: "Пенальти",
  cases: "Кейсы",
  buff_wheel: "Колесо баффов",
  horse_racing: "Скачки",
  dogs_house: "Dogs House",
};

export const GameHistoryList = ({ games, maxItems = 20 }: GameHistoryListProps) => {
  const displayedGames = games.slice(0, maxItems);

  if (displayedGames.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>История игр пуста</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayedGames.map((game, index) => {
        const isWin = (game.win_amount || 0) > (game.bet_amount || 0);
        const profit = (game.win_amount || 0) - (game.bet_amount || 0);
        
        return (
          <div
            key={game.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-xl",
              "bg-card/50 border border-border/30",
              "transition-all duration-300",
              "animate-fade-in"
            )}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                {gameIcons[game.game_name] || "🎮"}
              </div>
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {gameNames[game.game_name] || game.game_name}
                  {game.game_number && (
                    <span className="text-xs text-muted-foreground font-mono">
                      #{game.game_number}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(game.created_at), { 
                    addSuffix: true, 
                    locale: ru 
                  })}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className={cn(
                "font-bold",
                isWin ? "text-primary" : "text-destructive"
              )}>
                {isWin ? "+" : ""}{profit.toFixed(0)}₽
              </div>
              {game.multiplier && game.multiplier > 0 && (
                <div className="text-xs text-muted-foreground">
                  {game.multiplier.toFixed(2)}x
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
