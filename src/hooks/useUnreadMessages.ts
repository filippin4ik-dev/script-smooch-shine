import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useUnreadMessages = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["unread-messages", userId],
    queryFn: async () => {
      if (!userId) return 0;

      // Get user's last seen timestamp
      const { data: profile } = await supabase
        .from("profiles")
        .select("last_seen_message_at")
        .eq("id", userId)
        .single();

      if (!profile?.last_seen_message_at) return 0;

      // Count messages after last seen
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .gt("created_at", profile.last_seen_message_at)
        .neq("user_id", userId); // Don't count own messages

      return count || 0;
    },
    enabled: !!userId,
    refetchInterval: 3000, // Check every 3 seconds
  });
};

export const markMessagesAsRead = async (userId: string) => {
  await supabase
    .from("profiles")
    .update({ last_seen_message_at: new Date().toISOString() })
    .eq("id", userId);
};
