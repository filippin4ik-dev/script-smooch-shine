import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Package, Plus, Trash2, Search } from "lucide-react";
import { SkinImage } from "@/components/SkinImage";

const CATEGORIES = ["Ножи", "Перчатки", "Пистолеты", "Винтовки", "Пулемёты", "Автоматы", "Дробовики", "ПП"];
const RARITIES = ["Consumer", "Industrial", "Mil-Spec", "Restricted", "Classified", "Covert", "Contraband"];

export const SkinManager = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  
  // New skin form
  const [name, setName] = useState("");
  const [weapon, setWeapon] = useState("");
  const [category, setCategory] = useState("");
  const [rarity, setRarity] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const { data: skins = [], isLoading } = useQuery({
    queryKey: ["admin-skins", searchQuery],
    queryFn: async () => {
      let query = supabase.from("skins").select("*").order("price", { ascending: false }).limit(50);
      if (searchQuery.length >= 2) {
        query = query.or(`name.ilike.%${searchQuery}%,weapon.ilike.%${searchQuery}%`);
      }
      const { data } = await query;
      return data || [];
    },
  });

  const createSkin = useMutation({
    mutationFn: async () => {
      if (!name || !weapon || !category || !rarity || !price) {
        throw new Error("Заполните все поля");
      }
      const { error } = await supabase.from("skins").insert({
        name,
        weapon,
        category,
        rarity,
        price: parseFloat(price),
        image_url: imageUrl || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Скин добавлен");
      queryClient.invalidateQueries({ queryKey: ["admin-skins"] });
      setName("");
      setWeapon("");
      setCategory("");
      setRarity("");
      setPrice("");
      setImageUrl("");
    },
    onError: (error: any) => toast.error(error.message || "Ошибка добавления"),
  });

  const deleteSkin = useMutation({
    mutationFn: async (skinId: string) => {
      const { error } = await supabase.from("skins").delete().eq("id", skinId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Скин удалён");
      queryClient.invalidateQueries({ queryKey: ["admin-skins"] });
    },
    onError: (error: any) => toast.error(error.message || "Ошибка удаления"),
  });

  return (
    <div className="space-y-6">
      {/* Add new skin */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-400" />
            Добавить скин вручную
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Название скина</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Fade"
              />
            </div>
            <div className="space-y-2">
              <Label>Оружие</Label>
              <Input
                value={weapon}
                onChange={(e) => setWeapon(e.target.value)}
                placeholder="Butterfly Knife"
              />
            </div>
            <div className="space-y-2">
              <Label>Категория</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Редкость</Label>
              <Select value={rarity} onValueChange={setRarity}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите редкость" />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Цена (₽)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="10000"
              />
            </div>
            <div className="space-y-2">
              <Label>URL изображения (опционально)</Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <Button
            onClick={() => createSkin.mutate()}
            disabled={createSkin.isPending || !name || !weapon || !category || !rarity || !price}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createSkin.isPending ? "Добавление..." : "Добавить скин"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing skins */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Скины в базе данных
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск скинов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Загрузка...</div>
          ) : skins.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">Скины не найдены</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {skins.map((skin) => (
                <div
                  key={skin.id}
                  className="flex items-center gap-3 p-3 bg-background/50 rounded-lg"
                >
                  <SkinImage
                    src={skin.image_url}
                    alt={skin.name}
                    className="w-16 h-12 object-contain"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{skin.weapon} | {skin.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {skin.category} • {skin.rarity} • {skin.price}₽
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteSkin.mutate(skin.id)}
                    disabled={deleteSkin.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Показано {skins.length} скинов (максимум 50). Для добавления больше скинов используйте форму выше.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
