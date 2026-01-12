import { useState, useEffect } from "react";
import { Trophy, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface JackpotCounterProps {
  baseAmount?: number;
  incrementRate?: number;
  className?: string;
}

export const JackpotCounter = ({ 
  baseAmount = 1250000, 
  incrementRate = 0.47,
  className 
}: JackpotCounterProps) => {
  const [amount, setAmount] = useState(baseAmount);
  const [isGlowing, setIsGlowing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAmount(prev => prev + incrementRate + Math.random() * 2);
      
      // Random glow effect
      if (Math.random() > 0.95) {
        setIsGlowing(true);
        setTimeout(() => setIsGlowing(false), 500);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [incrementRate]);

  const formatAmount = (num: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl",
      "bg-gradient-to-br from-amber-950/80 via-amber-900/60 to-yellow-900/80",
      "border-2 border-amber-500/50",
      "p-4 sm:p-6",
      "transition-all duration-300",
      isGlowing && "shadow-[0_0_60px_rgba(251,191,36,0.6)]",
      className
    )}>
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-amber-400/40 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent -translate-x-full animate-shimmer" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <span className="text-amber-400 font-bold uppercase tracking-widest text-sm">
            Jackpot
          </span>
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
        </div>

        {/* Amount */}
        <div className="flex items-center justify-center gap-3">
          <Trophy className={cn(
            "w-8 h-8 sm:w-10 sm:h-10 text-amber-400",
            isGlowing && "animate-bounce"
          )} />
          
          <div className="relative">
            <span className={cn(
              "text-3xl sm:text-4xl md:text-5xl font-black",
              "bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200",
              "bg-clip-text text-transparent",
              "drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]",
              "tabular-nums"
            )}>
              {formatAmount(amount)}
            </span>
            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-amber-400 ml-1">₽</span>
          </div>

          <Zap className={cn(
            "w-8 h-8 sm:w-10 sm:h-10 text-amber-400",
            isGlowing && "animate-bounce"
          )} />
        </div>

        {/* Progress bar */}
        <div className="mt-4 relative h-2 bg-amber-950 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-full animate-pulse"
            style={{ width: `${(amount % 10000) / 100}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>

        <p className="text-center text-amber-400/70 text-xs mt-2 uppercase tracking-wider">
          Накопительный приз • Обновляется в реальном времени
        </p>
      </div>
    </div>
  );
};
