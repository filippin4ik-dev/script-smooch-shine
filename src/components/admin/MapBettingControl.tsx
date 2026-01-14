import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Match {
  id: string;
  sport: string;
  status: string;
  bo_format?: string;
  map1_betting_closed?: boolean;
  map2_betting_closed?: boolean;
  map3_betting_closed?: boolean;
  map4_betting_closed?: boolean;
  map5_betting_closed?: boolean;
  exact_score_closed?: boolean;
  exact_score_odds?: Record<string, number> | null;
  team1: { name: string };
  team2: { name: string };
}

interface MapBettingControlProps {
  match: Match;
  adminId: string;
}

export const MapBettingControl = ({ match, adminId }: MapBettingControlProps) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  
  const isEsports = match.sport === "csgo" || match.sport === "dota2";
  const hasExactScore = match.exact_score_odds && Object.keys(match.exact_score_odds).length > 0;
  
  if (match.status === "finished") {
    return null;
  }

  // Show controls for esports (maps) or any match with exact score
  if (!isEsports && !hasExactScore) {
    return null;
  }

  const toggleMapBetting = async (mapNumber: 1 | 2 | 3 | 4 | 5, currentValue: boolean) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_toggle_map_betting", {
        _admin_id: adminId,
        _match_id: match.id,
        _map_number: mapNumber,
        _is_closed: !currentValue
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Ошибка обновления");
      }

      queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
      toast.success(`Ставки на карту ${mapNumber} ${!currentValue ? "закрыты" : "открыты"}`);
    } catch (error: any) {
      console.error("Toggle map betting error:", error);
      toast.error(error.message || "Ошибка при обновлении");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExactScoreBetting = async (currentValue: boolean) => {
    setIsLoading(true);
    const newValue = !currentValue;
    console.log("toggleExactScoreBetting called:", { currentValue, newValue, matchId: match.id, adminId });
    
    try {
      const { data, error } = await supabase.rpc("admin_toggle_exact_score_betting", {
        _admin_id: adminId,
        _match_id: match.id,
        _is_closed: newValue
      });

      console.log("RPC response:", { data, error });
      
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Ошибка обновления");
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
      await queryClient.refetchQueries({ queryKey: ["admin-matches"] });
      toast.success(`Ставки на точный счет ${newValue ? "закрыты" : "открыты"}`);
    } catch (error: any) {
      console.error("Toggle exact score betting error:", error);
      toast.error(error.message || "Ошибка при обновлении");
    } finally {
      setIsLoading(false);
    }
  };

  const setMatchLive = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_set_match_live", {
        _admin_id: adminId,
        _match_id: match.id
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Ошибка перевода в LIVE");
      }

      queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
      toast.success("Матч переведен в LIVE");
    } catch (error: any) {
      toast.error(error.message || "Ошибка при обновлении статуса");
    } finally {
      setIsLoading(false);
    }
  };

  const getMaxMaps = () => {
    if (match.bo_format === "BO5") return 5;
    if (match.bo_format === "BO3") return 3;
    return 1;
  };

  const maxMaps = getMaxMaps();

  return (
    <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Управление ставками</h4>
        {match.status === "upcoming" && (
          <Button 
            size="sm" 
            onClick={setMatchLive} 
            disabled={isLoading}
            className="bg-red-500 hover:bg-red-600"
          >
            Начать LIVE
          </Button>
        )}
        {match.status === "live" && (
          <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
        )}
      </div>
      
      {/* Map controls for esports */}
      {isEsports && (
        <div className="grid grid-cols-3 gap-2">
          {/* Map 1 */}
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
            <Switch
              id={`map1-${match.id}`}
              checked={!match.map1_betting_closed}
              onCheckedChange={() => toggleMapBetting(1, !!match.map1_betting_closed)}
              disabled={isLoading}
            />
            <Label htmlFor={`map1-${match.id}`} className="text-xs cursor-pointer">
              Карта 1 {match.map1_betting_closed && <span className="text-destructive">(закр)</span>}
            </Label>
          </div>
          
          {/* Map 2 */}
          {maxMaps >= 2 && (
            <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
              <Switch
                id={`map2-${match.id}`}
                checked={!match.map2_betting_closed}
                onCheckedChange={() => toggleMapBetting(2, !!match.map2_betting_closed)}
                disabled={isLoading}
              />
              <Label htmlFor={`map2-${match.id}`} className="text-xs cursor-pointer">
                Карта 2 {match.map2_betting_closed && <span className="text-destructive">(закр)</span>}
              </Label>
            </div>
          )}
          
          {/* Map 3 */}
          {maxMaps >= 3 && (
            <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
              <Switch
                id={`map3-${match.id}`}
                checked={!match.map3_betting_closed}
                onCheckedChange={() => toggleMapBetting(3, !!match.map3_betting_closed)}
                disabled={isLoading}
              />
              <Label htmlFor={`map3-${match.id}`} className="text-xs cursor-pointer">
                Карта 3 {match.map3_betting_closed && <span className="text-destructive">(закр)</span>}
              </Label>
            </div>
          )}
          
          {/* Map 4 */}
          {maxMaps >= 4 && (
            <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
              <Switch
                id={`map4-${match.id}`}
                checked={!match.map4_betting_closed}
                onCheckedChange={() => toggleMapBetting(4, !!match.map4_betting_closed)}
                disabled={isLoading}
              />
              <Label htmlFor={`map4-${match.id}`} className="text-xs cursor-pointer">
                Карта 4 {match.map4_betting_closed && <span className="text-destructive">(закр)</span>}
              </Label>
            </div>
          )}
          
          {/* Map 5 */}
          {maxMaps >= 5 && (
            <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
              <Switch
                id={`map5-${match.id}`}
                checked={!match.map5_betting_closed}
                onCheckedChange={() => toggleMapBetting(5, !!match.map5_betting_closed)}
                disabled={isLoading}
              />
              <Label htmlFor={`map5-${match.id}`} className="text-xs cursor-pointer">
                Карта 5 {match.map5_betting_closed && <span className="text-destructive">(закр)</span>}
              </Label>
            </div>
          )}
        </div>
      )}
      
      {/* Exact score control */}
      {hasExactScore && (
        <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
          <Switch
            id={`exact-score-${match.id}`}
            checked={!match.exact_score_closed}
            onCheckedChange={() => toggleExactScoreBetting(!!match.exact_score_closed)}
            disabled={isLoading}
          />
          <Label htmlFor={`exact-score-${match.id}`} className="text-sm cursor-pointer font-medium">
            🎯 Точный счет {match.exact_score_closed && <span className="text-destructive">(закрыто)</span>}
          </Label>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Отключите переключатель, чтобы закрыть ставки. В LIVE режиме игроки смогут ставить только на открытые опции.
      </p>
    </div>
  );
};