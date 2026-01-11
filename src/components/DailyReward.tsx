import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface DailyRewardProps {
  userId: string;
}

export const DailyReward = ({ userId }: DailyRewardProps) => {
  const [claiming, setClaiming] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const queryClient = useQueryClient();

  const { data: rewardData } = useQuery({
    queryKey: ["daily-reward", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_rewards")
        .select("*")
        .eq("user_id", userId)
        .single();
      return data;
    },
    staleTime: 60000,
  });

  // Realtime обновления наград
  useEffect(() => {
    const channel = supabase
      .channel('daily-rewards-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_rewards',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["daily-reward", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const claimReward = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_daily_reward", {
        _user_id: userId,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(`${data.message} +${data.reward_amount?.toFixed(2)}₽`, {
          description: "Приходи снова через 2 часа!",
        });
        queryClient.invalidateQueries({ queryKey: ["daily-reward"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      } else {
        toast.error(data?.message || "Еще рано получать подарок");
      }
    },
    onError: () => {
      toast.error("Ошибка получения подарка");
    },
  });

  const handleClaim = async () => {
    setClaiming(true);
    await claimReward.mutateAsync();
    setClaiming(false);
  };

  const canClaim = () => {
    if (!rewardData?.last_claimed_at) return true;
    const lastClaimed = new Date(rewardData.last_claimed_at);
    const now = new Date();
    const diff = now.getTime() - lastClaimed.getTime();
    const twoHours = 2 * 60 * 60 * 1000;
    return diff >= twoHours;
  };

  const updateTimeLeft = () => {
    if (!rewardData?.last_claimed_at) {
      setTimeLeft("Доступно сейчас!");
      return;
    }
    
    const lastClaimed = new Date(rewardData.last_claimed_at);
    const nextClaim = new Date(lastClaimed.getTime() + 2 * 60 * 60 * 1000);
    const now = new Date();
    const diff = nextClaim.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeLeft("Доступно сейчас!");
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeLeft(`${hours}ч ${minutes}м ${seconds}с`);
  };

  useEffect(() => {
    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [rewardData]);

  return (
    <Card className="relative overflow-hidden bg-gradient-card border border-primary/30 shadow-neon-blue hover:shadow-neon-purple transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10"></div>
      
      <div className="relative p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-neon-blue">
            <span className="text-2xl">🎁</span>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-primary">Бесплатный подарок</h3>
            <p className="text-xs text-muted-foreground">Каждые 2 часа</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-primary/20">
            <span className="text-sm text-muted-foreground">Ежедневная награда</span>
            <span className="text-xl font-black text-primary">1-8 монет</span>
          </div>

          {rewardData && (
            <div className="text-center text-xs text-muted-foreground">
              Всего получено: {rewardData.total_claimed} раз
            </div>
          )}

          <Button
            onClick={handleClaim}
            disabled={!canClaim() || claiming}
            className="w-full bg-gradient-primary hover:shadow-neon-blue transition-all disabled:opacity-50"
          >
            {claiming ? "Получаем..." : canClaim() ? "🎁 Получить подарок" : `⏰ ${timeLeft}`}
          </Button>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {canClaim() ? "✨ Доступно сейчас!" : "Следующий подарок через"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
