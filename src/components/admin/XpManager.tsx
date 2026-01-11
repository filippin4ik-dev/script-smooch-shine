import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Plus, Minus, Search } from "lucide-react";
import { safeParseInt } from "@/lib/safeParseInt";

interface XpManagerProps {
  adminId: string;
}

export const XpManager = ({ adminId }: XpManagerProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [xpAmount, setXpAmount] = useState("");

  const { data: users } = useQuery({
    queryKey: ["admin-xp-users-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 1) return [];
      const parsedId = safeParseInt(searchQuery);
      let query = supabase
        .from("profiles")
        .select("id, username, public_id, balance, xp, level");
      
      if (parsedId !== null) {
        query = query.or(`public_id.eq.${parsedId},username.ilike.%${searchQuery}%`);
      } else {
        query = query.ilike("username", `%${searchQuery}%`);
      }
      
      const { data } = await query.limit(10);
      return data || [];
    },
    enabled: searchQuery.length >= 1,
  });

  const modifyXp = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const { data, error } = await supabase.rpc("admin_modify_xp", {
        _admin_id: adminId,
        _target_user_id: userId,
        _xp_amount: amount,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ["admin-xp-users-search"] });
        setXpAmount("");
        // Refresh selected user data
        if (selectedUser) {
          const { data: updated } = supabase
            .from("profiles")
            .select("id, username, telegram_id, balance, xp, level")
            .eq("id", selectedUser.id)
            .single();
        }
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: () => {
      toast.error("Не удалось изменить XP");
    },
  });

  const handleModifyXp = (positive: boolean) => {
    if (!selectedUser) {
      toast.error("Выберите пользователя");
      return;
    }
    
    const amount = parseInt(xpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Введите корректное количество XP");
      return;
    }
    
    modifyXp.mutate({
      userId: selectedUser.id,
      amount: positive ? amount : -amount,
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Управление XP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Поиск пользователя</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Имя или ID игрока"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {users && users.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {users.map((user: any) => (
              <div
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedUser?.id === user.id
                    ? "bg-primary/20 border border-primary/40"
                    : "bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <div className="font-bold">{user.username}</div>
                <div className="text-xs text-muted-foreground flex gap-3">
                  <span>ID: {user.public_id}</span>
                  <span>Уровень: {user.level || 1}</span>
                  <span>XP: {user.xp || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
            <div className="text-sm text-muted-foreground">Выбран:</div>
            <div className="font-bold">{selectedUser.username}</div>
            <div className="text-sm">
              Уровень: <span className="text-primary font-bold">{selectedUser.level || 1}</span> • 
              XP: <span className="text-primary font-bold">{selectedUser.xp || 0}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Количество XP</Label>
          <Input
            type="number"
            placeholder="Количество XP"
            value={xpAmount}
            onChange={(e) => setXpAmount(e.target.value)}
            min="1"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => handleModifyXp(true)}
            disabled={!selectedUser || !xpAmount || modifyXp.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Добавить XP
          </Button>
          <Button
            onClick={() => handleModifyXp(false)}
            disabled={!selectedUser || !xpAmount || modifyXp.isPending}
            variant="destructive"
            className="flex-1"
          >
            <Minus className="w-4 h-4 mr-1" />
            Снять XP
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
