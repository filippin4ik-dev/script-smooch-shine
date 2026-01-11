import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Sparkles, Gift, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuffWheelRouletteProps {
  userId: string;
}

const WHEEL_ITEMS = [
  { id: "buff_x2", label: "x2", sublabel: "30 мин", color: "#22c55e", textColor: "white" },
  { id: "nothing", label: "Пусто", sublabel: "", color: "#6b7280", textColor: "white" },
  { id: "buff_x3", label: "x3", sublabel: "30 мин", color: "#3b82f6", textColor: "white" },
  { id: "debuff_x05", label: "x0.5", sublabel: "дебафф", color: "#ef4444", textColor: "white" },
  { id: "buff_x5", label: "x5", sublabel: "30 мин", color: "#a855f7", textColor: "white" },
  { id: "loses_100", label: "-100", sublabel: "побед", color: "#dc2626", textColor: "white" },
  { id: "wins_1000", label: "+1000", sublabel: "побед", color: "#eab308", textColor: "black" },
  { id: "nothing2", label: "Пусто", sublabel: "", color: "#4b5563", textColor: "white" },
];

export const BuffWheelRoulette = ({ userId }: BuffWheelRouletteProps) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [targetRotation, setTargetRotation] = useState(0);
  const queryClient = useQueryClient();

  const { data: canSpin, refetch: refetchCanSpin } = useQuery({
    queryKey: ["buff-wheel-can-spin", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_buff_wheel")
        .select("last_spin_at")
        .eq("user_id", userId)
        .order("last_spin_at", { ascending: false })
        .limit(1)
        .single();
      
      if (!data) return { canSpin: true, hoursLeft: 0, minutesLeft: 0 };
      
      const lastSpin = new Date(data.last_spin_at);
      const now = new Date();
      const hoursSince = (now.getTime() - lastSpin.getTime()) / (1000 * 60 * 60);
      
      return {
        canSpin: hoursSince >= 2,
        hoursLeft: Math.max(0, Math.floor(2 - hoursSince)),
        minutesLeft: Math.max(0, Math.floor(((2 - hoursSince) % 1) * 60))
      };
    },
    refetchInterval: 60000,
  });

  const handleSpin = async () => {
    if (isSpinning) return;
    
    // First, get the result from server
    const { data, error } = await supabase.rpc("spin_buff_wheel", {
      _user_id: userId
    });

    if (error) {
      toast.error("Ошибка: " + error.message);
      return;
    }

    const resultData = data as any;
    if (!resultData.success) {
      toast.error(resultData.message);
      return;
    }

    setIsSpinning(true);
    setResult(null);

    // Find the index of the result
    const resultType = resultData.result_type;
    let resultIndex = WHEEL_ITEMS.findIndex(item => item.id === resultType);
    if (resultIndex === -1) {
      // For "nothing" result, pick one of the "nothing" segments
      resultIndex = resultType === "nothing" ? 1 : 7;
    }

    // Calculate target angle - each segment is 45 degrees (360/8)
    const segmentAngle = 360 / WHEEL_ITEMS.length;
    // The pointer is at top (0 degrees), so we need to rotate to bring the winning segment to top
    // Segment 0 starts at -90 degrees relative to 3 o'clock position
    const segmentCenterAngle = resultIndex * segmentAngle + segmentAngle / 2;
    
    // We want the segment to land at the top (270 degrees from starting position)
    // Add multiple full rotations for effect (8-10 spins over 6 seconds)
    const fullRotations = 8 + Math.floor(Math.random() * 3);
    const finalAngle = fullRotations * 360 + (360 - segmentCenterAngle);
    
    setTargetRotation(rotation + finalAngle);

    // Wait for animation to complete (6 seconds)
    setTimeout(() => {
      setIsSpinning(false);
      setRotation(rotation + finalAngle);
      setResult(resultData);
      
      if (resultData.result_type === "wins_1000") {
        toast.success("🎉 " + resultData.message, { duration: 5000 });
      } else if (resultData.result_type === "loses_100") {
        toast.error("💀 " + resultData.message, { duration: 5000 });
      } else if (resultData.result_type.startsWith("buff")) {
        toast.success("⚡ " + resultData.message);
      } else if (resultData.result_type === "debuff_x05") {
        toast.error("😔 " + resultData.message);
      } else {
        toast.info(resultData.message);
      }

      refetchCanSpin();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-buffs"] });
    }, 6500);
  };

  const segmentAngle = 360 / WHEEL_ITEMS.length;
  const currentRotation = isSpinning ? targetRotation : rotation;

  return (
    <Card className="border-sky-400/30 bg-gradient-to-br from-sky-900/20 to-blue-950/40 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-sky-400 animate-pulse" />
          <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent font-bold">
            ❄️ Колесо Фортуны
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Крути раз в 2 часа! Выиграй баффы или дебаффы</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="grid grid-cols-4 gap-1 text-[10px]">
          {WHEEL_ITEMS.filter((item, i, arr) => !item.id.includes("2") && arr.findIndex(x => x.id === item.id) === i).map((item) => (
            <div key={item.id} className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0 shadow-lg" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground truncate">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Wheel Container */}
        <div className="relative w-full max-w-[300px] mx-auto aspect-square">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-sky-400/30 via-cyan-400/30 to-blue-400/30 rounded-full blur-xl animate-pulse" />
          
          {/* Wheel SVG */}
          <svg 
            viewBox="0 0 200 200" 
            className={cn(
              "w-full h-full drop-shadow-2xl",
              isSpinning && "drop-shadow-[0_0_30px_rgba(56,189,248,0.6)]"
            )}
            style={{
              transform: `rotate(${currentRotation}deg)`,
              transition: isSpinning 
                ? "transform 6s cubic-bezier(0.15, 0.85, 0.25, 1)" 
                : "none",
            }}
          >
            {/* Segments */}
            {WHEEL_ITEMS.map((item, index) => {
              const startAngle = index * segmentAngle - 90;
              const endAngle = startAngle + segmentAngle;
              
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              
              const x1 = 100 + 95 * Math.cos(startRad);
              const y1 = 100 + 95 * Math.sin(startRad);
              const x2 = 100 + 95 * Math.cos(endRad);
              const y2 = 100 + 95 * Math.sin(endRad);
              
              const largeArc = segmentAngle > 180 ? 1 : 0;
              
              const pathD = `M 100 100 L ${x1} ${y1} A 95 95 0 ${largeArc} 1 ${x2} ${y2} Z`;
              
              // Text position
              const midAngle = (startAngle + endAngle) / 2;
              const midRad = (midAngle * Math.PI) / 180;
              const textRadius = 55;
              const textX = 100 + textRadius * Math.cos(midRad);
              const textY = 100 + textRadius * Math.sin(midRad);
              
              return (
                <g key={index}>
                  <path
                    d={pathD}
                    fill={item.color}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="2"
                  />
                  <g transform={`rotate(${midAngle + 90}, ${textX}, ${textY})`}>
                    <text
                      x={textX}
                      y={textY - 4}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={item.textColor}
                      fontSize="14"
                      fontWeight="bold"
                      style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
                    >
                      {item.label}
                    </text>
                    {item.sublabel && (
                      <text
                        x={textX}
                        y={textY + 10}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={item.textColor}
                        fontSize="8"
                        opacity="0.9"
                        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                      >
                        {item.sublabel}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
            
            {/* Center circle */}
            <circle
              cx="100"
              cy="100"
              r="22"
              fill="url(#centerGradientWinter)"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="2"
            />
            <defs>
              <linearGradient id="centerGradientWinter" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
            </defs>
            
            {/* Center icon */}
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="16"
            >
              ❄️
            </text>
          </svg>
          
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[24px] border-l-transparent border-r-transparent border-t-sky-400 drop-shadow-lg" 
              style={{ filter: "drop-shadow(0 0 8px rgba(56,189,248,0.8))" }}
            />
          </div>
        </div>

        {/* Spin Button */}
        <div className="text-center space-y-2">
          {canSpin?.canSpin ? (
            <Button
              onClick={handleSpin}
              disabled={isSpinning}
              className="w-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-500 hover:from-sky-400 hover:via-cyan-400 hover:to-blue-400 text-white font-bold py-3 shadow-glow border border-sky-400/50"
            >
              {isSpinning ? (
                <>
                  <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                  Крутится...
                </>
              ) : (
                <>
                  <Gift className="mr-2 h-5 w-5" />
                  ❄️ Крутить колесо!
                </>
              )}
            </Button>
          ) : (
            <div className="p-3 rounded-lg bg-sky-900/20 border border-sky-400/30">
              <div className="flex items-center justify-center gap-2 text-sky-300">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  Доступно через {canSpin?.hoursLeft || 0}ч {canSpin?.minutesLeft || 0}м
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Result Display */}
        {result && (
          <div className={cn(
            "p-3 rounded-lg text-center animate-bounce-in",
            result.result_type === "wins_1000" && "bg-yellow-500/20 border border-yellow-500/50",
            result.result_type === "loses_100" && "bg-red-600/20 border border-red-600/50",
            result.result_type.startsWith("buff") && "bg-green-500/20 border border-green-500/50",
            result.result_type === "debuff_x05" && "bg-red-500/20 border border-red-500/50",
            result.result_type === "nothing" && "bg-sky-900/30 border border-sky-400/30"
          )}>
            <p className="font-bold">{result.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
