import { cn } from "@/lib/utils";

export const GRADIENT_COLORS = {
  gold: "from-yellow-300 via-orange-400 to-amber-500",
  purple: "from-violet-400 via-fuchsia-500 to-pink-500",
  blue: "from-cyan-400 via-blue-500 to-indigo-500",
  green: "from-lime-400 via-emerald-400 to-teal-500",
  red: "from-rose-400 via-red-500 to-orange-500",
  rainbow: "from-red-500 via-yellow-400 via-green-400 via-cyan-400 to-purple-500",
  neon: "from-green-400 via-cyan-300 to-blue-400",
  sunset: "from-orange-500 via-pink-500 to-purple-600",
  ocean: "from-blue-300 via-teal-400 to-emerald-500",
  fire: "from-yellow-400 via-orange-500 to-red-600",
  ice: "from-blue-200 via-cyan-300 to-teal-400",
  electric: "from-yellow-300 via-lime-400 to-green-500",
  cosmic: "from-indigo-500 via-purple-500 to-pink-400",
  cherry: "from-pink-400 via-rose-500 to-red-500",
  mint: "from-emerald-300 via-green-400 to-teal-500",
  lavender: "from-purple-300 via-violet-400 to-indigo-500",
};

export type GradientColor = keyof typeof GRADIENT_COLORS;

interface VipUsernameProps {
  username: string;
  isAdmin?: boolean;
  isVip?: boolean;
  gradientColor?: GradientColor;
  level?: number;
  showLevel?: boolean;
  className?: string;
}

export const VipUsername = ({ 
  username, 
  isAdmin, 
  isVip, 
  gradientColor = "gold",
  level,
  showLevel = false,
  className 
}: VipUsernameProps) => {
  const hasSpecialStyle = isAdmin || isVip;
  const colorClass = GRADIENT_COLORS[gradientColor] || GRADIENT_COLORS.gold;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {hasSpecialStyle ? (
        <span 
          className={cn(
            "bg-gradient-to-r bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]",
            colorClass
          )}
        >
          {username}
        </span>
      ) : (
        <span>{username}</span>
      )}
      {showLevel && level !== undefined && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
          {level}
        </span>
      )}
    </span>
  );
};
