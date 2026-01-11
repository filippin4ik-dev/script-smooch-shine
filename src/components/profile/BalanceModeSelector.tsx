import { useBalanceMode, BalanceMode } from "@/hooks/useBalanceMode";
import { Wallet, Gift, Gamepad2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceModeSelectorProps {
  balance: number;
  freebetBalance: number;
  demoBalance: number;
}

export const BalanceModeSelector = ({ balance, freebetBalance, demoBalance }: BalanceModeSelectorProps) => {
  const { mode, setMode } = useBalanceMode();

  const options: { 
    value: BalanceMode; 
    label: string; 
    icon: React.ReactNode; 
    amount: number; 
    gradient: string;
    borderColor: string;
    available: boolean;
  }[] = [
    { 
      value: "main", 
      label: "Баланс", 
      icon: <Wallet className="w-4 h-4" />, 
      amount: balance,
      gradient: "from-primary/20 to-primary/5",
      borderColor: "border-primary/50",
      available: true 
    },
    { 
      value: "freebet", 
      label: "Фрибет", 
      icon: <Gift className="w-4 h-4" />, 
      amount: freebetBalance,
      gradient: "from-green-500/20 to-green-500/5",
      borderColor: "border-green-500/50",
      available: freebetBalance > 0 
    },
    { 
      value: "demo", 
      label: "Демо", 
      icon: <Gamepad2 className="w-4 h-4" />, 
      amount: demoBalance,
      gradient: "from-purple-500/20 to-purple-500/5",
      borderColor: "border-purple-500/50",
      available: demoBalance > 0 
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(opt => {
        const isActive = mode === opt.value;
        const isDisabled = !opt.available;
        
        return (
          <button
            key={opt.value}
            onClick={() => opt.available && setMode(opt.value)}
            disabled={isDisabled}
            className={cn(
              "relative p-3 rounded-2xl transition-all duration-200",
              "bg-gradient-to-br border",
              opt.gradient,
              isActive ? cn(opt.borderColor, "ring-2 ring-offset-2 ring-offset-background", 
                opt.value === "main" ? "ring-primary/50" : 
                opt.value === "freebet" ? "ring-green-500/50" : "ring-purple-500/50"
              ) : "border-border/30",
              isDisabled && "opacity-40 cursor-not-allowed",
              !isDisabled && !isActive && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            )}
          >
            {/* Active check */}
            {isActive && (
              <div className={cn(
                "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center",
                opt.value === "main" ? "bg-primary" : 
                opt.value === "freebet" ? "bg-green-500" : "bg-purple-500"
              )}>
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "p-1.5 rounded-lg",
                opt.value === "main" ? "text-primary" : 
                opt.value === "freebet" ? "text-green-400" : "text-purple-400"
              )}>
                {opt.icon}
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{opt.label}</span>
              <span className={cn(
                "text-lg font-bold",
                opt.value === "main" ? "text-primary" : 
                opt.value === "freebet" ? "text-green-400" : "text-purple-400"
              )}>
                {opt.amount.toFixed(0)}₽
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
