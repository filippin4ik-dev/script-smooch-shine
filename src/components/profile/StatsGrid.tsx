import { Trophy, Target, TrendingUp, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsGridProps {
  totalWins: number;
  totalLosses: number;
  winRate: string;
  totalGames: number;
}

export const StatsGrid = ({ totalWins, totalLosses, winRate, totalGames }: StatsGridProps) => {
  const stats = [
    {
      label: "Побед",
      value: totalWins,
      icon: Trophy,
      color: "text-primary",
      bg: "from-primary/20 to-primary/5",
      border: "border-primary/30"
    },
    {
      label: "Поражений",
      value: totalLosses,
      icon: Target,
      color: "text-destructive",
      bg: "from-destructive/20 to-destructive/5",
      border: "border-destructive/30"
    },
    {
      label: "Винрейт",
      value: `${winRate}%`,
      icon: TrendingUp,
      color: "text-green-400",
      bg: "from-green-500/20 to-green-500/5",
      border: "border-green-500/30"
    },
    {
      label: "Всего игр",
      value: totalGames,
      icon: Gamepad2,
      color: "text-purple-400",
      bg: "from-purple-500/20 to-purple-500/5",
      border: "border-purple-500/30"
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "p-4 rounded-2xl",
            "bg-gradient-to-br",
            stat.bg,
            "border",
            stat.border,
            "transition-all duration-300 hover:scale-[1.02]"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={cn("w-4 h-4", stat.color)} />
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
          <div className={cn("text-2xl font-bold", stat.color)}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
};
