import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

interface WheelSegment {
  label: string;
  color: string;
  key: string;
}

interface GiveawayWheelProps {
  userId: string;
  giveawayId: string;
  segments: WheelSegment[];
  onComplete?: (result: string) => void;
}

export const GiveawayWheel = ({ userId, giveawayId, segments, onComplete }: GiveawayWheelProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Check if user already spun this giveaway wheel
  const { data: hasSpun, isLoading: checkingSpun } = useQuery({
    queryKey: ["giveaway-wheel-spin", giveawayId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("giveaway_wheel_spins")
        .select("id")
        .eq("giveaway_id", giveawayId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("Error checking spin:", error);
        return false;
      }
      return !!data;
    },
  });

  const fireConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FFD700", "#FFA500", "#FF4500", "#8B5CF6", "#22C55E"],
    });
  };

  const spinWheel = async () => {
    if (isSpinning || hasSpun || segments.length === 0) return;

    setIsSpinning(true);
    setResult(null);

    try {
      // Call RPC to spin the wheel
      const { data, error } = await supabase.rpc("spin_giveaway_wheel", {
        _user_id: userId,
        _giveaway_id: giveawayId,
      });

      if (error) throw error;

      if (!data?.success) {
        toast({
          title: data?.message || "Ошибка",
          variant: "destructive",
        });
        setIsSpinning(false);
        return;
      }

      const resultKey = data.result;
      const resultIndex = segments.findIndex((s) => s.key === resultKey);

      if (resultIndex === -1) {
        toast({ title: "Ошибка определения результата", variant: "destructive" });
        setIsSpinning(false);
        return;
      }

      // Calculate rotation
      const segmentAngle = 360 / segments.length;
      const targetAngle = 360 - resultIndex * segmentAngle - segmentAngle / 2;
      const spins = 5;
      const finalRotation = rotation + spins * 360 + targetAngle;

      setRotation(finalRotation);

      // Wait for animation
      setTimeout(() => {
        setIsSpinning(false);
        const resultSegment = segments[resultIndex];
        setResult(resultSegment.label);
        fireConfetti();
        toast({
          title: "🎉 Поздравляем!",
          description: `Вы выиграли: ${resultSegment.label}`,
        });
        queryClient.invalidateQueries({ queryKey: ["giveaway-wheel-spin", giveawayId, userId] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        onComplete?.(resultSegment.key);
      }, 5000);
    } catch (error: any) {
      console.error("Spin error:", error);
      toast({
        title: "Ошибка: " + error.message,
        variant: "destructive",
      });
      setIsSpinning(false);
    }
  };

  if (segments.length === 0) return null;

  const segmentAngle = 360 / segments.length;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="h-5 w-5 text-primary" />
          Колесо фортуны
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {/* Wheel */}
        <div className="relative w-64 h-64">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[24px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
          </div>

          {/* Wheel */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full border-4 border-primary/50 shadow-2xl overflow-hidden"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              background: `conic-gradient(${segments
                .map((s, i) => `${s.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`)
                .join(", ")})`,
            }}
          >
            {/* Segment labels */}
            {segments.map((segment, index) => {
              const angle = index * segmentAngle + segmentAngle / 2;
              return (
                <div
                  key={segment.key}
                  className="absolute w-full h-full flex items-center justify-end pr-4"
                  style={{
                    transform: `rotate(${angle}deg)`,
                  }}
                >
                  <span
                    className="text-xs font-bold text-white drop-shadow-md"
                    style={{
                      transform: "rotate(90deg)",
                      maxWidth: "60px",
                      textAlign: "center",
                    }}
                  >
                    {segment.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gradient-to-br from-primary to-purple-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Result or Button */}
        {result ? (
          <div className="text-center p-4 bg-primary/10 rounded-xl border border-primary/30">
            <p className="text-sm text-muted-foreground">Ваш выигрыш:</p>
            <p className="text-xl font-bold text-primary">{result}</p>
          </div>
        ) : hasSpun ? (
          <div className="text-center p-4 bg-muted/50 rounded-xl">
            <p className="text-muted-foreground">Вы уже крутили это колесо</p>
          </div>
        ) : (
          <Button
            onClick={spinWheel}
            disabled={isSpinning || checkingSpun || hasSpun}
            className="w-full max-w-xs"
            size="lg"
          >
            {isSpinning ? "Крутится..." : "🎰 Крутить колесо"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
