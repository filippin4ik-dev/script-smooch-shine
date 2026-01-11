import { History, Wallet, ShoppingBag, Package, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileNavButtonsProps {
  onNavigate: (tab: string) => void;
  activeTab: string;
}

export const ProfileNavButtons = ({ onNavigate, activeTab }: ProfileNavButtonsProps) => {
  const buttons = [
    { 
      id: "history", 
      label: "История игр", 
      icon: History, 
      gradient: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-blue-400",
      borderColor: "border-blue-500/30"
    },
    { 
      id: "transactions", 
      label: "Транзакции", 
      icon: Wallet, 
      gradient: "from-emerald-500/20 to-green-500/20",
      iconColor: "text-emerald-400",
      borderColor: "border-emerald-500/30"
    },
    { 
      id: "market", 
      label: "Маркет скинов", 
      icon: ShoppingBag, 
      gradient: "from-orange-500/20 to-amber-500/20",
      iconColor: "text-orange-400",
      borderColor: "border-orange-500/30"
    },
    { 
      id: "inventory", 
      label: "Инвентарь", 
      icon: Package, 
      gradient: "from-purple-500/20 to-pink-500/20",
      iconColor: "text-purple-400",
      borderColor: "border-purple-500/30"
    },
  ];

  return (
    <div className="space-y-2">
      {buttons.map((btn, index) => {
        const Icon = btn.icon;
        const isActive = activeTab === btn.id;
        
        return (
          <button
            key={btn.id}
            onClick={() => onNavigate(btn.id)}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200",
              "bg-gradient-to-r border",
              btn.gradient,
              isActive ? cn(btn.borderColor, "ring-1", btn.borderColor.replace("border-", "ring-")) : btn.borderColor,
              "hover:scale-[1.01] active:scale-[0.99]",
              "animate-fade-in"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-background/50"
              )}>
                <Icon className={cn("w-5 h-5", btn.iconColor)} />
              </div>
              <span className="font-medium">{btn.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
};
