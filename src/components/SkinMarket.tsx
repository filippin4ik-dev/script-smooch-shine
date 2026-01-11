import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkinImage } from "@/components/SkinImage";
import { useBalanceMode } from "@/hooks/useBalanceMode";

interface SkinMarketProps {
  userId: string;
  balance: number;
  demoBalance?: number;
  onBalanceUpdate: () => void;
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

const RARITY_COLORS: Record<string, string> = {
  consumer: "bg-gray-500/20 border-gray-500 text-gray-400",
  industrial: "bg-sky-500/20 border-sky-500 text-sky-400",
  milspec: "bg-blue-500/20 border-blue-500 text-blue-400",
  restricted: "bg-purple-500/20 border-purple-500 text-purple-400",
  classified: "bg-pink-500/20 border-pink-500 text-pink-400",
  covert: "bg-red-500/20 border-red-500 text-red-400",
};

const RARITY_NAMES: Record<string, string> = {
  consumer: "Ширпотреб",
  industrial: "Промышленное",
  milspec: "Армейское",
  restricted: "Запрещённое",
  classified: "Засекреченное",
  covert: "Тайное",
};

const CATEGORY_NAMES: Record<string, string> = {
  Pistol: "🔫 Пистолеты",
  Rifle: "💥 Винтовки",
  Sniper: "🎯 Снайперки",
  SMG: "🔹 ПП",
  Shotgun: "💨 Дробовики",
  Machinegun: "⚙️ Пулемёты",
  Knife: "🔪 Ножи",
};

const getCategoryIcon = (category: string) => {
  const icons: Record<string, string> = {
    Pistol: "🔫",
    Rifle: "💥",
    Sniper: "🎯",
    SMG: "🔹",
    Shotgun: "💨",
    Machinegun: "⚙️",
    Knife: "🔪",
  };
  return icons[category] || "📦";
};

export const SkinMarket = ({ userId, balance, demoBalance = 0, onBalanceUpdate }: SkinMarketProps) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | "">("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const { mode } = useBalanceMode();

  const { data: skins, isLoading } = useQuery({
    queryKey: ["skins", selectedCategory, search, minPrice, maxPrice],
    queryFn: async () => {
      let query = supabase
        .from("skins")
        .select("*")
        .order("price", { ascending: true })
        .limit(2000);

      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,weapon.ilike.%${search}%`);
      }

      // Apply price filters at database level for better performance
      const min = minPrice ? Number(minPrice) : null;
      const max = maxPrice ? Number(maxPrice) : null;
      
      if (min !== null && !Number.isNaN(min)) {
        query = query.gte("price", min);
      }
      if (max !== null && !Number.isNaN(max)) {
        query = query.lte("price", max);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Skin[];
    },
  });

  const buySkin = async (skin: Skin) => {
    const useDemo = mode === "demo";
    const availableBalance = useDemo ? demoBalance : balance;
    
    if (availableBalance < skin.price) {
      toast.error(useDemo ? "Недостаточно демо-баланса" : "Недостаточно средств");
      return;
    }

    setBuyingId(skin.id);
    try {
      const { data, error } = await supabase.rpc("buy_skin", {
        _user_id: userId,
        _skin_id: skin.id,
        _use_freebet: false,
        _use_demo: useDemo,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; is_demo?: boolean };
      if (result.success) {
        toast.success(`${skin.weapon} | ${skin.name} куплен!${result.is_demo ? " (демо)" : ""}`);
        onBalanceUpdate();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Ошибка покупки");
    } finally {
      setBuyingId(null);
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

  return (
    <div className="space-y-4">
      {/* Поиск и фильтры */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск скинов..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-input"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            type="number"
            placeholder="Мин ₽"
            value={minPrice}
            onChange={(e) => {
              setMinPrice(e.target.value);
              setCurrentPage(1);
            }}
            className="w-24 bg-input"
          />
          <Input
            type="number"
            placeholder="Макс ₽"
            value={maxPrice}
            onChange={(e) => {
              setMaxPrice(e.target.value);
              setCurrentPage(1);
            }}
            className="w-24 bg-input"
          />
          <Button
            variant={priceSort === "asc" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setPriceSort(priceSort === "asc" ? "" : "asc");
              setCurrentPage(1);
            }}
          >
            Цена ↑
          </Button>
          <Button
            variant={priceSort === "desc" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setPriceSort(priceSort === "desc" ? "" : "desc");
              setCurrentPage(1);
            }}
          >
            Цена ↓
          </Button>
        </div>
      </div>

      {/* Категории */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSelectedCategory(null);
            setCurrentPage(1);
          }}
        >
          Все
        </Button>
        {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
          <Button
            key={key}
            variant={selectedCategory === key ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelectedCategory(key);
              setCurrentPage(1);
            }}
          >
            {name}
          </Button>
        ))}
      </div>

      {/* Сетка скинов */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : (
        (() => {
          let filtered = skins || [];

          // Sorting is now applied client-side only
          if (priceSort === "asc") {
            filtered = [...filtered].sort((a, b) => a.price - b.price);
          } else if (priceSort === "desc") {
            filtered = [...filtered].sort((a, b) => b.price - a.price);
          }

          const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
          const current = Math.min(currentPage, totalPages);
          const startIndex = (current - 1) * pageSize;
          const pageSkins = filtered.slice(startIndex, startIndex + pageSize);

          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {pageSkins.map((skin) => (
                  <Card
                    key={skin.id}
                    className={cn(
                      "border-2 transition-all hover:scale-[1.02]",
                      RARITY_COLORS[skin.rarity] || "border-border"
                    )}
                  >
                    <CardContent className="p-3 space-y-2">
                      {/* Картинка скина */}
                      <div className="aspect-square bg-black/20 rounded-lg overflow-hidden">
                        <SkinImage 
                          src={skin.image_url} 
                          alt={skin.name}
                          category={skin.category}
                          className="w-full h-full p-2"
                          skinName={skin.name}
                          weaponName={skin.weapon}
                        />
                      </div>

                      {/* Информация */}
                      <div>
                        <div className="text-xs text-muted-foreground">{skin.weapon}</div>
                        <div className="font-bold text-sm truncate">{skin.name}</div>
                        <Badge variant="outline" className={cn("text-[10px] mt-1", RARITY_COLORS[skin.rarity])}>
                          {RARITY_NAMES[skin.rarity] || skin.rarity}
                        </Badge>
                      </div>

                      {/* Цена и кнопка */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="font-bold text-primary">{formatPrice(skin.price)}</span>
                        <Button
                          size="sm"
                          disabled={buyingId === skin.id || (mode === "demo" ? demoBalance : balance) < skin.price}
                          onClick={() => buySkin(skin)}
                          className={cn("h-7 px-2 text-xs", mode === "demo" && "bg-green-600 hover:bg-green-700")}
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          {buyingId === skin.id ? "..." : mode === "demo" ? "Демо" : "Купить"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Пагинация */}
              {filtered.length > pageSize && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Страница {current} из {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Вперед
                  </Button>
                </div>
              )}
            </>
          );
        })()
      )}

      {skins?.length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          Скины не найдены
        </div>
      )}
    </div>
  );
};
