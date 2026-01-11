import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSpamProtection } from "@/hooks/useSpamProtection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Sword, Shield, Crosshair, Crown, Star, Gem, Trophy, Sparkles, Eye, Target, ArrowLeft } from "lucide-react";
import { useFreebetMode } from "@/hooks/useFreebetMode";
import { useBalanceMode } from "@/hooks/useBalanceMode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SkinImage } from "@/components/SkinImage";

interface CasesGameProps {
  userId: string;
  balance: number;
  onBalanceUpdate: () => void;
}

type Rarity = "consumer" | "industrial" | "mil-spec" | "milspec" | "restricted" | "classified" | "covert" | "rare" | "exotic" | "contraband";

interface CaseItem {
  id: string;
  name: string;
  weapon: string;
  rarity: Rarity;
  price: number;
  chance: number;
  image_url?: string | null;
  skin_id?: string | null;
}

interface CaseType {
  id: string;
  name: string;
  price: number;
  icon: string;
  color: string;
  is_active: boolean;
  items?: CaseItem[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Package: <Package className="h-8 w-8" />,
  Crosshair: <Crosshair className="h-8 w-8" />,
  Shield: <Shield className="h-8 w-8" />,
  Star: <Star className="h-8 w-8" />,
  Gem: <Gem className="h-8 w-8" />,
  Crown: <Crown className="h-8 w-8" />,
  Sword: <Sword className="h-8 w-8" />,
  Trophy: <Trophy className="h-8 w-8" />,
  Sparkles: <Sparkles className="h-8 w-8" />,
  Target: <Target className="h-8 w-8" />,
  Coins: <Gem className="h-8 w-8" />,
  Box: <Package className="h-8 w-8" />,
};

const RARITY_COLORS: Record<Rarity, string> = {
  consumer: "text-gray-400",
  industrial: "text-sky-400",
  "mil-spec": "text-blue-400",
  milspec: "text-blue-400",
  restricted: "text-purple-400",
  classified: "text-pink-400",
  covert: "text-red-400",
  rare: "text-yellow-400",
  exotic: "text-yellow-400",
  contraband: "text-orange-400",
};

const RARITY_BG: Record<Rarity, string> = {
  consumer: "bg-gray-500/20 border-gray-500/50",
  industrial: "bg-sky-500/20 border-sky-500/50",
  "mil-spec": "bg-blue-500/20 border-blue-500/50",
  milspec: "bg-blue-500/20 border-blue-500/50",
  restricted: "bg-purple-500/20 border-purple-500/50",
  classified: "bg-pink-500/20 border-pink-500/50",
  covert: "bg-red-500/20 border-red-500/50",
  rare: "bg-yellow-500/20 border-yellow-500/50",
  exotic: "bg-yellow-500/20 border-yellow-500/50",
  contraband: "bg-orange-500/20 border-orange-500/50",
};

const RARITY_NAMES: Record<Rarity, string> = {
  consumer: "Ширпотреб",
  industrial: "Промышленное",
  "mil-spec": "Армейское",
  milspec: "Армейское",
  restricted: "Запрещённое",
  classified: "Засекреченное",
  covert: "Тайное",
  rare: "Редкое★",
  exotic: "Экзотическое★",
  contraband: "Контрабанда★",
};

const formatPrice = (price: number): string => {
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(price >= 10000000 ? 0 : 1)}кк`;
  }
  if (price >= 1000) {
    return `${(price / 1000).toFixed(price >= 10000 ? 0 : 1)}K`;
  }
  return price.toString();
};

export const CasesGame = ({ userId, balance, onBalanceUpdate }: CasesGameProps) => {
  const [selectedCase, setSelectedCase] = useState<CaseType | null>(null);
  const [readyToSpin, setReadyToSpin] = useState(false);
  const [opening, setOpening] = useState(false);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [rouletteItems, setRouletteItems] = useState<CaseItem[]>([]);
  const [roulettePosition, setRoulettePosition] = useState(0);
  const [previewCase, setPreviewCase] = useState<CaseType | null>(null);
  const [lastGameNumber, setLastGameNumber] = useState<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const { canAct } = useSpamProtection();
  const { useFreebet } = useFreebetMode();
  const { mode } = useBalanceMode();

  // Загружаем кейсы из базы данных
  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ["case-types"],
    queryFn: async () => {
      const { data: caseTypes, error } = await supabase
        .from("case_types")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      return caseTypes as CaseType[];
    },
  });

  // Загружаем предметы для выбранного кейса
  const { data: caseItems } = useQuery({
    queryKey: ["case-items", previewCase?.id || selectedCase?.id],
    queryFn: async () => {
      const caseId = previewCase?.id || selectedCase?.id;
      if (!caseId) return [];
      
      const { data, error } = await supabase
        .from("case_items")
        .select("*")
        .eq("case_type_id", caseId)
        .order("chance", { ascending: false });

      if (error) throw error;
      return data as CaseItem[];
    },
    enabled: !!(previewCase?.id || selectedCase?.id),
  });

  // Очистка анимации
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Генерация случайного предмета по шансам (для визуальной рулетки)
  const getRandomItemByChance = (items: CaseItem[]): CaseItem => {
    const random = Math.random() * 100;
    let cumulative = 0;
    for (const item of items) {
      cumulative += item.chance;
      if (random <= cumulative) return item;
    }
    return items[0];
  };

  const selectCase = (caseType: CaseType) => {
    setSelectedCase(caseType);
    setReadyToSpin(true);
    setWonItem(null);
  };

  const spinCase = async () => {
    if (!selectedCase || !canAct()) return;

    // Загружаем предметы именно этого кейса для визуальной рулетки
    const { data: itemsForCase, error: itemsError } = await supabase
      .from("case_items")
      .select("*")
      .eq("case_type_id", selectedCase.id)
      .order("chance", { ascending: false });

    if (itemsError) {
      toast.error("Не удалось загрузить предметы кейса");
      return;
    }

    if (!itemsForCase || itemsForCase.length === 0) {
      toast.error("Кейс пуст");
      return;
    }

    let availableBalance = balance;
    const useDemo = mode === "demo";

    if (useDemo) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("demo_balance")
        .eq("id", userId)
        .single();

      if (profileError) {
        toast.error("Не удалось проверить демо баланс");
        return;
      }
      availableBalance = profile?.demo_balance || 0;
    } else if (useFreebet) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("freebet_balance")
        .eq("id", userId)
        .single();

      if (profileError) {
        toast.error("Не удалось проверить фрибет баланс");
        return;
      }
      availableBalance = profile?.freebet_balance || 0;
    }

    if (availableBalance < selectedCase.price) {
      toast.error(useDemo ? "Недостаточно демо баланса" : useFreebet ? "Недостаточно фрибет баланса" : "Недостаточно средств");
      return;
    }

    setOpening(true);
    setReadyToSpin(false);
    setWonItem(null);

    // Вызываем серверную функцию для определения выигрыша
    const { data, error } = await supabase.rpc("open_case", {
      _user_id: userId,
      _case_type_id: selectedCase.id,
      _use_freebet: useFreebet && mode !== "demo",
      _use_demo: mode === "demo",
    });

    if (error || !data) {
      toast.error(error?.message || "Ошибка открытия кейса");
      setOpening(false);
      return;
    }

    const response = data as { success: boolean; item?: CaseItem; game_number?: number; message?: string };

    if (!response.success) {
      toast.error(response.message || "Ошибка открытия кейса");
      setOpening(false);
      return;
    }

    const serverWinItem = response.item as CaseItem;
    if (response.game_number) {
      setLastGameNumber(response.game_number);
    }

    // Создаем рулетку из 60 предметов
    const items: CaseItem[] = [];
    for (let i = 0; i < 60; i++) {
      items.push(getRandomItemByChance(itemsForCase as CaseItem[]));
    }

    // КРИТИЧНО: Выигрышный предмет ТОЧНО в позиции 52
    items[52] = { ...serverWinItem };

    setRouletteItems(items);
    setRoulettePosition(0);

    // Анимация прокрутки - 6 секунд
    const itemWidth = 114;
    const targetPosition = 52 * itemWidth + 57 + (Math.random() * 20 - 10);
    const duration = 6000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Плавное замедление
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const currentPosition = easeOut * targetPosition;

      setRoulettePosition(currentPosition);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Показываем ТОЧНО тот предмет который сервер определил
        setWonItem(serverWinItem);
        onBalanceUpdate();
        toast.success(`🎉 Выпал ${serverWinItem.weapon} | ${serverWinItem.name}!`);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const resetCase = () => {
    setOpening(false);
    setWonItem(null);
    setSelectedCase(null);
    setReadyToSpin(false);
    setRouletteItems([]);
    setRoulettePosition(0);
  };

  const goBack = () => {
    setSelectedCase(null);
    setReadyToSpin(false);
    setWonItem(null);
  };

  if (casesLoading) {
    return (
      <Card className="border-primary/30 bg-gradient-card">
        <CardContent className="py-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка кейсов...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-card overflow-hidden">
      <CardHeader>
        <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
          {lastGameNumber && (
            <span className="text-sm font-mono bg-primary/20 px-2 py-1 rounded text-primary">
              #{lastGameNumber}
            </span>
          )}
          <Package className="h-6 w-6 text-primary" />
          Кейсы
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Рулетка при открытии */}
        {opening && rouletteItems.length > 0 && (
          <div className="relative">
            {/* Указатель */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-10">
              <div className="w-0.5 h-32 bg-yellow-400 shadow-lg" />
              <div className="w-4 h-4 bg-yellow-400 rotate-45 -mt-2 ml-[-7px]" />
            </div>
            
            {/* Лента рулетки */}
            <div className="overflow-hidden rounded-lg border-2 border-primary/50 bg-background/80">
              <div 
                className="flex gap-1 py-4"
                style={{ 
                  transform: `translateX(calc(50% - ${roulettePosition}px - 55px))`,
                  transition: 'none'
                }}
              >
                {rouletteItems.map((item, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "flex-shrink-0 w-[110px] p-2 rounded-lg border-2 transition-all",
                      RARITY_BG[item.rarity as Rarity],
                      index === 52 && wonItem && "ring-2 ring-yellow-400 scale-105"
                    )}
                  >
                    <SkinImage 
                      src={item.image_url}
                      className="h-16 w-full mb-1"
                      fallbackIcon={<Package className="h-8 w-8 text-muted-foreground" />}
                      skinName={item.name}
                      weaponName={item.weapon}
                    />
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground truncate">{item.weapon}</div>
                      <div className={cn("text-xs font-medium truncate", RARITY_COLORS[item.rarity as Rarity])}>
                        {item.name}
                      </div>
                      <div className="text-xs font-bold text-primary">{formatPrice(item.price)}₽</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Выигранный предмет */}
        {wonItem && (
          <div className="animate-scale-in">
            <div className={cn(
              "p-6 rounded-xl border-2 text-center",
              RARITY_BG[wonItem.rarity as Rarity]
            )}>
              <div className="text-4xl mb-2">🎉</div>
              <SkinImage 
                src={wonItem.image_url}
                className="h-24 w-full mb-2"
                fallbackIcon={<Package className="h-16 w-16" />}
                skinName={wonItem.name}
                weaponName={wonItem.weapon}
              />
              <div className="text-sm text-muted-foreground">{wonItem.weapon}</div>
              <div className={cn("text-xl font-bold", RARITY_COLORS[wonItem.rarity as Rarity])}>
                {wonItem.name}
              </div>
              <Badge className={cn("mt-2", RARITY_BG[wonItem.rarity as Rarity])}>
                {RARITY_NAMES[wonItem.rarity as Rarity]}
              </Badge>
              <div className="text-2xl font-bold text-primary mt-2">{formatPrice(wonItem.price)}₽</div>
              <Button onClick={resetCase} className="mt-4 w-full">
                Открыть ещё
              </Button>
            </div>
          </div>
        )}

        {/* Экран готовности к спину */}
        {readyToSpin && selectedCase && !opening && !wonItem && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={goBack} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к кейсам
            </Button>
            
            <div className={cn(
              "p-6 rounded-xl border-2 bg-gradient-to-br text-center",
              selectedCase.color
            )}>
              <div className="flex justify-center mb-4 text-primary">
                {ICON_MAP[selectedCase.icon] || <Package className="h-8 w-8" />}
              </div>
              <h3 className="text-xl font-bold mb-2">{selectedCase.name}</h3>
              <div className="text-2xl font-bold text-primary mb-4">{formatPrice(selectedCase.price)}₽</div>
              
              {/* Желтая кнопка КРУТИТЬ */}
              <Button 
                onClick={spinCase}
                disabled={balance < selectedCase.price && !useFreebet}
                className="w-full h-14 text-xl font-bold bg-yellow-500 hover:bg-yellow-400 text-black"
              >
                🎰 КРУТИТЬ
              </Button>
              
              {balance < selectedCase.price && !useFreebet && (
                <p className="text-red-400 text-sm mt-2">Недостаточно средств</p>
              )}
            </div>

            {/* Содержимое кейса */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm">Содержимое:</h4>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {caseItems?.map((item, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border",
                      RARITY_BG[item.rarity as Rarity]
                    )}
                  >
                    <SkinImage 
                      src={item.image_url}
                      className="w-10 h-10 flex-shrink-0"
                      fallbackIcon={<Package className="h-5 w-5 text-muted-foreground" />}
                      skinName={item.name}
                      weaponName={item.weapon}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-muted-foreground truncate">{item.weapon}</div>
                      <div className={cn("text-xs font-medium truncate", RARITY_COLORS[item.rarity as Rarity])}>
                        {item.name}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-primary">{formatPrice(item.price)}₽</div>
                      <div className="text-[10px] text-muted-foreground">{item.chance}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Список кейсов */}
        {!selectedCase && !opening && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cases?.map((caseType) => (
              <div
                key={caseType.id}
                className={cn(
                  "relative p-4 rounded-xl border-2 bg-gradient-to-br cursor-pointer transition-all hover:scale-105 hover:shadow-lg",
                  caseType.color
                )}
                onClick={() => selectCase(caseType)}
              >
                {/* Кнопка просмотра */}
                <button
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background transition-colors z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewCase(caseType);
                  }}
                >
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </button>

                <div className="text-center">
                  <div className="flex justify-center mb-2 text-primary">
                    {ICON_MAP[caseType.icon] || <Package className="h-6 w-6" />}
                  </div>
                  <h3 className="font-bold text-sm mb-1">{caseType.name}</h3>
                  <div className="text-lg font-bold text-primary">{formatPrice(caseType.price)}₽</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Диалог просмотра содержимого */}
        <Dialog open={!!previewCase} onOpenChange={() => setPreviewCase(null)}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {previewCase && ICON_MAP[previewCase.icon]}
                {previewCase?.name} - Содержимое
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {caseItems?.map((item, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    RARITY_BG[item.rarity as Rarity]
                  )}
                >
                  <SkinImage 
                    src={item.image_url}
                    className="w-12 h-12 flex-shrink-0"
                    fallbackIcon={<Package className="h-6 w-6 text-muted-foreground" />}
                    skinName={item.name}
                    weaponName={item.weapon}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{item.weapon}</div>
                    <div className={cn("font-medium truncate", RARITY_COLORS[item.rarity as Rarity])}>
                      {item.name}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-primary">{formatPrice(item.price)}₽</div>
                    <div className="text-xs text-muted-foreground">{item.chance}%</div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
