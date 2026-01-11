import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Zap, Star, Trophy, Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GiveawayWinStreakProps {
  userId: string;
}

export const GiveawayWinStreak = ({ userId }: GiveawayWinStreakProps) => {
  const queryClient = useQueryClient();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  // Fetch win streak data
  const { data: winStreak, isLoading } = useQuery({
    queryKey: ["giveaway-win-streak", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_history")
        .select("created_at, win_amount, bet_amount")
        .eq("user_id", userId)
        .gt("win_amount", 0)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (!data || data.length === 0) return { streak: 0, bonus: 0, message: null, canClaim: false };
      
      let streak = 0;
      let lastTime: Date | null = null;
      
      for (const game of data) {
        if (game.win_amount <= game.bet_amount) continue;
        
        const gameTime = new Date(game.created_at);
        if (lastTime === null) {
          streak = 1;
          lastTime = gameTime;
        } else {
          const diff = lastTime.getTime() - gameTime.getTime();
          if (diff <= 5 * 60 * 1000) {
            streak++;
            lastTime = gameTime;
          } else {
            break;
          }
        }
      }

      const bonus = streak >= 10 ? 50 : streak >= 7 ? 25 : streak >= 5 ? 10 : streak >= 3 ? 5 : 0;
      const message = streak >= 10 ? '🔥 МЕГА СЕРИЯ!' : 
                      streak >= 7 ? '🔥 Отличная серия!' : 
                      streak >= 5 ? '⚡ Хорошая серия!' : 
                      streak >= 3 ? '✨ Начало серии!' : null;

      return { streak, bonus, message, canClaim: streak >= 3 };
    },
    enabled: !!userId,
    refetchInterval: 10000,
  });

  // Check active achievement giveaway
  const { data: activeGiveaway } = useQuery({
    queryKey: ["active-achievement-giveaway"],
    queryFn: async () => {
      const { data } = await supabase
        .from("giveaways")
        .select("*")
        .eq("status", "active")
        .eq("giveaway_mode", "achievement")
        .in("achievement_type", ["most_wins", "most_wins_game"])
        .limit(1)
        .single();
      
      return data;
    },
  });

  // Claim bonus mutation - adds wins to the giveaway
  const claimBonus = useMutation({
    mutationFn: async () => {
      if (!activeGiveaway || !winStreak?.bonus) {
        throw new Error("Нет активного розыгрыша или бонуса");
      }

      // Add bonus wins via RPC
      const { data, error } = await supabase.rpc("add_streak_bonus_wins", {
        _user_id: userId,
        _giveaway_id: activeGiveaway.id,
        _bonus_wins: winStreak.bonus,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(`+${winStreak?.bonus} побед добавлено в розыгрыш!`);
        queryClient.invalidateQueries({ queryKey: ["giveaway-leaderboard"] });
        queryClient.invalidateQueries({ queryKey: ["giveaway-win-streak"] });
        setShowClaim(false);
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (winStreak?.streak >= 3) {
      setIsAnimating(true);
      const timer = setTimeout(() => setShowClaim(true), 500);
      return () => clearTimeout(timer);
    }
  }, [winStreak?.streak]);

  if (isLoading || !winStreak || winStreak.streak < 3) return null;

  const getStreakLevel = () => {
    if (winStreak.streak >= 10) return { 
      icon: Trophy, 
      color: "text-yellow-400", 
      bg: "from-yellow-500/30 to-orange-500/30", 
      border: "border-yellow-500/50", 
      glow: "shadow-[0_0_30px_hsl(45,100%,50%,0.5)]" 
    };
    if (winStreak.streak >= 7) return { 
      icon: Flame, 
      color: "text-orange-400", 
      bg: "from-orange-500/30 to-red-500/30", 
      border: "border-orange-500/50", 
      glow: "shadow-[0_0_25px_hsl(25,100%,50%,0.4)]" 
    };
    if (winStreak.streak >= 5) return { 
      icon: Zap, 
      color: "text-cyan-400", 
      bg: "from-cyan-500/30 to-blue-500/30", 
      border: "border-cyan-500/50", 
      glow: "shadow-[0_0_20px_hsl(195,100%,50%,0.4)]" 
    };
    return { 
      icon: Star, 
      color: "text-purple-400", 
      bg: "from-purple-500/30 to-pink-500/30", 
      border: "border-purple-500/50", 
      glow: "shadow-[0_0_15px_hsl(280,100%,50%,0.3)]" 
    };
  };

  const level = getStreakLevel();
  const Icon = level.icon;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-4",
      "bg-gradient-to-br",
      level.bg,
      "border-2",
      level.border,
      level.glow,
      "transition-all duration-500",
      isAnimating && "animate-pulse"
    )}>
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute w-1.5 h-1.5 rounded-full",
              level.color,
              "animate-ping opacity-60"
            )}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.15}s`,
              animationDuration: `${1.5 + Math.random()}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-4">
          {/* Animated icon */}
          <div className={cn(
            "w-16 h-16 rounded-xl flex items-center justify-center",
            "bg-gradient-to-br from-background/50 to-background/20",
            "border border-white/10",
            "transition-transform duration-300",
            isAnimating && "animate-bounce"
          )}>
            <Icon className={cn("w-8 h-8", level.color, "drop-shadow-lg")} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-3xl font-black", level.color)}>
                {winStreak.streak}x
              </span>
              <span className="text-lg font-bold text-foreground/90">
                СЕРИЯ ПОБЕД!
              </span>
            </div>
            
            {winStreak.message && (
              <p className="text-sm text-foreground/70 font-medium">
                {winStreak.message}
              </p>
            )}
          </div>

          {/* Bonus indicator */}
          {showClaim && winStreak.bonus > 0 && (
            <div className={cn(
              "px-4 py-2 rounded-xl text-center",
              "bg-primary/20 border border-primary/40",
              "animate-scale-in"
            )}>
              <div className="text-xs text-primary/80 font-medium">Бонус</div>
              <div className="text-2xl font-black text-primary">+{winStreak.bonus}</div>
              <div className="text-xs text-primary/70">побед</div>
            </div>
          )}
        </div>

        {/* Claim button for active giveaway */}
        {activeGiveaway && showClaim && winStreak.bonus > 0 && (
          <Button
            onClick={() => claimBonus.mutate()}
            disabled={claimBonus.isPending}
            className="w-full bg-gradient-to-r from-primary to-purple-500 hover:from-primary/80 hover:to-purple-500/80"
          >
            <Gift className="w-4 h-4 mr-2" />
            {claimBonus.isPending ? "Начисляем..." : `Получить +${winStreak.bonus} побед в розыгрыш`}
          </Button>
        )}

        {!activeGiveaway && showClaim && (
          <div className="text-center text-sm text-muted-foreground p-2 bg-muted/30 rounded-lg">
            <Sparkles className="w-4 h-4 inline mr-1" />
            Бонус будет применён в ближайшем розыгрыше достижений
          </div>
        )}

        {/* Progress bar for next tier */}
        <div className="mt-4 relative">
          <div className="h-2 bg-background/30 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                "bg-gradient-to-r from-primary via-purple-500 to-pink-500"
              )}
              style={{
                width: winStreak.streak >= 10 ? "100%" : 
                       winStreak.streak >= 7 ? `${((winStreak.streak - 7) / 3) * 100}%` :
                       winStreak.streak >= 5 ? `${((winStreak.streak - 5) / 2) * 100}%` :
                       `${((winStreak.streak - 3) / 2) * 100}%`
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className="font-medium">{winStreak.streak} побед подряд</span>
            <span>
              {winStreak.streak < 5 ? `до +10: ${5 - winStreak.streak} побед` : 
               winStreak.streak < 7 ? `до +25: ${7 - winStreak.streak} побед` :
               winStreak.streak < 10 ? `до +50: ${10 - winStreak.streak} побед` : "🏆 МАКСИМУМ!"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};