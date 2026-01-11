import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Gift } from "lucide-react";

interface FreeSpinsRewardProps {
  userId: string;
}

export const FreeSpinsReward = ({ userId }: FreeSpinsRewardProps) => {
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  const { data: freeSpinsData } = useQuery({
    queryKey: ["free-spins", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_freespins")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from("user_freespins")
          .insert({ user_id: userId, freespins_count: 0 })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newData;
      }
      
      return data;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`free-spins-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_freespins',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["free-spins", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const claimFreeSpins = useMutation({
    mutationFn: async () => {
      const spinsCount = Math.floor(Math.random() * 5) + 1;
      
      const { error } = await supabase
        .from("user_freespins")
        .update({ 
          freespins_count: (freeSpinsData?.freespins_count || 0) + spinsCount,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      if (error) throw error;
      return spinsCount;
    },
    onSuccess: (spinsCount) => {
      toast.success(`🎉 Получено ${spinsCount} фриспинов!`);
      queryClient.invalidateQueries({ queryKey: ["free-spins", userId] });
    },
    onError: (error) => {
      toast.error("Ошибка при получении фриспинов");
      console.error(error);
    },
  });

  const handleClaim = async () => {
    if (!canClaim()) return;
    
    setClaiming(true);
    try {
      await claimFreeSpins.mutateAsync();
    } finally {
      setClaiming(false);
    }
  };

  const canClaim = () => {
    if (!freeSpinsData?.updated_at) return true;
    const lastClaimed = new Date(freeSpinsData.updated_at);
    const now = new Date();
    const hoursSince = (now.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60);
    return hoursSince >= 24;
  };

  const updateTimeLeft = () => {
    if (!freeSpinsData?.updated_at) {
      setTimeLeft("");
      return;
    }

    const lastClaimed = new Date(freeSpinsData.updated_at);
    const nextClaim = new Date(lastClaimed.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = nextClaim.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeLeft("");
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
  }, [freeSpinsData?.updated_at]);

  return (
    <Card className="relative overflow-hidden bg-gradient-card border border-primary/30 shadow-neon-blue hover:shadow-neon-purple transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10"></div>
      
      <div className="relative p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-neon-blue">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-primary">Ежедневные фриспины</h3>
            <p className="text-xs text-muted-foreground">Получай 1-5 фриспинов каждый день</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-primary/20">
            <span className="text-sm text-muted-foreground">Доступно фриспинов</span>
            <span className="text-xl font-black text-primary">{freeSpinsData?.freespins_count || 0}</span>
          </div>

          <Button
            onClick={handleClaim}
            disabled={!canClaim() || claiming}
            className="w-full bg-gradient-primary hover:shadow-neon-blue transition-all disabled:opacity-50"
          >
            {claiming ? "Получение..." : canClaim() ? "🎁 Получить фриспины" : `⏰ ${timeLeft}`}
          </Button>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {canClaim() ? "✨ Доступно сейчас!" : "Следующая награда через"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};