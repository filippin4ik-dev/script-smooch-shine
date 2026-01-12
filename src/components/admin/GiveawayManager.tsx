import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Gift, Users, Trophy, Trash2, Clock, Target, Zap, Copy, Palette, Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { VipUsername, GradientColor } from "@/components/VipUsername";

interface GiveawayManagerProps {
  adminId: string;
}

const GAMES = [
  { value: "dice", label: "Dice" },
  { value: "mines", label: "Mines" },
  { value: "crash", label: "Crash" },
  { value: "roulette", label: "Рулетка" },
  { value: "blackjack", label: "Blackjack" },
  { value: "towers", label: "Towers" },
  { value: "hilo", label: "HiLo" },
  { value: "plinko", label: "Plinko" },
  { value: "balloon", label: "Balloon" },
  { value: "slots", label: "Слоты" },
  { value: "penalty", label: "Penalty" },
  { value: "chicken_road", label: "Chicken Road" },
  { value: "horse_racing", label: "Скачки" },
  { value: "cases", label: "Кейсы" },
  { value: "upgrader", label: "Апгрейдер" },
  { value: "crypto_trading", label: "Крипто" },
];

export const GiveawayManager = ({ adminId }: GiveawayManagerProps) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prizeType, setPrizeType] = useState("balance");
  const [prizeAmount, setPrizeAmount] = useState("");
  const [participationType, setParticipationType] = useState("free");
  const [participationCost, setParticipationCost] = useState("");
  const [minLevel, setMinLevel] = useState("");
  
  // New fields
  const [giveawayMode, setGiveawayMode] = useState("manual");
  const [endDurationValue, setEndDurationValue] = useState("");
  const [endDurationUnit, setEndDurationUnit] = useState<"days" | "hours" | "minutes" | "seconds">("days");
  const [registrationDurationValue, setRegistrationDurationValue] = useState("");
  const [registrationDurationUnit, setRegistrationDurationUnit] = useState<"days" | "hours" | "minutes" | "seconds">("days");
  const [achievementType, setAchievementType] = useState("most_wins");
  const [achievementGame, setAchievementGame] = useState("");
  
  // Wheel settings
  const [hasWheel, setHasWheel] = useState(false);
  const [wheelSegments, setWheelSegments] = useState<Array<{
    key: string;
    label: string;
    color: string;
    rewardType: string;
    rewardAmount: number;
  }>>([]);

  const addWheelSegment = () => {
    setWheelSegments([
      ...wheelSegments,
      {
        key: `segment_${Date.now()}`,
        label: "",
        color: "#8B5CF6",
        rewardType: "balance",
        rewardAmount: 0,
      },
    ]);
  };

  const updateWheelSegment = (index: number, field: string, value: any) => {
    const updated = [...wheelSegments];
    updated[index] = { ...updated[index], [field]: value };
    setWheelSegments(updated);
  };

  const removeWheelSegment = (index: number) => {
    setWheelSegments(wheelSegments.filter((_, i) => i !== index));
  };

  const { data: giveaways } = useQuery({
    queryKey: ["admin-giveaways"],
    queryFn: async () => {
      const { data } = await supabase
        .from("giveaways")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: participants } = useQuery({
    queryKey: ["giveaway-participants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("giveaway_participants")
        .select(`
          *,
          profiles:user_id (id, username, is_vip, level, gradient_color, public_id)
        `);
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();

      const durationToMs = (value: string, unit: "days" | "hours" | "minutes" | "seconds") => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return 0;
        const multipliers: Record<typeof unit, number> = {
          days: 24 * 60 * 60 * 1000,
          hours: 60 * 60 * 1000,
          minutes: 60 * 1000,
          seconds: 1000,
        };
        return Math.round(n * multipliers[unit]);
      };

      const giveawayPhaseMs = durationToMs(endDurationValue, endDurationUnit);
      const regMs = durationToMs(registrationDurationValue, registrationDurationUnit);

      // Двухфазная логика:
      // 1) регистрация длится regMs
      // 2) розыгрыш (до итогов) длится giveawayPhaseMs
      // end_at = registration_ends_at + giveawayPhaseMs
      // Если regMs не задан, то регистрация идёт "до конца" (registration_ends_at = end_at)
      let registrationEndsAt: Date | null = null;
      let endAt: Date | null = null;

      if (giveawayPhaseMs > 0) {
        if (regMs > 0) {
          registrationEndsAt = new Date(now.getTime() + regMs);
          endAt = new Date(registrationEndsAt.getTime() + giveawayPhaseMs);
        } else {
          endAt = new Date(now.getTime() + giveawayPhaseMs);
          registrationEndsAt = endAt;
        }
      }
      
      const insertData: any = {
        title,
        description,
        prize_type: prizeType,
        prize_amount: parseFloat(prizeAmount) || 0,
        participation_type: participationType,
        participation_cost: participationType === "balance" ? parseFloat(participationCost) || 0 : 0,
        min_level: participationType === "level" ? parseInt(minLevel) || 1 : 1,
        created_by: adminId,
        giveaway_mode: giveawayMode,
        end_at: endAt?.toISOString() || null,
        registration_ends_at: registrationEndsAt?.toISOString() || null,
      };

      if (giveawayMode === "achievement") {
        insertData.achievement_type = achievementType;
        insertData.achievement_game = achievementType === "most_wins_game" ? achievementGame : null;
        insertData.achievement_start_at = now.toISOString();
      }

      // Add wheel settings
      if (hasWheel && wheelSegments.length >= 2) {
        insertData.has_wheel = true;
        insertData.wheel_segments = wheelSegments;
      }

      const { error } = await supabase.from("giveaways").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Розыгрыш создан" });
      queryClient.invalidateQueries({ queryKey: ["admin-giveaways"] });
      setTitle("");
      setDescription("");
      setPrizeAmount("");
      setParticipationCost("");
      setMinLevel("");
      setEndDurationValue("");
      setEndDurationUnit("days");
      setRegistrationDurationValue("");
      setRegistrationDurationUnit("days");
      setHasWheel(false);
      setWheelSegments([]);
    },
    onError: (error: any) => {
      console.error("Create giveaway error:", error);
      toast({ title: "Ошибка: " + error.message, variant: "destructive" });
    },
  });

  const finishMutation = useMutation({
    mutationFn: async ({ giveawayId, winnerId }: { giveawayId: string; winnerId: string }) => {
      const { data, error } = await supabase.rpc("finish_giveaway", {
        _admin_id: adminId,
        _giveaway_id: giveawayId,
        _winner_id: winnerId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: "Победитель выбран!" });
        queryClient.invalidateQueries({ queryKey: ["admin-giveaways"] });
        queryClient.invalidateQueries({ queryKey: ["giveaway-participants"] });
      } else {
        toast({ title: data?.message || "Ошибка", variant: "destructive" });
      }
    },
  });

  const autoFinishMutation = useMutation({
    mutationFn: async (giveawayId: string) => {
      const { data, error } = await supabase.rpc("auto_finish_giveaway", {
        _giveaway_id: giveawayId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: "Розыгрыш завершён!" });
        queryClient.invalidateQueries({ queryKey: ["admin-giveaways"] });
        queryClient.invalidateQueries({ queryKey: ["giveaway-participants"] });
      } else {
        toast({ title: data?.message || "Ошибка", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete participants
      await supabase.from("giveaway_participants").delete().eq("giveaway_id", id);
      // Then delete giveaway
      const { error } = await supabase.from("giveaways").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Розыгрыш удалён" });
      queryClient.invalidateQueries({ queryKey: ["admin-giveaways"] });
      queryClient.invalidateQueries({ queryKey: ["giveaway-participants"] });
    },
  });

  const getPrizeLabel = (type: string) => {
    switch (type) {
      case "balance": return "Баланс";
      case "freebet": return "Фрибет казино";
      case "betting_freebet": return "Фрибет ставки";
      case "wheel": return "Колёса";
      case "skin": return "Скин";
      default: return type;
    }
  };

  const getParticipationLabel = (type: string) => {
    switch (type) {
      case "free": return "Бесплатно";
      case "balance": return "За баланс";
      case "level": return "За уровень";
      default: return type;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "manual": return "Ручной выбор";
      case "random": return "Случайный";
      case "achievement": return "По достижениям";
      default: return mode;
    }
  };

  const getAchievementLabel = (type: string) => {
    switch (type) {
      case "most_wins": return "Больше всего побед";
      case "most_wins_game": return "Побед в игре";
      case "biggest_win": return "Самый большой выигрыш";
      case "most_referrals": return "Больше всего рефералов";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Создать розыгрыш
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Новогодний розыгрыш"
              />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание розыгрыша"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Режим розыгрыша</Label>
              <Select value={giveawayMode} onValueChange={setGiveawayMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Ручной выбор победителя</SelectItem>
                  <SelectItem value="random">Случайный (по времени)</SelectItem>
                  <SelectItem value="achievement">По достижениям</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Тип приза</Label>
              <Select value={prizeType} onValueChange={setPrizeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">Баланс</SelectItem>
                  <SelectItem value="freebet">Фрибет казино</SelectItem>
                  <SelectItem value="betting_freebet">Фрибет ставки</SelectItem>
                  <SelectItem value="wheel">Колёса фортуны</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Сумма приза</Label>
              <Input
                type="number"
                value={prizeAmount}
                onChange={(e) => setPrizeAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>

          {/* Time settings for random/achievement modes */}
          {(giveawayMode === "random" || giveawayMode === "achievement") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Длительность розыгрыша (после регистрации)
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="number"
                    value={endDurationValue}
                    onChange={(e) => setEndDurationValue(e.target.value)}
                    placeholder="10"
                    className="sm:flex-1"
                  />
                  <Select value={endDurationUnit} onValueChange={(v) => setEndDurationUnit(v as any)}>
                    <SelectTrigger className="sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Дней</SelectItem>
                      <SelectItem value="hours">Часов</SelectItem>
                      <SelectItem value="minutes">Минут</SelectItem>
                      <SelectItem value="seconds">Секунд</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Регистрация закрывается через
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="number"
                    value={registrationDurationValue}
                    onChange={(e) => setRegistrationDurationValue(e.target.value)}
                    placeholder="Пусто = до конца"
                    className="sm:flex-1"
                  />
                  <Select value={registrationDurationUnit} onValueChange={(v) => setRegistrationDurationUnit(v as any)}>
                    <SelectTrigger className="sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Дней</SelectItem>
                      <SelectItem value="hours">Часов</SelectItem>
                      <SelectItem value="minutes">Минут</SelectItem>
                      <SelectItem value="seconds">Секунд</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}


          {/* Achievement settings */}
          {giveawayMode === "achievement" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-primary/5 rounded-lg">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Тип достижения
                </Label>
                <Select value={achievementType} onValueChange={setAchievementType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="most_wins">Больше всего побед</SelectItem>
                    <SelectItem value="most_wins_game">Побед в конкретной игре</SelectItem>
                    <SelectItem value="biggest_win">Самый большой выигрыш</SelectItem>
                    <SelectItem value="most_referrals">Больше всего рефералов</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {achievementType === "most_wins_game" && (
                <div className="space-y-2">
                  <Label>Игра</Label>
                  <Select value={achievementGame} onValueChange={setAchievementGame}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите игру" />
                    </SelectTrigger>
                    <SelectContent>
                      {GAMES.map(game => (
                        <SelectItem key={game.value} value={game.value}>{game.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Тип участия</Label>
              <Select value={participationType} onValueChange={setParticipationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Бесплатно</SelectItem>
                  <SelectItem value="balance">За баланс</SelectItem>
                  <SelectItem value="level">За уровень</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {participationType === "balance" && (
              <div className="space-y-2">
                <Label>Стоимость участия (₽)</Label>
                <Input
                  type="number"
                  value={participationCost}
                  onChange={(e) => setParticipationCost(e.target.value)}
                  placeholder="100"
                />
              </div>
            )}
            {participationType === "level" && (
              <div className="space-y-2">
                <Label>Минимальный уровень</Label>
                <Input
                  type="number"
                  value={minLevel}
                  onChange={(e) => setMinLevel(e.target.value)}
                  placeholder="5"
                />
              </div>
            )}
          </div>

          {/* Wheel settings */}
          <div className="space-y-4 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Колесо фортуны для участников
              </Label>
              <Switch checked={hasWheel} onCheckedChange={setHasWheel} />
            </div>

            {hasWheel && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Участники смогут крутить колесо после регистрации
                </p>
                
                {wheelSegments.map((segment, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-background rounded-lg border">
                    <input
                      type="color"
                      value={segment.color}
                      onChange={(e) => updateWheelSegment(index, "color", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <Input
                      value={segment.label}
                      onChange={(e) => updateWheelSegment(index, "label", e.target.value)}
                      placeholder="Название сегмента"
                      className="flex-1"
                    />
                    <Select
                      value={segment.rewardType}
                      onValueChange={(v) => updateWheelSegment(index, "rewardType", v)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balance">Баланс</SelectItem>
                        <SelectItem value="freebet">Фрибет</SelectItem>
                        <SelectItem value="xp">XP</SelectItem>
                        <SelectItem value="wheel">Колёса</SelectItem>
                        <SelectItem value="nothing">Ничего</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={segment.rewardAmount || ""}
                      onChange={(e) => updateWheelSegment(index, "rewardAmount", parseFloat(e.target.value) || 0)}
                      placeholder="Сумма"
                      className="w-20"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeWheelSegment(index)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addWheelSegment}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить сегмент
                </Button>

                {hasWheel && wheelSegments.length < 2 && (
                  <p className="text-sm text-amber-500">Минимум 2 сегмента для колеса</p>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              !title ||
              !prizeAmount ||
              createMutation.isPending ||
              ((giveawayMode === "random" || giveawayMode === "achievement") && !(Number(endDurationValue) > 0)) ||
              (giveawayMode === "achievement" && achievementType === "most_wins_game" && !achievementGame) ||
              (hasWheel && wheelSegments.length < 2)
            }
            className="w-full"
          >
            Создать розыгрыш
          </Button>
        </CardContent>
      </Card>

      {/* Giveaways list */}
      <div className="space-y-4">
        {giveaways?.map((giveaway: any) => {
          const giveawayParticipants = participants?.filter(
            (p: any) => p.giveaway_id === giveaway.id
          ) || [];

          const isRegistrationClosed = giveaway.registration_ends_at && new Date(giveaway.registration_ends_at) < new Date();
          const isEnded = giveaway.end_at && new Date(giveaway.end_at) < new Date();

          return (
            <Card key={giveaway.id} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {giveaway.status === "finished" ? (
                      <Trophy className="h-5 w-5 text-yellow-500" />
                    ) : giveaway.giveaway_mode === "achievement" ? (
                      <Target className="h-5 w-5 text-purple-500" />
                    ) : giveaway.giveaway_mode === "random" ? (
                      <Clock className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Gift className="h-5 w-5 text-primary" />
                    )}
                    {giveaway.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      giveaway.status === "active" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                    }`}>
                      {giveaway.status === "active" ? "Активен" : "Завершён"}
                    </span>
                    <span className="px-2 py-1 rounded text-xs bg-muted">
                      {getModeLabel(giveaway.giveaway_mode)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const link = `${window.location.origin}/giveaways?id=${giveaway.id}`;
                        navigator.clipboard.writeText(link);
                        toast({ title: "Ссылка скопирована" });
                      }}
                      title="Копировать ссылку"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {giveaway.status === "active" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(giveaway.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {giveaway.status === "finished" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => deleteMutation.mutate(giveaway.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Приз:</span>{" "}
                    <span className="font-medium">{getPrizeLabel(giveaway.prize_type)} {giveaway.prize_amount}₽</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Участие:</span>{" "}
                    <span className="font-medium">
                      {getParticipationLabel(giveaway.participation_type)}
                      {giveaway.participation_type === "balance" && ` (${giveaway.participation_cost}₽)`}
                      {giveaway.participation_type === "level" && ` (lvl ${giveaway.min_level}+)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{giveawayParticipants.length} участников</span>
                  </div>
                  {giveaway.giveaway_mode === "achievement" && (
                    <div>
                      <span className="text-muted-foreground">Цель:</span>{" "}
                      <span className="font-medium text-purple-400">
                        {getAchievementLabel(giveaway.achievement_type)}
                        {giveaway.achievement_game && ` (${GAMES.find(g => g.value === giveaway.achievement_game)?.label})`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Time info */}
                {(giveaway.end_at || giveaway.registration_ends_at) && (
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {giveaway.registration_ends_at && (
                      <div className={isRegistrationClosed ? "text-red-400" : ""}>
                        Регистрация до: {new Date(giveaway.registration_ends_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК
                      </div>
                    )}
                    {giveaway.end_at && (
                      <div className={isEnded ? "text-red-400" : ""}>
                        Окончание: {new Date(giveaway.end_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-finish button for timed giveaways */}
                {giveaway.status === "active" && (giveaway.giveaway_mode === "random" || giveaway.giveaway_mode === "achievement") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => autoFinishMutation.mutate(giveaway.id)}
                    disabled={autoFinishMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Завершить сейчас (авто-выбор победителя)
                  </Button>
                )}

                {/* Participants for manual mode */}
                {giveaway.giveaway_mode === "manual" && giveawayParticipants.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Участники (нажмите для выбора победителя):</div>
                    <div className="flex flex-wrap gap-2">
                      {giveawayParticipants.map((p: any) => (
                        <Button
                          key={p.id}
                          size="sm"
                          variant={giveaway.winner_id === p.user_id ? "default" : "outline"}
                          onClick={() => {
                            if (giveaway.status === "active") {
                              finishMutation.mutate({
                                giveawayId: giveaway.id,
                                winnerId: p.user_id,
                              });
                            }
                          }}
                          disabled={giveaway.status !== "active" || finishMutation.isPending}
                          className="text-xs"
                        >
                          {giveaway.winner_id === p.user_id && "🏆 "}
                          <VipUsername
                            username={p.profiles?.username || "Игрок"}
                            isVip={p.profiles?.is_vip}
                            gradientColor={(p.profiles?.gradient_color as GradientColor) || "gold"}
                            level={p.profiles?.level}
                            showLevel={false}
                          />
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};