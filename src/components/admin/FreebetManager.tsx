import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Search, User, Minus, Gift } from "lucide-react";
import { safeParseInt } from "@/lib/safeParseInt";

interface FreebetManagerProps {
  adminId: string;
}

export const FreebetManager = ({ adminId }: FreebetManagerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deductAmount, setDeductAmount] = useState("");
  const [deductType, setDeductType] = useState<"regular" | "betting">("regular");
  const queryClient = useQueryClient();

  // Поиск пользователей с фрибетами
  const { data: users, isLoading } = useQuery({
    queryKey: ["users-freebets", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, username, public_id, balance, freebet_balance, betting_freebet_balance, wager_requirement, wager_progress")
        .or("freebet_balance.gt.0,betting_freebet_balance.gt.0");
      
      if (searchQuery.length >= 1) {
        const parsedId = safeParseInt(searchQuery);
        if (parsedId !== null) {
          query = query.or(`public_id.eq.${parsedId},username.ilike.%${searchQuery}%`);
        } else {
          query = query.ilike("username", `%${searchQuery}%`);
        }
      }
      
      const { data, error } = await query.order("freebet_balance", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Мутация для списания фрибета через защищённый RPC
  const deductFreebet = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !deductAmount) {
        throw new Error("Выберите пользователя и укажите сумму");
      }

      const amount = parseFloat(deductAmount);
      const user = users?.find(u => u.id === selectedUserId);
      
      if (!user) throw new Error("Пользователь не найден");
      
      const currentBalance = deductType === "regular" 
        ? (user.freebet_balance || 0) 
        : (user.betting_freebet_balance || 0);
      
      if (amount > currentBalance) {
        throw new Error(`Нельзя списать больше чем есть (${currentBalance.toFixed(2)}₽)`);
      }

      const freebetType = deductType === "regular" ? "casino" : "betting";

      const { data, error } = await supabase.rpc("admin_deduct_freebet", {
        _admin_id: adminId,
        _target_user_id: selectedUserId,
        _amount: amount,
        _freebet_type: freebetType,
      });

      if (error) throw error;
      if (!data || !data[0]?.success) {
        throw new Error(data?.[0]?.message || "Ошибка списания фрибета");
      }

      return { success: true, amount, type: deductType };
    },
    onSuccess: (data) => {
      toast.success(`Списано ${data.amount}₽ ${data.type === "regular" ? "фрибета" : "беттинг фрибета"}`);
      setDeductAmount("");
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ["users-freebets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка списания");
    },
  });

  const selectedUser = users?.find(u => u.id === selectedUserId);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Управление фрибетами пользователей
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Поиск */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Поиск пользователя (показаны только с фрибетами)
          </Label>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Введите никнейм или ID..."
            className="bg-input"
          />
        </div>

        {/* Список пользователей с фрибетами */}
        {isLoading ? (
          <p className="text-center text-muted-foreground py-4">Загрузка...</p>
        ) : users && users.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto border border-border rounded-lg p-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUserId(user.id === selectedUserId ? null : user.id)}
                className={`w-full p-3 text-left rounded-lg transition-colors ${
                  selectedUserId === user.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 hover:bg-muted"
                }`}
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
                    <div className="flex items-center gap-1">
                      <Gift className="w-3 h-3 text-yellow-500" />
                      <span className="text-yellow-500 font-medium">
                        {(user.freebet_balance || 0).toFixed(2)}₽
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Gift className="w-3 h-3 text-blue-500" />
                      <span className="text-blue-500 font-medium">
                        {(user.betting_freebet_balance || 0).toFixed(2)}₽
                      </span>
                    </div>
                    {(user.wager_requirement || 0) > 0 && (
                      <p className="text-xs opacity-70">
                        Вейджер: {(user.wager_progress || 0).toFixed(0)}/{(user.wager_requirement || 0).toFixed(0)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">
            Нет пользователей с фрибетами
          </p>
        )}

        {/* Форма списания */}
        {selectedUser && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm font-semibold mb-2">Выбран: {selectedUser.username}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-yellow-500/20 rounded">
                  <p className="text-xs text-muted-foreground">Фрибет (игры)</p>
                  <p className="font-bold text-yellow-500">
                    {(selectedUser.freebet_balance || 0).toFixed(2)}₽
                  </p>
                </div>
                <div className="p-2 bg-blue-500/20 rounded">
                  <p className="text-xs text-muted-foreground">Фрибет (ставки)</p>
                  <p className="font-bold text-blue-500">
                    {(selectedUser.betting_freebet_balance || 0).toFixed(2)}₽
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={deductType === "regular" ? "default" : "outline"}
                onClick={() => setDeductType("regular")}
                className="flex-1"
              >
                Игровой
              </Button>
              <Button
                size="sm"
                variant={deductType === "betting" ? "default" : "outline"}
                onClick={() => setDeductType("betting")}
                className="flex-1"
              >
                Беттинг
              </Button>
            </div>

            <div>
              <Label>Сумма списания (₽)</Label>
              <Input
                type="number"
                value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                placeholder="Введите сумму"
                min="0.01"
                step="0.01"
                max={deductType === "regular" 
                  ? (selectedUser.freebet_balance || 0) 
                  : (selectedUser.betting_freebet_balance || 0)
                }
                className="bg-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Макс: {deductType === "regular" 
                  ? (selectedUser.freebet_balance || 0).toFixed(2) 
                  : (selectedUser.betting_freebet_balance || 0).toFixed(2)
                }₽
              </p>
            </div>

            <Button
              onClick={() => deductFreebet.mutate()}
              disabled={!deductAmount || parseFloat(deductAmount) <= 0 || deductFreebet.isPending}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <Minus className="w-4 h-4 mr-2" />
              {deductFreebet.isPending ? "Списание..." : `Списать ${deductAmount || "0"}₽`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
