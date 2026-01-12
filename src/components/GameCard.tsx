import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Gift, Sparkles } from "lucide-react";

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

  return (
    <Card
      className={cn(
        "group relative overflow-hidden cursor-pointer",
        "glass-card rounded-2xl",
        "transition-all duration-500 ease-out",
        "hover:-translate-y-2 hover:scale-[1.02]",
        "hover:shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_30px_hsl(45_100%_51%/0.15)]",
        "border border-white/5 hover:border-primary/30",
        status === "maintenance" && "opacity-60 grayscale"
      )}
      onClick={onClick}
    >
      {/* Gradient border overlay */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-secondary/20" />
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>

      <div className="relative h-full flex flex-col z-10">
        {/* Image container */}
        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-t-2xl">
          {image ? (
            <>
              {/* Dark overlay for better text contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent z-10" />
              
              {/* Main image */}
              <img 
                src={image} 
                alt={title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
              />
              
              {/* Top glow effect */}
              <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
              
              {/* Sparkle indicator */}
              <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                <div className="w-8 h-8 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
              </div>
            </>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-background">
              <div className="relative text-6xl sm:text-7xl transition-all duration-500 group-hover:scale-110 animate-float drop-shadow-2xl">
                {icon}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="relative p-4 space-y-2 flex-1 flex flex-col justify-between bg-gradient-to-t from-background/80 to-transparent">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-1">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 group-hover:text-foreground/70 transition-colors duration-300">
              {description}
            </p>
          </div>
          
          {/* Freebet Progress Bar */}
          {showFreebetProgress && wagerRequirement > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-primary" />
                  <span className="text-muted-foreground font-medium">Отыгрыш</span>
                </div>
                <span className="font-bold text-primary text-glow-gold">
                  {progressPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="relative h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Maintenance badge */}
        {status === "maintenance" && (
          <Badge 
            variant="destructive" 
            className="absolute top-3 left-3 text-xs shadow-lg animate-pulse backdrop-blur-md bg-destructive/80 border border-destructive/50"
          >
            🔧 Тех. перерыв
          </Badge>
        )}
      </div>

      {/* Bottom accent line */}
      {!isDisabled && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
    </Card>
  );
};
