import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trophy, Calendar, Search } from "lucide-react";
import { VipUsername, GradientColor } from "@/components/VipUsername";

interface PlayerStats {
  id: string;
  username: string;
  is_vip: boolean;
  level: number;
  gradient_color: GradientColor;
  public_id: number;
  total_wins_count: number;
  total_win_amount: number;
}

export const PlayerWinsStats = () => {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ["player-wins-stats", dateFrom, dateTo],
    queryFn: async () => {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);

      // Fetch all game_history wins with pagination to bypass 1000 row limit
      const userWins: Record<string, { count: number; total: number }> = {};
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: gameHistory, error } = await supabase
          .from("game_history")
          .select("user_id, win_amount")
          .gt("win_amount", 0)
          .gte("created_at", fromDate.toISOString())
          .lte("created_at", toDate.toISOString())
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        if (!gameHistory || gameHistory.length === 0) {
          hasMore = false;
        } else {
          gameHistory.forEach(row => {
            if (!userWins[row.user_id]) {
              userWins[row.user_id] = { count: 0, total: 0 };
            }
            userWins[row.user_id].count += 1;
            userWins[row.user_id].total += Number(row.win_amount) || 0;
          });

          if (gameHistory.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
        }
      }

      const userIds = Object.keys(userWins);
      if (userIds.length === 0) return [];

      // Fetch profiles in batches if needed (for large user counts)
      const allProfiles: any[] = [];
      for (let i = 0; i < userIds.length; i += 100) {
        const batch = userIds.slice(i, i + 100);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, is_vip, level, gradient_color, public_id")
          .in("id", batch);
        if (profiles) allProfiles.push(...profiles);
      }

      // Merge data
      const result: PlayerStats[] = allProfiles.map(p => ({
        id: p.id,
        username: p.username,
        is_vip: p.is_vip || false,
        level: p.level || 1,
        gradient_color: p.gradient_color as GradientColor,
        public_id: p.public_id,
        total_wins_count: userWins[p.id]?.count || 0,
        total_win_amount: userWins[p.id]?.total || 0,
      }));

      // Sort by wins count descending
      result.sort((a, b) => b.total_wins_count - a.total_wins_count);

      return result;
    },
  });

  const filteredStats = (stats || []).filter(s => 
    !searchQuery || 
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.public_id.toString().includes(searchQuery)
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Статистика побед игроков
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              С даты
            </Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              По дату
            </Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Поиск
            </Label>
            <Input
              placeholder="Имя или ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => refetch()} className="w-full">
              Обновить
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Загрузка...</div>
        ) : filteredStats.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">Нет данных за выбранный период</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Игрок</th>
                  <th className="text-right py-2 px-2">Побед</th>
                  <th className="text-right py-2 px-2">Сумма выигрышей</th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.slice(0, 100).map((player, index) => (
                  <tr key={player.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-2 text-muted-foreground">{index + 1}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <VipUsername 
                          username={player.username} 
                          isVip={player.is_vip} 
                          level={player.level}
                          gradientColor={player.gradient_color}
                        />
                        <span className="text-xs text-muted-foreground">#{player.public_id}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-green-500">
                      {player.total_wins_count.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right font-medium">
                      {player.total_win_amount.toLocaleString()}₽
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {filteredStats.length > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            Показано {Math.min(filteredStats.length, 100)} из {filteredStats.length} игроков
          </div>
        )}
      </CardContent>
    </Card>
  );
};
