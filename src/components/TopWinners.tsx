import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface TopWin {
  id: string;
  win_amount: number;
  game_name: string;
  multiplier: number | null;
  created_at: string;
  username: string;
  is_vip: boolean;
  gradient_color: string | null;
}

export const TopWinners = () => {
  const queryClient = useQueryClient();

  const { data: topWinners } = useQuery({
    queryKey: ["top-winners"],
    queryFn: async () => {
      // Use server-side RPC for secure data fetching
      const { data, error } = await supabase.rpc('get_top_winners_today', { _limit: 3 });
      
      if (error) {
        console.error('Error fetching top winners:', error);
        return [];
      }
      
      return (data as TopWin[]) || [];
    },
    refetchInterval: 5000,
  });

  // Realtime подписка на новые выигрыши
  useEffect(() => {
    const channel = supabase
      .channel('game-history-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_history',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["top-winners"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getGameIcon = (gameName: string) => {
    const icons: Record<string, string> = {
      dice: "🎲",
      mines: "💎",
      towers: "🗼",
      hilo: "🃏",
      roulette: "🎡",
      blackjack: "♠️",
      crash: "🚀",
      slots: "🎰",
      balloon: "🎈",
      cases: "📦",
      penalty: "⚽",
      crypto_trading: "₿",
      dogs_house: "🐕",
      horse_racing: "🏇",
      plinko: "📍",
      chicken_road: "🐔",
    };
    return icons[gameName] || "🎮";
  };

  if (!topWinners || topWinners.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-gradient-to-br from-yellow-500/10 via-orange-500/8 to-transparent backdrop-blur-md overflow-hidden shadow-lg">
      <div className="p-4 border-b border-yellow-500/30 bg-gradient-to-r from-yellow-500/15 to-orange-500/10">
        <div className="flex items-center gap-2 justify-center">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-black text-yellow-300 drop-shadow-md">🏆 Топ выигрышей за день</h3>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        {topWinners.map((winner, index) => (
          <div
            key={winner.id}
            className={cn(
              "relative p-3 rounded-lg transition-all duration-300 hover:scale-[1.02] border-2 animate-fade-in",
              index === 0 && "bg-gradient-to-r from-yellow-500/20 to-orange-500/15 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.3)]",
              index === 1 && "bg-gradient-to-r from-gray-400/20 to-gray-500/15 border-gray-400/40 shadow-md",
              index === 2 && "bg-gradient-to-r from-amber-700/20 to-amber-800/15 border-amber-700/40 shadow-md"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "text-2xl font-black flex items-center justify-center w-10 h-10 rounded-full shadow-md",
                  index === 0 && "bg-gradient-to-br from-yellow-400/30 to-orange-500/30 text-yellow-300 ring-2 ring-yellow-400/30",
                  index === 1 && "bg-gradient-to-br from-gray-300/30 to-gray-400/30 text-gray-200 ring-2 ring-gray-400/30",
                  index === 2 && "bg-gradient-to-br from-orange-500/30 to-amber-700/30 text-orange-300 ring-2 ring-orange-500/30"
                )}>
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                      "font-bold text-sm",
                      index === 0 && "text-yellow-200",
                      index === 1 && "text-gray-200",
                      index === 2 && "text-orange-200"
                    )}>
                      {winner.username}
                    </span>
                    <span className="text-sm">{getGameIcon(winner.game_name)}</span>
                  </div>
                  <div className={cn(
                    "text-xs font-semibold",
                    index === 0 && "text-yellow-300/80",
                    index === 1 && "text-gray-300/80",
                    index === 2 && "text-orange-300/80"
                  )}>
                    {winner.multiplier && `Множитель: ${winner.multiplier.toFixed(2)}x`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-xl font-black flex items-center gap-1.5",
                  index === 0 && "text-yellow-300 drop-shadow-md",
                  index === 1 && "text-gray-200 drop-shadow-md",
                  index === 2 && "text-orange-300 drop-shadow-md"
                )}>
                  <TrendingUp className="w-5 h-5" />
                  {winner.win_amount.toFixed(0)}₽
                </div>
                <div className={cn(
                  "text-xs font-medium",
                  index === 0 && "text-yellow-400/70",
                  index === 1 && "text-gray-400/70",
                  index === 2 && "text-orange-400/70"
                )}>
                  {new Date(winner.created_at).toLocaleDateString("ru-RU")}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
