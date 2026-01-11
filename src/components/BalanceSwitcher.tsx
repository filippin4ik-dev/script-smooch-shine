import { useBalanceMode, BalanceMode } from "@/hooks/useBalanceMode";
import { Wallet, Gift, Play, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceSwitcherProps {
  balance: number;
  freebetBalance: number;
  demoBalance: number;
}

export const BalanceSwitcher = ({ balance, freebetBalance, demoBalance }: BalanceSwitcherProps) => {
  const { mode, setMode } = useBalanceMode();

  const options: { value: BalanceMode; label: string; icon: React.ReactNode; bgActive: string; bgInactive: string; textColor: string; amount: number; available: boolean }[] = [
    { 
      value: "main", 
      label: "Баланс", 
      icon: <Wallet className="w-5 h-5" />, 
      bgActive: "bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30",
      bgInactive: "bg-background/50 border-primary/30 hover:border-primary/60",
      textColor: "text-primary",
      amount: balance, 
      available: true 
    },
    { 
      value: "freebet", 
      label: "Бонус", 
      icon: <Gift className="w-5 h-5" />, 
      bgActive: "bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30",
      bgInactive: "bg-background/50 border-amber-500/30 hover:border-amber-500/60",
      textColor: "text-amber-500",
      amount: freebetBalance, 
      available: freebetBalance > 0 
    },
    { 
      value: "demo", 
      label: "Демо", 
      icon: <Play className="w-5 h-5" />, 
      bgActive: "bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/30",
      bgInactive: "bg-background/50 border-emerald-500/30 hover:border-emerald-500/60",
      textColor: "text-emerald-500",
      amount: demoBalance, 
      available: demoBalance > 0 
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center font-medium">Выберите режим игры</p>
      <div className="grid grid-cols-3 gap-3">
        {options.map(opt => {
          const isActive = mode === opt.value;
          const isDisabled = !opt.available;
          
          return (
            <button
              key={opt.value}
              onClick={() => opt.available && setMode(opt.value)}
              disabled={isDisabled}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300",
                isActive 
                  ? cn(opt.bgActive, "border-transparent text-white scale-[1.02]") 
                  : cn(opt.bgInactive, "border"),
                isDisabled && "opacity-40 cursor-not-allowed",
                !isDisabled && !isActive && "cursor-pointer hover:scale-[1.02]"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                  <Check className="w-3 h-3 text-primary" />
                </div>
              )}
              
              {/* Icon */}
              <div className={cn(
                "p-2 rounded-lg",
                isActive ? "bg-white/20" : "bg-muted/50"
              )}>
                <span className={isActive ? "text-white" : opt.textColor}>
                  {opt.icon}
                </span>
              </div>
              
              {/* Label */}
              <span className={cn(
                "text-sm font-semibold",
                isActive ? "text-white" : "text-foreground"
              )}>
                {opt.label}
              </span>
              
              {/* Amount */}
              <span className={cn(
                "text-lg font-bold",
                isActive ? "text-white" : opt.textColor
              )}>
                {opt.amount.toFixed(2)}₽
              </span>
            </button>
          );
        })}
      </div>
      
      {mode === "demo" && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <Play className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-medium text-emerald-500">Демо-счёт нельзя вывести</span>
        </div>
      )}
      
      {mode === "freebet" && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <Gift className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium text-amber-500">Бонус требует отыгрыша</span>
        </div>
      )}
    </div>
  );
};