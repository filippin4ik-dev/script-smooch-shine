import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";

interface BonusWheelProps {
  userId: string;
  wheelId?: string;
  isRegistrationWheel?: boolean;
  onComplete?: () => void;
}

// Сегменты должны совпадать с RPC функцией spin_registration_wheel
const WHEEL_SEGMENTS = [
  { label: "5₽", color: "#3b82f6", key: "5₽ на баланс" },
  { label: "15₽", color: "#8b5cf6", key: "15₽ на баланс" },
  { label: "25₽", color: "#ec4899", key: "25₽ на баланс" },
  { label: "50₽", color: "#f97316", key: "50₽ на баланс" },
  { label: "100₽", color: "#22c55e", key: "100₽ на баланс" },
  { label: "100₽ ставки", color: "#06b6d4", key: "100₽ фрибет на ставки" },
  { label: "500₽ ставки", color: "#a855f7", key: "500₽ фрибет на ставки" },
  { label: "50 спинов", color: "#eab308", key: "50 фриспинов" },
  { label: "500₽ казино", color: "#ef4444", key: "500₽ фрибет казино" },
  { label: "1000₽ казино", color: "#14b8a6", key: "1000₽ фрибет казино" },
  { label: "10000₽", color: "#ffd700", key: "10000₽ ДЖЕКПОТ!" },
];

const SEGMENT_COUNT = WHEEL_SEGMENTS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

export const BonusWheel = ({ userId, wheelId, isRegistrationWheel = false, onComplete }: BonusWheelProps) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ reward_description: string; reward_amount: number } | null>(null);
  const queryClient = useQueryClient();
  const wheelRef = useRef<HTMLDivElement>(null);

  const findSegmentIndex = (description: string): number => {
    const idx = WHEEL_SEGMENTS.findIndex((s) => s.key === description);
    return idx >= 0 ? idx : 0;
  };

  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const spinWheel = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setResult(null);

    try {
      let data, error;

      if (isRegistrationWheel) {
        const response = await supabase.rpc("spin_registration_wheel", { _user_id: userId });
        data = response.data;
        error = response.error;
      } else if (wheelId) {
        const response = await supabase.rpc("spin_bonus_wheel", { _user_id: userId, _wheel_id: wheelId });
        data = response.data;
        error = response.error;
      }

      if (error) throw error;

      const resultData = data?.[0];
      if (!resultData?.success) {
        toast.error(resultData?.message || "Ошибка");
        setIsSpinning(false);
        return;
      }

      const winningIndex = findSegmentIndex(resultData.reward_description);
      
      // Стрелка указывает вниз на элемент сверху колеса (12 часов)
      // conic-gradient начинается справа (3 часа) и идёт по часовой стрелке
      // Чтобы сегмент N оказался сверху, нужно повернуть колесо:
      // - Сегмент 0 начинается на 0° (справа, 3 часа)
      // - Чтобы центр сегмента оказался сверху (270°), нужно повернуть на:
      //   270° - (N * SEGMENT_ANGLE + SEGMENT_ANGLE/2)
      
      const segmentCenterFromStart = winningIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
      // Нам нужно, чтобы этот угол оказался на позиции стрелки (сверху = -90° или 270°)
      // Вращение колеса по часовой стрелке = положительный угол
      // targetAngle = -(segmentCenterFromStart - 270) = 270 - segmentCenterFromStart
      // Но поскольку conic-gradient от 0deg справа и идёт clockwise:
      // Для попадания стрелки (сверху) на центр сегмента:
      const targetAngle = (90 - segmentCenterFromStart + 360) % 360;
      
      // 5-8 полных оборотов + точный угол
      const spins = 5 + Math.floor(Math.random() * 3);
      const baseRotation = rotation % 360; // Нормализуем текущий угол
      const finalRotation = spins * 360 + targetAngle;
      
      setRotation(finalRotation);

      setTimeout(() => {
        setResult({ reward_description: resultData.reward_description, reward_amount: resultData.reward_amount });
        fireConfetti();
        toast.success(`🎉 ${resultData.reward_description}`);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["bonus-wheels"] });
        queryClient.invalidateQueries({ queryKey: ["registration-wheel"] });
        setIsSpinning(false);
        onComplete?.();
      }, 5000);

    } catch (err) {
      console.error(err);
      toast.error("Ошибка прокрутки колеса");
      setIsSpinning(false);
    }
  };

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-purple-900/50 via-pink-900/30 to-orange-900/50 border border-primary/30 p-6">
      <div className="text-center mb-4">
        <h3 className="text-2xl font-black text-primary mb-1">
          {isRegistrationWheel ? "🎡 Колесо регистрации" : "🎡 Бонусное колесо"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isRegistrationWheel ? "Крутите один раз!" : "Подарок от администрации!"}
        </p>
      </div>

      <div className="relative flex justify-center items-center mb-6">
        {/* Стрелка сверху */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
          <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
        </div>

        {/* Колесо */}
        <div
          ref={wheelRef}
          className="relative w-64 h-64 rounded-full shadow-2xl"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? "transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
            background: `conic-gradient(
              from 0deg,
              ${WHEEL_SEGMENTS.map((s, i) => 
                `${s.color} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`
              ).join(", ")}
            )`,
          }}
        >
          {/* Сегменты с текстом */}
          {WHEEL_SEGMENTS.map((segment, index) => (
            <div
              key={index}
              className="absolute w-full h-full flex items-center justify-start"
              style={{
                transform: `rotate(${index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2}deg)`,
              }}
            >
              <span
                className="text-[9px] font-bold text-white drop-shadow-lg pl-4"
                style={{
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                {segment.label}
              </span>
            </div>
          ))}

          {/* Центр колеса */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg flex items-center justify-center border-4 border-yellow-300">
            <span className="text-2xl">🎰</span>
          </div>
        </div>
      </div>

      {result && (
        <div className="text-center mb-4 p-4 bg-green-500/20 rounded-lg border border-green-500/50 animate-pulse">
          <p className="text-lg font-bold text-green-400">🎉 Поздравляем!</p>
          <p className="text-xl font-black text-white">{result.reward_description}</p>
        </div>
      )}

      <Button
        onClick={spinWheel}
        disabled={isSpinning || (isRegistrationWheel && !!result)}
        className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:opacity-90 text-white font-bold text-lg py-6"
      >
        {isSpinning ? "🎡 Крутится..." : result ? "✅ Получено!" : "🎰 Крутить колесо!"}
      </Button>
    </Card>
  );
};