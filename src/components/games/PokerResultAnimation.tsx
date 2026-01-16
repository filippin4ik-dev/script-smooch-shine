import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

interface PokerResultAnimationProps {
  result: 'win' | 'lose' | 'draw';
  amount?: number;
  show: boolean;
  onComplete?: () => void;
}

export const PokerResultAnimation = ({ result, amount, show, onComplete }: PokerResultAnimationProps) => {
  const [visible, setVisible] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setAnimationPhase(1);
      
      // Phase 2: Scale up
      setTimeout(() => setAnimationPhase(2), 100);
      
      // Phase 3: Particles
      setTimeout(() => setAnimationPhase(3), 300);
      
      // Trigger confetti for wins
      if (result === 'win') {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#00BFFF'],
          });
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#00BFFF'],
          });
        }, 250);

        setTimeout(() => clearInterval(interval), duration);
      }
      
      // Auto hide
      const timer = setTimeout(() => {
        setAnimationPhase(0);
        setTimeout(() => {
          setVisible(false);
          onComplete?.();
        }, 300);
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [show, result, onComplete]);

  if (!visible) return null;

  const getResultConfig = () => {
    switch (result) {
      case 'win':
        return {
          emoji: '🏆',
          title: 'ПОБЕДА!',
          subtitle: amount ? `+${amount.toFixed(2)}₽` : '',
          bgGradient: 'from-yellow-500/20 via-green-500/20 to-emerald-500/20',
          borderColor: 'border-yellow-400',
          textColor: 'text-yellow-400',
          glowColor: 'rgba(250, 204, 21, 0.6)',
          subtitleColor: 'text-green-400',
        };
      case 'lose':
        return {
          emoji: '💔',
          title: 'ПОРАЖЕНИЕ',
          subtitle: 'Повезёт в следующий раз!',
          bgGradient: 'from-red-500/20 via-red-600/20 to-red-700/20',
          borderColor: 'border-red-500',
          textColor: 'text-red-400',
          glowColor: 'rgba(239, 68, 68, 0.4)',
          subtitleColor: 'text-red-300',
        };
      case 'draw':
        return {
          emoji: '🤝',
          title: 'НИЧЬЯ',
          subtitle: 'Ставки возвращены',
          bgGradient: 'from-blue-500/20 via-indigo-500/20 to-purple-500/20',
          borderColor: 'border-blue-400',
          textColor: 'text-blue-400',
          glowColor: 'rgba(96, 165, 250, 0.4)',
          subtitleColor: 'text-blue-300',
        };
    }
  };

  const config = getResultConfig();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          animationPhase >= 1 ? 'opacity-100' : 'opacity-0'
        }`} 
      />
      
      {/* Animated rings for win */}
      {result === 'win' && animationPhase >= 3 && (
        <>
          <div 
            className="absolute w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full border-4 border-yellow-400/30 animate-ping"
            style={{ animationDuration: '1.5s' }}
          />
          <div 
            className="absolute w-[250px] h-[250px] sm:w-[400px] sm:h-[400px] rounded-full border-4 border-green-400/30 animate-ping"
            style={{ animationDuration: '1.5s', animationDelay: '0.3s' }}
          />
          <div 
            className="absolute w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] rounded-full border-4 border-yellow-400/20 animate-ping"
            style={{ animationDuration: '1.5s', animationDelay: '0.6s' }}
          />
        </>
      )}
      
      {/* Particles for lose */}
      {result === 'lose' && animationPhase >= 3 && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-red-500/60 rounded-full animate-bounce"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
                animationDuration: `${0.5 + Math.random() * 1}s`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main Card */}
      <div 
        className={`relative transition-all duration-500 ease-out ${
          animationPhase >= 2 
            ? 'scale-100 opacity-100' 
            : 'scale-50 opacity-0'
        }`}
      >
        {/* Glow effect */}
        <div 
          className="absolute inset-0 blur-3xl rounded-3xl scale-150"
          style={{ background: config.glowColor }}
        />
        
        {/* Card */}
        <div 
          className={`relative bg-gradient-to-br ${config.bgGradient} border-4 ${config.borderColor} rounded-3xl px-8 sm:px-16 py-8 sm:py-12 backdrop-blur-lg`}
          style={{ 
            boxShadow: `0 0 60px ${config.glowColor}, 0 0 120px ${config.glowColor}` 
          }}
        >
          <div className="text-center space-y-4">
            {/* Emoji */}
            <div 
              className={`text-6xl sm:text-8xl transition-transform duration-500 ${
                animationPhase >= 3 ? 'animate-bounce' : ''
              }`}
              style={{ 
                filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.5))',
              }}
            >
              {config.emoji}
            </div>
            
            {/* Title */}
            <h2 
              className={`text-3xl sm:text-5xl font-black ${config.textColor} uppercase tracking-wider`}
              style={{ 
                textShadow: `0 0 20px ${config.glowColor}, 0 0 40px ${config.glowColor}`,
              }}
            >
              {config.title}
            </h2>
            
            {/* Subtitle / Amount */}
            <div 
              className={`text-2xl sm:text-4xl font-bold ${config.subtitleColor} ${
                result === 'win' ? 'animate-pulse' : ''
              }`}
            >
              {config.subtitle}
            </div>
            
            {/* Decorative cards for poker theme */}
            <div className="flex justify-center gap-2 mt-4">
              {['♠', '♥', '♦', '♣'].map((suit, i) => (
                <span 
                  key={suit}
                  className={`text-2xl sm:text-3xl transition-all duration-300 ${
                    animationPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
                  style={{ 
                    transitionDelay: `${i * 100}ms`,
                    color: suit === '♥' || suit === '♦' ? '#ef4444' : '#ffffff'
                  }}
                >
                  {suit}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating coins for win */}
      {result === 'win' && animationPhase >= 3 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
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
              💰
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
