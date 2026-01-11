import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, Trophy, Zap } from "lucide-react";

export const LiveStats = () => {
  const { data: stats } = useQuery({
    queryKey: ["live-stats"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

      const [gamesToday, onlineUsers, biggestWin] = await Promise.all([
        supabase
          .from("game_history")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("last_seen_message_at", fiveMinutesAgo),
        supabase
          .from("game_history")
          .select("win_amount, game_name")
          .gt("win_amount", 0)
          .order("win_amount", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        totalGames: gamesToday.count || 0,
        totalUsers: onlineUsers.count || 0,
        biggestWin: biggestWin.data?.win_amount || 0,
      };
    },
    refetchInterval: 5000, // Обновляем каждые 5 секунд
  });

  const statCards = [
    {
      icon: Users,
      label: "Игроков онлайн",
      value: stats?.totalUsers || 0,
      color: "text-primary",
      gradient: "from-primary/20 to-primary/5",
    },
    {
      icon: Zap,
      label: "Игр сегодня",
      value: stats?.totalGames || 0,
      color: "text-secondary",
      gradient: "from-secondary/20 to-secondary/5",
    },
    {
      icon: Trophy,
      label: "Макс выигрыш",
      value: `${(stats?.biggestWin || 0).toFixed(0)}₽`,
      color: "text-accent",
      gradient: "from-accent/20 to-accent/5",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {statCards.map((stat, index) => (
        <Card
          key={index}
          className="relative overflow-hidden bg-gradient-card border border-border/50 hover:border-primary/50 transition-all duration-300 group"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
          
          <div className="relative p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
              <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            </div>
            <div className={`text-lg sm:text-2xl font-black ${stat.color} mb-1`}>
              {stat.value}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
              {stat.label}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
