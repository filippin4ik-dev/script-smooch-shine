import { useBalanceMode } from "@/hooks/useBalanceMode";
import { Wallet, Gift, Play } from "lucide-react";

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
  let colorClass = "text-primary";
  let Icon = Wallet;

  if (mode === "freebet") {
    displayBalance = freebetBalance;
    balanceLabel = "Бонус";
    colorClass = "text-amber-500";
    Icon = Gift;
  } else if (mode === "demo") {
    displayBalance = demoBalance;
    balanceLabel = "Демо";
    colorClass = "text-green-500";
    Icon = Play;
  }

  if (variant === "mobile") {
    return (
      <button
        onClick={onClick}
        className="border-2 rounded-lg px-3 py-1.5 shadow-neon-blue hover:shadow-neon-gold hover:scale-105 transition-all bg-card border-border/60"
      >
        <div className={`text-[10px] uppercase font-bold ${colorClass}`}>
          <Icon className="inline w-3 h-3 mr-1" /> {balanceLabel} • Нажми
        </div>
        <div className={`text-base font-black ${colorClass}`}>
          {displayBalance.toFixed(2)}₽
        </div>
      </button>
    );
  }

  return (
    <button onClick={onClick} className="w-full text-left">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${colorClass}`} />
        <span className={`text-xs uppercase ${colorClass} font-bold`}>
          Ваш {balanceLabel.toLowerCase()}:
        </span>
      </div>
      <div className={`text-2xl font-black ${colorClass}`}>
        {displayBalance.toFixed(2)}₽
      </div>
    </button>
  );
};
