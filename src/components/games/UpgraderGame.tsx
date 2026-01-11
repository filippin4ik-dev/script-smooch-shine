import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowUp, Zap, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkinImage } from "@/components/SkinImage";

interface UpgraderGameProps {
  userId: string;
  onBalanceUpdate: () => void;
}

interface InventoryItem {
  id: string;
  skin_id: string;
  skins: {
    id: string;
    name: string;
    weapon: string;
    category: string;
    rarity: string;
    price: number;
    image_url: string | null;
  };
}

interface Skin {
  id: string;
  name: string;
  weapon: string;
  category: string;
  rarity: string;
  price: number;
  image_url: string | null;
}

const getCategoryIcon = (category: string) => {
  const icons: Record<string, string> = {
    pistols: "🔫",
    rifles: "💥",
    snipers: "🎯",
    smgs: "🔹",
    knives: "🔪",
    gloves: "🧤",
  };
  return icons[category] || "📦";
};

const RARITY_COLORS: Record<string, string> = {
  consumer: "bg-gray-500/20 border-gray-500 text-gray-400",
  industrial: "bg-sky-500/20 border-sky-500 text-sky-400",
  milspec: "bg-blue-500/20 border-blue-500 text-blue-400",
  restricted: "bg-purple-500/20 border-purple-500 text-purple-400",
  classified: "bg-pink-500/20 border-pink-500 text-pink-400",
  covert: "bg-red-500/20 border-red-500 text-red-400",
  rare: "bg-yellow-500/20 border-yellow-500 text-yellow-400",
};

export const UpgraderGame = ({ userId, onBalanceUpdate }: UpgraderGameProps) => {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [targetSkin, setTargetSkin] = useState<Skin | null>(null);
  const [chance, setChance] = useState(50);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastGameNumber, setLastGameNumber] = useState<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  // Проверяем статус игры
  const { data: gameStatus } = useQuery({
    queryKey: ["game-status-upgrader"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_settings")
        .select("status")
        .eq("game_name", "upgrader")
        .single();
      return data?.status || "active";
    },
    refetchInterval: 10000,
  });

  const isMaintenance = gameStatus === "maintenance";

  // Получаем инвентарь - используем тот же query key что и в SkinInventory
  const { data: inventory, refetch: refetchInventory } = useQuery({
    queryKey: ["user-inventory", userId],
    queryFn: async () => {
      // Используем RPC функцию для получения инвентаря
      const { data, error } = await supabase.rpc('get_user_inventory', {
        _user_id: userId
      });

      if (error) throw error;
      
      // Преобразуем формат данных из RPC в нужный формат
      return (data || []).map((item: any) => ({
        id: item.id,
        skin_id: item.skin_id,
        skins: {
          id: item.skin_id,
          name: item.skin_name,
          weapon: item.skin_weapon,
          category: item.skin_category,
          rarity: item.skin_rarity,
          price: item.skin_price,
          image_url: item.skin_image_url,
        }
      })) as InventoryItem[];
    },
    refetchInterval: 2000,
  });

  // Подписка на изменения инвентаря в реальном времени
  useEffect(() => {
    const channel = supabase
      .channel('inventory-changes-upgrader')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_inventory',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refetchInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetchInventory]);

  // Получаем доступные скины для апгрейда
  // Формула шанса: chance = (fromPrice / toPrice) * 87
  // При 1.24x = 70%, при 87x = 1%
  const { data: targetSkins } = useQuery({
    queryKey: ["target-skins", selectedItem?.skins.price],
    queryFn: async () => {
      if (!selectedItem) return [];
      
      // Минимальная цена для 70% шанса: toPrice = fromPrice * 1.24
      const minPrice = selectedItem.skins.price * 1.24;
      // Максимальная цена для 1% шанса: toPrice = fromPrice * 87
      const maxPrice = selectedItem.skins.price * 87;
      
      const { data, error } = await supabase
        .from("skins")
        .select("*")
        .gte("price", minPrice)
        .lte("price", maxPrice)
        .not("image_url", "is", null)
        .order("price", { ascending: true })
        .limit(100);

      if (error) throw error;
      return data as Skin[];
    },
    enabled: !!selectedItem,
  });

  // Очистка анимации при размонтировании
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Рассчитываем шанс на основе цен (максимум 70%, минимум 1%)
  // Формула: chance = (fromPrice / toPrice) * 87
  // При 1.24x → 70%, при 87x → 1%
  const calculateChance = (fromPrice: number, toPrice: number) => {
    const chance = (fromPrice / toPrice) * 87;
    return Math.min(70, Math.max(1, Math.round(chance)));
  };

  const selectTargetSkin = (skin: Skin) => {
    setTargetSkin(skin);
    if (selectedItem) {
      setChance(calculateChance(selectedItem.skins.price, skin.price));
    }
  };

  const multiplier = targetSkin && selectedItem 
    ? (targetSkin.price / selectedItem.skins.price).toFixed(2) 
    : "1.00";

  const upgrade = async () => {
    if (!selectedItem || !targetSkin || isMaintenance) return;

    setIsUpgrading(true);
    setIsSpinning(true);
    setResult(null);

    try {
      // Вызываем серверную RPC функцию
      const { data, error } = await supabase.rpc('upgrade_skin', {
        _user_id: userId,
        _inventory_id: selectedItem.id,
        _target_skin_id: targetSkin.id
      });

       if (error) {
         toast.error(error.message || "Ошибка апгрейда");
         setIsUpgrading(false);
         setIsSpinning(false);
         return;
       }

      const response = data as { success: boolean; won: boolean; chance: number; game_number?: number; message?: string };
      
      if (!response.success) {
        toast.error(response.message || "Ошибка апгрейда");
        setIsUpgrading(false);
        setIsSpinning(false);
        return;
      }

      if (response.game_number) {
        setLastGameNumber(response.game_number);
      }

       const won = response.won;
       const serverChance = response.chance;
       setChance(Number(serverChance));
      
      // Анимация колеса - стрелка вращается, колесо неподвижно
      // Зеленая зона (WIN) начинается с 0° и занимает chance% от 360°
      const greenZoneSize = serverChance * 3.6; // размер зеленой зоны в градусах
      
      let targetAngle: number;
      
      if (won) {
        // Стрелка должна указать на зеленую зону (0° - greenZoneSize°)
        // Гарантируем попадание в центр зеленой зоны с небольшим отклонением
        const safePadding = Math.min(8, greenZoneSize * 0.2);
        const safeZoneStart = safePadding;
        const safeZoneEnd = greenZoneSize - safePadding;
        targetAngle = safeZoneStart + Math.random() * (safeZoneEnd - safeZoneStart);
      } else {
        // Стрелка должна указать на красную зону (greenZoneSize° - 360°)
        const redZoneStart = greenZoneSize;
        const redZoneEnd = 360;
        const safePadding = Math.min(8, (redZoneEnd - redZoneStart) * 0.1);
        const safeZoneStart = redZoneStart + safePadding;
        const safeZoneEnd = redZoneEnd - safePadding;
        targetAngle = safeZoneStart + Math.random() * (safeZoneEnd - safeZoneStart);
      }
      
      // Добавляем 6-8 полных оборотов для более драматичного эффекта
      const fullRotations = 6 + Math.floor(Math.random() * 3);
      const totalRotation = fullRotations * 360 + targetAngle;
      
      // Анимация вращения колеса - 4 секунды
      const duration = 4000;
      const startTime = Date.now();
      const startRotation = wheelRotation % 360;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Плавное замедление
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentRotation = startRotation + easeOut * totalRotation;
        
        setWheelRotation(currentRotation);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsSpinning(false);
          // Показываем результат
          setTimeout(() => {
            setResult(won ? "win" : "lose");
            if (won) {
              toast.success(`🎉 Апгрейд успешен! Получен ${targetSkin.weapon} | ${targetSkin.name}`);
            } else {
              toast.error(`💀 Скин сгорел! ${selectedItem.skins.weapon} | ${selectedItem.skins.name}`);
            }
            
            queryClient.invalidateQueries({ queryKey: ["user-inventory", userId] });
            refetchInventory();
            onBalanceUpdate();

            setTimeout(() => {
              setIsUpgrading(false);
              setSelectedItem(null);
              setTargetSkin(null);
              setResult(null);
            }, 2500);
          }, 500);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    } catch (err) {
      toast.error("Ошибка соединения");
      setIsUpgrading(false);
      setIsSpinning(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(price >= 10000000 ? 0 : 1)}кк₽`;
    }
    if (price >= 1000) {
      return `${(price / 1000).toFixed(price >= 10000 ? 0 : 1)}K₽`;
    }
    return `${price}₽`;
  };

  if (isMaintenance) {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold text-yellow-500 mb-2">Технический перерыв</h2>
          <p className="text-muted-foreground">Апгрейдер временно недоступен. Попробуйте позже.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-card">
      <CardHeader>
        <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
          {lastGameNumber && (
            <span className="text-sm font-mono bg-primary/20 px-2 py-1 rounded text-primary">
              #{lastGameNumber}
            </span>
          )}
          <TrendingUp className="w-6 h-6 text-primary" />
          Upgrader
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Колесо фортуны */}
        <div className="relative mx-auto w-64 h-64">
          {/* Вращающийся треугольник-указатель */}
          <div 
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              transform: `rotate(${wheelRotation}deg)`,
              transition: isSpinning ? 'none' : 'transform 0.3s ease-out',
            }}
          >
            <div className="absolute left-1/2 -top-1 transform -translate-x-1/2">
              <div 
                className="w-0 h-0" 
                style={{
                  borderLeft: '16px solid transparent',
                  borderRight: '16px solid transparent',
                  borderTop: '28px solid white',
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))'
                }}
              />
            </div>
          </div>

          {/* Неподвижное колесо */}
          <div 
            className={cn(
              "absolute inset-0 rounded-full border-4 overflow-hidden",
              result === "win" && "border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.5)]",
              result === "lose" && "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]",
              !result && "border-primary/50"
            )}
            style={{
              background: `conic-gradient(
                from 0deg,
                hsl(142, 76%, 36%) 0deg,
                hsl(142, 76%, 36%) ${chance * 3.6}deg,
                hsl(0, 84%, 60%) ${chance * 3.6}deg,
                hsl(0, 84%, 60%) 360deg
              )`
            }}
          >
            {/* Метки WIN/LOSE */}
            <div className="absolute inset-0 flex flex-col items-center justify-between py-6 pointer-events-none">
              <span className="text-white font-bold text-sm drop-shadow-lg">WIN</span>
              <span className="text-white font-bold text-sm drop-shadow-lg">LOSE</span>
            </div>
          </div>

          {/* Центральный круг */}
          <div className="absolute inset-10 rounded-full bg-background flex items-center justify-center shadow-inner border-2 border-muted z-10">
            <div className="text-center">
              <div className="text-3xl font-black text-primary">{chance}%</div>
              <div className="text-xs text-muted-foreground">шанс успеха</div>
              <div className="text-lg font-bold text-yellow-400 mt-1">x{multiplier}</div>
            </div>
          </div>
        </div>

        {/* Результат */}
        {result && (
          <div className={cn(
            "text-center py-4 rounded-xl animate-scale-in",
            result === "win" ? "bg-green-500/20 border-2 border-green-500" : "bg-red-500/20 border-2 border-red-500"
          )}>
            <div className="text-3xl mb-2">{result === "win" ? "🎉" : "💀"}</div>
            <div className={cn("text-xl font-bold", result === "win" ? "text-green-400" : "text-red-400")}>
              {result === "win" ? "ПОБЕДА!" : "ПРОИГРЫШ"}
            </div>
          </div>
        )}

        {/* Выбор своего скина */}
        {!isUpgrading && (
          <div>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Ваш скин:
            </h3>
            {selectedItem ? (
              <div className={cn("p-3 rounded-lg border-2", RARITY_COLORS[selectedItem.skins.rarity])}>
                <div className="flex items-center gap-3">
                  <SkinImage 
                    src={selectedItem.skins.image_url} 
                    category={selectedItem.skins.category}
                    className="w-12 h-12"
                    skinName={selectedItem.skins.name}
                    weaponName={selectedItem.skins.weapon}
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{selectedItem.skins.weapon}</div>
                    <div className="font-bold">{selectedItem.skins.name}</div>
                  </div>
                  <div className="font-bold text-primary">{formatPrice(selectedItem.skins.price)}</div>
                </div>
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setSelectedItem(null)}>
                  Изменить
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {inventory?.map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    className={cn("h-auto p-2 flex-col", RARITY_COLORS[item.skins.rarity])}
                    onClick={() => setSelectedItem(item)}
                  >
                    <SkinImage 
                      src={item.skins.image_url}
                      category={item.skins.category}
                      className="w-12 h-12"
                      skinName={item.skins.name}
                      weaponName={item.skins.weapon}
                    />
                    <div className="text-[10px] truncate w-full">{item.skins.name}</div>
                    <div className="text-xs font-bold text-primary">{formatPrice(item.skins.price)}</div>
                  </Button>
                ))}
                {(!inventory || inventory.length === 0) && (
                  <div className="col-span-3 text-center py-4 text-muted-foreground">
                    Нет скинов. Купите в маркете.
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        {/* Выбор целевого скина */}
        {selectedItem && !isUpgrading && (
          <div>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
              <ArrowUp className="w-4 h-4" />
              Апгрейд до:</h3>
            {targetSkin ? (
              <div className={cn("p-3 rounded-lg border-2", RARITY_COLORS[targetSkin.rarity])}>
                <div className="flex items-center gap-3">
                  <SkinImage 
                    src={targetSkin.image_url}
                    category={targetSkin.category}
                    className="w-12 h-12"
                    skinName={targetSkin.name}
                    weaponName={targetSkin.weapon}
                  />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{targetSkin.weapon}</div>
                    <div className="font-bold">{targetSkin.name}</div>
                  </div>
                  <div className="font-bold text-yellow-400">{formatPrice(targetSkin.price)}</div>
                </div>
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setTargetSkin(null)}>
                  Изменить
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {targetSkins?.map((skin) => (
                  <Button
                    key={skin.id}
                    variant="outline"
                    className={cn("h-auto p-2 flex-col", RARITY_COLORS[skin.rarity])}
                    onClick={() => selectTargetSkin(skin)}
                  >
                    <SkinImage 
                      src={skin.image_url}
                      category={skin.category}
                      className="w-12 h-12"
                      skinName={skin.name}
                      weaponName={skin.weapon}
                    />
                    <div className="text-[10px] truncate w-full">{skin.name}</div>
                    <div className="text-xs font-bold text-yellow-400">{formatPrice(skin.price)}</div>
                    <Badge variant="outline" className="text-[8px] mt-1">
                      {calculateChance(selectedItem.skins.price, skin.price)}%
                    </Badge>
                  </Button>
                ))}
                {(!targetSkins || targetSkins.length === 0) && (
                  <div className="col-span-3 text-center py-4 text-muted-foreground">
                    Нет доступных скинов для апгрейда
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Кнопка апгрейда */}
        <Button
          size="lg"
          className="w-full h-14 text-xl font-bold"
          disabled={!selectedItem || !targetSkin || isUpgrading}
          onClick={upgrade}
        >
          {isUpgrading ? (
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5 animate-pulse" />
              Апгрейд...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              АПГРЕЙД x{multiplier}
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
