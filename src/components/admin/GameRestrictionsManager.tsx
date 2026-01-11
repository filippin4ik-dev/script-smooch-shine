import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface Profile {
  id: string;
  username: string;
}

interface GameRestriction {
  id: string;
  user_id: string;
  game_name: string;
  profiles: { username: string };
}

interface GameRestrictionsManagerProps {
  adminId: string;
}

const GAMES = [
  { value: "crash", label: "Crash" },
  { value: "roulette", label: "Рулетка" },
  { value: "dice", label: "Кости" },
  { value: "mines", label: "Мины" },
  { value: "towers", label: "Башни" },
  { value: "hilo", label: "HiLo" },
  { value: "blackjack", label: "Блэкджек" },
  { value: "slots", label: "Слоты" },
  { value: "dogs-house", label: "Dogs House" },
  { value: "sweet-bonanza", label: "Sweet Bonanza" },
  { value: "cases", label: "Кейсы" },
  { value: "balloon", label: "Воздушный шар" },
  { value: "penalty", label: "Пенальти" },
  { value: "plinko", label: "Плинко" },
];

export const GameRestrictionsManager = ({ adminId }: GameRestrictionsManagerProps) => {
  const [restrictions, setRestrictions] = useState<GameRestriction[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchRestrictions();
    fetchProfiles();
  }, []);

  const fetchRestrictions = async () => {
    const { data, error } = await supabase
      .from('user_game_restrictions')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching restrictions:', error);
      return;
    }

    setRestrictions(data || []);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .order('username');

    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    setProfiles(data || []);
  };

  const addRestriction = async () => {
    if (!selectedUserId || !selectedGame) {
      toast({
        title: "Ошибка",
        description: "Выберите пользователя и игру",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.rpc("admin_add_game_restriction", {
      _admin_id: adminId,
      _target_user_id: selectedUserId,
      _game_name: selectedGame,
    });

    if (error || !data?.success) {
      toast({
        title: "Ошибка",
        description: data?.message || "Не удалось добавить ограничение",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Успешно",
      description: "Игра заблокирована для пользователя",
    });

    setSelectedUserId("");
    setSelectedGame("");
    fetchRestrictions();
  };

  const removeRestriction = async (id: string) => {
    const { data, error } = await supabase.rpc("admin_remove_game_restriction", {
      _admin_id: adminId,
      _restriction_id: id,
    });

    if (error || !data?.success) {
      toast({
        title: "Ошибка",
        description: data?.message || "Не удалось удалить ограничение",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Успешно",
      description: "Ограничение удалено",
    });

    fetchRestrictions();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <Label>Пользователь</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите пользователя" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Игра</Label>
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите игру" />
              </SelectTrigger>
              <SelectContent>
                {GAMES.map((game) => (
                  <SelectItem key={game.value} value={game.value}>
                    {game.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={addRestriction} className="w-full">
            Заблокировать игру
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {restrictions.map((restriction) => (
          <Card key={restriction.id} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{restriction.profiles.username}</p>
                <p className="text-sm text-muted-foreground">
                  {GAMES.find(g => g.value === restriction.game_name)?.label || restriction.game_name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRestriction(restriction.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
