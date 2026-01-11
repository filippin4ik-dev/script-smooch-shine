import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trophy, Trash2, Medal, Clock, Users } from "lucide-react";
import { VipUsername } from "@/components/VipUsername";
import { Badge } from "@/components/ui/badge";

interface BettingTournamentManagerProps {
  adminId: string;
}

export const BettingTournamentManager = ({ adminId }: BettingTournamentManagerProps) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prizeType, setPrizeType] = useState("balance");
  const [prizeAmount, setPrizeAmount] = useState("");
  const [durationHours, setDurationHours] = useState("24");
  const [minBetAmount, setMinBetAmount] = useState("10");

  const { data: tournaments } = useQuery({
    queryKey: ["admin-betting-tournaments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("betting_tournaments")
        .select("*, winner:profiles!betting_tournaments_winner_id_fkey(username, is_vip, level, gradient_color)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_betting_tournament", {
        _admin_id: adminId,
        _title: title,
        _description: description || null,
        _prize_type: prizeType,
        _prize_amount: parseFloat(prizeAmount) || 0,
        _duration_hours: parseInt(durationHours) || 24,
        _min_bet_amount: parseFloat(minBetAmount) || 10,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: "Турнир создан!" });
        queryClient.invalidateQueries({ queryKey: ["admin-betting-tournaments"] });
        setTitle("");
        setDescription("");
        setPrizeAmount("");
      } else {
        toast({ title: data?.message || "Ошибка", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Ошибка: " + error.message, variant: "destructive" });
    },
  });

  const finishMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase.rpc("finish_betting_tournament", {
        _admin_id: adminId,
        _tournament_id: tournamentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: `Победитель: ${data.winner_username} (${data.total_wins}₽)` });
        queryClient.invalidateQueries({ queryKey: ["admin-betting-tournaments"] });
      } else {
        toast({ title: data?.message || "Ошибка", variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      await supabase.from("betting_tournament_results").delete().eq("tournament_id", tournamentId);
      const { error } = await supabase.from("betting_tournaments").delete().eq("id", tournamentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Турнир удалён" });
      queryClient.invalidateQueries({ queryKey: ["admin-betting-tournaments"] });
    },
  });

  const getPrizeLabel = (type: string) => {
    switch (type) {
      case "balance": return "Баланс";
      case "freebet": return "Фрибет казино";
      case "betting_freebet": return "Фрибет ставки";
      case "wheel": return "Колёса";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Create tournament form */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Создать турнир по ставкам
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ежедневный турнир" />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание турнира" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Тип приза</Label>
              <Select value={prizeType} onValueChange={setPrizeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Input type="number" value={prizeAmount} onChange={(e) => setPrizeAmount(e.target.value)} placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label>Длительность (часов)</Label>
              <Input type="number" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} placeholder="24" />
            </div>
            <div className="space-y-2">
              <Label>Мин. ставка</Label>
              <Input type="number" value={minBetAmount} onChange={(e) => setMinBetAmount(e.target.value)} placeholder="10" />
            </div>
          </div>

          <Button onClick={() => createMutation.mutate()} disabled={!title || !prizeAmount} className="w-full">
            <Trophy className="w-4 h-4 mr-2" /> Создать турнир
          </Button>
        </CardContent>
      </Card>

      {/* Active tournaments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Активные турниры
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tournaments?.filter((t) => t.status === "active").map((tournament) => (
            <div key={tournament.id} className="p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">{tournament.title}</span>
                <Badge className="bg-green-500/20 text-green-500">Активен</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                Приз: {tournament.prize_amount} {getPrizeLabel(tournament.prize_type)} | 
                Мин. ставка: {tournament.min_bet_amount}₽ |
                До: {tournament.end_at ? new Date(tournament.end_at).toLocaleString("ru-RU") : "∞"}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="default" onClick={() => finishMutation.mutate(tournament.id)}>
                  <Medal className="w-4 h-4 mr-1" /> Завершить
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(tournament.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {tournaments?.filter((t) => t.status === "active").length === 0 && (
            <p className="text-muted-foreground text-center py-4">Нет активных турниров</p>
          )}
        </CardContent>
      </Card>

      {/* Finished tournaments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            Завершённые турниры
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tournaments?.filter((t) => t.status === "finished").slice(0, 10).map((tournament) => (
            <div key={tournament.id} className="p-3 bg-muted/20 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-semibold">{tournament.title}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({tournament.prize_amount} {getPrizeLabel(tournament.prize_type)})
                </span>
              </div>
              {tournament.winner && (
                <div className="flex items-center gap-2">
                  <Medal className="w-4 h-4 text-amber-500" />
                  <VipUsername
                    username={(tournament.winner as any).username}
                    isVip={(tournament.winner as any).is_vip}
                    level={(tournament.winner as any).level}
                    gradientColor={(tournament.winner as any).gradient_color}
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          ))}
          {tournaments?.filter((t) => t.status === "finished").length === 0 && (
            <p className="text-muted-foreground text-center py-4">Нет завершённых турниров</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
