import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { VipUsername } from "@/components/VipUsername";

interface LiveWin {
  id: string;
  win_amount: number;
  game_name: string;
  multiplier: number | null;
  created_at: string;
  username: string;
  is_vip: boolean;
  gradient_color: string | null;
  is_admin: boolean;
}

export const LiveWinners = () => {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: liveWins } = useQuery({
    queryKey: ["live-wins"],
    queryFn: async () => {
      // Use server-side RPC for secure data fetching
      const { data, error } = await supabase.rpc('get_live_winners', { _limit: 10 });
      
      if (error) {
        console.error('Error fetching live winners:', error);
        return [];
      }
      
      return (data as LiveWin[]) || [];
    },
    refetchInterval: 3000,
  });

  // Realtime подписка на новые выигрыши
  useEffect(() => {
    const channel = supabase
      .channel('live-wins-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_history',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-wins"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Автопрокрутка каждые 3 секунды
  useEffect(() => {
    if (!liveWins || liveWins.length <= 3) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % Math.max(1, liveWins.length - 2));
    }, 3000);
    
    return () => clearInterval(timer);
  }, [liveWins]);

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
      crypto: "₿",
      crypto_trading: "₿",
      "Dogs House": "🐕",
      dogs_house: "🐕",
      "Horse Racing": "🏇",
      horse_racing: "🏇",
      plinko: "📍",
      chicken_road: "🐔",
    };
    return icons[gameName] || "🎮";
  };

  const getGameName = (gameName: string) => {
    const names: Record<string, string> = {
      dice: "Dice",
      mines: "Mines",
      towers: "Towers",
      hilo: "Hi-Lo",
      roulette: "Рулетка",
      blackjack: "Blackjack",
      crash: "Crash",
      slots: "Slots",
      balloon: "Balloon",
      cases: "Cases",
      penalty: "Penalty",
      crypto: "Crypto",
      crypto_trading: "Crypto",
      "Dogs House": "Dogs House",
      dogs_house: "Dogs House",
      "Horse Racing": "Скачки",
      horse_racing: "Скачки",
      plinko: "Plinko",
      chicken_road: "Chicken Road",
    };
    return names[gameName] || gameName;
  };

  if (!liveWins || liveWins.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-md overflow-hidden">
      <div className="p-3 border-b border-primary/20 bg-gradient-to-r from-primary/10 to-secondary/10">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="text-sm font-bold text-foreground">🔥 Последние выигрыши</h3>
        </div>
      </div>
      
      <div className="relative overflow-hidden p-2">
        <div 
          className="flex transition-transform duration-500 ease-in-out gap-2"
          style={{ transform: `translateX(-${currentIndex * (100 / 3)}%)` }}
        >
          {liveWins.map((win) => {
            const isVipOrAdmin = win.is_vip || win.is_admin;
            
            return (
              <div
                key={win.id}
                className="min-w-[calc(33.333%-0.5rem)] flex-shrink-0"
              >
                <div className="flex flex-col p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors h-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg flex-shrink-0">{getGameIcon(win.game_name)}</span>
                    <div className="flex flex-col min-w-0 flex-1">
                    {isVipOrAdmin ? (
                        <VipUsername 
                          username={win.username || 'Unknown'} 
                          isVip={win.is_vip}
                          isAdmin={win.is_admin}
                          gradientColor={(win.gradient_color || 'gold') as any}
                          className="text-xs font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-foreground truncate text-xs">
                          {win.username}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground truncate">
                        {getGameName(win.game_name)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    {win.multiplier && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        x{win.multiplier.toFixed(2)}
                      </span>
                    )}
                    <span className="text-xs font-bold text-green-500 whitespace-nowrap ml-auto">
                      +{win.win_amount.toFixed(0)}₽
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Индикаторы слайдов */}
      {liveWins && liveWins.length > 3 && (
        <div className="flex justify-center gap-1 pb-2">
          {Array.from({ length: Math.max(1, liveWins.length - 2) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? "w-6 bg-primary" 
                  : "w-1.5 bg-muted/50 hover:bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </Card>
  );
};
