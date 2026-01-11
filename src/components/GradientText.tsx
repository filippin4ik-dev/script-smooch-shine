import { cn } from "@/lib/utils";

interface GradientTextProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "gold" | "rainbow" | "neon" | "fire" | "ice";
  className?: string;
  animated?: boolean;
}

const VARIANTS = {
  primary: "from-primary via-purple-500 to-pink-500",
  secondary: "from-secondary via-pink-500 to-orange-500",
  gold: "from-yellow-300 via-amber-500 to-orange-500",
  rainbow: "from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500",
  neon: "from-cyan-400 via-blue-500 to-purple-600",
  fire: "from-yellow-400 via-orange-500 to-red-600",
  ice: "from-blue-200 via-cyan-400 to-teal-500",
};

export const GradientText = ({ 
  children, 
  variant = "primary", 
  className,
  animated = true 
}: GradientTextProps) => {
  return (
    <span 
      className={cn(
        "bg-gradient-to-r bg-clip-text text-transparent",
        VARIANTS[variant],
        animated && "animate-gradient-shift bg-[length:200%_auto]",
        className
      )}
    >
      {children}
    </span>
  );
};
