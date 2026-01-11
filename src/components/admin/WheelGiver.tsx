import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { safeParseInt } from "@/lib/safeParseInt";

interface WheelGiverProps {
  adminId: string;
}

export const WheelGiver = ({ adminId }: WheelGiverProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [wheelCount, setWheelCount] = useState(1);
  const [isGiving, setIsGiving] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["users-for-wheel", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 1) return [];
      const parsedId = safeParseInt(searchQuery);
      let query = supabase
        .from("profiles")
        .select("id, username, public_id");
      
      if (parsedId !== null) {
        query = query.or(`public_id.eq.${parsedId},username.ilike.%${searchQuery}%`);
      } else {
        query = query.ilike("username", `%${searchQuery}%`);
      }
      
      const { data } = await query.limit(10);
      return data || [];
    },
    enabled: searchQuery.length >= 1,
  });

  const giveWheel = async () => {
    if (!selectedUserId) {
      toast.error("Выберите пользователя");
      return;
    }

    if (wheelCount < 1 || wheelCount > 100) {
      toast.error("Количество колёс от 1 до 100");
      return;
    }

    setIsGiving(true);
    try {
      const { data, error } = await supabase.rpc("admin_give_wheel", {
        _admin_id: adminId,
        _target_user_id: selectedUserId,
        _count: wheelCount,
      });

      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        toast.success(result.message);
        setSearchQuery("");
        setSelectedUserId(null);
        setWheelCount(1);
      } else {
        toast.error(result?.message || "Ошибка");
      }
    } catch (err) {
      console.error(err);
      toast.error("Ошибка выдачи колеса");
    } finally {
      setIsGiving(false);
    }
  };

  return (
    <Card className="border-yellow-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-500">
          🎡 Выдать бонусные колёса
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Поиск по нику или ID игрока..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedUserId(null);
          }}
        />

        {users && users.length > 0 && (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {users.map((user) => (
              <Button
                key={user.id}
                variant={selectedUserId === user.id ? "default" : "outline"}
                size="sm"
                className="w-full justify-start"
                onClick={() => setSelectedUserId(user.id)}
              >
                {user.username} (ID: {user.public_id})
              </Button>
            ))}
          </div>
        )}

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Количество колёс</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={wheelCount}
            onChange={(e) => setWheelCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className="w-full"
          />
        </div>

        <Button
          onClick={giveWheel}
          disabled={!selectedUserId || isGiving}
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500"
        >
          {isGiving ? "Выдаём..." : `🎡 Выдать ${wheelCount} колёс`}
        </Button>
      </CardContent>
    </Card>
  );
};
