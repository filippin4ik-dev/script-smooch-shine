import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, Medal, Award, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACHIEVEMENT_PRESETS = [
  { id: "tournament_1", title: "🥇 1 место в турнире", icon: "🥇", rarity: "legendary", place: 1 },
  { id: "tournament_2", title: "🥈 2 место в турнире", icon: "🥈", rarity: "epic", place: 2 },
  { id: "tournament_3", title: "🥉 3 место в турнире", icon: "🥉", rarity: "rare", place: 3 },
  { id: "big_win", title: "💰 Крупный выигрыш", icon: "💰", rarity: "legendary", place: null },
  { id: "special", title: "⭐ Особая награда", icon: "⭐", rarity: "epic", place: null },
  { id: "custom", title: "✏️ Своя ачивка", icon: "🏆", rarity: "rare", place: null },
];

export const AchievementGiver = () => {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customIcon, setCustomIcon] = useState("🏆");
  const [customRarity, setCustomRarity] = useState("rare");

  const { data: users } = useQuery({
    queryKey: ["admin-users-for-achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, public_id")
        .order("username");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentAchievements } = useQuery({
    queryKey: ["admin-recent-achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_achievements")
        .select(`
          *,
          user:profiles!admin_achievements_user_id_fkey(username, public_id),
          granter:profiles!admin_achievements_granted_by_fkey(username)
        `)
        .order("granted_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const grantAchievement = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("Выберите пользователя");
      
      const preset = ACHIEVEMENT_PRESETS.find(p => p.id === selectedPreset);
      if (!preset) throw new Error("Выберите тип ачивки");

      let title = preset.title;
      let description = customDescription;
      let icon = preset.icon;
      let rarity = preset.rarity;
      let place = preset.place;

      if (selectedPreset === "custom") {
        if (!customTitle.trim()) throw new Error("Введите название ачивки");
        title = customTitle;
        icon = customIcon;
        rarity = customRarity;
      }

      if (!description.trim()) throw new Error("Введите описание (за что выдана)");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Не авторизован");

      const { error } = await supabase.from("admin_achievements").insert({
        user_id: selectedUserId,
        title,
        description,
        icon,
        rarity,
        place,
        granted_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("✅ Ачивка выдана!");
      queryClient.invalidateQueries({ queryKey: ["admin-recent-achievements"] });
      setSelectedUserId("");
      setSelectedPreset("");
      setCustomTitle("");
      setCustomDescription("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка выдачи ачивки");
    },
  });

  const deleteAchievement = useMutation({
    mutationFn: async (achievementId: string) => {
      const { error } = await supabase
        .from("admin_achievements")
        .delete()
        .eq("id", achievementId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ачивка удалена");
      queryClient.invalidateQueries({ queryKey: ["admin-recent-achievements"] });
    },
    onError: () => {
      toast.error("Ошибка удаления");
    },
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "from-yellow-500/20 to-orange-500/20 border-yellow-500/50";
      case "epic": return "from-purple-500/20 to-pink-500/20 border-purple-500/50";
      case "rare": return "from-blue-500/20 to-cyan-500/20 border-blue-500/50";
      default: return "from-gray-500/20 to-gray-600/20 border-gray-500/50";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {/* User selection */}
        <div className="space-y-2">
          <Label>Пользователь</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите пользователя" />
            </SelectTrigger>
            <SelectContent>
              {users?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.username} (ID: {user.public_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Achievement type */}
        <div className="space-y-2">
          <Label>Тип ачивки</Label>
          <Select value={selectedPreset} onValueChange={setSelectedPreset}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите тип" />
            </SelectTrigger>
            <SelectContent>
              {ACHIEVEMENT_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom fields */}
        {selectedPreset === "custom" && (
          <>
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Название ачивки"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Иконка</Label>
                <Input
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  placeholder="🏆"
                />
              </div>
              <div className="space-y-2">
                <Label>Редкость</Label>
                <Select value={customRarity} onValueChange={setCustomRarity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legendary">Легендарная</SelectItem>
                    <SelectItem value="epic">Эпическая</SelectItem>
                    <SelectItem value="rare">Редкая</SelectItem>
                    <SelectItem value="common">Обычная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {/* Description */}
        <div className="space-y-2">
          <Label>За что выдана</Label>
          <Textarea
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            placeholder="Например: Победа в турнире по Crash 12.01.2026"
            rows={2}
          />
        </div>

        <Button 
          onClick={() => grantAchievement.mutate()}
          disabled={grantAchievement.isPending}
          className="w-full"
        >
          <Trophy className="w-4 h-4 mr-2" />
          {grantAchievement.isPending ? "Выдаём..." : "Выдать ачивку"}
        </Button>
      </div>

      {/* Recent achievements */}
      <div className="space-y-3">
        <h3 className="font-bold flex items-center gap-2">
          <Medal className="w-4 h-4" />
          Выданные ачивки
        </h3>
        
        {recentAchievements?.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            Нет выданных ачивок
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {recentAchievements?.map((achievement: any) => (
              <div
                key={achievement.id}
                className={cn(
                  "p-3 rounded-xl border bg-gradient-to-br",
                  getRarityColor(achievement.rarity)
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl">{achievement.icon}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{achievement.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {achievement.user?.username} (ID: {achievement.user?.public_id})
                      </div>
                      <div className="text-xs text-foreground/70 mt-1">
                        {achievement.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Выдал: {achievement.granter?.username} • {new Date(achievement.granted_at).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteAchievement.mutate(achievement.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
