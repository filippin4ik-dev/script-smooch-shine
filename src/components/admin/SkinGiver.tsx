import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Package, Search, User, Gift } from "lucide-react";
import { SkinImage } from "@/components/SkinImage";
import { safeParseInt } from "@/lib/safeParseInt";

interface SkinGiverProps {
  adminId: string;
}

export const SkinGiver = ({ adminId }: SkinGiverProps) => {
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [skinSearchQuery, setSkinSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedSkinId, setSelectedSkinId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users-search-skin", userSearchQuery],
    queryFn: async () => {
      if (!userSearchQuery || userSearchQuery.length < 2) return [];
      const parsedId = safeParseInt(userSearchQuery);
      let query = supabase
        .from("profiles")
        .select("id, username, public_id, balance");
      
      if (parsedId !== null) {
        query = query.or(`public_id.eq.${parsedId},username.ilike.%${userSearchQuery}%`);
      } else {
        query = query.ilike("username", `%${userSearchQuery}%`);
      }
      
      const { data } = await query.limit(10);
      return data || [];
    },
    enabled: userSearchQuery.length >= 2,
  });

  const { data: skins = [] } = useQuery({
    queryKey: ["skins-search", skinSearchQuery],
    queryFn: async () => {
      if (!skinSearchQuery || skinSearchQuery.length < 2) return [];
      const { data } = await supabase
        .from("skins")
        .select("*")
        .or(`name.ilike.%${skinSearchQuery}%,weapon.ilike.%${skinSearchQuery}%`)
        .order("price", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: skinSearchQuery.length >= 2,
  });

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedSkin = skins.find((s) => s.id === selectedSkinId);

  const giveSkin = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !selectedSkinId) throw new Error("Выберите пользователя и скин");
      const { data, error } = await supabase.rpc("admin_give_skin", {
        _admin_id: adminId,
        _target_user_id: selectedUserId,
        _skin_id: selectedSkinId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(data.message);
        setSelectedUserId(null);
        setSelectedSkinId(null);
        setUserSearchQuery("");
        setSkinSearchQuery("");
        queryClient.invalidateQueries({ queryKey: ["users-search-skin"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
    onError: (error: any) => toast.error(error.message || "Ошибка выдачи скина"),
  });

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-400" />
          Выдать скин
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* User Search */}
        <div className="space-y-2">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск пользователя по ID или нику..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {users.length > 0 && !selectedUserId && (
            <div className="max-h-32 overflow-y-auto space-y-1 bg-background/50 rounded-lg p-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className="p-2 hover:bg-primary/20 rounded cursor-pointer flex justify-between text-sm"
                >
                  <span>{user.username}</span>
                  <span className="text-muted-foreground">#{user.public_id}</span>
                </div>
              ))}
            </div>
          )}
          {selectedUser && (
            <div className="p-2 bg-green-500/20 rounded-lg flex justify-between items-center">
              <span className="text-green-400">{selectedUser.username} #{selectedUser.public_id}</span>
              <Button size="sm" variant="ghost" onClick={() => setSelectedUserId(null)}>✕</Button>
            </div>
          )}
        </div>

        {/* Skin Search */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск скина..."
              value={skinSearchQuery}
              onChange={(e) => setSkinSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {skins.length > 0 && !selectedSkinId && (
            <div className="max-h-48 overflow-y-auto space-y-1 bg-background/50 rounded-lg p-2">
              {skins.map((skin) => (
                <div
                  key={skin.id}
                  onClick={() => setSelectedSkinId(skin.id)}
                  className="p-2 hover:bg-primary/20 rounded cursor-pointer flex items-center gap-3 text-sm"
                >
                  <SkinImage src={skin.image_url} alt={skin.name} className="w-10 h-10 object-contain" />
                  <div className="flex-1">
                    <div>{skin.weapon} | {skin.name}</div>
                    <div className="text-muted-foreground text-xs">{skin.price}₽</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedSkin && (
            <div className="p-2 bg-purple-500/20 rounded-lg flex items-center gap-3">
              <SkinImage src={selectedSkin.image_url} alt={selectedSkin.name} className="w-12 h-12 object-contain" />
              <div className="flex-1">
                <div className="text-purple-400">{selectedSkin.weapon} | {selectedSkin.name}</div>
                <div className="text-sm text-muted-foreground">{selectedSkin.price}₽</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedSkinId(null)}>✕</Button>
            </div>
          )}
        </div>

        <Button
          onClick={() => giveSkin.mutate()}
          disabled={!selectedUserId || !selectedSkinId || giveSkin.isPending}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          <Package className="w-4 h-4 mr-2" />
          {giveSkin.isPending ? "Выдача..." : "Выдать скин"}
        </Button>
      </CardContent>
    </Card>
  );
};
