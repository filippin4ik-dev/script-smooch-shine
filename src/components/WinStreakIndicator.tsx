import { useState, useEffect } from "react";
import { Flame, Zap, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface WinStreakIndicatorProps {
  streak: number;
  bonus: number;
  message: string | null;
  className?: string;
}

export const WinStreakIndicator = ({ streak, bonus, message, className }: WinStreakIndicatorProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showBonus, setShowBonus] = useState(false);

  useEffect(() => {
    if (streak >= 3) {
      setIsAnimating(true);
      const timer = setTimeout(() => setShowBonus(true), 500);
      return () => clearTimeout(timer);
    }
  }, [streak]);

  if (streak < 3) return null;

  const getStreakLevel = () => {
    if (streak >= 10) return { icon: Trophy, color: "text-yellow-400", bg: "from-yellow-500/30 to-orange-500/30", border: "border-yellow-500/50", glow: "shadow-[0_0_30px_hsl(45,100%,50%,0.5)]" };
    if (streak >= 7) return { icon: Flame, color: "text-orange-400", bg: "from-orange-500/30 to-red-500/30", border: "border-orange-500/50", glow: "shadow-[0_0_25px_hsl(25,100%,50%,0.4)]" };
    if (streak >= 5) return { icon: Zap, color: "text-cyan-400", bg: "from-cyan-500/30 to-blue-500/30", border: "border-cyan-500/50", glow: "shadow-[0_0_20px_hsl(195,100%,50%,0.4)]" };
    return { icon: Star, color: "text-purple-400", bg: "from-purple-500/30 to-pink-500/30", border: "border-purple-500/50", glow: "shadow-[0_0_15px_hsl(280,100%,50%,0.3)]" };
  };

  const level = getStreakLevel();
  const Icon = level.icon;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-4",
      "bg-gradient-to-br",
      level.bg,
      "border-2",
      level.border,
      level.glow,
      "transition-all duration-500",
      isAnimating && "animate-pulse",
      className
    )}>
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute w-1 h-1 rounded-full",
              level.color,
              "animate-ping opacity-60"
            )}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${1.5 + Math.random()}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center gap-4">
        {/* Animated icon */}
        <div className={cn(
          "w-16 h-16 rounded-xl flex items-center justify-center",
          "bg-gradient-to-br from-background/50 to-background/20",
          "border border-white/10",
          "transition-transform duration-300",
          isAnimating && "animate-bounce"
        )}>
          <Icon className={cn("w-8 h-8", level.color, "drop-shadow-lg")} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-2xl font-black", level.color)}>
              {streak}x
            </span>
            <span className="text-lg font-bold text-foreground/90">
              СЕРИЯ
            </span>
          </div>
          
          {message && (
            <p className="text-sm text-foreground/70 font-medium">
              {message}
            </p>
          )}
        </div>

        {/* Bonus indicator */}
        {showBonus && bonus > 0 && (
          <div className={cn(
            "px-4 py-2 rounded-xl",
            "bg-primary/20 border border-primary/40",
            "animate-scale-in"
          )}>
            <div className="text-xs text-primary/80 font-medium">Бонус</div>
            <div className="text-xl font-black text-primary">+{bonus}</div>
          </div>
        )}
      </div>

      {/* Progress bar for next tier */}
      <div className="mt-3 relative">
        <div className="h-1.5 bg-background/30 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              "bg-gradient-to-r from-primary via-purple-500 to-pink-500"
            )}
            style={{
              width: streak >= 10 ? "100%" : `${((streak % 3) / 3) * 100}%`
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>{streak} побед</span>
          <span>
            {streak < 5 ? `до 5x: ${5 - streak}` : 
             streak < 7 ? `до 7x: ${7 - streak}` :
             streak < 10 ? `до 10x: ${10 - streak}` : "МАКСИМУМ!"}
          </span>
        </div>
      </div>
    </div>
  );
};
