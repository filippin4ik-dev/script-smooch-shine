import { cn } from "@/lib/utils";

interface CardProps {
  value: string;
  suit: string;
  hidden?: boolean;
  delay?: number;
}

export const BlackjackCard = ({ value, suit, hidden = false, delay = 0 }: CardProps) => {
  const isRed = suit === "♥️" || suit === "♦️";
  
  if (hidden) {
    return (
      <div 
        className="relative w-20 h-28 rounded-lg shadow-xl animate-card-deal"
        style={{ 
          animationDelay: `${delay}ms`,
          background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1e3a8a 100%)",
        }}
      >
        <div className="absolute inset-1 border-2 border-white/20 rounded-lg">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid grid-cols-4 gap-1 p-2">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-white/30 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "relative w-20 h-28 bg-white rounded-lg shadow-2xl border-2 border-gray-200",
        "animate-card-deal hover:scale-105 transition-transform duration-200",
        "hover:shadow-[0_0_20px_rgba(255,215,0,0.5)]"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top left corner */}
      <div className={cn(
        "absolute top-1 left-1 flex flex-col items-center text-xs font-bold leading-none",
        isRed ? "text-red-600" : "text-gray-900"
      )}>
        <div className="text-base">{value}</div>
        <div className="text-lg">{suit}</div>
      </div>

      {/* Center suit */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center text-4xl",
        isRed ? "text-red-600" : "text-gray-900"
      )}>
        {suit}
      </div>

      {/* Bottom right corner (rotated) */}
      <div className={cn(
        "absolute bottom-1 right-1 flex flex-col items-center text-xs font-bold leading-none rotate-180",
        isRed ? "text-red-600" : "text-gray-900"
      )}>
        <div className="text-base">{value}</div>
        <div className="text-lg">{suit}</div>
      </div>

      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent rounded-lg opacity-50" />
    </div>
  );
};
