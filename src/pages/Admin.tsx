import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { PromocodeManager } from "@/components/admin/PromocodeManager";
import { AdminStats } from "@/components/admin/AdminStats";
import { SupportTicketsAdmin } from "@/components/admin/SupportTicketsAdmin";
import { FreebetGiver } from "@/components/admin/FreebetGiver";
import { FreebetManager } from "@/components/admin/FreebetManager";
import { GameRestrictionsManager } from "@/components/admin/GameRestrictionsManager";
import { SystemNotificationsManager } from "@/components/admin/SystemNotificationsManager";
import { AllUserBets } from "@/components/admin/AllUserBets";
import { WithdrawalRequestsManager } from "@/components/admin/WithdrawalRequestsManager";
import { XpManager } from "@/components/admin/XpManager";
import { WheelGiver } from "@/components/admin/WheelGiver";
import { GiveawayManager } from "@/components/admin/GiveawayManager";
import { GiveawayWinGiver } from "@/components/admin/GiveawayWinGiver";
import { GameWinGiver } from "@/components/admin/GameWinGiver";
import { SkinGiver } from "@/components/admin/SkinGiver";
import { SkinManager } from "@/components/admin/SkinManager";
import { DemoBalanceManager } from "@/components/admin/DemoBalanceManager";
import { BuffManager } from "@/components/admin/BuffManager";
import { TaskManager } from "@/components/admin/TaskManager";
import { PlayerWinsStats } from "@/components/admin/PlayerWinsStats";
import { WheelPresetManager } from "@/components/admin/WheelPresetManager";
import { EmailAccountManager } from "@/components/admin/EmailAccountManager";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BettingTournamentManager } from "@/components/admin/BettingTournamentManager";
import { BulkDataImport } from "@/components/admin/BulkDataImport";
import { BettingManagementSection } from "@/components/admin/BettingManagementSection";

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isLoading, profile } = useProfile(user?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoading && !isAdmin && user?.id) {
      navigate("/");
      toast.error("Доступ запрещен");
    }
  }, [isAdmin, isLoading, navigate, user?.id]);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`*, user_roles(role)`)
        .order("created_at", { ascending: false });
      
      if (profilesError) throw profilesError;
      
      const { data: moderationData } = await supabase
        .from("user_moderation")
        .select("user_id, is_banned, muted_until");
      
      return (profilesData || []).map(profile => {
        const moderation = moderationData?.find(m => m.user_id === profile.id);
        return { ...profile, user_moderation: moderation ? [moderation] : [] };
      });
    },
  });

  const { data: gameSettings } = useQuery({
    queryKey: ["admin-game-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("game_settings").select("*").order("game_name");
      return data || [];
    },
  });

  const [muteInputs, setMuteInputs] = useState<{[key: string]: number}>({});

  const updateGameStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "maintenance" }) => {
      const { data, error } = await supabase.rpc("admin_toggle_game_status", {
        _admin_id: user?.id,
        _game_id: id,
        _status: status,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Ошибка");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-game-settings"] });
      queryClient.invalidateQueries({ queryKey: ["game-settings"] });
      toast.success("Статус игры обновлен");
    },
    onError: (error: any) => {
      toast.error(error.message || "Ошибка обновления статуса");
    },
  });

  const updateUserBalance = async (userId: string, amount: number) => {
    try {
      await supabase.rpc("update_balance", { user_id: userId, amount });
      await supabase.from("transactions").insert({
        user_id: userId, amount, type: "admin_adjustment", description: "Корректировка баланса админом",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Баланс обновлен");
    } catch (error) {
      toast.error("Ошибка обновления баланса");
    }
  };

  const toggleBan = async (userId: string, currentBan: boolean, banReason?: string) => {
    try {
      const newBanStatus = !currentBan;
      const { error } = await supabase.rpc("set_user_ban", {
        _user_id: userId,
        _is_banned: newBanStatus,
        _ban_reason: newBanStatus ? (banReason || "Нарушение правил") : null,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(newBanStatus ? "✅ Пользователь заблокирован" : "✅ Пользователь разблокирован");
    } catch (error) {
      toast.error("❌ Ошибка обновления бана: " + (error as any).message);
    }
  };

  const toggleMute = async (userId: string, currentMute: boolean) => {
    try {
      const muteSeconds = currentMute ? 0 : (muteInputs[userId] || 60);
      const { error } = await supabase.rpc("set_user_mute", { _user_id: userId, _mute_seconds: muteSeconds });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(currentMute ? "✅ Пользователь размучен" : `✅ Пользователь замучен на ${muteSeconds}с`);
    } catch (error) {
      toast.error("❌ Ошибка обновления мута: " + (error as any).message);
    }
  };

  const toggleMaxWin = async (userId: string, currentMaxWin: boolean) => {
    try {
      const { error } = await supabase.rpc("set_guaranteed_max_win", { _user_id: userId, _enabled: !currentMaxWin });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(!currentMaxWin ? "🎰 Макс вин активирован!" : "Макс вин отключен");
    } catch (error) {
      toast.error("Ошибка активации макс вина");
    }
  };

  const deleteUserProfile = async (userId: string, username: string) => {
    const confirmed = window.confirm(`Удалить профиль ${username}? Это действие необратимо!`);
    if (!confirmed) return;
    try {
      const { error } = await supabase.rpc("delete_user_profile", { _user_id: userId });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("✅ Профиль удален");
    } catch (error) {
      toast.error("❌ Ошибка удаления профиля: " + (error as any).message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-background/80">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-50">
          <div className="container mx-auto px-2 sm:px-4 py-3 flex items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              ⚙️ Админ Панель
            </h1>
            <Button onClick={() => navigate("/")} variant="outline" size="sm">← На главную</Button>
          </div>
        </header>

        <main className="container mx-auto px-2 sm:px-4 py-4 space-y-4">
          <Accordion type="multiple" className="space-y-3">
            {/* Статистика */}
            <AccordionItem value="stats" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">📊 Статистика</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <AdminStats />
              </AccordionContent>
            </AccordionItem>

            {/* Статистика побед */}
            <AccordionItem value="player-wins" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">🏆 Статистика побед игроков</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <PlayerWinsStats />
              </AccordionContent>
            </AccordionItem>

            {/* Заявки на вывод */}
            <AccordionItem value="withdrawals" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">💸 Заявки на вывод</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <WithdrawalRequestsManager />
              </AccordionContent>
            </AccordionItem>

            {/* Макс вин */}
            <AccordionItem value="max-win" className="border border-yellow-500/50 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">🎰 Режим Макс Выигрыша</span>
                  {users?.filter(user => user.guaranteed_max_win).length > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      {users?.filter(user => user.guaranteed_max_win).length} АКТИВНЫХ
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {users?.filter(user => user.guaranteed_max_win).length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">Нет активных режимов</div>
                  ) : (
                    users?.filter(user => user.guaranteed_max_win).map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30 animate-pulse">
                        <div>
                          <div className="font-bold text-yellow-400">🏆 {user.username}</div>
                          <div className="text-xs text-muted-foreground">Следующая игра - гарантированный макс выигрыш!</div>
                        </div>
                        <Button size="sm" variant="destructive" onClick={() => toggleMaxWin(user.id, true)}>❌ Отключить</Button>
                      </div>
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Пользователи */}
            <AccordionItem value="users" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">👥 Пользователи ({users?.length || 0})</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {users?.map((u) => {
                    const isBanned = u.user_moderation?.[0]?.is_banned || u.is_banned;
                    const isMuted = u.user_moderation?.[0]?.muted_until ? new Date(u.user_moderation[0].muted_until) > new Date() : false;
                    const isUserAdmin = u.user_roles?.some((r: any) => r.role === 'admin');
                    const hasMaxWin = u.guaranteed_max_win;
                    const isVip = u.is_vip;
                    
                    return (
                      <div key={u.id} className="p-3 bg-muted/20 rounded-lg space-y-2 border border-border/30">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold ${(isUserAdmin || isVip) ? 'vip-gradient-text' : ''}`}>{u.username}</span>
                          {isVip && <Badge className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500">⭐ VIP</Badge>}
                          {isUserAdmin && <Badge variant="secondary" className="text-xs">👑 Админ</Badge>}
                          {isBanned && <Badge variant="destructive" className="text-xs">🚫 Бан</Badge>}
                          {isMuted && <Badge variant="outline" className="text-xs">🔇 Мут</Badge>}
                          {hasMaxWin && <Badge className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse">🎰 МАКС ВИН</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-secondary font-semibold">ID: {u.public_id}</span> • 
                          <span className="text-primary font-semibold"> Баланс: {u.balance?.toFixed(2)}₽</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <Input type="number" placeholder="Баланс" className="h-7 text-xs" onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const amount = parseFloat(e.currentTarget.value);
                              if (!isNaN(amount) && amount !== 0) {
                                updateUserBalance(u.id, amount);
                                e.currentTarget.value = '';
                              }
                            }
                          }} />
                          <Input type="number" placeholder="Мут (сек)" className="h-7 text-xs" value={muteInputs[u.id] || 60}
                            onChange={(e) => setMuteInputs({...muteInputs, [u.id]: parseInt(e.target.value) || 60})} />
                          <Button size="sm" variant={isBanned ? "default" : "destructive"} className="text-xs h-7"
                            onClick={() => isBanned ? toggleBan(u.id, isBanned) : toggleBan(u.id, isBanned, prompt("Причина бана:") || undefined)}>
                            {isBanned ? "✅ Разбан" : "🚫 Бан"}
                          </Button>
                          <Button size="sm" variant={isMuted ? "default" : "outline"} className="text-xs h-7" onClick={() => toggleMute(u.id, isMuted)}>
                            {isMuted ? "🔊 Размут" : "🔇 Мут"}
                          </Button>
                          <Button size="sm" variant={hasMaxWin ? "default" : "secondary"} className={`text-xs h-7 ${hasMaxWin ? 'bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse' : ''}`}
                            onClick={() => toggleMaxWin(u.id, hasMaxWin)}>
                            {hasMaxWin ? "🎰 МАКС!" : "🎰 Макс Вин"}
                          </Button>
                          <Button size="sm" variant={isVip ? "default" : "outline"} className={`text-xs h-7 ${isVip ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : ''}`}
                            onClick={async () => {
                              try {
                                const { error } = await supabase.rpc("admin_set_vip", { _user_id: u.id, _is_vip: !isVip });
                                if (error) throw error;
                                queryClient.invalidateQueries({ queryKey: ["admin-users"] });
                                toast.success(isVip ? "VIP снят" : "VIP выдан!");
                              } catch { toast.error("Ошибка"); }
                            }}>
                            {isVip ? "⭐ Снять VIP" : "⭐ VIP"}
                          </Button>
                          <Button size="sm" variant="destructive" className="text-xs h-7 col-span-2" onClick={() => deleteUserProfile(u.id, u.username)}>🗑️ Удалить</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Управление играми */}
            <AccordionItem value="game-settings" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">🎮 Управление играми</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {gameSettings?.map((game) => (
                    <div key={game.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div>
                        <div className="font-bold text-sm">{game.game_name}</div>
                        <div className="text-xs text-muted-foreground">Мин: {game.min_bet}₽ • Макс: {game.max_bet}₽</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={game.status === "active" ? "default" : "destructive"}>
                          {game.status === "active" ? "✅ Активна" : "🔧 Перерыв"}
                        </Badge>
                        <Switch checked={game.status === "active"} onCheckedChange={(checked) =>
                          updateGameStatus.mutate({ id: game.id, status: checked ? "active" : "maintenance" })} />
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Промокоды */}
            <AccordionItem value="promocodes" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">🎫 Промокоды</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <PromocodeManager adminId={user?.id || ""} />
              </AccordionContent>
            </AccordionItem>

            {/* Фрибеты */}
            <AccordionItem value="freebets" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">🎁 Выдача фрибетов</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <FreebetGiver adminId={user!.id} />
              </AccordionContent>
            </AccordionItem>

            {/* Управление фрибетами */}
            <AccordionItem value="freebet-manager" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">💰 Управление фрибетами</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <FreebetManager adminId={user!.id} />
              </AccordionContent>
            </AccordionItem>

            {/* Демо счета */}
            <AccordionItem value="demo" className="border border-green-500/30 rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold text-green-400">🎮 Демо-счета</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <DemoBalanceManager adminId={user!.id} />
              </AccordionContent>
            </AccordionItem>

            {/* XP */}
            <AccordionItem value="xp" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">⭐ Управление XP</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <XpManager adminId={user!.id} />
              </AccordionContent>
            </AccordionItem>

            {/* Поддержка */}
            <AccordionItem value="support" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">🎫 Тикеты поддержки</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <SupportTicketsAdmin />
              </AccordionContent>
            </AccordionItem>

            {/* Ограничения */}
            <AccordionItem value="restrictions" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">🚫 Ограничения игр</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <GameRestrictionsManager adminId={user?.id || ""} />
              </AccordionContent>
            </AccordionItem>

            {/* Уведомления */}
            <AccordionItem value="notifications" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">📢 Уведомления</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <SystemNotificationsManager />
              </AccordionContent>
            </AccordionItem>

            {/* Розыгрыши */}
            <AccordionItem value="giveaways" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">🎁 Розыгрыши</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <GiveawayManager adminId={user?.id || ""} />
                <GiveawayWinGiver adminId={user?.id || ""} />
                <GameWinGiver adminId={user?.id || ""} />
                <div className="pt-4 border-t">
                  <h4 className="font-bold mb-3">⚡ Баффы</h4>
                  <BuffManager adminId={user?.id || ""} />
                </div>
                <div className="pt-4 border-t">
                  <h4 className="font-bold mb-3">🎯 Подкрутка колеса</h4>
                  <WheelPresetManager />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Скины */}
            <AccordionItem value="skins" className="border border-purple-500/30 rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold text-purple-400">📦 Скины</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <SkinGiver adminId={user?.id || ""} />
                <SkinManager />
              </AccordionContent>
            </AccordionItem>

            {/* Управление ставками */}
            <BettingManagementSection adminId={user?.id || ""} />

            {/* Турниры ставок */}
            <AccordionItem value="betting-tournaments" className="border border-amber-500/30 rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold text-amber-500">🏆 Турниры ставок</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <BettingTournamentManager adminId={user?.id || ""} />
              </AccordionContent>
            </AccordionItem>

            {/* Ставки */}
            <AccordionItem value="bets" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">📋 Все ставки</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <AllUserBets />
              </AccordionContent>
            </AccordionItem>

            {/* Колёса */}
            <AccordionItem value="wheels" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">🎡 Выдача колёс</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {user?.id && <WheelGiver adminId={user.id} />}
              </AccordionContent>
            </AccordionItem>

            {/* Задания */}
            <AccordionItem value="tasks" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">📝 Задания</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {user?.id && <TaskManager adminId={user.id} />}
              </AccordionContent>
            </AccordionItem>

            {/* Email */}
            <AccordionItem value="email" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">📧 Email аккаунты</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {user?.id && <EmailAccountManager userId={user.id} />}
              </AccordionContent>
            </AccordionItem>

            {/* Импорт данных */}
            <AccordionItem value="bulk-import" className="border rounded-lg bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-lg font-bold">📦 Массовый импорт</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <BulkDataImport />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </main>
      </div>
    </AuthGuard>
  );
};

export default Admin;