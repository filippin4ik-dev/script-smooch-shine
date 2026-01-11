import { Button } from "@/components/ui/button";
import { GRADIENT_COLORS, GradientColor } from "./VipUsername";
import { cn } from "@/lib/utils";

interface GradientColorPickerProps {
  currentColor: GradientColor;
  onColorChange: (color: GradientColor) => void;
  disabled?: boolean;
}

const COLOR_LABELS: Record<GradientColor, string> = {
  gold: "Золото",
  purple: "Фиолетовый",
  blue: "Синий",
  green: "Зеленый",
  red: "Красный",
  rainbow: "Радуга",
  neon: "Неон",
  sunset: "Закат",
  ocean: "Океан",
  fire: "Огонь",
  ice: "Лёд",
  electric: "Электро",
  cosmic: "Космос",
  cherry: "Вишня",
  mint: "Мята",
  lavender: "Лаванда",
};

export const GradientColorPicker = ({ 
  currentColor, 
  onColorChange, 
  disabled 
}: GradientColorPickerProps) => {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Цвет никнейма</div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(GRADIENT_COLORS) as GradientColor[]).map((color) => (
          <Button
            key={color}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onColorChange(color)}
            className={cn(
              "h-10 relative overflow-hidden transition-all",
              currentColor === color && "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
          >
            <span 
              className={cn(
                "absolute inset-0 bg-gradient-to-r animate-gradient-shift bg-[length:200%_auto]",
                GRADIENT_COLORS[color]
              )}
            />
            <span className="relative text-white font-medium text-xs drop-shadow-md">
              {COLOR_LABELS[color]}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
};
