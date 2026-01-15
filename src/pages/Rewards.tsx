import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { ArrowLeft } from "lucide-react";
import casinoLogo from "/casino-logo.png";
import { FreeSpinsReward } from "@/components/FreeSpinsReward";
import { FreebetManager } from "@/components/FreebetManager";
import { BettingFreebetManager } from "@/components/BettingFreebetManager";
import { BonusWheel } from "@/components/BonusWheel";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyBonus } from "@/lib/telegramNotifications";

export default function Rewards() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [promocode, setPromocode] = useState("");
  
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Проверяем использовал ли пользователь колесо регистрации
  const { data: registrationWheel, refetch: refetchRegWheel } = useQuery({
    queryKey: ["registration-wheel", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("registration_wheel")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Получаем все бонусные колеса от админа (использованные и нет)
  const { data: allBonusWheels, refetch: refetchBonusWheels } = useQuery({
    queryKey: ["bonus-wheels", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bonus_wheels")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const bonusWheels = allBonusWheels?.filter(w => !w.is_used) || [];
  const usedBonusWheels = allBonusWheels?.filter(w => w.is_used) || [];
  const totalBonusWheels = allBonusWheels?.length || 0;
  const usedCount = usedBonusWheels.length;

  const applyPromocode = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("apply_promocode", {
        _user_id: user!.id,
        _code: code,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data.message);
        
        // Отправляем уведомление в Telegram о промокоде
        if (user?.id) {
          notifyBonus(user.id, data.reward_amount || 0, 'Промокод', data.message || 'Промокод активирован!');
        }
        
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        setPromocode("");
      } else {
        toast.error(data?.message || "Неверный промокод");
      }
    },
  });

  const handleApplyPromocode = () => {
    if (!promocode.trim()) {
      toast.error("Введите промокод");
      return;
    }
    applyPromocode.mutate(promocode.trim());
  };

  const hasAvailableWheels = !registrationWheel || (bonusWheels && bonusWheels.length > 0);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-dark p-4">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            className="mb-6 hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Назад
          </Button>

          <Card className="p-8 bg-card/80 backdrop-blur-xl border-primary/20 shadow-neon-blue mb-6">
            <div className="text-center mb-8">
              <img
                src={casinoLogo}
                alt="Casino"
                className="w-16 h-16 mx-auto mb-4 rounded-xl shadow-gold"
              />
              <h1 className="text-3xl font-black text-primary mb-2">🎁 Подарки и Бонусы</h1>
              <p className="text-muted-foreground">Получай награды каждый день</p>
            </div>
          </Card>

          {/* Колесо регистрации - показываем если не использовано */}
          {user?.id && !registrationWheel && (
            <div className="mb-6 animate-fade-in">
              <BonusWheel 
                userId={user.id} 
                isRegistrationWheel={true}
                onComplete={() => refetchRegWheel()}
              />
            </div>
          )}

          {/* Бонусные колеса от админа */}
          {user?.id && totalBonusWheels > 0 && (
            <div className="space-y-4 mb-6">
              {/* Показываем счётчик */}
              <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🎡</span>
                      <div>
                        <h3 className="font-bold text-yellow-400">Бонусные колёса</h3>
                        <p className="text-sm text-muted-foreground">
                          Использовано: {usedCount} / {totalBonusWheels}
                        </p>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {bonusWheels.length} доступно
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Показываем доступные колёса для прокрутки */}
              {bonusWheels.length > 0 && (
                <BonusWheel 
                  key={bonusWheels[0].id}
                  userId={user.id} 
                  wheelId={bonusWheels[0].id}
                  onComplete={() => refetchBonusWheels()}
                />
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6 mb-6">
            {user?.id && (
              <FreeSpinsReward userId={user.id} />
            )}
          </div>

          {/* Фрибет система - показываем только если есть фрибет или вейджер */}
          {user?.id && (profile?.freebet_balance > 0 || profile?.wager_requirement > 0) && (
            <div className="space-y-6 mb-6 animate-fade-in">
              <FreebetManager userId={user.id} />
            </div>
          )}
          
          {/* Беттинг фрибет - показываем всегда */}
          {user?.id && (
            <div className="space-y-6 mb-6">
              <BettingFreebetManager userId={user.id} />
            </div>
          )}

          {/* Промокоды */}
          <Card className="mb-6 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)] bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <span className="text-2xl">🎁</span>
                Промокод
              </CardTitle>
              <CardDescription>
                Введите промокод для получения бонусов
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={promocode}
                onChange={(e) => setPromocode(e.target.value)}
                placeholder="Введите промокод"
                className="bg-input border-purple-500/20 focus:border-purple-500"
              />
              <Button
                onClick={handleApplyPromocode}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                disabled={applyPromocode.isPending}
              >
                {applyPromocode.isPending ? "Проверяем..." : "Применить"}
              </Button>
            </CardContent>
          </Card>

          {/* Кешбэк */}
          <Card className="p-6 bg-gradient-card border border-accent/30 shadow-neon-purple">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl">💰</div>
              <div>
                <h3 className="text-2xl font-bold text-accent">Кешбэк 20%</h3>
                <p className="text-sm text-muted-foreground">Возврат с проигрышей</p>
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-4 border border-accent/20">
              <p className="text-sm text-muted-foreground mb-3">
                Получайте 20% от всех проигрышей обратно на баланс!
              </p>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>✅ Автоматический возврат 20% от проигрышей</li>
                <li>✅ Начисление каждую неделю</li>
                <li>✅ Минимальная сумма для возврата: 100₽</li>
                <li>✅ Бонус доступен всем игрокам</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}