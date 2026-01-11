import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

export const useProfile = (userId?: string) => {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Profile fetch error:", error);
        return null;
      }
      
      console.log("Profile data loaded:", data);
      return data;
    },
    enabled: !!userId,
    staleTime: 30000,
  });

  // Realtime подписка на изменения профиля для мгновенного обновления баланса
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('Profile updated via realtime:', payload);
          // Мгновенное обновление данных из payload
          queryClient.setQueryData(["profile", userId], (old: any) => {
            if (!old) return old;
            return {
              ...old,
              balance: payload.new.balance,
              freebet_balance: payload.new.freebet_balance,
              demo_balance: payload.new.demo_balance,
              wager_progress: payload.new.wager_progress,
              wager_requirement: payload.new.wager_requirement,
              xp: payload.new.xp,
              level: payload.new.level,
            };
          });
        }
      )
      .subscribe();

    // Автообновление каждые 3 секунды для синхронизации
    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId, queryClient, refetch]);

  const isAdmin = Array.isArray(profile?.user_roles) && profile.user_roles.some((r: any) => r.role === "admin");
  
  console.log("useProfile - userId:", userId, "isAdmin:", isAdmin, "profile:", profile);

  const updateBalance = useMutation({
    mutationFn: async ({ amount, type }: { amount: number; type: string }) => {
      if (!userId) throw new Error("No user");
      
      const { error } = await supabase.rpc("update_balance", {
        user_id: userId,
        amount,
      });

      if (error) throw error;

      await supabase.from("transactions").insert({
        user_id: userId,
        amount,
        type,
        description: `${type} transaction`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      toast.error("Ошибка обновления баланса");
      console.error(error);
    },
  });

  return {
    profile,
    isLoading,
    updateBalance,
    isAdmin,
    refetch,
  };
};
