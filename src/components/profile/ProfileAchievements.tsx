import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Trophy, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProfileAchievementsProps {
  userId: string;
}

export const ProfileAchievements = ({ userId }: ProfileAchievementsProps) => {
  const [selectedAchievement, setSelectedAchievement] = useState<any>(null);

  const { data: achievements, isLoading } = useQuery({
    queryKey: ["user-achievements", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_achievements")
        .select("*")
        .eq("user_id", userId)
        .order("granted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const getRarityStyle = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return {
          bg: "from-yellow-500/30 to-orange-500/30 border-yellow-500/60",
          text: "text-yellow-400",
          glow: "shadow-[0_0_15px_rgba(234,179,8,0.3)]",
        };
      case "epic":
        return {
          bg: "from-purple-500/30 to-pink-500/30 border-purple-500/60",
          text: "text-purple-400",
          glow: "shadow-[0_0_15px_rgba(168,85,247,0.3)]",
        };
      case "rare":
        return {
          bg: "from-blue-500/30 to-cyan-500/30 border-blue-500/60",
          text: "text-blue-400",
          glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]",
        };
      default:
        return {
          bg: "from-gray-500/30 to-gray-600/30 border-gray-500/60",
          text: "text-gray-400",
          glow: "",
        };
    }
  };

  const getRarityName = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "Легендарная";
      case "epic": return "Эпическая";
      case "rare": return "Редкая";
      default: return "Обычная";
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 rounded-2xl bg-card/50 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-primary" />
          <span className="font-bold">Достижения</span>
        </div>
        <div className="flex gap-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-14 h-14 rounded-xl bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (!achievements || achievements.length === 0) {
    return null;
  }

  return (
    <>
      <div className="p-4 rounded-2xl bg-card/50 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-primary" />
          <span className="font-bold">Достижения</span>
          <span className="text-sm text-muted-foreground">({achievements.length})</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {achievements.map((achievement, index) => {
            const style = getRarityStyle(achievement.rarity);
            return (
              <button
                key={achievement.id}
                onClick={() => setSelectedAchievement(achievement)}
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center text-2xl",
                  "bg-gradient-to-br border transition-all duration-300",
                  "hover:scale-110 cursor-pointer",
                  style.bg,
                  style.glow,
                  "animate-fade-in"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {achievement.icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* Achievement Details Dialog */}
      <Dialog open={!!selectedAchievement} onOpenChange={() => setSelectedAchievement(null)}>
        <DialogContent className="max-w-sm">
          {selectedAchievement && (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">Детали достижения</DialogTitle>
              </DialogHeader>
              <div className="text-center space-y-4">
                {/* Large Icon */}
                <div className={cn(
                  "w-24 h-24 mx-auto rounded-2xl flex items-center justify-center text-5xl",
                  "bg-gradient-to-br border",
                  getRarityStyle(selectedAchievement.rarity).bg,
                  getRarityStyle(selectedAchievement.rarity).glow
                )}>
                  {selectedAchievement.icon}
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-xl font-bold">{selectedAchievement.title}</h3>
                  <span className={cn(
                    "text-sm font-medium",
                    getRarityStyle(selectedAchievement.rarity).text
                  )}>
                    {getRarityName(selectedAchievement.rarity)}
                  </span>
                </div>

                {/* Description */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-sm text-foreground/90">{selectedAchievement.description}</p>
                </div>

                {/* Date */}
                <div className="text-xs text-muted-foreground">
                  Получено: {new Date(selectedAchievement.granted_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
