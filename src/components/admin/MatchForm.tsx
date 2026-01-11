import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";

interface MatchFormProps {
  onClose: () => void;
  adminId: string;
}

export const MatchForm = ({ onClose, adminId }: MatchFormProps) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    sport: "football",
    team1_id: "",
    team2_id: "",
    team1_odds: "1.50",
    team2_odds: "1.50",
    draw_odds: "3.00",
    has_draw: false,
    has_total: false,
    total_value: "2.5",
    over_odds: "1.80",
    under_odds: "2.00",
    has_both_score: false,
    both_score_yes_odds: "1.90",
    both_score_no_odds: "1.90",
    has_handicap: false,
    handicap_value: "1.5",
    team1_handicap_odds: "1.85",
    team2_handicap_odds: "1.95",
    match_time: "",
    // Cybersport map betting
    bo_format: "BO1",
    map1_team1_odds: "",
    map1_team2_odds: "",
    map1_handicap_value: "",
    map1_team1_handicap_odds: "",
    map1_team2_handicap_odds: "",
    map2_team1_odds: "",
    map2_team2_odds: "",
    map2_handicap_value: "",
    map2_team1_handicap_odds: "",
    map2_team2_handicap_odds: "",
    map3_team1_odds: "",
    map3_team2_odds: "",
    map3_handicap_value: "",
    map3_team1_handicap_odds: "",
    map3_team2_handicap_odds: "",
    // BO5 карты 4 и 5
    map4_team1_odds: "",
    map4_team2_odds: "",
    map4_handicap_value: "",
    map4_team1_handicap_odds: "",
    map4_team2_handicap_odds: "",
    map5_team1_odds: "",
    map5_team2_odds: "",
    map5_handicap_value: "",
    map5_team1_handicap_odds: "",
    map5_team2_handicap_odds: "",
    // Точный счет BO3 (2:0, 2:1, 1:2, 0:2)
    exact_score_2_0: "",
    exact_score_2_1: "",
    exact_score_1_2: "",
    exact_score_0_2: "",
    // Точный счет BO5 (3:0, 3:1, 3:2, 2:3, 1:3, 0:3)
    exact_score_3_0: "",
    exact_score_3_1: "",
    exact_score_3_2: "",
    exact_score_2_3: "",
    exact_score_1_3: "",
    exact_score_0_3: "",
  });

  const { data: teams } = useQuery({
    queryKey: ["admin-teams-for-match"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const validateForm = () => {
    if (!formData.team1_id) {
      toast.error("Выберите первую команду");
      return false;
    }
    if (!formData.team2_id) {
      toast.error("Выберите вторую команду");
      return false;
    }
    if (formData.team1_id === formData.team2_id) {
      toast.error("Команды должны быть разными");
      return false;
    }
    if (!formData.match_time) {
      toast.error("Укажите время матча");
      return false;
    }
    
    // Validate odds
    const team1Odds = parseFloat(formData.team1_odds);
    const team2Odds = parseFloat(formData.team2_odds);
    
    if (isNaN(team1Odds) || team1Odds < 1.01 || team1Odds > 100) {
      toast.error("Коэффициент команды 1 должен быть от 1.01 до 100");
      return false;
    }
    if (isNaN(team2Odds) || team2Odds < 1.01 || team2Odds > 100) {
      toast.error("Коэффициент команды 2 должен быть от 1.01 до 100");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const matchData: any = {
        sport: formData.sport,
        team1_id: formData.team1_id,
        team2_id: formData.team2_id,
        team1_odds: parseFloat(formData.team1_odds),
        team2_odds: parseFloat(formData.team2_odds),
        match_time: formData.match_time,
        status: "upcoming",
        has_draw: formData.has_draw,
        has_total: formData.has_total,
        has_both_score: formData.has_both_score,
        has_handicap: formData.has_handicap,
      };

      // Add optional fields
      if (formData.has_draw) {
        matchData.draw_odds = parseFloat(formData.draw_odds) || 3.00;
      }
      
      if (formData.has_total) {
        matchData.total_value = parseFloat(formData.total_value) || 2.5;
        matchData.over_odds = parseFloat(formData.over_odds) || 1.80;
        matchData.under_odds = parseFloat(formData.under_odds) || 2.00;
      }
      
      if (formData.has_both_score) {
        matchData.both_score_yes_odds = parseFloat(formData.both_score_yes_odds) || 1.90;
        matchData.both_score_no_odds = parseFloat(formData.both_score_no_odds) || 1.90;
      }

      if (formData.has_handicap) {
        matchData.handicap_value = parseFloat(formData.handicap_value) || 1.5;
        matchData.team1_handicap_odds = parseFloat(formData.team1_handicap_odds) || 1.85;
        matchData.team2_handicap_odds = parseFloat(formData.team2_handicap_odds) || 1.95;
      }

      // Cybersport map betting
      if (formData.sport === "csgo" || formData.sport === "dota2") {
        matchData.bo_format = formData.bo_format;
        
        if (formData.map1_team1_odds) matchData.map1_team1_odds = parseFloat(formData.map1_team1_odds);
        if (formData.map1_team2_odds) matchData.map1_team2_odds = parseFloat(formData.map1_team2_odds);
        if (formData.map1_handicap_value) matchData.map1_handicap_value = parseFloat(formData.map1_handicap_value);
        if (formData.map1_team1_handicap_odds) matchData.map1_team1_handicap_odds = parseFloat(formData.map1_team1_handicap_odds);
        if (formData.map1_team2_handicap_odds) matchData.map1_team2_handicap_odds = parseFloat(formData.map1_team2_handicap_odds);
        
        if (formData.map2_team1_odds) matchData.map2_team1_odds = parseFloat(formData.map2_team1_odds);
        if (formData.map2_team2_odds) matchData.map2_team2_odds = parseFloat(formData.map2_team2_odds);
        if (formData.map2_handicap_value) matchData.map2_handicap_value = parseFloat(formData.map2_handicap_value);
        if (formData.map2_team1_handicap_odds) matchData.map2_team1_handicap_odds = parseFloat(formData.map2_team1_handicap_odds);
        if (formData.map2_team2_handicap_odds) matchData.map2_team2_handicap_odds = parseFloat(formData.map2_team2_handicap_odds);
        
        if (formData.map3_team1_odds) matchData.map3_team1_odds = parseFloat(formData.map3_team1_odds);
        if (formData.map3_team2_odds) matchData.map3_team2_odds = parseFloat(formData.map3_team2_odds);
        if (formData.map3_handicap_value) matchData.map3_handicap_value = parseFloat(formData.map3_handicap_value);
        if (formData.map3_team1_handicap_odds) matchData.map3_team1_handicap_odds = parseFloat(formData.map3_team1_handicap_odds);
        if (formData.map3_team2_handicap_odds) matchData.map3_team2_handicap_odds = parseFloat(formData.map3_team2_handicap_odds);
        
        // BO5 карты 4 и 5
        if (formData.map4_team1_odds) matchData.map4_team1_odds = parseFloat(formData.map4_team1_odds);
        if (formData.map4_team2_odds) matchData.map4_team2_odds = parseFloat(formData.map4_team2_odds);
        if (formData.map4_handicap_value) matchData.map4_handicap_value = parseFloat(formData.map4_handicap_value);
        if (formData.map4_team1_handicap_odds) matchData.map4_team1_handicap_odds = parseFloat(formData.map4_team1_handicap_odds);
        if (formData.map4_team2_handicap_odds) matchData.map4_team2_handicap_odds = parseFloat(formData.map4_team2_handicap_odds);
        
        if (formData.map5_team1_odds) matchData.map5_team1_odds = parseFloat(formData.map5_team1_odds);
        if (formData.map5_team2_odds) matchData.map5_team2_odds = parseFloat(formData.map5_team2_odds);
        if (formData.map5_handicap_value) matchData.map5_handicap_value = parseFloat(formData.map5_handicap_value);
        if (formData.map5_team1_handicap_odds) matchData.map5_team1_handicap_odds = parseFloat(formData.map5_team1_handicap_odds);
        if (formData.map5_team2_handicap_odds) matchData.map5_team2_handicap_odds = parseFloat(formData.map5_team2_handicap_odds);
        
        // Exact score odds for BO3/BO5
        const exactScoreOdds: any = {};
        // BO3 точный счет
        if (formData.exact_score_2_0) exactScoreOdds["2-0"] = parseFloat(formData.exact_score_2_0);
        if (formData.exact_score_2_1) exactScoreOdds["2-1"] = parseFloat(formData.exact_score_2_1);
        if (formData.exact_score_1_2) exactScoreOdds["1-2"] = parseFloat(formData.exact_score_1_2);
        if (formData.exact_score_0_2) exactScoreOdds["0-2"] = parseFloat(formData.exact_score_0_2);
        // BO5 точный счет
        if (formData.exact_score_3_0) exactScoreOdds["3-0"] = parseFloat(formData.exact_score_3_0);
        if (formData.exact_score_3_1) exactScoreOdds["3-1"] = parseFloat(formData.exact_score_3_1);
        if (formData.exact_score_3_2) exactScoreOdds["3-2"] = parseFloat(formData.exact_score_3_2);
        if (formData.exact_score_2_3) exactScoreOdds["2-3"] = parseFloat(formData.exact_score_2_3);
        if (formData.exact_score_1_3) exactScoreOdds["1-3"] = parseFloat(formData.exact_score_1_3);
        if (formData.exact_score_0_3) exactScoreOdds["0-3"] = parseFloat(formData.exact_score_0_3);
        
        if (Object.keys(exactScoreOdds).length > 0) {
          matchData.exact_score_odds = exactScoreOdds;
        }
      }

      const { data, error } = await supabase.rpc("admin_create_match", {
        _admin_id: adminId,
        _match_data: matchData,
      });

      if (error) {
        console.error("Match creation error:", error);
        toast.error(`Ошибка: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.message || "Ошибка создания матча");
        return;
      }

      toast.success("Матч создан!");
      queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
      setFormData({
        sport: "football",
        team1_id: "",
        team2_id: "",
        team1_odds: "1.50",
        team2_odds: "1.50",
        draw_odds: "3.00",
        has_draw: false,
        has_total: false,
        total_value: "2.5",
        over_odds: "1.80",
        under_odds: "2.00",
        has_both_score: false,
        both_score_yes_odds: "1.90",
        both_score_no_odds: "1.90",
        has_handicap: false,
        handicap_value: "1.5",
        team1_handicap_odds: "1.85",
        team2_handicap_odds: "1.95",
        match_time: "",
        bo_format: "BO1",
        map1_team1_odds: "",
        map1_team2_odds: "",
        map1_handicap_value: "",
        map1_team1_handicap_odds: "",
        map1_team2_handicap_odds: "",
        map2_team1_odds: "",
        map2_team2_odds: "",
        map2_handicap_value: "",
        map2_team1_handicap_odds: "",
        map2_team2_handicap_odds: "",
        map3_team1_odds: "",
        map3_team2_odds: "",
        map3_handicap_value: "",
        map3_team1_handicap_odds: "",
        map3_team2_handicap_odds: "",
        map4_team1_odds: "",
        map4_team2_odds: "",
        map4_handicap_value: "",
        map4_team1_handicap_odds: "",
        map4_team2_handicap_odds: "",
        map5_team1_odds: "",
        map5_team2_odds: "",
        map5_handicap_value: "",
        map5_team1_handicap_odds: "",
        map5_team2_handicap_odds: "",
        exact_score_2_0: "",
        exact_score_2_1: "",
        exact_score_1_2: "",
        exact_score_0_2: "",
        exact_score_3_0: "",
        exact_score_3_1: "",
        exact_score_3_2: "",
        exact_score_2_3: "",
        exact_score_1_3: "",
        exact_score_0_3: "",
      });
      onClose();
    } catch (error: any) {
      console.error("Unexpected error:", error);
      toast.error("Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTeams = teams?.filter((t: any) => t.sport === formData.sport) || [];

  return (
    <form onSubmit={handleSubmit} className="p-3 sm:p-4 bg-muted/20 rounded-lg space-y-3">
      <div className="space-y-2">
        <Label htmlFor="match-sport">Вид спорта *</Label>
        <select
          id="match-sport"
          className="w-full p-2 rounded-lg bg-background border border-border text-sm"
          value={formData.sport}
          onChange={(e) => setFormData({ ...formData, sport: e.target.value, team1_id: "", team2_id: "" })}
          disabled={isLoading}
        >
          <option value="football">⚽ Футбол</option>
          <option value="csgo">🔫 CS:GO</option>
          <option value="dota2">🎮 Dota 2</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="team1">Команда 1 *</Label>
          <select
            id="team1"
            className="w-full p-2 rounded-lg bg-background border border-border text-sm"
            value={formData.team1_id}
            onChange={(e) => setFormData({ ...formData, team1_id: e.target.value })}
            disabled={isLoading}
          >
            <option value="">Выберите команду</option>
            {filteredTeams.map((team: any) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team2">Команда 2 *</Label>
          <select
            id="team2"
            className="w-full p-2 rounded-lg bg-background border border-border text-sm"
            value={formData.team2_id}
            onChange={(e) => setFormData({ ...formData, team2_id: e.target.value })}
            disabled={isLoading}
          >
            <option value="">Выберите команду</option>
            {filteredTeams.map((team: any) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="odds1">Коэф. П1 *</Label>
          <Input
            id="odds1"
            type="number"
            step="0.01"
            min="1.01"
            max="100"
            value={formData.team1_odds}
            onChange={(e) => setFormData({ ...formData, team1_odds: e.target.value })}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="odds2">Коэф. П2 *</Label>
          <Input
            id="odds2"
            type="number"
            step="0.01"
            min="1.01"
            max="100"
            value={formData.team2_odds}
            onChange={(e) => setFormData({ ...formData, team2_odds: e.target.value })}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
        <Switch
          id="has-draw"
          checked={formData.has_draw}
          onCheckedChange={(checked) => setFormData({ ...formData, has_draw: checked })}
          disabled={isLoading}
        />
        <Label htmlFor="has-draw" className="cursor-pointer flex-1">Ничья</Label>
        {formData.has_draw && (
          <Input
            type="number"
            step="0.01"
            placeholder="Коэф."
            value={formData.draw_odds}
            onChange={(e) => setFormData({ ...formData, draw_odds: e.target.value })}
            className="w-24"
            disabled={isLoading}
          />
        )}
      </div>

      <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
        <Switch
          id="has-total"
          checked={formData.has_total}
          onCheckedChange={(checked) => setFormData({ ...formData, has_total: checked })}
          disabled={isLoading}
        />
        <Label htmlFor="has-total" className="cursor-pointer flex-1">Тотал</Label>
        {formData.has_total && (
          <div className="flex gap-1">
            <Input
              type="number"
              step="0.5"
              placeholder="Знач."
              value={formData.total_value}
              onChange={(e) => setFormData({ ...formData, total_value: e.target.value })}
              className="w-16"
              disabled={isLoading}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Б"
              value={formData.over_odds}
              onChange={(e) => setFormData({ ...formData, over_odds: e.target.value })}
              className="w-16"
              disabled={isLoading}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="М"
              value={formData.under_odds}
              onChange={(e) => setFormData({ ...formData, under_odds: e.target.value })}
              className="w-16"
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
        <Switch
          id="has-both"
          checked={formData.has_both_score}
          onCheckedChange={(checked) => setFormData({ ...formData, has_both_score: checked })}
          disabled={isLoading}
        />
        <Label htmlFor="has-both" className="cursor-pointer flex-1">Обе забьют</Label>
        {formData.has_both_score && (
          <div className="flex gap-1">
            <Input
              type="number"
              step="0.01"
              placeholder="Да"
              value={formData.both_score_yes_odds}
              onChange={(e) => setFormData({ ...formData, both_score_yes_odds: e.target.value })}
              className="w-16"
              disabled={isLoading}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Нет"
              value={formData.both_score_no_odds}
              onChange={(e) => setFormData({ ...formData, both_score_no_odds: e.target.value })}
              className="w-16"
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
        <Switch
          id="has-handicap"
          checked={formData.has_handicap}
          onCheckedChange={(checked) => setFormData({ ...formData, has_handicap: checked })}
          disabled={isLoading}
        />
        <Label htmlFor="has-handicap" className="cursor-pointer flex-1">Фора</Label>
        {formData.has_handicap && (
          <div className="flex gap-1">
            <Input
              type="number"
              step="0.5"
              placeholder="Знач."
              value={formData.handicap_value}
              onChange={(e) => setFormData({ ...formData, handicap_value: e.target.value })}
              className="w-16"
              disabled={isLoading}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Ф1"
              value={formData.team1_handicap_odds}
              onChange={(e) => setFormData({ ...formData, team1_handicap_odds: e.target.value })}
              className="w-16"
              disabled={isLoading}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Ф2"
              value={formData.team2_handicap_odds}
              onChange={(e) => setFormData({ ...formData, team2_handicap_odds: e.target.value })}
              className="w-16"
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="match-time">Время матча *</Label>
        <Input
          id="match-time"
          type="datetime-local"
          value={formData.match_time}
          onChange={(e) => setFormData({ ...formData, match_time: e.target.value })}
          disabled={isLoading}
        />
      </div>

      {/* Cybersport Map Betting */}
      {(formData.sport === "csgo" || formData.sport === "dota2") && (
        <div className="space-y-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="font-bold text-sm">🎮 Ставки на карты (Киберспорт)</div>
          
          <div className="space-y-2">
            <Label>Формат матча *</Label>
            <select
              className="w-full p-2 rounded-lg bg-background border border-border text-sm"
              value={formData.bo_format}
              onChange={(e) => setFormData({ ...formData, bo_format: e.target.value })}
              disabled={isLoading}
            >
              <option value="BO1">BO1 (Best of 1)</option>
              <option value="BO3">BO3 (Best of 3)</option>
              <option value="BO5">BO5 (Best of 5)</option>
            </select>
          </div>

          {/* Map 1 */}
          <div className="border-t border-border/50 pt-3">
            <div className="font-bold text-xs mb-2">Карта 1</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="space-y-1">
                <Label className="text-xs">Победа Команды 1</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Коэф."
                  value={formData.map1_team1_odds}
                  onChange={(e) => setFormData({ ...formData, map1_team1_odds: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Победа Команды 2</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Коэф."
                  value={formData.map1_team2_odds}
                  onChange={(e) => setFormData({ ...formData, map1_team2_odds: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="text-xs font-semibold mb-1 text-muted-foreground">Фора на карту 1</div>
            <div className="grid grid-cols-3 gap-1">
              <Input
                type="number"
                step="0.5"
                placeholder="Знач."
                value={formData.map1_handicap_value}
                onChange={(e) => setFormData({ ...formData, map1_handicap_value: e.target.value })}
                className="text-xs"
                disabled={isLoading}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Ф1"
                value={formData.map1_team1_handicap_odds}
                onChange={(e) => setFormData({ ...formData, map1_team1_handicap_odds: e.target.value })}
                className="text-xs"
                disabled={isLoading}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Ф2"
                value={formData.map1_team2_handicap_odds}
                onChange={(e) => setFormData({ ...formData, map1_team2_handicap_odds: e.target.value })}
                className="text-xs"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Map 2 (only for BO3/BO5) */}
          {(formData.bo_format === "BO3" || formData.bo_format === "BO5") && (
            <div className="border-t border-border/50 pt-3">
              <div className="font-bold text-xs mb-2">Карта 2</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="space-y-1">
                  <Label className="text-xs">Победа Команды 1</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Коэф."
                    value={formData.map2_team1_odds}
                    onChange={(e) => setFormData({ ...formData, map2_team1_odds: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Победа Команды 2</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Коэф."
                    value={formData.map2_team2_odds}
                    onChange={(e) => setFormData({ ...formData, map2_team2_odds: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Фора на карту 2</div>
              <div className="grid grid-cols-3 gap-1">
                <Input
                  type="number"
                  step="0.5"
                  placeholder="Знач."
                  value={formData.map2_handicap_value}
                  onChange={(e) => setFormData({ ...formData, map2_handicap_value: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ф1"
                  value={formData.map2_team1_handicap_odds}
                  onChange={(e) => setFormData({ ...formData, map2_team1_handicap_odds: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ф2"
                  value={formData.map2_team2_handicap_odds}
                  onChange={(e) => setFormData({ ...formData, map2_team2_handicap_odds: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Map 3 (only for BO3/BO5) */}
          {(formData.bo_format === "BO3" || formData.bo_format === "BO5") && (
            <div className="border-t border-border/50 pt-3">
              <div className="font-bold text-xs mb-2">Карта 3</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="space-y-1">
                  <Label className="text-xs">Победа Команды 1</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Коэф."
                    value={formData.map3_team1_odds}
                    onChange={(e) => setFormData({ ...formData, map3_team1_odds: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Победа Команды 2</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Коэф."
                    value={formData.map3_team2_odds}
                    onChange={(e) => setFormData({ ...formData, map3_team2_odds: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Фора на карту 3</div>
              <div className="grid grid-cols-3 gap-1">
                <Input
                  type="number"
                  step="0.5"
                  placeholder="Знач."
                  value={formData.map3_handicap_value}
                  onChange={(e) => setFormData({ ...formData, map3_handicap_value: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ф1"
                  value={formData.map3_team1_handicap_odds}
                  onChange={(e) => setFormData({ ...formData, map3_team1_handicap_odds: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ф2"
                  value={formData.map3_team2_handicap_odds}
                  onChange={(e) => setFormData({ ...formData, map3_team2_handicap_odds: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Map 4 (only for BO5) */}
          {formData.bo_format === "BO5" && (
            <div className="border-t border-border/50 pt-3">
              <div className="font-bold text-xs mb-2">Карта 4</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="space-y-1">
                  <Label className="text-xs">Победа Команды 1</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Коэф."
                    value={formData.map4_team1_odds}
                    onChange={(e) => setFormData({ ...formData, map4_team1_odds: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Победа Команды 2</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Коэф."
                    value={formData.map4_team2_odds}
                    onChange={(e) => setFormData({ ...formData, map4_team2_odds: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Фора на карту 4</div>
              <div className="grid grid-cols-3 gap-1">
                <Input
                  type="number"
                  step="0.5"
                  placeholder="Знач."
                  value={formData.map4_handicap_value}
                  onChange={(e) => setFormData({ ...formData, map4_handicap_value: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ф1"
                  value={formData.map4_team1_handicap_odds}
                  onChange={(e) => setFormData({ ...formData, map4_team1_handicap_odds: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ф2"
                  value={formData.map4_team2_handicap_odds}
                  onChange={(e) => setFormData({ ...formData, map4_team2_handicap_odds: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Map 5 (only for BO5) */}
          {formData.bo_format === "BO5" && (
            <div className="border-t border-border/50 pt-3">
              <div className="font-bold text-xs mb-2">Карта 5</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="space-y-1">
                  <Label className="text-xs">Победа Команды 1</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Коэф."
                    value={formData.map5_team1_odds}
                    onChange={(e) => setFormData({ ...formData, map5_team1_odds: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Победа Команды 2</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Коэф."
                    value={formData.map5_team2_odds}
                    onChange={(e) => setFormData({ ...formData, map5_team2_odds: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">Фора на карту 5</div>
              <div className="grid grid-cols-3 gap-1">
                <Input
                  type="number"
                  step="0.5"
                  placeholder="Знач."
                  value={formData.map5_handicap_value}
                  onChange={(e) => setFormData({ ...formData, map5_handicap_value: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ф1"
                  value={formData.map5_team1_handicap_odds}
                  onChange={(e) => setFormData({ ...formData, map5_team1_handicap_odds: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ф2"
                  value={formData.map5_team2_handicap_odds}
                  onChange={(e) => setFormData({ ...formData, map5_team2_handicap_odds: e.target.value })}
                  className="text-xs"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Точный счет BO3 */}
          {(formData.bo_format === "BO3") && (
            <div className="border-t border-border/50 pt-3">
              <div className="font-bold text-xs mb-2">Точный счет (BO3)</div>
              <div className="grid grid-cols-4 gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="2-0"
                  value={formData.exact_score_2_0}
                  onChange={(e) => setFormData({ ...formData, exact_score_2_0: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="2-1"
                  value={formData.exact_score_2_1}
                  onChange={(e) => setFormData({ ...formData, exact_score_2_1: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="1-2"
                  value={formData.exact_score_1_2}
                  onChange={(e) => setFormData({ ...formData, exact_score_1_2: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0-2"
                  value={formData.exact_score_0_2}
                  onChange={(e) => setFormData({ ...formData, exact_score_0_2: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Точный счет BO5 */}
          {formData.bo_format === "BO5" && (
            <div className="border-t border-border/50 pt-3">
              <div className="font-bold text-xs mb-2">Точный счет (BO5)</div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="3-0"
                  value={formData.exact_score_3_0}
                  onChange={(e) => setFormData({ ...formData, exact_score_3_0: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="3-1"
                  value={formData.exact_score_3_1}
                  onChange={(e) => setFormData({ ...formData, exact_score_3_1: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="3-2"
                  value={formData.exact_score_3_2}
                  onChange={(e) => setFormData({ ...formData, exact_score_3_2: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="2-3"
                  value={formData.exact_score_2_3}
                  onChange={(e) => setFormData({ ...formData, exact_score_2_3: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="1-3"
                  value={formData.exact_score_1_3}
                  onChange={(e) => setFormData({ ...formData, exact_score_1_3: e.target.value })}
                  disabled={isLoading}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0-3"
                  value={formData.exact_score_0_3}
                  onChange={(e) => setFormData({ ...formData, exact_score_0_3: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? "Создание..." : "✓ Создать матч"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          Отмена
        </Button>
      </div>
    </form>
  );
};