import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, Gift, Sparkles, Shield, Copy, Link } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";
interface PromocodeManagerProps {
  adminId: string;
}

export const PromocodeManager = ({ adminId }: PromocodeManagerProps) => {
  const [code, setCode] = useState("");
  const [rewardType, setRewardType] = useState<"money" | "freespins" | "freebet" | "betting_freebet" | "demo_balance" | "admin">("money");
  const [rewardAmount, setRewardAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const queryClient = useQueryClient();

  const { data: promocodes } = useQuery({
    queryKey: ["admin-promocodes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("promocodes")
        .select("*, promocode_activations(user_id, activated_at)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createPromocode = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_create_promocode", {
        _admin_id: adminId,
        _code: code.toUpperCase(),
        _reward_type: rewardType,
        _reward_amount: rewardType === "admin" ? 0 : (parseFloat(rewardAmount) || 0),
        _max_uses: maxUses ? parseInt(maxUses) : null,
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Ошибка");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promocodes"] });
      toast.success("Промокод создан!");
      setCode("");
      setRewardAmount("");
      setMaxUses("");
    },
    onError: (error: any) => {
      console.error("Promocode creation error:", error);
      toast.error(error?.message || "Ошибка создания промокода");
    },
  });

  const togglePromocode = async (id: string, isActive: boolean) => {
    const { data, error } = await supabase.rpc("admin_toggle_promocode", {
      _admin_id: adminId,
      _promocode_id: id,
      _is_active: !isActive,
    });

    if (error || !data?.success) {
      toast.error(data?.message || "Ошибка");
    } else {
      toast.success(isActive ? "Промокод отключен" : "Промокод включен");
      queryClient.invalidateQueries({ queryKey: ["admin-promocodes"] });
    }
  };

  const deletePromocode = async (id: string) => {
    const { data, error } = await supabase.rpc("admin_delete_promocode", {
      _admin_id: adminId,
      _promocode_id: id,
    });
    
    if (error || !data?.success) {
      toast.error(data?.message || "Ошибка удаления");
    } else {
      toast.success("Промокод удален");
      queryClient.invalidateQueries({ queryKey: ["admin-promocodes"] });
    }
  };

  const copyPromocodeLink = (code: string) => {
    const link = APP_CONFIG.getPromoLink(code);
    navigator.clipboard.writeText(link);
    toast.success("Ссылка на промокод скопирована!");
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Управление промокодами</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create Form */}
        <div className="p-4 bg-muted/20 rounded-lg space-y-3">
          <h3 className="font-bold">Создать промокод</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Код</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PROMO2024"
                className="uppercase"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Тип награды</label>
              <Select value={rewardType} onValueChange={(v: any) => setRewardType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="money">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      <span>Баланс (монеты)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="freebet">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      <span>Фрибет казино (60x отыгрыш)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="betting_freebet">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-blue-500" />
                      <span>Фрибет ставки (коэфф.2)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="freespins">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Фриспины</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="demo_balance">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-purple-500" />
                      <span>Демо баланс</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>Админ роль</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rewardType !== "admin" && (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">
                    {rewardType === "freebet" ? "Сумма фрибета (₽)" :
                     rewardType === "betting_freebet" ? "Сумма фрибета для ставок (₽)" :
                     rewardType === "money" ? "Сумма (₽)" : 
                     rewardType === "demo_balance" ? "Сумма демо баланса (₽)" : "Количество фриспинов"}
                  </label>
                  <Input
                    type="number"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(e.target.value)}
                    placeholder={rewardType === "freebet" || rewardType === "betting_freebet" || rewardType === "money" ? "100" : "10"}
                  />
                  {rewardType === "freebet" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Фрибет нужно отыграть в 60x (для игр казино)
                    </p>
                  )}
                  {rewardType === "betting_freebet" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Фрибет для ставок (коэффициент делится на 2)
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Макс. использований</label>
                  <Input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="Без ограничений"
                  />
                </div>
              </>
            )}
          </div>

          <Button
            onClick={() => createPromocode.mutate()}
            disabled={!code || (!rewardAmount && rewardType !== "admin")}
            className="w-full"
          >
            ➕ Создать промокод
          </Button>
        </div>

        {/* Promocodes List */}
        <div className="space-y-3">
          <h3 className="font-bold">Активные промокоды ({promocodes?.length || 0})</h3>
          {promocodes?.map((promo) => (
            <div key={promo.id} className="p-3 bg-muted/20 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <code className="text-lg font-bold bg-primary/10 px-2 py-1 rounded">
                    {promo.code}
                  </code>
                  {!promo.is_active && <Badge variant="secondary">Неактивен</Badge>}
                </div>
                <Badge variant={
                  promo.reward_type === "money" ? "default" :
                  promo.reward_type === "freebet" ? "default" :
                  promo.reward_type === "betting_freebet" ? "default" :
                  promo.reward_type === "freespins" ? "secondary" : "destructive"
                }>
                  {promo.reward_type === "money" && (
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" /> {promo.reward_amount}₽
                    </span>
                  )}
                  {promo.reward_type === "freebet" && (
                    <span className="flex items-center gap-1">
                      <Gift className="w-3 h-3" /> {promo.reward_amount}₽ фрибет казино
                    </span>
                  )}
                  {promo.reward_type === "betting_freebet" && (
                    <span className="flex items-center gap-1">
                      <Gift className="w-3 h-3 text-blue-500" /> {promo.reward_amount}₽ фрибет ставки
                    </span>
                  )}
                  {promo.reward_type === "freespins" && (
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> {promo.reward_amount} FS
                    </span>
                  )}
                  {promo.reward_type === "demo_balance" && (
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3 text-purple-500" /> {promo.reward_amount}₽ демо
                    </span>
                  )}
                  {promo.reward_type === "admin" && (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Админ
                    </span>
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Использовано: {promo.current_uses}
                  {promo.max_uses && ` / ${promo.max_uses}`}
                </div>
                <div>Активаций: {promo.promocode_activations?.length || 0}</div>
              </div>

              {promo.promocode_activations && promo.promocode_activations.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <details>
                    <summary className="cursor-pointer">Показать активации</summary>
                    <div className="mt-2 space-y-1">
                      {promo.promocode_activations.map((activation: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span>User: {activation.user_id.slice(0, 8)}...</span>
                          <span>{new Date(activation.activated_at).toLocaleDateString("ru-RU")}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {/* Ссылка для шаринга */}
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                <Link className="w-4 h-4 text-primary shrink-0" />
                <code className="text-[10px] text-muted-foreground truncate flex-1">
                  {APP_CONFIG.getPromoLink(promo.code)}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyPromocodeLink(promo.code)}
                  className="h-7 px-2"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => togglePromocode(promo.id, promo.is_active)}
                  className="flex-1"
                >
                  {promo.is_active ? "⏸️ Отключить" : "▶️ Включить"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deletePromocode(promo.id)}
                >
                  🗑️
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
