import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface WinAnimationProps {
  amount: number;
  show: boolean;
  onComplete?: () => void;
}

export const WinAnimation = ({ amount, show, onComplete }: WinAnimationProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Confetti particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full animate-coin-fall"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-${Math.random() * 100}px`,
              backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Win text */}
      <div className="relative animate-win-burst">
        <div className="absolute inset-0 blur-3xl bg-gradient-primary opacity-50 scale-150"></div>
        <div className={cn(
          "relative bg-gradient-card border-4 border-primary rounded-3xl px-8 sm:px-16 py-6 sm:py-12",
          "shadow-[0_0_100px_rgba(250,204,21,0.8)]"
        )}>
          <div className="text-center space-y-2 sm:space-y-4">
            <div className="text-5xl sm:text-7xl animate-bounce">🎉</div>
            <h2 className="text-3xl sm:text-5xl font-black bg-gradient-primary bg-clip-text text-transparent uppercase">
              Победа!
            </h2>
            <div className="text-4xl sm:text-6xl font-black text-success animate-pulse">
              +{amount.toFixed(2)}₽
            </div>
          </div>
        </div>
      </div>

      {/* Glow rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-64 h-64 sm:w-96 sm:h-96 rounded-full border-4 border-primary/30 animate-ping"></div>
        <div className="absolute w-48 h-48 sm:w-72 sm:h-72 rounded-full border-4 border-secondary/30 animate-ping" style={{ animationDelay: "0.5s" }}></div>
      </div>
    </div>
  );
};
