import { useEffect, useState } from "react";

export type ProfileBackground = "none" | "snow" | "stars" | "aurora" | "fire" | "matrix" | "gradient" | "particles";

interface AnimatedProfileBackgroundProps {
  background: ProfileBackground;
}

export const AnimatedProfileBackground = ({ background }: AnimatedProfileBackgroundProps) => {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const count = background === "snow" ? 50 : 
                  background === "stars" ? 80 :
                  background === "particles" ? 40 :
                  background === "matrix" ? 30 : 25;
    
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 5,
      delay: Math.random() * 8,
      duration: 4 + Math.random() * 8,
      opacity: 0.4 + Math.random() * 0.6,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 1,
    }));
    setParticles(newParticles);
  }, [background]);

  if (background === "none") return null;

  const renderSnow = () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-900/40 via-blue-900/30 to-cyan-950/40" />
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(147, 197, 253, 0.3) 0%, transparent 70%)",
        }}
      />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `snowfall ${p.duration}s linear infinite`,
            animationDelay: `${p.delay}s`,
            boxShadow: `0 0 ${p.size * 3}px rgba(255,255,255,0.8), 0 0 ${p.size * 6}px rgba(147,197,253,0.4)`,
            filter: "blur(0.5px)",
          }}
        />
      ))}
      {/* Дополнительные крупные снежинки */}
      {particles.slice(0, 15).map((p) => (
        <div
          key={`large-${p.id}`}
          className="absolute text-white/60"
          style={{
            left: `${(p.x + 30) % 100}%`,
            top: "-20px",
            fontSize: `${10 + p.size * 2}px`,
            animation: `snowfall ${p.duration * 1.5}s linear infinite`,
            animationDelay: `${p.delay + 2}s`,
            filter: "blur(1px)",
          }}
        >
          ❄
        </div>
      ))}
    </>
  );

  const renderStars = () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/50 via-purple-950/40 to-slate-950/50" />
      <div 
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 30% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)",
        }}
      />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: `radial-gradient(circle, rgba(255,255,255,${p.opacity}) 0%, rgba(255,255,255,0.3) 40%, transparent 70%)`,
            animation: `twinkle ${2 + p.duration * 0.4}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            boxShadow: `0 0 ${p.size * 2}px rgba(255,255,255,0.5)`,
          }}
        />
      ))}
      {/* Shooting stars */}
      <div 
        className="absolute w-20 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-60"
        style={{
          top: "20%",
          left: "-20%",
          animation: "shooting-star 4s ease-in-out infinite",
          animationDelay: "1s",
          transform: "rotate(-45deg)",
        }}
      />
      <div 
        className="absolute w-16 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-40"
        style={{
          top: "40%",
          left: "-15%",
          animation: "shooting-star 5s ease-in-out infinite",
          animationDelay: "3s",
          transform: "rotate(-45deg)",
        }}
      />
    </>
  );

  const renderAurora = () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/40 via-teal-900/30 to-cyan-950/40" />
      <div 
        className="absolute inset-0 opacity-50"
        style={{
          background: `
            linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.3) 20%, rgba(6, 182, 212, 0.4) 40%, rgba(139, 92, 246, 0.3) 60%, transparent 100%)
          `,
          animation: "aurora 6s ease-in-out infinite",
          filter: "blur(30px)",
        }}
      />
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          background: `
            linear-gradient(150deg, transparent 0%, rgba(52, 211, 153, 0.4) 25%, rgba(96, 165, 250, 0.3) 50%, rgba(167, 139, 250, 0.3) 75%, transparent 100%)
          `,
          animation: "aurora 10s ease-in-out infinite reverse",
          filter: "blur(40px)",
        }}
      />
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            linear-gradient(200deg, transparent 0%, rgba(74, 222, 128, 0.3) 30%, rgba(34, 211, 238, 0.4) 60%, transparent 100%)
          `,
          animation: "aurora 8s ease-in-out infinite",
          animationDelay: "2s",
          filter: "blur(50px)",
        }}
      />
      {/* Aurora particles */}
      {particles.slice(0, 20).map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${20 + p.y * 0.6}%`,
            width: `${p.size * 2}px`,
            height: `${p.size * 2}px`,
            background: `radial-gradient(circle, rgba(52, 211, 153, ${p.opacity * 0.5}) 0%, transparent 70%)`,
            animation: `float-particle ${p.duration * 2}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );

  const renderFire = () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-orange-950/50 via-red-900/40 to-yellow-950/30" />
      <div 
        className="absolute bottom-0 left-0 right-0 h-1/2 opacity-60"
        style={{
          background: "linear-gradient(to top, rgba(251, 146, 60, 0.5), rgba(239, 68, 68, 0.3), transparent)",
          animation: "fire-glow 2s ease-in-out infinite",
        }}
      />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            bottom: "-10px",
            width: `${p.size * 3}px`,
            height: `${p.size * 5}px`,
            background: `radial-gradient(ellipse at center bottom, rgba(251, 146, 60, ${p.opacity}) 0%, rgba(239, 68, 68, 0.6) 40%, rgba(220, 38, 38, 0.3) 70%, transparent 100%)`,
            animation: `fire-particle ${1.5 + p.duration * 0.3}s ease-out infinite`,
            animationDelay: `${p.delay * 0.3}s`,
            filter: "blur(2px)",
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
          }}
        />
      ))}
      {/* Sparks */}
      {particles.slice(0, 15).map((p) => (
        <div
          key={`spark-${p.id}`}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: "20%",
            width: `${p.size * 0.5}px`,
            height: `${p.size * 0.5}px`,
            background: "rgba(253, 224, 71, 0.9)",
            animation: `spark ${1 + p.duration * 0.2}s ease-out infinite`,
            animationDelay: `${p.delay * 0.5}s`,
            boxShadow: "0 0 4px rgba(253, 224, 71, 0.8)",
          }}
        />
      ))}
    </>
  );

  const renderMatrix = () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-green-950/40 via-emerald-950/30 to-black/60" />
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          background: "linear-gradient(0deg, transparent 24%, rgba(34, 197, 94, 0.05) 25%, rgba(34, 197, 94, 0.05) 26%, transparent 27%, transparent 74%, rgba(34, 197, 94, 0.05) 75%, rgba(34, 197, 94, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(34, 197, 94, 0.05) 25%, rgba(34, 197, 94, 0.05) 26%, transparent 27%, transparent 74%, rgba(34, 197, 94, 0.05) 75%, rgba(34, 197, 94, 0.05) 76%, transparent 77%, transparent)",
          backgroundSize: "50px 50px",
        }}
      />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute font-mono"
          style={{
            left: `${p.x}%`,
            top: "-20px",
            fontSize: `${10 + p.size * 1.5}px`,
            color: `rgba(34, 197, 94, ${p.opacity})`,
            animation: `matrix-fall ${3 + p.duration * 0.6}s linear infinite`,
            animationDelay: `${p.delay}s`,
            textShadow: "0 0 10px #22c55e, 0 0 20px #22c55e",
          }}
        >
          {String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))}
        </div>
      ))}
      {/* Secondary layer with different characters */}
      {particles.slice(0, 20).map((p) => (
        <div
          key={`secondary-${p.id}`}
          className="absolute font-mono opacity-40"
          style={{
            left: `${(p.x + 50) % 100}%`,
            top: "-20px",
            fontSize: `${8 + p.size}px`,
            color: "#4ade80",
            animation: `matrix-fall ${4 + p.duration * 0.5}s linear infinite`,
            animationDelay: `${p.delay + 1}s`,
            textShadow: "0 0 5px #22c55e",
          }}
        >
          {Math.random() > 0.5 ? String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)) : Math.floor(Math.random() * 10)}
        </div>
      ))}
    </>
  );

  const renderGradient = () => (
    <>
      <div 
        className="absolute inset-0 opacity-50"
        style={{
          background: "linear-gradient(45deg, #a855f7, #ec4899, #3b82f6, #06b6d4, #a855f7)",
          backgroundSize: "400% 400%",
          animation: "gradient-shift 8s ease infinite",
        }}
      />
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: "linear-gradient(-45deg, #06b6d4, #8b5cf6, #f43f5e, #eab308, #06b6d4)",
          backgroundSize: "400% 400%",
          animation: "gradient-shift 12s ease infinite reverse",
        }}
      />
      {/* Neon glow spots */}
      <div 
        className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.6) 0%, transparent 70%)",
          animation: "pulse-glow 3s ease-in-out infinite",
          filter: "blur(20px)",
        }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.6) 0%, transparent 70%)",
          animation: "pulse-glow 4s ease-in-out infinite",
          animationDelay: "1.5s",
          filter: "blur(25px)",
        }}
      />
    </>
  );

  const renderParticles = () => (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/40 via-slate-900/30 to-slate-950/50" />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size * 1.5}px`,
            height: `${p.size * 1.5}px`,
            background: `radial-gradient(circle, rgba(56, 189, 248, ${p.opacity}) 0%, rgba(139, 92, 246, 0.6) 50%, transparent 70%)`,
            animation: `float-particle ${4 + p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            boxShadow: `0 0 ${p.size * 2}px rgba(56, 189, 248, 0.6), 0 0 ${p.size * 4}px rgba(139, 92, 246, 0.3)`,
          }}
        />
      ))}
      {/* Connection lines effect */}
      {particles.slice(0, 10).map((p, i) => {
        const nextP = particles[(i + 1) % particles.length];
        return (
          <svg
            key={`line-${p.id}`}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
          >
            <line
              x1={`${p.x}%`}
              y1={`${p.y}%`}
              x2={`${nextP.x}%`}
              y2={`${nextP.y}%`}
              stroke="url(#particleGradient)"
              strokeWidth="0.5"
              style={{
                animation: `pulse-line ${3 + p.duration * 0.5}s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
              }}
            />
            <defs>
              <linearGradient id="particleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(56, 189, 248, 0.5)" />
                <stop offset="50%" stopColor="rgba(139, 92, 246, 0.5)" />
                <stop offset="100%" stopColor="rgba(56, 189, 248, 0.5)" />
              </linearGradient>
            </defs>
          </svg>
        );
      })}
    </>
  );

  return (
    <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes shooting-star {
          0% { transform: translateX(0) translateY(0) rotate(-45deg); opacity: 0; }
          10% { opacity: 0.8; }
          70% { opacity: 0.8; }
          100% { transform: translateX(300px) translateY(300px) rotate(-45deg); opacity: 0; }
        }
        @keyframes fire-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.7; }
        }
        @keyframes spark {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) translateX(20px) scale(0); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
        @keyframes pulse-line {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      {background === "snow" && renderSnow()}
      {background === "stars" && renderStars()}
      {background === "aurora" && renderAurora()}
      {background === "fire" && renderFire()}
      {background === "matrix" && renderMatrix()}
      {background === "gradient" && renderGradient()}
      {background === "particles" && renderParticles()}
    </div>
  );
};
