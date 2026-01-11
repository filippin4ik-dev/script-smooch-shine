import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Sparkles, TrendingUp } from "lucide-react";

export const PromoBanner = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: Gift,
      title: "Колесо фортуны",
      description: "Крутите и выигрывайте до 10000₽",
      bgGradient: "from-emerald-500/20 via-green-500/10 to-lime-500/20",
      borderColor: "border-emerald-500/40",
      iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
      titleColor: "text-emerald-400",
      glowColor: "shadow-[0_0_20px_rgba(16,185,129,0.3)]",
    },
    {
      icon: Sparkles,
      title: "Ежедневные фриспины",
      description: "1-5 фриспинов каждый день",
      bgGradient: "from-purple-500/20 via-pink-500/10 to-fuchsia-500/20",
      borderColor: "border-purple-500/40",
      iconBg: "bg-gradient-to-br from-purple-500 to-pink-600",
      titleColor: "text-purple-400",
      glowColor: "shadow-[0_0_20px_rgba(168,85,247,0.3)]",
    },
    {
      icon: TrendingUp,
      title: "Кешбэк 20%",
      description: "Возврат от проигрышей еженедельно",
      bgGradient: "from-amber-500/20 via-yellow-500/10 to-orange-500/20",
      borderColor: "border-amber-500/40",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
      titleColor: "text-amber-400",
      glowColor: "shadow-[0_0_20px_rgba(245,158,11,0.3)]",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, index) => {
          const IconComponent = slide.icon;
          return (
            <div key={index} className="min-w-full px-1">
              <Card className={`relative overflow-hidden bg-card/80 backdrop-blur-xl border-2 ${slide.borderColor} ${slide.glowColor} transition-all duration-300 h-full`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient} animate-pulse`}></div>
                
                <div className="relative p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-14 h-14 rounded-xl ${slide.iconBg} flex items-center justify-center shadow-lg flex-shrink-0 animate-float`}>
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-xl sm:text-2xl font-black ${slide.titleColor} mb-1 drop-shadow-lg truncate`}>
                          {slide.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                          {slide.description}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => navigate("/rewards")}
                      className={`${slide.iconBg} hover:scale-105 transition-all whitespace-nowrap px-4 sm:px-6 h-10 font-bold shadow-lg hover:shadow-xl text-white border-0 flex-shrink-0`}
                    >
                      Получить
                    </Button>
                  </div>
                </div>

                {/* Animated border shimmer */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
                  <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer`}></div>
                  <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer`} style={{ animationDelay: "1s" }}></div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Slide indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {slides.map((slide, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentSlide 
                ? `w-8 ${slide.iconBg} ${slide.glowColor}` 
                : "w-2 bg-muted/50 hover:bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};