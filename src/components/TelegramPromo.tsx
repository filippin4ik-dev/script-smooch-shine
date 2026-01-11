import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Sparkles } from "lucide-react";

export const TelegramPromo = () => {
  return (
    <Card className="relative overflow-hidden border-none bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-transparent to-cyan-500/30 animate-pulse"></div>
      
      {/* Floating orbs */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/30 rounded-full blur-2xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/30 rounded-full blur-2xl animate-pulse delay-1000"></div>
      
      {/* Content */}
      <div className="relative p-4 flex items-center gap-4">
        {/* Icon */}
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 bg-white/30 rounded-full blur-lg animate-pulse"></div>
          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-white/90 to-white/70 flex items-center justify-center backdrop-blur-xl shadow-xl">
            <Sparkles className="w-6 h-6 text-cyan-600" />
          </div>
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-white drop-shadow-lg">
            Telegram канал
          </h3>
          <p className="text-xs text-white/90 font-medium">
            Промокоды, бонусы, новости
          </p>
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => window.open("https://t.me/casino666s", "_blank")}
          className="flex-shrink-0 bg-white hover:bg-white/90 text-cyan-600 font-bold text-sm px-4 py-2 shadow-lg transition-all hover:scale-105 border border-white/50"
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          Подписаться
        </Button>
      </div>

      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]"></div>
    </Card>
  );
};
