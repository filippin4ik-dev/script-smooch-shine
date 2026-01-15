import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sendTelegramNotification } from "@/lib/telegramNotifications";

interface MatchDetailsDialogProps {
  match: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  balance: number;
  parlayBets?: Array<{ matchId: string; betType: string; odds: number }>;
  onAddToParlay?: (bet: { matchId: string; betType: string; odds: number }) => void;
  onBetPlaced: () => void;
}

export const MatchDetailsDialog = ({
  match,
  open,
  onOpenChange,
  userId,
  balance,
  parlayBets = [],
  onAddToParlay,
  onBetPlaced,
}: MatchDetailsDialogProps) => {
  const [betAmount, setBetAmount] = useState("");
  const [selectedBetType, setSelectedBetType] = useState<string | null>(null);
  const [selectedOdds, setSelectedOdds] = useState<number | null>(null);
  const [useBettingFreebet, setUseBettingFreebet] = useState(false);
  const [bettingFreebetBalance, setBettingFreebetBalance] = useState(0);

  const baseBetCard =
    "p-3 sm:p-4 cursor-pointer transition-all duration-300 rounded-2xl bg-background/60 border border-border/70 shadow-card hover:-translate-y-0.5 hover:shadow-glow";
  const selectedBetCard =
    "bg-primary text-primary-foreground border-primary shadow-glow";
  const secondaryBetCard =
    "bg-card/80 border-border hover:border-primary/60";

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
    
    if (userId) {
      fetchBettingFreebetBalance();
    }
  }, [userId]);

  const getHandicapValueForBetType = () => {
    if (!selectedBetType) return null;

    if (selectedBetType === "team1_handicap" || selectedBetType === "team2_handicap") {
      return match.handicap_value ?? null;
    }

    if (selectedBetType === "map1_team1_handicap" || selectedBetType === "map1_team2_handicap") {
      return match.map1_handicap_value ?? null;
    }

    if (selectedBetType === "map2_team1_handicap" || selectedBetType === "map2_team2_handicap") {
      return match.map2_handicap_value ?? null;
    }

    if (selectedBetType === "map3_team1_handicap" || selectedBetType === "map3_team2_handicap") {
      return match.map3_handicap_value ?? null;
    }

    return null;
  };

  const placeBet = async () => {
    // Если используется betting freebet, ставим весь баланс фрибета
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

    if (!selectedBetType || !selectedOdds) {
      toast.error("Выберите тип ставки");
      return;
    }

    // Блокируем точный счет, если админ закрыл этот рынок
    if (selectedBetType.startsWith("exact_") && match?.exact_score_closed) {
      toast.error("Ставки на точный счет закрыты");
      return;
    }

    const handicapValue = getHandicapValueForBetType();

    try {
      // Обычная одиночная ставка
      const { data, error } = await supabase.rpc("place_bet", {
        _user_id: userId,
        _match_id: match.id,
        _bet_type: selectedBetType,
        _bet_amount: amount,
        _odds: selectedOdds,
        _use_betting_freebet: useBettingFreebet,
        _handicap_value: handicapValue,
      });

      if (error) {
        console.error("Place bet error:", error);
        throw error;
      }

      if (data && data[0]?.success) {
        toast.success(data[0].message);
        
        // Отправляем уведомление в Telegram о размещении ставки
        sendTelegramNotification({
          userId,
          message: `Ставка размещена!\n\n🎯 ${match.team1?.name} vs ${match.team2?.name}\n💰 Сумма: ${amount.toFixed(2)}₽\n📊 Коэф: ${selectedOdds}x\n💵 Возможный выигрыш: ${(amount * selectedOdds).toFixed(2)}₽`,
          notificationType: 'system',
        });
        
        onBetPlaced();
        setBetAmount("");
        setSelectedBetType(null);
        setSelectedOdds(null);
        onOpenChange(false);
      } else {
        toast.error(data?.[0]?.message || "Ошибка размещения ставки");
      }
    } catch (error: any) {
      console.error("Place bet catch error:", error);
      toast.error(error?.message || "Ошибка размещения ставки");
    }
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

    if (!selectedBetType || !selectedOdds) {
      toast.error("Выберите тип ставки");
      return;
    }

    // Проверяем, не добавлен ли уже этот матч в экспресс
    const matchAlreadyInParlay = parlayBets.some(b => b.matchId === match.id);
    
    if (matchAlreadyInParlay) {
      toast.error("Нельзя добавить второй раз ставку на один матч");
      return;
    }

    // Добавляем текущую ставку к экспрессу
    const allBets = [
      ...parlayBets,
      { matchId: match.id, betType: selectedBetType, odds: selectedOdds }
    ];

    try {
      const { data, error } = await supabase.rpc("place_parlay_bet", {
        _user_id: userId,
        _bet_amount: amount,
        _bet_items: allBets.map((b) => ({
          match_id: b.matchId,
          bet_type: b.betType,
          odds: b.odds,
        })),
        _use_betting_freebet: useBettingFreebet,
      });

      if (error) throw error;

      if (data?.[0]?.success) {
        toast.success(data[0].message);
        onBetPlaced();
        setBetAmount("");
        setSelectedBetType(null);
        setSelectedOdds(null);
        onOpenChange(false);
      } else {
        toast.error(data?.[0]?.message || "Ошибка при размещении экспресса");
      }
    } catch (error: any) {
      console.error("Place parlay bet error:", error);
      toast.error(error?.message || "Ошибка размещения экспресса");
    }
  };

  const selectBet = (betType: string, odds: number) => {
    setSelectedBetType(betType);
    setSelectedOdds(odds);
  };

  const isSelected = (betType: string) => selectedBetType === betType;

  const getBetTypeName = (betType: string) => {
    const names: Record<string, string> = {
      team1_win: `${match.team1.name} победит`,
      team2_win: `${match.team2.name} победит`,
      draw: "Ничья",
      over: `Больше ${match.total_value}`,
      under: `Меньше ${match.total_value}`,
      both_score_yes: "Обе команды забьют",
      both_score_no: "Не обе забьют",
      team1_handicap: `${match.team1.name} с форой ${match.handicap_value > 0 ? '+' : ''}${match.handicap_value}`,
      team2_handicap: `${match.team2.name} с форой ${match.handicap_value < 0 ? '+' : ''}${-match.handicap_value}`,
      map1_team1: `Карта 1 - ${match.team1.name}`,
      map1_team2: `Карта 1 - ${match.team2.name}`,
      map2_team1: `Карта 2 - ${match.team1.name}`,
      map2_team2: `Карта 2 - ${match.team2.name}`,
      map3_team1: `Карта 3 - ${match.team1.name}`,
      map3_team2: `Карта 3 - ${match.team2.name}`,
      map4_team1: `Карта 4 - ${match.team1.name}`,
      map4_team2: `Карта 4 - ${match.team2.name}`,
      map5_team1: `Карта 5 - ${match.team1.name}`,
      map5_team2: `Карта 5 - ${match.team2.name}`,
      map1_team1_handicap: `Карта 1 - ${match.team1.name} (${match.map1_handicap_value > 0 ? '+' : ''}${match.map1_handicap_value})`,
      map1_team2_handicap: `Карта 1 - ${match.team2.name} (${match.map1_handicap_value < 0 ? '+' : ''}${-match.map1_handicap_value})`,
      map2_team1_handicap: `Карта 2 - ${match.team1.name} (${match.map2_handicap_value > 0 ? '+' : ''}${match.map2_handicap_value})`,
      map2_team2_handicap: `Карта 2 - ${match.team2.name} (${match.map2_handicap_value < 0 ? '+' : ''}${-match.map2_handicap_value})`,
      map3_team1_handicap: `Карта 3 - ${match.team1.name} (${match.map3_handicap_value > 0 ? '+' : ''}${match.map3_handicap_value})`,
      map3_team2_handicap: `Карта 3 - ${match.team2.name} (${match.map3_handicap_value < 0 ? '+' : ''}${-match.map3_handicap_value})`,
    };
    
    if (betType.startsWith('exact_')) {
      const score = betType.replace('exact_', '');
      return `Точный счет ${score}`;
    }
    
    return names[betType] || betType;
  };

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case "football": return "⚽";
      case "csgo": return "🔫";
      case "dota2": return "🎮";
      default: return "🏆";
    }
  };

  // Расчет выигрыша с учетом фрибета (коэффициент 2)
  const calculatePotentialWin = () => {
    const amount = useBettingFreebet ? bettingFreebetBalance : parseFloat(betAmount);
    if (!amount || !selectedOdds) return 0;
    
    // Если это будет экспресс (есть ставки в parlayBets)
    const totalOdds = parlayBets.length > 0 
      ? parlayBets.reduce((acc, b) => acc * b.odds, 1) * selectedOdds
      : selectedOdds;
    
    const rawWin = amount * totalOdds;
    
    // Если используется фрибет для ставок, выигрыш делим на 2
    if (useBettingFreebet) {
      return rawWin / 2;
    }
    
    return rawWin;
  };

  const hasOpenMapBets = () => {
    const isEsports = match?.sport === "csgo" || match?.sport === "dota2";
    if (!isEsports) return false;
    
    const hasMap2Open = match?.map2_team1_odds && !match?.map2_betting_closed;
    const hasMap3Open = match?.map3_team1_odds && !match?.map3_betting_closed;
    const hasMap4Open = match?.map4_team1_odds && !match?.map4_betting_closed;
    const hasMap5Open = match?.map5_team1_odds && !match?.map5_betting_closed;
    
    return hasMap2Open || hasMap3Open || hasMap4Open || hasMap5Open;
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-2xl">
            <span className="text-xl sm:text-2xl">{getSportIcon(match.sport)}</span>
            <span className="truncate">{match.team1.name} vs {match.team2.name}</span>
          </DialogTitle>
          <div className="flex items-center justify-between">
            <div className="text-xs sm:text-sm text-muted-foreground">
              {format(new Date(match.match_time), "dd.MM.yyyy в HH:mm")}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 mt-3 sm:mt-4">
          {/* Teams Display */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <Card className="p-3 sm:p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                <img
                  src={match.team1.logo_url}
                  alt={match.team1.name}
                  className="w-16 h-16 sm:w-24 sm:h-24 object-contain"
                />
                <h3 className="font-bold text-sm sm:text-xl text-center line-clamp-2">{match.team1.name}</h3>
                {match.status === "finished" && match.team1_score !== null && (
                  <div className="text-2xl sm:text-4xl font-bold text-primary">{match.team1_score}</div>
                )}
              </div>
            </Card>

            <Card className="p-3 sm:p-6 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                <img
                  src={match.team2.logo_url}
                  alt={match.team2.name}
                  className="w-16 h-16 sm:w-24 sm:h-24 object-contain"
                />
                <h3 className="font-bold text-sm sm:text-xl text-center line-clamp-2">{match.team2.name}</h3>
                {match.status === "finished" && match.team2_score !== null && (
                  <div className="text-2xl sm:text-4xl font-bold text-accent">{match.team2_score}</div>
                )}
              </div>
            </Card>
          </div>

        {(match.status === "upcoming" || match.status === "live") && (
          <>
            {/* Main Bets - Only show if not live */}
            {match.status !== "live" && (
              <div className="space-y-2 sm:space-y-3">
                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  🎯 Основные ставки
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                  <Card
                    className={`${baseBetCard} ${
                      isSelected("team1_win") ? selectedBetCard : secondaryBetCard
                    }`}
                    onClick={() => selectBet("team1_win", Number(match.team1_odds))}
                  >
                    <div className="text-xs sm:text-sm font-semibold">П1</div>
                    <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team1.name}</div>
                    <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.team1_odds}</div>
                  </Card>

                  {match.has_draw && (
                    <Card
                      className={`${baseBetCard} ${
                        isSelected("draw") ? selectedBetCard : secondaryBetCard
                      }`}
                      onClick={() => selectBet("draw", Number(match.draw_odds))}
                    >
                      <div className="text-xs sm:text-sm font-semibold">X</div>
                      <div className="font-bold text-xs sm:text-base mt-1">Ничья</div>
                      <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.draw_odds}</div>
                    </Card>
                  )}

                  <Card
                    className={`${baseBetCard} ${
                      isSelected("team2_win") ? selectedBetCard : secondaryBetCard
                    }`}
                    onClick={() => selectBet("team2_win", Number(match.team2_odds))}
                  >
                    <div className="text-xs sm:text-sm font-semibold">П2</div>
                    <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team2.name}</div>
                    <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.team2_odds}</div>
                  </Card>
                </div>
              </div>
            )}

            {/* Total Bets - Only show if not live */}
            {match.has_total && match.status !== "live" && (
              <div className="space-y-2 sm:space-y-3">
                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  📊 Тотал
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Card
                    className={`${baseBetCard} ${
                      isSelected("over") ? selectedBetCard : secondaryBetCard
                    }`}
                    onClick={() => selectBet("over", Number(match.over_odds))}
                  >
                    <div className="text-xs sm:text-sm font-semibold">Тотал больше</div>
                    <div className="font-bold text-sm sm:text-lg mt-1">Больше {match.total_value}</div>
                    <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.over_odds}</div>
                  </Card>

                  <Card
                    className={`${baseBetCard} ${
                      isSelected("under") ? selectedBetCard : secondaryBetCard
                    }`}
                    onClick={() => selectBet("under", Number(match.under_odds))}
                  >
                    <div className="text-xs sm:text-sm font-semibold">Тотал меньше</div>
                    <div className="font-bold text-sm sm:text-lg mt-1">Меньше {match.total_value}</div>
                    <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.under_odds}</div>
                  </Card>
                </div>
              </div>
            )}

            {/* Both Score - Only show if not live */}
            {match.has_both_score && match.status !== "live" && (
              <div className="space-y-2 sm:space-y-3">
                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  ⚡ Обе забьют
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Card
                    className={`${baseBetCard} ${
                      isSelected("both_score_yes") ? selectedBetCard : secondaryBetCard
                    }`}
                    onClick={() => selectBet("both_score_yes", Number(match.both_score_yes_odds))}
                  >
                    <div className="text-xs sm:text-sm font-semibold">Да</div>
                    <div className="font-bold text-xs sm:text-base mt-1">Обе команды забьют</div>
                    <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.both_score_yes_odds}</div>
                  </Card>

                  <Card
                    className={`${baseBetCard} ${
                      isSelected("both_score_no") ? selectedBetCard : secondaryBetCard
                    }`}
                    onClick={() => selectBet("both_score_no", Number(match.both_score_no_odds))}
                  >
                    <div className="text-xs sm:text-sm font-semibold">Нет</div>
                    <div className="font-bold text-xs sm:text-base mt-1">Не обе забьют</div>
                    <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.both_score_no_odds}</div>
                  </Card>
                </div>
              </div>
            )}

            {/* Handicap Bets - Only show if not live */}
            {match.has_handicap && match.status !== "live" && (
              <div className="space-y-2 sm:space-y-3">
                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  🎯 Фора
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Card
                    className={`${baseBetCard} ${
                      isSelected("team1_handicap") ? selectedBetCard : secondaryBetCard
                    }`}
                    onClick={() => selectBet("team1_handicap", Number(match.team1_handicap_odds))}
                  >
                    <div className="text-xs sm:text-sm font-semibold">Фора 1</div>
                    <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">
                      {match.team1.name} ({match.handicap_value > 0 ? "+" : ""}{match.handicap_value})
                    </div>
                    <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.team1_handicap_odds}</div>
                  </Card>

                  <Card
                    className={`${baseBetCard} ${
                      isSelected("team2_handicap") ? selectedBetCard : secondaryBetCard
                    }`}
                    onClick={() => selectBet("team2_handicap", Number(match.team2_handicap_odds))}
                  >
                    <div className="text-xs sm:text-sm font-semibold">Фора 2</div>
                    <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">
                      {match.team2.name} ({match.handicap_value < 0 ? "+" : ""}{-match.handicap_value})
                    </div>
                    <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.team2_handicap_odds}</div>
                  </Card>
                </div>
              </div>
            )}

            {/* Map Bets for Esports - Map 2 and 3 available in live mode */}
            {(match.sport === "csgo" || match.sport === "dota2") && (
              <>
                {match.bo_format && (
                  <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg border border-blue-500/30">
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {match.bo_format}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Формат матча</span>
                    {match.status === "live" && (
                      <Badge variant="destructive" className="ml-auto animate-pulse">LIVE</Badge>
                    )}
                  </div>
                )}

                {/* Map 1 - only in upcoming status, hidden in live */}
                {match.map1_team1_odds && match.status === "upcoming" && (
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                      🗺️ Карта 1
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map1_team1") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map1_team1", Number(match.map1_team1_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team1.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map1_team1_odds}</div>
                      </Card>

                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map1_team2") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map1_team2", Number(match.map1_team2_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team2.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map1_team2_odds}</div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Map 2 - available in live if not closed */}
                {match.map2_team1_odds && !match.map2_betting_closed && (
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                      🗺️ Карта 2
                      {match.status === "live" && (
                        <Badge className="bg-green-500 text-xs animate-pulse">Ставки открыты</Badge>
                      )}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map2_team1") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map2_team1", Number(match.map2_team1_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team1.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map2_team1_odds}</div>
                      </Card>

                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map2_team2") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map2_team2", Number(match.map2_team2_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team2.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map2_team2_odds}</div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Map 3 - available in live if not closed */}
                {match.map3_team1_odds && !match.map3_betting_closed && (
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                      🗺️ Карта 3
                      {match.status === "live" && (
                        <Badge className="bg-green-500 text-xs animate-pulse">Ставки открыты</Badge>
                      )}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map3_team1") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map3_team1", Number(match.map3_team1_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team1.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map3_team1_odds}</div>
                      </Card>

                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map3_team2") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map3_team2", Number(match.map3_team2_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team2.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map3_team2_odds}</div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Map 4 - BO5 only */}
                {match.map4_team1_odds && !match.map4_betting_closed && (
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                      🗺️ Карта 4
                      {match.status === "live" && (
                        <Badge className="bg-green-500 text-xs animate-pulse">Ставки открыты</Badge>
                      )}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map4_team1") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map4_team1", Number(match.map4_team1_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team1.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map4_team1_odds}</div>
                      </Card>

                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map4_team2") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map4_team2", Number(match.map4_team2_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team2.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map4_team2_odds}</div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Map 5 - BO5 only */}
                {match.map5_team1_odds && !match.map5_betting_closed && (
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                      🗺️ Карта 5
                      {match.status === "live" && (
                        <Badge className="bg-green-500 text-xs animate-pulse">Ставки открыты</Badge>
                      )}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map5_team1") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map5_team1", Number(match.map5_team1_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team1.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map5_team1_odds}</div>
                      </Card>

                      <Card
                        className={`${baseBetCard} ${
                          isSelected("map5_team2") ? selectedBetCard : secondaryBetCard
                        }`}
                        onClick={() => selectBet("map5_team2", Number(match.map5_team2_odds))}
                      >
                        <div className="text-xs sm:text-sm font-semibold">Победа</div>
                        <div className="font-bold text-xs sm:text-base mt-1 line-clamp-2">{match.team2.name}</div>
                        <div className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{match.map5_team2_odds}</div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Exact Score - only in upcoming (and only if not закрыто) */}
                {match.exact_score_odds && match.status === "upcoming" && !match.exact_score_closed && (
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                      🎯 Точный счет (по картам)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Формат: {match.team1?.name || "Команда 1"} - {match.team2?.name || "Команда 2"}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(match.exact_score_odds).map(([score, odds]: [string, any]) => {
                        const [t1Score, t2Score] = score.split("-");
                        return (
                          <Card
                            key={score}
                            className={`${baseBetCard} ${
                              isSelected(`exact_${score}`) ? selectedBetCard : secondaryBetCard
                            }`}
                            onClick={() => selectBet(`exact_${score}`, odds)}
                          >
                            <div className="text-xs text-muted-foreground text-center truncate">
                              {match.team1?.name?.substring(0, 8)}
                            </div>
                            <div className="font-bold text-xl text-center">{t1Score} - {t2Score}</div>
                            <div className="text-xs text-muted-foreground text-center truncate">
                              {match.team2?.name?.substring(0, 8)}
                            </div>
                            <div className="text-lg font-bold text-center mt-1 text-primary">{odds}</div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

              </>
            )}

              {/* Bet Input and Confirm */}
              <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm p-3 sm:p-4 rounded-lg border-2 border-primary/30 space-y-2 sm:space-y-3">
                {selectedBetType && (
                  <div className="bg-primary/10 p-2.5 sm:p-3 rounded-lg">
                    <div className="text-xs sm:text-sm text-muted-foreground">Выбрана ставка:</div>
                    <div className="font-bold text-sm sm:text-lg line-clamp-2">{getBetTypeName(selectedBetType)}</div>
                    <div className="text-primary text-lg sm:text-xl font-bold">Коэффициент: {selectedOdds}</div>
                    
                    {parlayBets.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <div className="text-xs text-muted-foreground">
                          В экспрессе: {parlayBets.length + 1} событий
                        </div>
                        <div className="text-sm font-bold text-primary">
                          Общий коэффициент: {(parlayBets.reduce((acc, b) => acc * b.odds, 1) * selectedOdds).toFixed(2)}x
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Фрибет для ставок тоггл */}
                {bettingFreebetBalance > 0 && (
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/30">
                    <Label htmlFor="use-betting-freebet" className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-medium">Фрибет для ставок</span>
                      <span className="text-xs text-muted-foreground">({bettingFreebetBalance.toFixed(2)}₽)</span>
                    </Label>
                    <Switch
                      id="use-betting-freebet"
                      checked={useBettingFreebet}
                      onCheckedChange={setUseBettingFreebet}
                    />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  {useBettingFreebet && bettingFreebetBalance > 0 ? (
                    <div className="flex-1 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <span className="text-lg font-bold text-green-400">
                        Ставка: фрибет ({bettingFreebetBalance.toFixed(2)}₽)
                      </span>
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder="Сумма ставки (мин. 10₽)"
                      min="10"
                      max={balance}
                      className="flex-1 text-base"
                    />
                  )}
                  
                  <div className="flex gap-2 w-full sm:w-auto">
                    {onAddToParlay && parlayBets.every(b => b.matchId !== match.id) && selectedBetType && selectedOdds && (
                      <Button 
                        onClick={() => {
                          onAddToParlay({ matchId: match.id, betType: selectedBetType, odds: selectedOdds });
                          toast.success("Добавлено в экспресс");
                        }}
                        variant="outline"
                        size="lg"
                        className="flex-1 sm:flex-initial"
                      >
                        + Экспресс
                      </Button>
                    )}
                    <Button 
                      onClick={parlayBets.length > 0 ? placeParlayBet : placeBet} 
                      size="lg" 
                      className="flex-1 sm:flex-initial sm:px-8"
                    >
                      {parlayBets.length > 0 ? "Оформить экспресс" : "Поставить"}
                    </Button>
                  </div>
                </div>

                {betAmount && selectedOdds && (
                  <div className="text-center">
                    <div className="text-xs sm:text-sm text-muted-foreground">Возможный выигрыш:</div>
                    <div className="text-xl sm:text-2xl font-bold text-green-500">
                      {calculatePotentialWin().toFixed(2)}₽
                    </div>
                    {useBettingFreebet && (
                      <div className="text-xs text-muted-foreground mt-1">
                        (фрибет: коэффициент делится на 2)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {match.status === "live" && !hasOpenMapBets() && (
            <div className="text-center py-6 sm:py-8 space-y-4">
              <Badge variant="destructive" className="text-sm sm:text-lg px-4 sm:px-6 py-2 sm:py-3">
                🔴 Матч идет - ставки закрыты
              </Badge>
              <div>
                <Button variant="outline" onClick={() => onOpenChange(false)} className="min-w-[120px]">
                  Закрыть
                </Button>
              </div>
            </div>
          )}

          {match.status === "finished" && (
            <div className="text-center py-6 sm:py-8 space-y-4">
              <Badge variant="secondary" className="text-sm sm:text-lg px-4 sm:px-6 py-2 sm:py-3">
                ✅ Матч завершен
              </Badge>
              <div>
                <Button variant="outline" onClick={() => onOpenChange(false)} className="min-w-[120px]">
                  Закрыть
                </Button>
              </div>
            </div>
          )}

          {/* Universal close button for all states */}
          {match.status === "upcoming" && (
            <div className="text-center pt-4">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
                Закрыть
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
