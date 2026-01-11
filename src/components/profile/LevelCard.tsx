import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Star, Gift, Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface LevelCardProps {
  userId: string;
  xp: number;
  level: number;
}

const getXpForLevel = (level: number): number => {
  return Math.pow(level - 1, 2) * 100;
};

const getNextLevelXp = (level: number): number => {
  return getXpForLevel(level + 1);
};

export const LevelCard = ({ userId, xp, level }: LevelCardProps) => {
  const queryClient = useQueryClient();
  
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getNextLevelXp(level);
  const xpProgress = xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  const progressPercent = Math.min(100, (xpProgress / xpNeeded) * 100);

  const { data: levelRewards } = useQuery({
    queryKey: ["level-rewards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("level_rewards")
        .select("*")
        .order("level", { ascending: true });
      return data || [];
    },
  });

  const { data: claimedRewards } = useQuery({
    queryKey: ["claimed-rewards", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("level_claims")
        .select("level")
        .eq("user_id", userId);
      return data?.map(r => r.level) || [];
    },
    enabled: !!userId,
  });

  const claimReward = useMutation({
    mutationFn: async (rewardLevel: number) => {
      const { data, error } = await supabase.rpc("claim_level_reward", {
        _user_id: userId,
        _level: rewardLevel,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["claimed-rewards"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: () => {
      toast.error("Не удалось получить награду");
    },
  });

  // Check if there are claimable rewards
  const hasClaimable = levelRewards?.some((r: any) => 
    level >= r.level && !claimedRewards?.includes(r.level)
  );

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-card to-purple-500/10 border border-amber-500/30 p-4">
      {/* Decorative sparkles */}
      <Sparkles className="absolute top-3 right-3 w-5 h-5 text-amber-400/40 animate-pulse" />
      
      {/* Level circle and progress */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-amber-500 to-orange-500",
            "shadow-[0_0_20px_hsl(38,92%,50%,0.4)]",
            "border-2 border-amber-400/50"
          )}>
            <span className="text-2xl font-black text-white">{level}</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center border-2 border-background">
            <Star className="w-3 h-3 text-white" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold">Уровень {level}</span>
            <span className="text-sm text-amber-400 font-medium">{xp} XP</span>
          </div>
          <div className="relative h-3 rounded-full bg-muted/50 overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">{xpProgress} / {xpNeeded}</span>
            <span className="text-xs text-purple-400">→ Уровень {level + 1}</span>
          </div>
        </div>
      </div>

      {/* Claimable rewards notification */}
      {hasClaimable && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 mb-3 animate-pulse">
          <Gift className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-medium text-amber-300">Есть доступные награды!</span>
        </div>
      )}

      {/* Compact rewards row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {levelRewards?.slice(0, 8).map((reward: any) => {
          const isClaimed = claimedRewards?.includes(reward.level);
          const canClaim = level >= reward.level && !isClaimed;
          const isLocked = level < reward.level;
          const isVip = reward.reward_type === 'vip';
          
          return (
            <div
              key={reward.level}
              className={cn(
                "flex-shrink-0 w-16 p-2 rounded-xl text-center transition-all",
                isClaimed && "bg-green-500/20 border border-green-500/40",
                canClaim && !isVip && "bg-primary/20 border border-primary/40",
                canClaim && isVip && "bg-amber-500/20 border border-amber-500/40",
                isLocked && "bg-muted/30 border border-border/30 opacity-60"
              )}
            >
              <div className="text-[10px] text-muted-foreground mb-0.5">Ур. {reward.level}</div>
              <div className={cn(
                "text-xs font-bold",
                isClaimed && "text-green-400",
                canClaim && "text-primary",
                isLocked && "text-muted-foreground"
              )}>
                {isVip ? "⭐" : 
                 reward.reward_type === 'wheel' ? "🎡" :
                 `${reward.reward_amount}₽`}
              </div>
              {canClaim && (
                <Button
                  size="sm"
                  className="h-5 text-[10px] px-2 mt-1 w-full"
                  onClick={() => claimReward.mutate(reward.level)}
                  disabled={claimReward.isPending}
                >
                  Взять
                </Button>
              )}
              {isClaimed && (
                <div className="text-[10px] text-green-400 mt-1">✓</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
