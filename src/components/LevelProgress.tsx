import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Star, Gift, Trophy } from "lucide-react";

interface LevelProgressProps {
  userId: string;
  xp: number;
  level: number;
}

// Calculate XP needed for each level - must match database formula: FLOOR(SQRT(xp / 100) + 1)
// Inverse: to reach level L, you need xp = (L-1)^2 * 100
const getXpForLevel = (level: number): number => {
  return Math.pow(level - 1, 2) * 100;
};

const getNextLevelXp = (level: number): number => {
  return getXpForLevel(level + 1);
};

export const LevelProgress = ({ userId, xp, level }: LevelProgressProps) => {
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

  return (
    <Card className="border-border/50 shadow-gold overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Уровень и опыт
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level Display */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center border-4 border-primary/30">
              <span className="text-2xl font-bold">{level}</span>
            </div>
            <Star className="w-5 h-5 text-yellow-400 absolute -top-1 -right-1" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Уровень {level}</span>
              <span className="text-primary font-medium">{xp} XP</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{xpProgress} / {xpNeeded} XP</span>
              <span>До уровня {level + 1}</span>
            </div>
          </div>
        </div>

        {/* Level Rewards */}
        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <Gift className="w-4 h-4 text-green-400" />
            Награды за уровни
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {levelRewards?.map((reward: any) => {
              const isClaimed = claimedRewards?.includes(reward.level);
              const canClaim = level >= reward.level && !isClaimed;
              const isLocked = level < reward.level;
              const isVipReward = reward.reward_type === 'vip';
              
              return (
                <div
                  key={reward.level}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    isClaimed 
                      ? "bg-green-500/10 border-green-500/30" 
                      : canClaim 
                        ? isVipReward 
                          ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/50 animate-pulse"
                          : reward.reward_type === 'wheel'
                            ? "bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border-orange-500/50 animate-pulse"
                            : "bg-primary/10 border-primary/30 animate-pulse" 
                        : isVipReward
                          ? "bg-gradient-to-r from-yellow-500/5 to-amber-500/5 border-yellow-500/30"
                          : reward.reward_type === 'wheel'
                            ? "bg-gradient-to-r from-orange-500/5 to-yellow-500/5 border-orange-500/30"
                            : "bg-muted/20 border-border/50"
                  }`}
                >
                  <div className={`text-xs ${isLocked ? "text-muted-foreground" : ""}`}>
                    Уровень {reward.level}
                  </div>
                  <div className={`font-bold text-sm ${
                    isClaimed 
                      ? "text-green-400" 
                      : canClaim 
                        ? isVipReward ? "text-yellow-400" : reward.reward_type === 'wheel' ? "text-orange-400" : "text-primary" 
                        : isLocked 
                          ? "text-muted-foreground" 
                          : isVipReward ? "text-yellow-500/70" : reward.reward_type === 'wheel' ? "text-orange-500/70" : ""
                  }`}>
                    {isVipReward ? "⭐ VIP" : 
                     reward.reward_type === 'wheel' ? `🎡 ${reward.reward_amount}` :
                     reward.reward_type === 'freebet' ? `${reward.reward_amount}₽ фрибет` :
                     reward.reward_type === 'betting_freebet' ? `${reward.reward_amount}₽ ставки` :
                     `${reward.reward_amount}₽`}
                  </div>
                  {isClaimed ? (
                    <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 mt-1">
                      ✓ Получено
                    </Badge>
                  ) : canClaim ? (
                    <Button
                      size="sm"
                      className={`mt-1 h-6 text-xs ${isVipReward ? "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600" : ""}`}
                      onClick={() => claimReward.mutate(reward.level)}
                      disabled={claimReward.isPending}
                    >
                      Забрать
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-xs mt-1 opacity-50">
                      🔒
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          💡 Получайте XP за выигрыши в играх и ставках. За достижение уровней получайте фрибеты для ставок!
        </div>
      </CardContent>
    </Card>
  );
};
