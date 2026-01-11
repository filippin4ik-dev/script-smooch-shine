import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUnreadSupport = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["unread-support", userId],
    queryFn: async () => {
      if (!userId) return 0;

      // Get all user's tickets
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "open");

      if (!tickets || tickets.length === 0) return 0;

      const ticketIds = tickets.map((t) => t.id);

      // Count admin messages in these tickets
      const { count } = await supabase
        .from("support_messages")
        .select("*", { count: "exact", head: true })
        .in("ticket_id", ticketIds)
        .eq("is_admin", true)
        .order("created_at", { ascending: false });

      return count || 0;
    },
    enabled: !!userId,
    refetchInterval: 5000, // Check every 5 seconds
  });
};
