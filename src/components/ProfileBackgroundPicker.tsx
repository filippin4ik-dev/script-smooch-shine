import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, Sparkles, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ProfileBackground = 
  | "none" 
  | "snow" 
  | "stars" 
  | "aurora" 
  | "fire" 
  | "matrix" 
  | "gradient" 
  | "particles";

interface ProfileBackgroundPickerProps {
  currentBackground: ProfileBackground;
  onBackgroundChange: (background: ProfileBackground) => void;
  showSnowToggle?: boolean;
  isSnowEnabled?: boolean;
  onSnowToggle?: () => void;
}

const BACKGROUNDS: { id: ProfileBackground; name: string; preview: string; icon: string }[] = [
  { id: "none", name: "Без фона", preview: "bg-card", icon: "⬜" },
  { id: "snow", name: "Снегопад", preview: "bg-gradient-to-b from-sky-900 to-blue-950", icon: "❄️" },
  { id: "stars", name: "Звёзды", preview: "bg-gradient-to-b from-indigo-950 to-purple-950", icon: "✨" },
  { id: "aurora", name: "Северное сияние", preview: "bg-gradient-to-b from-emerald-950 via-teal-900 to-cyan-950", icon: "🌌" },
  { id: "fire", name: "Огонь", preview: "bg-gradient-to-b from-orange-950 via-red-900 to-yellow-950", icon: "🔥" },
  { id: "matrix", name: "Матрица", preview: "bg-gradient-to-b from-green-950 to-black", icon: "💚" },
  { id: "gradient", name: "Неон", preview: "bg-gradient-to-br from-purple-900 via-pink-900 to-blue-900", icon: "🌈" },
  { id: "particles", name: "Частицы", preview: "bg-gradient-to-b from-gray-900 to-slate-950", icon: "⚡" },
];

export const ProfileBackgroundPicker = ({ 
  currentBackground, 
  onBackgroundChange,
  showSnowToggle = false,
  isSnowEnabled = true,
  onSnowToggle
}: ProfileBackgroundPickerProps) => {
  return (
    <Card className="border-sky-400/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-400" />
            <span className="bg-gradient-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">
              Анимированный фон профиля
            </span>
          </div>
          {showSnowToggle && (
            <Button
              variant={isSnowEnabled ? "default" : "outline"}
              size="sm"
              onClick={onSnowToggle}
              className={cn(
                "gap-1.5 text-xs",
                isSnowEnabled 
                  ? "bg-sky-500 hover:bg-sky-600 text-white" 
                  : "border-sky-400/50 text-sky-400 hover:bg-sky-400/10"
              )}
            >
              <Snowflake className="h-3.5 w-3.5" />
              {isSnowEnabled ? "Снег вкл" : "Снег выкл"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              onClick={() => onBackgroundChange(bg.id)}
              className={cn(
                "relative aspect-square rounded-lg transition-all duration-300 flex flex-col items-center justify-center gap-1 p-2",
                bg.preview,
                currentBackground === bg.id 
                  ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-background scale-105" 
                  : "hover:scale-105 hover:ring-1 hover:ring-sky-400/50"
              )}
            >
              <span className="text-xl">{bg.icon}</span>
              <span className="text-[9px] text-white/90 font-medium text-center leading-tight">
                {bg.name}
              </span>
              {currentBackground === bg.id && (
                <div className="absolute top-1 right-1 bg-sky-400 rounded-full p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
