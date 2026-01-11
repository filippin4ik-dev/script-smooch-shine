import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Search, User } from "lucide-react";
import { safeParseInt } from "@/lib/safeParseInt";

interface DemoGiverProps {
  adminId: string;
}

export const DemoGiver = ({ adminId }: DemoGiverProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["users-search-demo", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 1) return [];
      const parsedId = safeParseInt(searchQuery);
      let query = supabase
        .from("profiles")
        .select("id, username, telegram_id, public_id, balance, demo_balance");
      
      if (parsedId !== null) {
        query = query.or(`public_id.eq.${parsedId},username.ilike.%${searchQuery}%`);
      } else {
        query = query.ilike("username", `%${searchQuery}%`);
      }
      
      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 1,
  });

  const giveDemo = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !amount) {
        throw new Error("Выберите пользователя и укажите сумму");
      }
      const { data, error } = await supabase.rpc("give_demo_balance", {
        _admin_id: adminId,
        _target_user_id: selectedUserId,
        _amount: parseFloat(amount),
      });
      if (error) throw error;
      return data as { success: boolean; amount?: number; message?: string };
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(`Демо-счёт начислен: +${data.amount}₽`);
        setAmount("");
        setSelectedUserId(null);
        setSearchQuery("");
        queryClient.invalidateQueries({ queryKey: ["users-search-demo"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка выдачи демо");
    },
  });

  const selectedUser = users?.find((u: any) => u.id === selectedUserId);

  return (
    <Card className="border-green-500/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-green-500">
          <Play className="w-5 h-5" />
          Выдать демо-счёт
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Поиск пользователя
          </Label>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Никнейм или ID"
            className="bg-input"
          />
          {users && users.length > 0 && (
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border border-border rounded-lg p-2">
              {users.map((user: any) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full p-3 text-left rounded-lg transition-colors ${selectedUserId === user.id ? "bg-green-600 text-white" : "bg-muted/50 hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <div>
                        <p className="font-semibold">{user.username}</p>
                        <p className="text-xs opacity-70">ID: {user.public_id}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p>Баланс: {user.balance?.toFixed(2)}₽</p>
                      <p className="text-xs opacity-70">Демо: {(user.demo_balance || 0).toFixed(2)}₽</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedUser && (
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-sm font-semibold mb-1">Выбран:</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{selectedUser.username}</p>
                <p className="text-xs text-muted-foreground">ID: {(selectedUser as any).public_id}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedUserId(null)}>✕</Button>
            </div>
          </div>
        )}

        {selectedUserId && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div>
              <Label>Сумма демо (₽)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Например: 1000"
                min="1"
                className="bg-input"
              />
            </div>
            <Button
              onClick={() => giveDemo.mutate()}
              disabled={!amount || giveDemo.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4 mr-2" />
              {giveDemo.isPending ? "Начисление..." : `Выдать ${amount || "0"}₽ демо`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
