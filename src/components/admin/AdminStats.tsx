import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Gamepad2, Activity } from "lucide-react";

export const AdminStats = () => {
  // Общая статистика
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // Количество пользователей
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Количество игр сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: gamesToday } = await supabase
        .from("game_history")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());

      // Максимальный выигрыш сегодня
      const { data: maxWinData } = await supabase
        .from("game_history")
        .select("win_amount")
        .gte("created_at", today.toISOString())
        .order("win_amount", { ascending: false })
        .limit(1)
        .single();

      // Онлайн игроки (активные за последние 5 минут)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const { count: onlineUsers } = await supabase
        .from("game_history")
        .select("user_id", { count: "exact", head: true })
        .gte("created_at", fiveMinutesAgo.toISOString());

      return {
        totalUsers: totalUsers || 0,
        gamesToday: gamesToday || 0,
        maxWinToday: maxWinData?.win_amount || 0,
        onlineUsers: onlineUsers || 0,
      };
    },
    refetchInterval: 5000, // Обновление каждые 5 секунд
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
          <Users className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {stats?.totalUsers || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Зарегистрировано в системе
          </p>
        </CardContent>
      </Card>

      <Card className="border-accent/20 bg-gradient-to-br from-accent/10 to-accent/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Игры сегодня</CardTitle>
          <Gamepad2 className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-accent">
            {stats?.gamesToday || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Игр сыграно за сегодня
          </p>
        </CardContent>
      </Card>

      <Card className="border-secondary/20 bg-gradient-to-br from-secondary/10 to-secondary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Макс выигрыш</CardTitle>
          <TrendingUp className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-secondary">
            {stats?.maxWinToday.toFixed(0)}₽
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Максимум за сегодня
          </p>
        </CardContent>
      </Card>

      <Card className="border-success/20 bg-gradient-to-br from-success/10 to-success/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Онлайн игроки</CardTitle>
          <Activity className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-success">
            {stats?.onlineUsers || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Активных за 5 минут
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
