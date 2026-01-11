import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Target, X, Gift, TrendingDown, Zap, Sparkles, Star, Minus } from "lucide-react";
import { VipUsername } from "@/components/VipUsername";

interface PresetResult {
  id: string;
  user_id: string;
  preset_result: string;
  created_at: string;
  is_used: boolean;
  profile?: {
    username: string;
    is_vip: boolean;
    public_id: number;
    gradient_color: string | null;
  };
}

const RESULT_OPTIONS = [
  { value: "wins_1000", label: "+1000 побед (Джекпот)", icon: Gift, color: "text-yellow-500" },
  { value: "loses_100", label: "-100 побед", icon: TrendingDown, color: "text-red-500" },
  { value: "buff_x2", label: "Бафф x2", icon: Zap, color: "text-green-500" },
  { value: "buff_x3", label: "Бафф x3", icon: Sparkles, color: "text-blue-500" },
  { value: "buff_x5", label: "Бафф x5", icon: Star, color: "text-purple-500" },
  { value: "debuff_x05", label: "Дебафф x0.5", icon: Minus, color: "text-orange-500" },
  { value: "nothing", label: "Пусто", icon: X, color: "text-muted-foreground" },
];

export function WheelPresetManager() {
  const { user: authUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<string>("");
  const queryClient = useQueryClient();

  const getAdminCreds = () => {
    const adminId = authUser?.id;
    const sessionToken = localStorage.getItem("app_session_token");
    if (!adminId || !sessionToken) throw new Error("Не авторизован");
    return { adminId, sessionToken };
  };

  // Search users
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ["admin-user-search-wheel", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const isNumeric = /^\d+$/.test(searchQuery);
      
      let query = supabase
        .from("profiles")
        .select("id, username, is_vip, public_id, gradient_color")
        .limit(10);
      
      if (isNumeric) {
        query = query.eq("public_id", parseInt(searchQuery));
      } else {
        query = query.ilike("username", `%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  // Get active presets
  const { data: activePresets = [] } = useQuery({
    queryKey: ["admin-wheel-presets", authUser?.id],
    queryFn: async () => {
      const { adminId, sessionToken } = getAdminCreds();

      const { data, error } = await supabase.rpc("admin_list_wheel_presets", {
        p_admin_id: adminId,
        p_session_token: sessionToken,
      });

      if (error) throw error;

      const rows = (data as any[]) ?? [];
      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        preset_result: r.preset_result,
        created_at: r.created_at,
        is_used: r.is_used,
        profile: r.username
          ? {
              username: r.username,
              is_vip: r.is_vip,
              public_id: r.public_id,
              gradient_color: r.gradient_color ?? null,
            }
          : undefined,
      })) as PresetResult[];
    },
    enabled: !!authUser?.id,
    refetchInterval: 10000,
  });

  // Set preset mutation
  const setPresetMutation = useMutation({
    mutationFn: async ({ userId, result }: { userId: string; result: string }) => {
      const { adminId, sessionToken } = getAdminCreds();

      const { data, error } = await supabase.rpc("admin_set_wheel_preset", {
        p_admin_id: adminId,
        p_session_token: sessionToken,
        p_target_user_id: userId,
        p_preset_result: result,
      });

      if (error) throw error;
      const response = data as { success: boolean; message: string };
      if (!response?.success) throw new Error(response?.message || "Ошибка");
      return response;
    },
    onSuccess: () => {
      toast.success("Результат колеса установлен");
      queryClient.invalidateQueries({ queryKey: ["admin-wheel-presets"] });
      setSelectedUserId(null);
      setSelectedResult("");
      setSearchQuery("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove preset mutation
  const removePresetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { adminId, sessionToken } = getAdminCreds();

      const { data, error } = await supabase.rpc("admin_remove_wheel_preset", {
        p_admin_id: adminId,
        p_session_token: sessionToken,
        p_target_user_id: userId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Пресет удалён");
      queryClient.invalidateQueries({ queryKey: ["admin-wheel-presets"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSetPreset = () => {
    if (!selectedUserId || !selectedResult) {
      toast.error("Выберите игрока и результат");
      return;
    }
    setPresetMutation.mutate({ userId: selectedUserId, result: selectedResult });
  };

  const getResultLabel = (result: string) => {
    const option = RESULT_OPTIONS.find(o => o.value === result);
    return option ? option.label : result;
  };

  const getResultIcon = (result: string) => {
    const option = RESULT_OPTIONS.find(o => o.value === result);
    if (!option) return null;
    const Icon = option.icon;
    return <Icon className={`h-4 w-4 ${option.color}`} />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Подкрутка колеса
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search user */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по username или ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUserId(user.id);
                    setSearchQuery(user.username);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2 ${
                    selectedUserId === user.id ? "bg-accent" : ""
                  }`}
                >
                  <VipUsername
                    username={user.username}
                    isVip={user.is_vip}
                    gradientColor={user.gradient_color}
                  />
                  <span className="text-muted-foreground text-sm">#{user.public_id}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Select result */}
        <Select value={selectedResult} onValueChange={setSelectedResult}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите результат" />
          </SelectTrigger>
          <SelectContent>
            {RESULT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <option.icon className={`h-4 w-4 ${option.color}`} />
                  {option.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleSetPreset}
          disabled={!selectedUserId || !selectedResult || setPresetMutation.isPending}
          className="w-full"
        >
          Установить результат
        </Button>

        {/* Active presets */}
        {activePresets.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Активные пресеты:</h4>
            <div className="space-y-2">
              {activePresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-2 bg-accent/50 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    {preset.profile && (
                      <>
                        <VipUsername
                          username={preset.profile.username}
                          isVip={preset.profile.is_vip}
                          gradientColor={preset.profile.gradient_color as any}
                        />
                        <span className="text-muted-foreground text-sm">
                          #{preset.profile.public_id}
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground">→</span>
                    <div className="flex items-center gap-1">
                      {getResultIcon(preset.preset_result)}
                      <span className="text-sm">{getResultLabel(preset.preset_result)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePresetMutation.mutate(preset.user_id)}
                    disabled={removePresetMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
