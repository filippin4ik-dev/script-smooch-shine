import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Gamepad2, User } from "lucide-react";
import { VipUsername, GradientColor } from "@/components/VipUsername";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { safeParseInt } from "@/lib/safeParseInt";

interface GameWinGiverProps {
  adminId: string;
}

const GAMES = [
  { value: "mines", label: "Mines" },
  { value: "dice", label: "Dice" },
  { value: "crash", label: "Crash" },
  { value: "roulette", label: "Roulette" },
  { value: "hilo", label: "HiLo" },
  { value: "plinko", label: "Plinko" },
  { value: "balloon", label: "Balloon" },
  { value: "towers", label: "Towers" },
  { value: "chicken_road", label: "Chicken Road" },
  { value: "upgrader", label: "Upgrader" },
  { value: "cases", label: "Cases" },
  { value: "slots", label: "Slots" },
  { value: "blackjack", label: "Blackjack" },
  { value: "horse_racing", label: "Horse Racing" },
  { value: "penalty", label: "Penalty" },
];

export const GameWinGiver = ({ adminId }: GameWinGiverProps) => {
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [gameName, setGameName] = useState("mines");
  const [betAmount, setBetAmount] = useState("100");
  const [winAmount, setWinAmount] = useState("200");
  const [winsCount, setWinsCount] = useState("1");
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users-search-game-win", userSearchQuery],
    queryFn: async () => {
      if (!userSearchQuery || userSearchQuery.length < 2) return [];
      const parsedId = safeParseInt(userSearchQuery);
      let query = supabase
        .from("profiles")
        .select("id, username, public_id, is_vip, level, gradient_color");
      
      if (parsedId !== null) {
        query = query.or(`public_id.eq.${parsedId},username.ilike.%${userSearchQuery}%`);
      } else {
        query = query.ilike("username", `%${userSearchQuery}%`);
      }
      
      const { data } = await query.limit(10);
      return data || [];
    },
    enabled: userSearchQuery.length >= 2,
  });

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const giveWin = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("Выберите пользователя");
      
      const count = parseInt(winsCount) || 1;
      const results = [];
      
      for (let i = 0; i < count; i++) {
        const { data, error } = await supabase.rpc("admin_add_game_win", {
          _admin_id: adminId,
          _target_user_id: selectedUserId,
          _game_name: gameName,
          _bet_amount: parseFloat(betAmount) || 100,
          _win_amount: parseFloat(winAmount) || 200,
          _multiplier: (parseFloat(winAmount) || 200) / (parseFloat(betAmount) || 100),
        });
        if (error) throw error;
        results.push(data);
      }
      
      return results;
    },
    onSuccess: (results) => {
      const lastResult = results[results.length - 1] as any;
      if (lastResult?.success) {
        toast.success(`Добавлено ${winsCount} побед(ы) для ${selectedUser?.username}`);
        setSelectedUserId(null);
        setUserSearchQuery("");
        queryClient.invalidateQueries({ queryKey: ["giveaway-leaderboard"] });
      } else {
        toast.error(lastResult?.message || "Ошибка");
      }
    },
    onError: (error: any) => toast.error(error.message || "Ошибка добавления победы"),
  });

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-green-400" />
          Добавить победы в играх (для розыгрышей)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Search */}
        <div className="space-y-2">
          <Label>Пользователь</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по ID или нику..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {users.length > 0 && !selectedUserId && (
            <div className="max-h-32 overflow-y-auto space-y-1 bg-background/50 rounded-lg p-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className="p-2 hover:bg-primary/20 rounded cursor-pointer flex justify-between text-sm"
                >
                  <VipUsername
                    username={user.username}
                    isVip={user.is_vip}
                    gradientColor={(user.gradient_color as GradientColor) || "gold"}
                    level={user.level}
                    showLevel={false}
                  />
                  <span className="text-muted-foreground">#{user.public_id}</span>
                </div>
              ))}
            </div>
          )}
          {selectedUser && (
            <div className="p-2 bg-green-500/20 rounded-lg flex justify-between items-center">
              <VipUsername
                username={selectedUser.username}
                isVip={selectedUser.is_vip}
                gradientColor={(selectedUser.gradient_color as GradientColor) || "gold"}
                level={selectedUser.level}
                showLevel={false}
              />
              <Button size="sm" variant="ghost" onClick={() => setSelectedUserId(null)}>✕</Button>
            </div>
          )}
        </div>

        {/* Game Selection */}
        <div className="space-y-2">
          <Label>Игра</Label>
          <Select value={gameName} onValueChange={setGameName}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GAMES.map((game) => (
                <SelectItem key={game.value} value={game.value}>
                  {game.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Ставка</Label>
            <Input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          <div className="space-y-2">
            <Label>Выигрыш</Label>
            <Input
              type="number"
              value={winAmount}
              onChange={(e) => setWinAmount(e.target.value)}
              placeholder="200"
            />
          </div>
          <div className="space-y-2">
            <Label>Кол-во побед</Label>
            <Input
              type="number"
              value={winsCount}
              onChange={(e) => setWinsCount(e.target.value)}
              placeholder="1"
              min="1"
              max="100"
            />
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Множитель: x{((parseFloat(winAmount) || 200) / (parseFloat(betAmount) || 100)).toFixed(2)}
        </div>

        <Button
          onClick={() => giveWin.mutate()}
          disabled={!selectedUserId || giveWin.isPending}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Gamepad2 className="w-4 h-4 mr-2" />
          {giveWin.isPending ? "Добавление..." : `Добавить ${winsCount} побед(ы)`}
        </Button>
      </CardContent>
    </Card>
  );
};