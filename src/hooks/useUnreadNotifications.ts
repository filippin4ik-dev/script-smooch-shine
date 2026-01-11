import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUnreadNotifications = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["unread-notifications", userId],
    queryFn: async () => {
      if (!userId) return 0;

      // Count unread system notifications
      const { count } = await supabase
        .from("system_notifications")
        .select("*", { count: "exact", head: true })
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq("is_read", false);

      return count || 0;
    },
    enabled: !!userId,
    refetchInterval: 3000, // Check every 3 seconds
  });
};
