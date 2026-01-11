import { cn } from "@/lib/utils";
import { Crown, Shield, Star, Sparkles, Zap } from "lucide-react";

interface AdminProfileBadgeProps {
  className?: string;
  variant?: "default" | "compact";
}

export const AdminProfileBadge = ({ className, variant = "default" }: AdminProfileBadgeProps) => {
  if (variant === "compact") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
        "bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20",
        "border border-amber-500/50",
        className
      )}>
        <Crown className="h-3 w-3 text-amber-500 animate-pulse" />
        <span className="text-xs font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-400 bg-clip-text text-transparent">
          ADMIN
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl p-4",
      "bg-gradient-to-br from-amber-900/30 via-yellow-900/20 to-orange-900/30",
      "border-2 border-amber-500/40",
      className
    )}>
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <Sparkles 
            key={i}
            className="absolute text-amber-400/30 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.5}s`,
              width: `${12 + Math.random() * 8}px`,
              height: `${12 + Math.random() * 8}px`,
            }}
          />
        ))}
      </div>

      <div className="relative flex items-center gap-3">
        {/* Icon container */}
        <div className="relative">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Crown className="h-7 w-7 text-white drop-shadow-lg" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center border-2 border-background">
            <Shield className="h-2.5 w-2.5 text-white" />
          </div>
        </div>

        {/* Text content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
              АДМИНИСТРАТОР
            </span>
            <Zap className="h-4 w-4 text-amber-400 animate-pulse" />
          </div>
          <p className="text-xs text-amber-200/70 mt-0.5">
            Полный доступ к управлению
          </p>
        </div>

        {/* Stars decoration */}
        <div className="flex flex-col gap-1">
          {[...Array(3)].map((_, i) => (
            <Star 
              key={i} 
              className="h-4 w-4 text-amber-400 fill-amber-400/50"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 animate-shimmer" />
    </div>
  );
};
