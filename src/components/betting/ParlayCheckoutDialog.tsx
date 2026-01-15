import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendTelegramNotification } from "@/lib/telegramNotifications";

interface ParlayBet {
  matchId: string;
  betType: string;
  odds: number;
  matchInfo?: any;
}

interface ParlayCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parlayBets: ParlayBet[];
  userId: string;
  balance: number;
  onBetPlaced: () => void;
}

export const ParlayCheckoutDialog = ({
  open,
  onOpenChange,
  parlayBets,
  userId,
  balance,
  onBetPlaced,
}: ParlayCheckoutDialogProps) => {
  const [betAmount, setBetAmount] = useState("");
  const [useBettingFreebet, setUseBettingFreebet] = useState(false);
  const [bettingFreebetBalance, setBettingFreebetBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBettingFreebetBalance = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("betting_freebet_balance")
        .eq("id", userId)
        .single();

      if (data) {
        setBettingFreebetBalance(data.betting_freebet_balance || 0);
      }
    };

    if (userId && open) {
      fetchBettingFreebetBalance();
    }
  }, [userId, open]);

  const totalOdds = parlayBets.reduce((acc, bet) => acc * bet.odds, 1);

  const calculatePotentialWin = () => {
    const amount = useBettingFreebet ? bettingFreebetBalance : parseFloat(betAmount);
    if (!amount) return 0;

    const rawWin = amount * totalOdds;

    // Если используется фрибет для ставок, выигрыш делим на 2
    if (useBettingFreebet) {
      return rawWin / 2;
    }

    return rawWin;
  };

  const getBetTypeName = (bet: ParlayBet) => {
    const match = bet.matchInfo;
    if (!match) return bet.betType;

    const names: Record<string, string> = {
      team1_win: `${match.team1?.name} победит`,
      team2_win: `${match.team2?.name} победит`,
      draw: "Ничья",
      over: `Больше ${match.total_value}`,
      under: `Меньше ${match.total_value}`,
      both_score_yes: "Обе забьют",
      both_score_no: "Не обе забьют",
      team1_handicap: `${match.team1?.name} фора`,
      team2_handicap: `${match.team2?.name} фора`,
      map1_team1: `Карта 1 - ${match.team1?.name}`,
      map1_team2: `Карта 1 - ${match.team2?.name}`,
      map2_team1: `Карта 2 - ${match.team1?.name}`,
      map2_team2: `Карта 2 - ${match.team2?.name}`,
      map3_team1: `Карта 3 - ${match.team1?.name}`,
      map3_team2: `Карта 3 - ${match.team2?.name}`,
    };

    return names[bet.betType] || bet.betType;
  };

  const placeParlayBet = async () => {
    const amount = useBettingFreebet ? bettingFreebetBalance : parseFloat(betAmount);

    if (!amount || amount < 10) {
      toast.error("Минимальная ставка 10₽");
      return;
    }

    const availableBalance = useBettingFreebet ? bettingFreebetBalance : balance;
    if (amount > availableBalance) {
      toast.error("Недостаточно средств");
      return;
    }

    // Проверка максимального коэффициента для фрибета
    if (useBettingFreebet && totalOdds > 10) {
      toast.error("Максимальный коэффициент для фрибета - 10x");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc("place_parlay_bet", {
        _user_id: userId,
        _bet_amount: amount,
        _bet_items: parlayBets.map((b) => ({
          match_id: b.matchId,
          bet_type: b.betType,
          odds: b.odds,
        })),
        _use_betting_freebet: useBettingFreebet,
      });

      if (error) throw error;

      if (data?.[0]?.success) {
        toast.success(data[0].message);
        
        // Отправляем уведомление в Telegram об экспрессе
        const potentialWin = useBettingFreebet ? (amount * totalOdds) / 2 : amount * totalOdds;
        sendTelegramNotification({
          userId,
          message: `Экспресс размещён!\n\n🎯 Ставок: ${parlayBets.length}\n💰 Сумма: ${amount.toFixed(2)}₽\n📊 Общий коэф: ${totalOdds.toFixed(2)}x\n💵 Возможный выигрыш: ${potentialWin.toFixed(2)}₽`,
          notificationType: 'system',
        });
        
        onBetPlaced();
        setBetAmount("");
        onOpenChange(false);
      } else {
        toast.error(data?.[0]?.message || "Ошибка при размещении экспресса");
      }
    } catch (error: any) {
      console.error("Place parlay bet error:", error);
      toast.error(error?.message || "Ошибка размещения экспресса");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            🎯 Оформление экспресса
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Список ставок */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {parlayBets.map((bet, index) => (
              <div
                key={index}
                className="p-3 bg-card/60 rounded-xl border border-border/50"
              >
                <div className="font-semibold text-sm truncate">
                  {bet.matchInfo?.team1?.name} vs {bet.matchInfo?.team2?.name}
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-muted-foreground">
                    {getBetTypeName(bet)}
                  </span>
                  <span className="text-primary font-bold">{bet.odds}x</span>
                </div>
              </div>
            ))}
          </div>

          {/* Общий коэффициент */}
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/30">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Общий коэффициент:</span>
              <span className="text-xl font-bold text-primary">
                {totalOdds.toFixed(2)}x
              </span>
            </div>
          </div>

          {/* Фрибет переключатель */}
          {bettingFreebetBalance > 0 && (
            <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
              <div className="flex items-center gap-2">
                <Label htmlFor="freebet-switch" className="text-sm font-medium">
                  Фрибет: {bettingFreebetBalance.toFixed(2)}₽
                </Label>
              </div>
              <Switch
                id="freebet-switch"
                checked={useBettingFreebet}
                onCheckedChange={setUseBettingFreebet}
              />
            </div>
          )}

          {/* Ввод суммы */}
          {useBettingFreebet ? (
            <div className="p-3 bg-amber-500/20 rounded-xl border border-amber-500/40 text-center">
              <span className="font-bold text-amber-400">
                Ставка: фрибет ({bettingFreebetBalance.toFixed(2)}₽)
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Сумма ставки</Label>
              <Input
                type="number"
                placeholder="Введите сумму"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="text-lg"
              />
              <div className="text-xs text-muted-foreground">
                Баланс: {balance.toFixed(2)}₽
              </div>
            </div>
          )}

          {/* Потенциальный выигрыш */}
          {(betAmount || useBettingFreebet) && (
            <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/30">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Возможный выигрыш:</span>
                <span className="text-xl font-bold text-green-500">
                  {calculatePotentialWin().toFixed(2)}₽
                </span>
              </div>
              {useBettingFreebet && (
                <div className="text-xs text-amber-400 mt-1">
                  * Фрибет: выигрыш делится на 2
                </div>
              )}
            </div>
          )}

          {/* Кнопка размещения */}
          <Button
            className="w-full bg-primary hover:bg-primary/90 shadow-glow transition-all duration-300"
            onClick={placeParlayBet}
            disabled={isLoading || (!betAmount && !useBettingFreebet)}
          >
            {isLoading ? "Размещение..." : "Поставить экспресс"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
