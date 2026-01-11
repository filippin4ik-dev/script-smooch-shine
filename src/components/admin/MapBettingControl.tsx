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
  team1: { name: string };
  team2: { name: string };
}

interface MapBettingControlProps {
  match: Match;
}

export const MapBettingControl = ({ match }: MapBettingControlProps) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  
  const isEsports = match.sport === "csgo" || match.sport === "dota2";
  
  if (!isEsports || match.status === "finished") {
    return null;
  }

  const toggleMapBetting = async (mapNumber: 1 | 2 | 3, currentValue: boolean) => {
    setIsLoading(true);
    try {
      const updateData: any = {};
      updateData[`map${mapNumber}_betting_closed`] = !currentValue;
      
      const { error } = await supabase
        .from("matches")
        .update(updateData)
        .eq("id", match.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
      toast.success(`Ставки на карту ${mapNumber} ${!currentValue ? "закрыты" : "открыты"}`);
    } catch (error) {
      toast.error("Ошибка при обновлении");
    } finally {
      setIsLoading(false);
    }
  };

  const setMatchLive = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ status: "live" })
        .eq("id", match.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
      toast.success("Матч переведен в LIVE");
    } catch (error) {
      toast.error("Ошибка при обновлении статуса");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Управление ставками на карты</h4>
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
            Карта 1
          </Label>
        </div>
        
        {/* Map 2 */}
        {(match.bo_format === "BO3" || match.bo_format === "BO5") && (
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
            <Switch
              id={`map2-${match.id}`}
              checked={!match.map2_betting_closed}
              onCheckedChange={() => toggleMapBetting(2, !!match.map2_betting_closed)}
              disabled={isLoading}
            />
            <Label htmlFor={`map2-${match.id}`} className="text-xs cursor-pointer">
              Карта 2
            </Label>
          </div>
        )}
        
        {/* Map 3 */}
        {(match.bo_format === "BO3" || match.bo_format === "BO5") && (
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
            <Switch
              id={`map3-${match.id}`}
              checked={!match.map3_betting_closed}
              onCheckedChange={() => toggleMapBetting(3, !!match.map3_betting_closed)}
              disabled={isLoading}
            />
            <Label htmlFor={`map3-${match.id}`} className="text-xs cursor-pointer">
              Карта 3
            </Label>
          </div>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Отключите переключатель, чтобы закрыть ставки на карту. В LIVE режиме игроки смогут ставить только на открытые карты.
      </p>
    </div>
  );
};