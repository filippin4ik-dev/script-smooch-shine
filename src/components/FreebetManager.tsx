import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, TrendingUp } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFreebetMode } from "@/hooks/useFreebetMode";

interface FreebetManagerProps {
  userId: string;
}

export const FreebetManager = ({ userId }: FreebetManagerProps) => {
  const queryClient = useQueryClient();
  const { useFreebet, setUseFreebet } = useFreebetMode();
  const [loading, setLoading] = useState(false);

  const { data: profileData, refetch } = useQuery({
    queryKey: ["freebet-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("freebet_balance, wager_requirement, wager_progress")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 2000,
  });

  const freebetBalance = profileData?.freebet_balance || 0;
  const wagerRequirement = profileData?.wager_requirement || 0;
  const wagerProgress = profileData?.wager_progress || 0;

  // Автоматически переключаем на обычный баланс если фрибет = 0
  useEffect(() => {
    if (freebetBalance === 0 && wagerRequirement === 0 && useFreebet) {
      setUseFreebet(false);
    }
  }, [freebetBalance, wagerRequirement, useFreebet, setUseFreebet]);

  // Realtime подписка
  useEffect(() => {
    const channel = supabase
      .channel('freebet-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Если фрибет баланс обнулился - показываем уведомление
          if (oldData.freebet_balance > 0 && newData.freebet_balance === 0) {
            toast.info("Бонусный баланс закончился", {
              description: "Ваш фрибет баланс обнулился"
            });
            setUseFreebet(false);
          }
          
          queryClient.invalidateQueries({ queryKey: ["freebet-profile", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, setUseFreebet, queryClient]);

  const activateFreebet = async (amount: number) => {
    setLoading(true);
    try {
      const requirement = amount * 60;

      const { error } = await supabase
        .from("profiles")
        .update({
          freebet_balance: amount,
          wager_requirement: requirement,
          wager_progress: 0,
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success(`Фрибет ${amount}₽ активирован! Нужно отыграть ${requirement}₽`);
      refetch();
    } catch (error) {
      toast.error("Ошибка активации фрибета");
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage =
    wagerRequirement > 0
      ? Math.min((wagerProgress / wagerRequirement) * 100, 100)
      : 0;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          Фрибет (Бонусный баланс)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Режим игры:</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={!useFreebet ? "default" : "outline"}
              onClick={() => setUseFreebet(false)}
              className={!useFreebet ? "bg-primary text-primary-foreground" : ""}
            >
              Обычный баланс
            </Button>
            <Button
              size="sm"
              variant={useFreebet ? "default" : "outline"}
              onClick={() => freebetBalance > 0 ? setUseFreebet(true) : toast.error("Нет фрибет баланса")}
              className={useFreebet ? "bg-primary text-primary-foreground" : ""}
              disabled={freebetBalance === 0 && !useFreebet}
            >
              Фрибет
            </Button>
          </div>
        </div>

        {wagerRequirement > 0 ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Бонусный баланс:</span>
                <span className="font-bold text-primary">{freebetBalance.toFixed(2)}₽</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Отыгрыш:</span>
                <span className="font-bold">
                  {wagerProgress.toFixed(2)}₽ / {wagerRequirement.toFixed(2)}₽
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Прогресс отыгрыша</span>
                <span className="font-bold text-primary">
                  {progressPercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
            </div>

            <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold mb-1 text-foreground">Как работает фрибет?</p>
                <p>
                  Играйте на бонусный баланс в любых играх. Каждая ставка увеличивает прогресс
                  отыгрыша. Когда вы отыграете полную сумму ({wagerRequirement.toFixed(0)}₽),
                  бонусный баланс автоматически конвертируется в основной!
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Фрибет - это бонусные средства, которые нужно отыграть в 60x, чтобы вывести.
              Получайте фрибеты в промокодах и акциях!
            </p>

            {freebetBalance > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  Доступный фрибет: {freebetBalance.toFixed(2)}₽
                </p>
                <Button
                  onClick={() => activateFreebet(freebetBalance)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Активация..." : "Активировать фрибет"}
                </Button>
              </div>
            )}

            {freebetBalance === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">У вас пока нет фрибетов</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};