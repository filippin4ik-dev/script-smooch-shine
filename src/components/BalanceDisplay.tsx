import { useBalanceMode } from "@/hooks/useBalanceMode";
import { Wallet, Gift, Play, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceDisplayProps {
  balance: number;
  freebetBalance: number;
  demoBalance?: number;
  variant?: "desktop" | "mobile";
  onClick?: () => void;
}

export const BalanceDisplay = ({
  balance,
  freebetBalance,
  demoBalance = 0,
  variant = "desktop",
  onClick
}: BalanceDisplayProps) => {
  const { mode } = useBalanceMode();

  let displayBalance = balance;
  let balanceLabel = "Баланс";
  let gradientClass = "from-primary via-primary to-amber-400";
  let glowClass = "shadow-[0_0_20px_hsl(45_100%_51%/0.3)]";
  let Icon = Wallet;

  if (mode === "freebet") {
    displayBalance = freebetBalance;
    balanceLabel = "Бонус";
    gradientClass = "from-amber-500 via-orange-500 to-amber-400";
    glowClass = "shadow-[0_0_20px_hsl(35_100%_50%/0.3)]";
    Icon = Gift;
  } else if (mode === "demo") {
    displayBalance = demoBalance;
    balanceLabel = "Демо";
    gradientClass = "from-emerald-500 via-green-500 to-teal-400";
    glowClass = "shadow-[0_0_20px_hsl(142_76%_46%/0.3)]";
    Icon = Play;
  }

  if (variant === "mobile") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "relative overflow-hidden",
          "glass-card rounded-xl px-3 py-2",
          "border border-white/10 hover:border-primary/40",
          "transition-all duration-300",
          "hover:scale-105",
          glowClass
        )}
      >
        {/* Background shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer-fast opacity-0 hover:opacity-100" />
        
        <div className="relative flex items-center gap-2">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            "bg-gradient-to-br",
            gradientClass
          )}>
            <Icon className="w-4 h-4 text-background" />
          </div>
          
          <div className="text-left">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
              {balanceLabel}
              <ChevronDown className="w-3 h-3" />
            </div>
            <div className={cn(
              "text-sm font-black",
              "bg-gradient-to-r bg-clip-text text-transparent",
              gradientClass
            )}>
              {displayBalance.toFixed(2)}₽
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button 
      onClick={onClick} 
      className={cn(
        "w-full text-left",
        "glass-card rounded-xl p-4",
        "border border-white/10 hover:border-primary/30",
        "transition-all duration-300",
        "group hover:scale-[1.02]",
        glowClass
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          "bg-gradient-to-br transition-transform duration-300",
          "group-hover:scale-110 group-hover:rotate-3",
          gradientClass
        )}>
          <Icon className="w-5 h-5 text-background" />
        </div>
        <div>
          <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wide flex items-center gap-1.5">
            Ваш {balanceLabel.toLowerCase()}
            <Sparkles className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
          <div className={cn(
            "text-2xl font-black",
            "bg-gradient-to-r bg-clip-text text-transparent",
            gradientClass
          )}>
            {displayBalance.toFixed(2)}₽
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Нажмите для действий</span>
        <ChevronDown className="w-3 h-3 animate-bounce" />
      </div>
    </button>
  );
};
