import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Search, User } from "lucide-react";
import { VipUsername, GradientColor } from "@/components/VipUsername";
import { safeParseInt } from "@/lib/safeParseInt";

interface GiveawayWinGiverProps {
  adminId: string;
}

export const GiveawayWinGiver = ({ adminId }: GiveawayWinGiverProps) => {
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedGiveawayId, setSelectedGiveawayId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users-search-giveaway", userSearchQuery],
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

  const { data: activeGiveaways = [] } = useQuery({
    queryKey: ["active-giveaways"],
    queryFn: async () => {
      const { data } = await supabase
        .from("giveaways")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedGiveaway = activeGiveaways.find((g) => g.id === selectedGiveawayId);

  const giveWin = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !selectedGiveawayId) throw new Error("Выберите пользователя и розыгрыш");
      const { data, error } = await supabase.rpc("admin_give_giveaway_win", {
        _admin_id: adminId,
        _target_user_id: selectedUserId,
        _giveaway_id: selectedGiveawayId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(data.message);
        setSelectedUserId(null);
        setSelectedGiveawayId(null);
        setUserSearchQuery("");
        queryClient.invalidateQueries({ queryKey: ["active-giveaways"] });
        queryClient.invalidateQueries({ queryKey: ["admin-giveaways"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: (error: any) => toast.error(error.message || "Ошибка выдачи победы"),
  });

  const getPrizeLabel = (type: string) => {
    switch (type) {
      case "balance": return "Баланс";
      case "freebet": return "Фрибет казино";
      case "betting_freebet": return "Фрибет ставки";
      case "wheel": return "Колёса";
      case "skin": return "Скин";
      default: return type;
    }
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Выдать победу в розыгрыше
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Search */}
        <div className="space-y-2">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск пользователя по ID или нику..."
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

        {/* Giveaway Selection */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">Выберите розыгрыш:</div>
          {activeGiveaways.length === 0 ? (
            <div className="text-sm text-yellow-500">Нет активных розыгрышей</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeGiveaways.map((giveaway) => (
                <div
                  key={giveaway.id}
                  onClick={() => setSelectedGiveawayId(giveaway.id)}
                  className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                    selectedGiveawayId === giveaway.id
                      ? "bg-yellow-500/20 border-yellow-500"
                      : "bg-background/50 border-transparent hover:bg-primary/10"
                  }`}
                >
                  <div className="font-medium">{giveaway.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {getPrizeLabel(giveaway.prize_type)}: {giveaway.prize_amount}₽
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={() => giveWin.mutate()}
          disabled={!selectedUserId || !selectedGiveawayId || giveWin.isPending}
          className="w-full bg-yellow-600 hover:bg-yellow-700"
        >
          <Trophy className="w-4 h-4 mr-2" />
          {giveWin.isPending ? "Выдача..." : "Выдать победу"}
        </Button>
      </CardContent>
    </Card>
  );
};