import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkinImage } from "@/components/SkinImage";

interface SkinInventoryProps {
  userId: string;
  onBalanceUpdate: () => void;
}

interface InventoryItem {
  id: string;
  skin_id: string;
  purchased_at: string;
  purchased_price: number;
  is_demo?: boolean;
  skins: {
    id: string;
    name: string;
    weapon: string;
    category: string;
    rarity: string;
    price: number;
    image_url: string | null;
  } | null;
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

export const SkinInventory = ({ userId, onBalanceUpdate }: SkinInventoryProps) => {
  const [sellingId, setSellingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: inventory, isLoading, refetch } = useQuery({
    queryKey: ["user-inventory", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_inventory")
        .select("*, skins(*)")
        .eq("user_id", userId)
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      return (data || []).filter(item => item.skins !== null).map(item => ({
        ...item,
        is_demo: item.is_demo ?? false
      })) as InventoryItem[];
    },
    enabled: !!userId,
    refetchInterval: 3000,
  });

  const sellSkin = async (item: InventoryItem) => {
    if (!item.skins) return;
    
    setSellingId(item.id);
    try {
      const { data, error } = await supabase.rpc("sell_skin", {
        _user_id: userId,
        _inventory_id: item.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ["user-inventory", userId] });
        onBalanceUpdate();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Ошибка продажи");
    } finally {
      setSellingId(null);
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

  const totalValue = inventory?.reduce((sum, item) => sum + (item.skins?.price || 0), 0) || 0;

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <span className="text-muted-foreground">Предметов:</span>
          <span className="font-bold">{inventory?.length || 0}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Общая стоимость:</span>
          <span className="font-bold text-primary ml-2">{formatPrice(totalValue)}</span>
        </div>
      </div>

      {/* Сетка инвентаря - без лимита */}
      {inventory && inventory.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto">
          {inventory.map((item) => {
            if (!item.skins) return null;
            const skin = item.skins;
            
            return (
              <Card
                key={item.id}
                className={cn(
                  "border-2 transition-all relative",
                  RARITY_COLORS[skin.rarity] || "border-border",
                  item.is_demo && "ring-2 ring-green-500/50"
                )}
              >
                {item.is_demo && (
                  <div className="absolute top-1 right-1 z-10">
                    <Badge className="bg-green-600 text-[10px] px-1 py-0">ДЕМО</Badge>
                  </div>
                )}
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

                  {/* Цена и кнопка продажи */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-bold text-primary">{formatPrice(skin.price)}</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={sellingId === item.id}
                      onClick={() => sellSkin(item)}
                      className="h-7 px-2 text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      {sellingId === item.id ? "..." : "Продать"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Ваш инвентарь пуст</p>
          <p className="text-sm">Купите скины в маркете</p>
        </div>
      )}
    </div>
  );
};