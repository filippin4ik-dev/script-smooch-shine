import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Search, User, Minus, Plus, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { safeParseInt } from "@/lib/safeParseInt";

interface DemoBalanceManagerProps {
  adminId: string;
}

export const DemoBalanceManager = ({ adminId }: DemoBalanceManagerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const queryClient = useQueryClient();

  // Fetch all users with demo balance > 0
  const { data: usersWithDemo, isLoading: loadingUsers } = useQuery({
    queryKey: ["users-with-demo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, telegram_id, public_id, balance, demo_balance")
        .gt("demo_balance", 0)
        .order("demo_balance", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Search users
  const { data: searchResults } = useQuery({
    queryKey: ["users-search-demo-manager", searchQuery],
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
      return data as { success: boolean; amount?: number; message?: string }[];
    },
    onSuccess: (data) => {
      if (data?.[0]?.success) {
        toast.success(`Демо-счёт начислен: +${data[0].amount}₽`);
        setAmount("");
        setSelectedUserId(null);
        setSearchQuery("");
        queryClient.invalidateQueries({ queryKey: ["users-with-demo"] });
        queryClient.invalidateQueries({ queryKey: ["users-search-demo-manager"] });
      } else {
        toast.error(data?.[0]?.message || "Ошибка");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка выдачи демо");
    },
  });

  const deductDemo = useMutation({
    mutationFn: async ({ userId, deductAmount }: { userId: string; deductAmount: number }) => {
      const { data, error } = await supabase.rpc("deduct_demo_balance", {
        _admin_id: adminId,
        _target_user_id: userId,
        _amount: deductAmount,
      });
      if (error) throw error;
      return data as { success: boolean; message?: string }[];
    },
    onSuccess: (data) => {
      if (data?.[0]?.success) {
        toast.success(data[0].message);
        queryClient.invalidateQueries({ queryKey: ["users-with-demo"] });
      } else {
        toast.error(data?.[0]?.message || "Ошибка");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка списания демо");
    },
  });

  const resetDemo = useMutation({
    mutationFn: async (userId: string) => {
      const user = usersWithDemo?.find(u => u.id === userId);
      if (!user || !user.demo_balance) throw new Error("Нет демо для сброса");
      
      const { data, error } = await supabase.rpc("deduct_demo_balance", {
        _admin_id: adminId,
        _target_user_id: userId,
        _amount: user.demo_balance,
      });
      if (error) throw error;
      return data as { success: boolean; message?: string }[];
    },
    onSuccess: (data) => {
      if (data?.[0]?.success) {
        toast.success("Демо-баланс обнулён");
        queryClient.invalidateQueries({ queryKey: ["users-with-demo"] });
      } else {
        toast.error(data?.[0]?.message || "Ошибка");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка обнуления");
    },
  });

  const selectedUser = searchResults?.find((u) => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      {/* Выдача демо */}
      <Card className="border-green-500/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-green-500">
            <Plus className="w-5 h-5" />
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
            {searchResults && searchResults.length > 0 && (
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-2">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full p-3 text-left rounded-lg transition-colors ${
                      selectedUserId === user.id ? "bg-green-600 text-white" : "bg-muted/50 hover:bg-muted"
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
                        <p>Демо: {(user.demo_balance || 0).toFixed(2)}₽</p>
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
                  <p className="text-xs text-muted-foreground">
                    Демо: {(selectedUser.demo_balance || 0).toFixed(2)}₽
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedUserId(null)}>
                  ✕
                </Button>
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
                <Plus className="w-4 h-4 mr-2" />
                {giveDemo.isPending ? "Начисление..." : `Выдать ${amount || "0"}₽ демо`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Таблица пользователей с демо */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="w-5 h-5 text-green-500" />
            Пользователи с демо-балансом
            <Button
              size="sm"
              variant="ghost"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["users-with-demo"] })}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : usersWithDemo && usersWithDemo.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead className="text-right">Демо баланс</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersWithDemo.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{user.username}</p>
                        <p className="text-xs text-muted-foreground">ID: {user.public_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-500">
                      {(user.demo_balance || 0).toFixed(2)}₽
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:bg-red-500/10"
                          onClick={() => resetDemo.mutate(user.id)}
                          disabled={resetDemo.isPending}
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          Обнулить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Нет пользователей с демо-балансом
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
