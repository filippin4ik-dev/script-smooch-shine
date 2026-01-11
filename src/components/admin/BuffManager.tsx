import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Zap, Trash2, Search, Users } from "lucide-react";
import { safeParseInt } from "@/lib/safeParseInt";

interface BuffManagerProps {
  adminId: string;
}

export const BuffManager = ({ adminId }: BuffManagerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [buffType, setBuffType] = useState<"x2" | "x3" | "x5" | "x10">("x2");
  const [durationHours, setDurationHours] = useState("24");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGiveawayId, setSelectedGiveawayId] = useState("");

  const { data: users } = useQuery({
    queryKey: ["admin-users-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const parsedId = safeParseInt(searchQuery);
      let query = supabase
        .from("profiles")
        .select("id, username, public_id");
      
      if (parsedId !== null) {
        query = query.or(`username.ilike.%${searchQuery}%,public_id.eq.${parsedId}`);
      } else {
        query = query.ilike("username", `%${searchQuery}%`);
      }
      
      const { data } = await query.limit(10);
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const { data: activeGiveaways } = useQuery({
    queryKey: ["active-giveaways-for-buffs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("giveaways")
        .select("id, title")
        .eq("status", "active")
        .eq("giveaway_mode", "achievement")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: activeBuffs, refetch: refetchBuffs } = useQuery({
    queryKey: ["active-buffs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_buffs")
        .select(`
          *,
          profiles:user_id(username, public_id)
        `)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
      return data || [];
    },
  });

  const giveBuff = async () => {
    if (!selectedUserId) {
      toast.error("Выберите пользователя");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_give_buff", {
        _admin_id: adminId,
        _target_user_id: selectedUserId,
        _buff_type: buffType,
        _duration_hours: parseInt(durationHours) || 24,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; message: string };
      if (result.success) {
        toast.success(`Бафф ${buffType} выдан на ${durationHours} часов`);
        refetchBuffs();
        setSelectedUserId("");
        setSearchQuery("");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Ошибка выдачи баффа");
    } finally {
      setIsLoading(false);
    }
  };

  const giveBuffToAll = async () => {
    if (!selectedGiveawayId) {
      toast.error("Выберите розыгрыш");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_give_buff_to_all", {
        _admin_id: adminId,
        _giveaway_id: selectedGiveawayId,
        _buff_type: buffType,
        _duration_hours: parseInt(durationHours) || 24,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; message: string; count?: number };
      if (result.success) {
        toast.success(result.message);
        refetchBuffs();
        setSelectedGiveawayId("");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Ошибка выдачи баффа");
    } finally {
      setIsLoading(false);
    }
  };

  const removeBuff = async (userId: string, buffTypeToRemove: string) => {
    try {
      const { data, error } = await supabase.rpc("admin_remove_buff", {
        _admin_id: adminId,
        _target_user_id: userId,
        _buff_type: buffTypeToRemove,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; message: string };
      if (result.success) {
        toast.success("Бафф удалён");
        refetchBuffs();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Ошибка удаления баффа");
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
  };

  return (
    <div className="space-y-6">
      {/* Выдача баффа одному пользователю */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Выдать бафф игроку</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск игрока..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {users && users.length > 0 && searchQuery.length >= 2 && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setSearchQuery(user.username);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
                  >
                    {user.username} (ID: {user.public_id})
                  </button>
                ))}
              </div>
            )}
          </div>

          <Select value={buffType} onValueChange={(v) => setBuffType(v as "x2" | "x3" | "x5" | "x10")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="x2">x2 множитель</SelectItem>
              <SelectItem value="x3">x3 множитель</SelectItem>
              <SelectItem value="x5">x5 множитель</SelectItem>
              <SelectItem value="x10">x10 множитель</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Часы"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            min="1"
            max="720"
          />

          <Button onClick={giveBuff} disabled={isLoading || !selectedUserId}>
            <Zap className="w-4 h-4 mr-2" />
            Выдать бафф
          </Button>
        </div>
      </div>

      {/* Выдача баффа всем участникам розыгрыша */}
      <div className="space-y-3 p-4 bg-accent/30 rounded-lg border border-accent">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          Выдать бафф всем участникам розыгрыша
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={selectedGiveawayId} onValueChange={setSelectedGiveawayId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите розыгрыш" />
            </SelectTrigger>
            <SelectContent>
              {activeGiveaways?.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={buffType} onValueChange={(v) => setBuffType(v as "x2" | "x3" | "x5" | "x10")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="x2">x2 множитель</SelectItem>
              <SelectItem value="x3">x3 множитель</SelectItem>
              <SelectItem value="x5">x5 множитель</SelectItem>
              <SelectItem value="x10">x10 множитель</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Часы"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            min="1"
            max="720"
          />

          <Button onClick={giveBuffToAll} disabled={isLoading || !selectedGiveawayId} variant="secondary">
            <Users className="w-4 h-4 mr-2" />
            Выдать всем
          </Button>
        </div>
      </div>

      {activeBuffs && activeBuffs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Активные баффы ({activeBuffs.length}):</h4>
          <div className="grid gap-2 max-h-64 overflow-auto">
            {activeBuffs.map((buff: any) => (
              <div
                key={buff.id}
                className="flex items-center justify-between p-3 bg-accent/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    buff.buff_type === 'x10' ? 'bg-red-500/20 text-red-400' :
                    buff.buff_type === 'x5' ? 'bg-purple-500/20 text-purple-400' :
                    buff.buff_type === 'x3' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {buff.buff_type}
                  </span>
                  <span className="text-sm">
                    {buff.profiles?.username} (ID: {buff.profiles?.public_id})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Осталось: {formatTimeRemaining(buff.expires_at)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBuff(buff.user_id, buff.buff_type)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
