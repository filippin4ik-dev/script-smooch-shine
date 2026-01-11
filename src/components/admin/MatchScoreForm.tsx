import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Match {
  id: string;
  sport: string;
  bo_format?: string;
  team1: { name: string };
  team2: { name: string };
}

interface MatchScoreFormProps {
  match: Match;
  adminId: string;
  onClose: () => void;
}

export const MatchScoreForm = ({ match, adminId, onClose }: MatchScoreFormProps) => {
  const queryClient = useQueryClient();
  const isEsports = match.sport === "csgo" || match.sport === "dota2";
  const isBO5 = match.bo_format === "BO5";
  const [hasMap3, setHasMap3] = useState(false);
  const [hasMap4, setHasMap4] = useState(false);
  const [hasMap5, setHasMap5] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    winner: "",
    team1_score: "",
    team2_score: "",
    map1_team1_score: "",
    map1_team2_score: "",
    map2_team1_score: "",
    map2_team2_score: "",
    map3_team1_score: "",
    map3_team2_score: "",
    map4_team1_score: "",
    map4_team2_score: "",
    map5_team1_score: "",
    map5_team2_score: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.winner) {
      toast.error("Выберите победителя");
      return;
    }
    
    if (!formData.team1_score || !formData.team2_score) {
      toast.error("Введите счет матча");
      return;
    }

    setIsLoading(true);

    try {
      // Собираем счета по картам
      const mapScores: any = {};
      
      if (isEsports) {
        if (formData.map1_team1_score && formData.map1_team2_score) {
          mapScores.map1 = {
            team1: parseInt(formData.map1_team1_score),
            team2: parseInt(formData.map1_team2_score)
          };
        }
        if (formData.map2_team1_score && formData.map2_team2_score) {
          mapScores.map2 = {
            team1: parseInt(formData.map2_team1_score),
            team2: parseInt(formData.map2_team2_score)
          };
        }
        if (hasMap3 && formData.map3_team1_score && formData.map3_team2_score) {
          mapScores.map3 = {
            team1: parseInt(formData.map3_team1_score),
            team2: parseInt(formData.map3_team2_score)
          };
        }
        if (hasMap4 && formData.map4_team1_score && formData.map4_team2_score) {
          mapScores.map4 = {
            team1: parseInt(formData.map4_team1_score),
            team2: parseInt(formData.map4_team2_score)
          };
        }
        if (hasMap5 && formData.map5_team1_score && formData.map5_team2_score) {
          mapScores.map5 = {
            team1: parseInt(formData.map5_team1_score),
            team2: parseInt(formData.map5_team2_score)
          };
        }
      }

      // Используем RPC функцию с авторизацией админа
      const { data, error } = await supabase.rpc("admin_finish_match", {
        _admin_id: adminId,
        _match_id: match.id,
        _winner: formData.winner,
        _team1_score: parseInt(formData.team1_score),
        _team2_score: parseInt(formData.team2_score),
        _map_scores: Object.keys(mapScores).length > 0 ? mapScores : null,
      });

      if (error) {
        console.error("Finish match error:", error);
        toast.error(`Ошибка: ${error.message}`);
        return;
      }

      if (data && !data.success) {
        toast.error(data.message || "Ошибка завершения матча");
        return;
      }

      toast.success("Матч завершен и ставки рассчитаны!");
      queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-bets"] });
      onClose();
    } catch (error: any) {
      console.error("Unexpected error:", error);
      toast.error("Произошла непредвиденная ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Победитель *</Label>
        <select
          value={formData.winner}
          onChange={(e) => setFormData({ ...formData, winner: e.target.value })}
          className="w-full p-2 border rounded bg-background"
          required
          disabled={isLoading}
        >
          <option value="">Выберите победителя</option>
          <option value="team1">{match.team1.name}</option>
          <option value="team2">{match.team2.name}</option>
          {match.sport === "football" && <option value="draw">Ничья</option>}
        </select>
      </div>

      {/* Общий счет матча */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Счет матча {isEsports ? "(по картам)" : ""}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{match.team1.name} *</Label>
            <Input
              type="number"
              value={formData.team1_score}
              onChange={(e) => setFormData({ ...formData, team1_score: e.target.value })}
              placeholder={isEsports ? "2" : "3"}
              required
              disabled={isLoading}
            />
          </div>
          <div>
            <Label>{match.team2.name} *</Label>
            <Input
              type="number"
              value={formData.team2_score}
              onChange={(e) => setFormData({ ...formData, team2_score: e.target.value })}
              placeholder={isEsports ? "0" : "1"}
              required
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {isEsports && (
        <>
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Карта 1 (раунды)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Раунды {match.team1.name}</Label>
                <Input
                  type="number"
                  value={formData.map1_team1_score}
                  onChange={(e) => setFormData({ ...formData, map1_team1_score: e.target.value })}
                  placeholder="16"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label>Раунды {match.team2.name}</Label>
                <Input
                  type="number"
                  value={formData.map1_team2_score}
                  onChange={(e) => setFormData({ ...formData, map1_team2_score: e.target.value })}
                  placeholder="14"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Карта 2 (раунды)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Раунды {match.team1.name}</Label>
                <Input
                  type="number"
                  value={formData.map2_team1_score}
                  onChange={(e) => setFormData({ ...formData, map2_team1_score: e.target.value })}
                  placeholder="13"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label>Раунды {match.team2.name}</Label>
                <Input
                  type="number"
                  value={formData.map2_team2_score}
                  onChange={(e) => setFormData({ ...formData, map2_team2_score: e.target.value })}
                  placeholder="16"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 border-t pt-4">
            <Switch
              id="has-map3"
              checked={hasMap3}
              onCheckedChange={setHasMap3}
              disabled={isLoading}
            />
            <Label htmlFor="has-map3">Карта 3</Label>
          </div>

          {hasMap3 && (
            <div className="pt-2">
              <h3 className="font-semibold mb-2">Карта 3 (раунды)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Раунды {match.team1.name}</Label>
                  <Input
                    type="number"
                    value={formData.map3_team1_score}
                    onChange={(e) => setFormData({ ...formData, map3_team1_score: e.target.value })}
                    placeholder="16"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label>Раунды {match.team2.name}</Label>
                  <Input
                    type="number"
                    value={formData.map3_team2_score}
                    onChange={(e) => setFormData({ ...formData, map3_team2_score: e.target.value })}
                    placeholder="14"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          )}

          {isBO5 && (
            <>
              <div className="flex items-center space-x-2 border-t pt-4">
                <Switch
                  id="has-map4"
                  checked={hasMap4}
                  onCheckedChange={setHasMap4}
                  disabled={isLoading}
                />
                <Label htmlFor="has-map4">Карта 4</Label>
              </div>

              {hasMap4 && (
                <div className="pt-2">
                  <h3 className="font-semibold mb-2">Карта 4 (раунды)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Раунды {match.team1.name}</Label>
                      <Input
                        type="number"
                        value={formData.map4_team1_score}
                        onChange={(e) => setFormData({ ...formData, map4_team1_score: e.target.value })}
                        placeholder="16"
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <Label>Раунды {match.team2.name}</Label>
                      <Input
                        type="number"
                        value={formData.map4_team2_score}
                        onChange={(e) => setFormData({ ...formData, map4_team2_score: e.target.value })}
                        placeholder="14"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 border-t pt-4">
                <Switch
                  id="has-map5"
                  checked={hasMap5}
                  onCheckedChange={setHasMap5}
                  disabled={isLoading}
                />
                <Label htmlFor="has-map5">Карта 5</Label>
              </div>

              {hasMap5 && (
                <div className="pt-2">
                  <h3 className="font-semibold mb-2">Карта 5 (раунды)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Раунды {match.team1.name}</Label>
                      <Input
                        type="number"
                        value={formData.map5_team1_score}
                        onChange={(e) => setFormData({ ...formData, map5_team1_score: e.target.value })}
                        placeholder="16"
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <Label>Раунды {match.team2.name}</Label>
                      <Input
                        type="number"
                        value={formData.map5_team2_score}
                        onChange={(e) => setFormData({ ...formData, map5_team2_score: e.target.value })}
                        placeholder="14"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!isEsports && (
        <div className="p-3 bg-muted/20 rounded-lg text-sm text-muted-foreground">
          Введите итоговый счет матча
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Сохранение..." : "Завершить матч"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          Отмена
        </Button>
      </div>
    </form>
  );
};
