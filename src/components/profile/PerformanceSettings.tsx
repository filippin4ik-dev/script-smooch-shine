import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePerformance } from "@/hooks/usePerformance";
import { Zap, Sparkles, Circle, Image, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export const PerformanceSettings = () => {
  const { settings, isLowPerformanceMode, toggleLowPerformanceMode, updateSetting } = usePerformance();

  const settingsItems = [
    {
      key: "reducedMotion" as const,
      label: "Уменьшить анимации",
      description: "Отключает большинство анимаций",
      icon: Sparkles,
    },
    {
      key: "disableOrbs" as const,
      label: "Отключить фоновые эффекты",
      description: "Убирает светящиеся орбы на фоне",
      icon: Circle,
    },
    {
      key: "disableParticles" as const,
      label: "Отключить частицы",
      description: "Убирает эффекты частиц в играх",
      icon: Sparkles,
    },
    {
      key: "lowQualityImages" as const,
      label: "Упрощённая графика",
      description: "Использует меньше визуальных эффектов",
      icon: Image,
    },
  ];

  return (
    <Card className="glass-card border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="w-5 h-5 text-primary" />
          Производительность
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick toggle for all settings */}
        <div 
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer",
            isLowPerformanceMode 
              ? "bg-primary/10 border-primary/30" 
              : "bg-muted/30 border-white/10 hover:border-white/20"
          )}
          onClick={toggleLowPerformanceMode}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                isLowPerformanceMode ? "bg-primary/20" : "bg-muted/50"
              )}>
                <Zap className={cn(
                  "w-5 h-5 transition-colors",
                  isLowPerformanceMode ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <div className="font-semibold text-sm">Режим экономии</div>
                <div className="text-xs text-muted-foreground">
                  Оптимизация для слабых устройств
                </div>
              </div>
            </div>
            <Switch 
              checked={isLowPerformanceMode}
              onCheckedChange={toggleLowPerformanceMode}
            />
          </div>
        </div>

        {/* Individual settings */}
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-1">
            Детальные настройки
          </div>
          
          {settingsItems.map((item) => (
            <div 
              key={item.key}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-white/5"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium cursor-pointer">
                    {item.label}
                  </Label>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </div>
              <Switch
                checked={settings[item.key]}
                onCheckedChange={(checked) => updateSetting(item.key, checked)}
              />
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          💡 Включите режим экономии, если приложение работает медленно
        </div>
      </CardContent>
    </Card>
  );
};
