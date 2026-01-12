import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface WinAnimationProps {
  amount: number;
  show: boolean;
  onComplete?: () => void;
}

export const WinAnimation = ({ amount, show, onComplete }: WinAnimationProps) => {
  const [visible, setVisible] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);

  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ['#FFD700', '#FFA500', '#FF6347', '#7CFC00', '#00CED1', '#FF69B4'];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Initial burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: colors,
    });

    frame();
  }, []);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setDisplayAmount(0);
      fireConfetti();
      
      // Animate number counting up
      const steps = 30;
      const increment = amount / steps;
      let current = 0;
      
      const countInterval = setInterval(() => {
        current += increment;
        if (current >= amount) {
          setDisplayAmount(amount);
          clearInterval(countInterval);
        } else {
          setDisplayAmount(current);
        }
      }, 50);

      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 3500);

      return () => {
        clearTimeout(timer);
        clearInterval(countInterval);
      };
    }
  }, [show, onComplete, amount, fireConfetti]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Radial glow background */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      {/* Animated coins falling */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute text-3xl animate-coin-fall"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-50px`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          >
            🪙
          </div>
        ))}
      </div>

      {/* Win card */}
      <div className="relative animate-win-burst">
        {/* Outer glow rings */}
        <div className="absolute inset-0 -m-8 sm:-m-16">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 blur-3xl animate-pulse" />
        </div>

        <div className={cn(
          "relative overflow-hidden",
          "bg-gradient-to-br from-amber-950 via-yellow-900 to-amber-950",
          "border-4 border-amber-400",
          "rounded-3xl px-8 sm:px-16 py-8 sm:py-12",
          "shadow-[0_0_100px_rgba(251,191,36,0.8),inset_0_0_60px_rgba(251,191,36,0.3)]"
        )}>
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer-fast" />
          
          {/* Stars decoration */}
          <div className="absolute top-4 left-4 text-2xl animate-pulse">✨</div>
          <div className="absolute top-4 right-4 text-2xl animate-pulse" style={{ animationDelay: '0.5s' }}>✨</div>
          <div className="absolute bottom-4 left-4 text-2xl animate-pulse" style={{ animationDelay: '0.3s' }}>✨</div>
          <div className="absolute bottom-4 right-4 text-2xl animate-pulse" style={{ animationDelay: '0.8s' }}>✨</div>

          <div className="text-center space-y-4 relative z-10">
            {/* Trophy icon with animation */}
            <div className="text-6xl sm:text-8xl animate-bounce-slow">
              🏆
            </div>
            
            {/* Win text */}
            <h2 className={cn(
              "text-4xl sm:text-6xl font-black uppercase",
              "bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200",
              "bg-clip-text text-transparent",
              "drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]",
              "animate-pulse"
            )}>
              Победа!
            </h2>
            
            {/* Amount with counting animation */}
            <div className="relative">
              <div className={cn(
                "text-5xl sm:text-7xl font-black",
                "bg-gradient-to-r from-green-300 via-emerald-400 to-green-300",
                "bg-clip-text text-transparent",
                "drop-shadow-[0_0_30px_rgba(34,197,94,0.8)]",
                "tabular-nums"
              )}>
                +{displayAmount.toFixed(2)}₽
              </div>
              
              {/* Glowing underline */}
              <div className="mt-2 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent rounded-full animate-pulse" />
            </div>

            {/* Subtitle */}
            <p className="text-amber-300/80 text-sm uppercase tracking-widest font-medium">
              Поздравляем с выигрышем!
            </p>
          </div>
        </div>
      </div>

      {/* Extra glow rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-80 h-80 sm:w-[500px] sm:h-[500px] rounded-full border-2 border-amber-400/20 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute w-64 h-64 sm:w-[400px] sm:h-[400px] rounded-full border-2 border-yellow-400/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
        <div className="absolute w-48 h-48 sm:w-[300px] sm:h-[300px] rounded-full border-2 border-green-400/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }} />
      </div>
    </div>
  );
};
