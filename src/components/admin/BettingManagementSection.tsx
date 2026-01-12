import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MatchForm } from "./MatchForm";
import { TeamForm } from "./TeamForm";
import { MatchScoreForm } from "./MatchScoreForm";
import { MapBettingControl } from "./MapBettingControl";
import { Trash2 } from "lucide-react";

interface BettingManagementSectionProps {
  adminId: string;
}

export const BettingManagementSection = ({ adminId }: BettingManagementSectionProps) => {
  const queryClient = useQueryClient();
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [finishingMatch, setFinishingMatch] = useState<string | null>(null);

  const { data: teams } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: matches } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select(`
          *,
          team1:teams!matches_team1_id_fkey(id, name, logo_url),
          team2:teams!matches_team2_id_fkey(id, name, logo_url)
        `)
        .order("match_time", { ascending: false });
      return data || [];
    },
  });

  const deleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Удалить команду "${teamName}"?`)) return;
    
    try {
      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      toast.success("Команда удалена");
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления");
    }
  };

  const deleteMatch = async (matchId: string) => {
    if (!confirm("Удалить матч?")) return;
    
    try {
      const { error } = await supabase.from("matches").delete().eq("id", matchId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
      toast.success("Матч удален");
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления");
    }
  };

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case "football": return "⚽";
      case "csgo": return "🔫";
      case "dota2": return "🎮";
      default: return "🎯";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "upcoming": return <Badge variant="outline">Предстоящий</Badge>;
      case "live": return <Badge variant="destructive" className="animate-pulse">LIVE</Badge>;
      case "finished": return <Badge variant="secondary">Завершен</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <AccordionItem value="betting-management" className="border border-blue-500/30 rounded-lg bg-card/50">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <span className="text-lg font-bold text-blue-400">🎲 Управление ставками</span>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 space-y-6">
        {/* Команды */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">👥 Команды ({teams?.length || 0})</h3>
            <Button size="sm" onClick={() => setShowTeamForm(!showTeamForm)}>
              {showTeamForm ? "Отмена" : "+ Новая команда"}
            </Button>
          </div>
          
          {showTeamForm && (
            <TeamForm adminId={adminId} onClose={() => setShowTeamForm(false)} />
          )}
          
          <div className="grid gap-2 max-h-[300px] overflow-y-auto">
            {teams?.map((team: any) => (
              <div key={team.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <img src={team.logo_url} alt={team.name} className="w-8 h-8 rounded object-cover" />
                  <span className="font-medium">{team.name}</span>
                  <Badge variant="outline" className="text-xs">{getSportIcon(team.sport)} {team.sport}</Badge>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => deleteTeam(team.id, team.name)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {teams?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Команды не созданы</p>
            )}
          </div>
        </div>

        {/* Матчи */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">⚔️ Матчи ({matches?.length || 0})</h3>
            <Button size="sm" onClick={() => setShowMatchForm(!showMatchForm)}>
              {showMatchForm ? "Отмена" : "+ Новый матч"}
            </Button>
          </div>
          
          {showMatchForm && (
            <MatchForm adminId={adminId} onClose={() => setShowMatchForm(false)} />
          )}
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {matches?.map((match: any) => (
              <div key={match.id} className="p-3 bg-muted/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getSportIcon(match.sport)}
                    <span className="font-bold">{match.team1?.name}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="font-bold">{match.team2?.name}</span>
                    {match.bo_format && <Badge variant="outline" className="text-xs">{match.bo_format}</Badge>}
                  </div>
                  {getStatusBadge(match.status)}
                </div>
                
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{new Date(match.match_time).toLocaleString("ru-RU")}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">П1: {match.team1_odds}</Badge>
                    {match.has_draw && <Badge variant="outline">X: {match.draw_odds}</Badge>}
                    <Badge variant="outline">П2: {match.team2_odds}</Badge>
                  </div>
                </div>

                {match.status === "finished" && (
                  <div className="text-center font-bold text-lg text-primary">
                    Счет: {match.team1_score} - {match.team2_score}
                  </div>
                )}

                {/* Управление картами для киберспорта */}
                <MapBettingControl match={match} />

                {/* Кнопки управления */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {match.status === "upcoming" && (
                    <Button 
                      size="sm" 
                      className="bg-red-500 hover:bg-red-600"
                      onClick={async () => {
                        const { error } = await supabase
                          .from("matches")
                          .update({ status: "live" })
                          .eq("id", match.id);
                        if (error) {
                          toast.error("Ошибка перевода в LIVE");
                        } else {
                          queryClient.invalidateQueries({ queryKey: ["admin-matches"] });
                          toast.success("Матч переведен в LIVE");
                        }
                      }}
                    >
                      🔴 Начать LIVE
                    </Button>
                  )}
                  
                  {match.status !== "finished" && (
                    <>
                      {finishingMatch === match.id ? (
                        <MatchScoreForm 
                          match={match} 
                          adminId={adminId} 
                          onClose={() => setFinishingMatch(null)} 
                        />
                      ) : (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => setFinishingMatch(match.id)}
                        >
                          ✅ Завершить матч
                        </Button>
                      )}
                    </>
                  )}
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteMatch(match.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {matches?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Матчи не созданы</p>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
