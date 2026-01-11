import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Search, User } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { safeParseInt } from "@/lib/safeParseInt";

interface FreebetGiverProps {
  adminId: string;
}

export const FreebetGiver = ({ adminId }: FreebetGiverProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [freebetType, setFreebetType] = useState<"regular" | "betting">("regular");
  const queryClient = useQueryClient();

  // Поиск пользователей
  const { data: users } = useQuery({
    queryKey: ["users-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 1) return [];
      const parsedId = safeParseInt(searchQuery);
      let query = supabase
        .from("profiles")
        .select("id, username, telegram_id, public_id, balance, freebet_balance");
      
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

  // Мутация для выдачи фрибета
  const giveFreebet = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !amount) {
        throw new Error("Выберите пользователя и укажите сумму");
      }

      const { data, error } = await supabase.rpc("admin_give_freebet", {
        _admin_id: adminId,
        _target_user_id: selectedUserId,
        _amount: parseFloat(amount),
        _description: description || "Фрибет от администрации",
        _freebet_type: freebetType,
      });

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data.message);
        setAmount("");
        setDescription("");
        setSelectedUserId(null);
        setSearchQuery("");
        queryClient.invalidateQueries({ queryKey: ["users-search"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка выдачи фрибета");
    },
  });

  const selectedUser = users?.find(u => u.id === selectedUserId);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          Выдать фрибет пользователю
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Поиск пользователя */}
        <div className="space-y-2">
          <Label htmlFor="search-user" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Поиск пользователя
          </Label>
          <Input
            id="search-user"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Введите никнейм или ID игрока..."
            className="bg-input"
          />
          
          {/* Результаты поиска */}
          {users && users.length > 0 && (
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto border border-border rounded-lg p-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
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
                      <p>Баланс: {user.balance.toFixed(2)}₽</p>
                      <p className="text-xs opacity-70">
                        Фрибет: {user.freebet_balance.toFixed(2)}₽
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && users?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Пользователи не найдены
            </p>
          )}
        </div>

        {/* Выбранный пользователь */}
        {selectedUser && (
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm font-semibold mb-1">Выбран пользователь:</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{selectedUser.username}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {(selectedUser as any).public_id}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedUserId(null)}
              >
                ✕
              </Button>
            </div>
          </div>
        )}

        {/* Форма выдачи */}
        {selectedUserId && (
          <div className="space-y-3 pt-2 border-t border-border">
            {/* Выбор типа фрибета */}
            <div>
              <Label>Тип фрибета</Label>
              <RadioGroup
                value={freebetType}
                onValueChange={(v) => setFreebetType(v as "regular" | "betting")}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="regular" id="regular" />
                  <Label htmlFor="regular" className="cursor-pointer">
                    Обычный фрибет (для игр)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="betting" id="betting" />
                  <Label htmlFor="betting" className="cursor-pointer">
                    Фрибет для ставок
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="freebet-amount">Сумма фрибета (₽)</Label>
              <Input
                id="freebet-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Например: 100"
                min="1"
                step="0.01"
                className="bg-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {freebetType === "regular" 
                  ? "Фрибет нужно будет отыграть в 60x (только для игр)"
                  : "Фрибет отыгрывается с коэффициентом 2 (только для ставок)"
                }
              </p>
            </div>

            <div>
              <Label htmlFor="freebet-description">Описание (опционально)</Label>
              <Input
                id="freebet-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Фрибет от администрации"
                className="bg-input"
              />
            </div>

            <Button
              onClick={() => giveFreebet.mutate()}
              disabled={!amount || giveFreebet.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Gift className="w-4 h-4 mr-2" />
              {giveFreebet.isPending ? "Начисление..." : `Выдать ${amount || "0"}₽ фрибета`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
