import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Gift } from "lucide-react";

interface GameCardProps {
  icon?: string;
  image?: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  status?: "active" | "maintenance";
  showFreebetProgress?: boolean;
  wagerProgress?: number;
  wagerRequirement?: number;
}

export const GameCard = ({ 
  icon, 
  image, 
  title, 
  description, 
  onClick, 
  disabled, 
  status,
  showFreebetProgress = false,
  wagerProgress = 0,
  wagerRequirement = 0
}: GameCardProps) => {
  const isDisabled = disabled || status === "maintenance";
  
  const progressPercentage = wagerRequirement > 0 
    ? Math.min((wagerProgress / wagerRequirement) * 100, 100) 
    : 0;

  const gradients = {
    blue: "from-blue-500/20 via-blue-500/10 to-transparent",
    green: "from-green-500/20 via-green-500/10 to-transparent", 
    purple: "from-purple-500/20 via-purple-500/10 to-transparent",
  };
  
  const borderColors = {
    blue: "border-blue-500/30 hover:border-blue-500",
    green: "border-green-500/30 hover:border-green-500",
    purple: "border-purple-500/30 hover:border-purple-500",
  };

  const glowColors = {
    blue: "shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)]",
    green: "shadow-[0_0_30px_rgba(34,197,94,0.2)] hover:shadow-[0_0_50px_rgba(34,197,94,0.5)]",
    purple: "shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:shadow-[0_0_50px_rgba(168,85,247,0.5)]",
  };

  // Выбираем цвет на основе заголовка
  const colorScheme = title.length % 3 === 0 ? 'blue' : title.length % 3 === 1 ? 'green' : 'purple';

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer transition-all duration-500",
        "bg-gradient-to-br from-card/95 to-background/95 backdrop-blur-md",
        "border-2 rounded-2xl",
        borderColors[colorScheme],
        glowColors[colorScheme],
        "hover:-translate-y-2 hover:scale-[1.02]",
        status === "maintenance" && "opacity-70"
      )}
      onClick={onClick}
    >
      {/* Gradient overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-40 group-hover:opacity-60 transition-opacity duration-500",
        gradients[colorScheme]
      )}></div>

      {/* Shimmer border effect */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
      </div>

      <div className="relative h-full flex flex-col z-10">
        {/* Image container */}
        <div className="relative w-full aspect-square overflow-hidden rounded-t-2xl">
          {image ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-70 z-10"></div>
              <img 
                src={image} 
                alt={title}
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
              />
              {/* Corner accents */}
              <div className={cn(
                "absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-500",
                colorScheme === 'blue' && "bg-blue-500/50",
                colorScheme === 'green' && "bg-green-500/50",
                colorScheme === 'purple' && "bg-purple-500/50"
              )}></div>
            </>
          ) : (
            <div className={cn(
              "relative w-full h-full flex items-center justify-center bg-gradient-to-br",
              gradients[colorScheme]
            )}>
              <div className="relative text-7xl sm:text-8xl transition-all duration-500 group-hover:scale-110 animate-float drop-shadow-2xl">
                {icon}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="relative p-4 space-y-2 flex-1 flex flex-col justify-between">
          <div>
            <h3 className={cn(
              "text-lg sm:text-xl font-black transition-all duration-300",
              colorScheme === 'blue' && "text-blue-400 group-hover:text-blue-300",
              colorScheme === 'green' && "text-green-400 group-hover:text-green-300",
              colorScheme === 'purple' && "text-purple-400 group-hover:text-purple-300"
            )}>
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors duration-300">
              {description}
            </p>
          </div>
          
          {/* Freebet Progress Bar */}
          {showFreebetProgress && wagerRequirement > 0 && (
            <div className="space-y-1 pt-2 border-t border-primary/20">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <Gift className="w-3 h-3 text-primary" />
                  <span className="text-muted-foreground">Отыгрыш</span>
                </div>
                <span className="font-bold text-primary">
                  {progressPercentage.toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={progressPercentage} 
                className="h-1.5"
              />
            </div>
          )}
        </div>

        {status === "maintenance" && (
          <Badge variant="destructive" className="absolute top-3 right-3 text-xs shadow-lg animate-pulse backdrop-blur-sm">
            Тех. перерыв
          </Badge>
        )}
      </div>

      {/* Bottom accent line */}
      {!isDisabled && (
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          colorScheme === 'blue' && "bg-gradient-to-r from-transparent via-blue-500 to-transparent",
          colorScheme === 'green' && "bg-gradient-to-r from-transparent via-green-500 to-transparent",
          colorScheme === 'purple' && "bg-gradient-to-r from-transparent via-purple-500 to-transparent"
        )}></div>
      )}
    </Card>
  );
};
