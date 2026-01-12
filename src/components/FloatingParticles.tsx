import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
  type: 'circle' | 'star' | 'diamond';
}

interface FloatingParticlesProps {
  count?: number;
  className?: string;
}

export const FloatingParticles = ({ count = 30, className }: FloatingParticlesProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = [
      'bg-primary/20',
      'bg-secondary/20', 
      'bg-amber-500/15',
      'bg-purple-500/15',
      'bg-pink-500/15',
      'bg-blue-500/15',
    ];

    const types: Particle['type'][] = ['circle', 'star', 'diamond'];

    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 4 + Math.random() * 12,
      duration: 15 + Math.random() * 25,
      delay: Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: types[Math.floor(Math.random() * types.length)],
    }));

    setParticles(newParticles);
  }, [count]);

  const renderParticle = (particle: Particle) => {
    const baseStyle = {
      left: `${particle.x}%`,
      top: `${particle.y}%`,
      width: `${particle.size}px`,
      height: `${particle.size}px`,
      animationDuration: `${particle.duration}s`,
      animationDelay: `${particle.delay}s`,
    };

    switch (particle.type) {
      case 'star':
        return (
          <div
            key={particle.id}
            className={cn(
              "absolute animate-float-slow opacity-60",
              particle.color
            )}
            style={{
              ...baseStyle,
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
            }}
          />
        );
      case 'diamond':
        return (
          <div
            key={particle.id}
            className={cn(
              "absolute rotate-45 animate-float-slow opacity-50",
              particle.color
            )}
            style={baseStyle}
          />
        );
      default:
        return (
          <div
            key={particle.id}
            className={cn(
              "absolute rounded-full animate-float-slow opacity-40 blur-[1px]",
              particle.color
            )}
            style={baseStyle}
          />
        );
    }
  };

  return (
    <div className={cn("fixed inset-0 pointer-events-none overflow-hidden z-0", className)}>
      {particles.map(renderParticle)}
      
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/50" />
    </div>
  );
};
