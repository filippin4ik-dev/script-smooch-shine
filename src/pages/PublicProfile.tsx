import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VipUsername, GradientColor } from "@/components/VipUsername";
import { AdminProfileBadge } from "@/components/AdminProfileBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AnimatedProfileBackground } from "@/components/AnimatedProfileBackground";
import { ProfileBackground } from "@/components/ProfileBackgroundPicker";
import { 
  Copy, 
  Trophy, 
  Target, 
  Gamepad2, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft,
  Zap,
  Star,
  Award
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PublicProfile = () => {
  const navigate = useNavigate();
  const { publicId } = useParams<{ publicId: string }>();
  
  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", publicId],
    queryFn: async () => {
      if (!publicId) return null;
      const { data: publicData } = await supabase
        .from("public_profiles")
        .select("*")
        .eq("public_id", parseInt(publicId))
        .single();
      
      if (!publicData) return null;
      
      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("profile_background, email_verified_at")
        .eq("id", publicData.id)
        .single();
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", publicData.id);
      
      return {
        ...publicData,
        profile_background: fullProfile?.profile_background || "none",
        email_verified_at: fullProfile?.email_verified_at || null,
        user_roles: roles || [],
      };
    },
    enabled: !!publicId,
  });

  const { data: gameHistory } = useQuery({
    queryKey: ["public-game-history", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("game_history")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!profile?.id,
  });

  const { data: betsStats } = useQuery({
    queryKey: ["public-bets-stats", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { total: 0, won: 0, lost: 0 };
      
      const { data: bets } = await supabase
        .from("user_bets")
        .select("status")
        .eq("user_id", profile.id);
      
      const total = bets?.length || 0;
      const won = bets?.filter(b => b.status === "won").length || 0;
      const lost = bets?.filter(b => b.status === "lost").length || 0;
      
      return { total, won, lost };
    },
    enabled: !!profile?.id,
  });

  const getGameIcon = (gameName: string) => {
    const icons: Record<string, string> = {
      dice: "🎲", crash: "🚀", roulette: "🎡", blackjack: "🃏",
      hilo: "🎯", towers: "🗼", mines: "💣", slots: "🎰",
      cases: "📦", "crypto-trading": "📈", "horse-racing": "🏇",
      penalty: "⚽", balloon: "🎈", plinko: "⚪", streak_bonus: "🔥",
    };
    return icons[gameName] || "🎮";
  };

  const isAdmin = Array.isArray(profile?.user_roles) && 
    profile.user_roles.some((r: any) => r.role === "admin");
  const isVip = profile?.is_vip === true;

  const totalGames = (profile?.total_wins || 0) + (profile?.total_losses || 0);
  const winRate = totalGames > 0 ? ((profile?.total_wins || 0) / totalGames * 100).toFixed(1) : "0.0";

  const copyProfileLink = () => {
    const link = `https://t.me/casinocasino123_bot/casic?startapp=profile_${publicId}`;
    navigator.clipboard.writeText(link);
    toast.success("Ссылка скопирована!");
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AuthGuard>
    );
  }

  if (!profile) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
            <div className="container mx-auto px-4 py-3">
              <Button onClick={() => navigate("/")} variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </div>
          </header>
          <main className="container mx-auto px-4 py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Профиль не найден</p>
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <Button onClick={() => navigate("/")} variant="ghost" size="icon" className="hover:bg-primary/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">Профиль</h1>
            <Button variant="ghost" size="icon" onClick={copyProfileLink} className="hover:bg-primary/10">
              <Copy className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-lg space-y-4 pb-24">
          {/* Profile Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card/95 to-card/90 border border-border/50 shadow-xl">
            <AnimatedProfileBackground background={(profile.profile_background as ProfileBackground) || "none"} />
            
            {isAdmin && (
              <div className="absolute top-3 right-3 z-20">
                <AdminProfileBadge variant="compact" />
              </div>
            )}

            <div className="relative z-10 p-6">
              {/* Avatar & Username */}
              <div className="flex items-center gap-4 mb-6">
                <div className={cn(
                  "w-20 h-20 rounded-2xl flex items-center justify-center text-4xl",
                  "bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20",
                  "border-2 border-primary/30 shadow-lg"
                )}>
                  {isAdmin ? "👑" : isVip ? "💎" : "🎮"}
                </div>
                <div className="flex-1 min-w-0">
                  <VipUsername 
                    username={profile.username} 
                    isAdmin={isAdmin}
                    isVip={isVip}
                    gradientColor={(profile.gradient_color as GradientColor) || "gold"}
                    level={profile.level}
                    showLevel={true}
                    className="text-xl font-bold truncate"
                  />
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {profile.email_verified_at && <VerifiedBadge />}
                    <Badge variant="outline" className="text-xs border-border/50 bg-background/50">
                      ID: {profile.public_id}
                    </Badge>
                    {isVip && (
                      <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-xs border-0">
                        <Star className="w-3 h-3 mr-1" />
                        VIP
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Level & XP */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-background/30 border border-border/30 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                  <Award className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Уровень</span>
                    <span className="font-bold text-primary">{profile.level || 1} LVL</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-muted-foreground">Опыт</span>
                    <span className="font-medium text-foreground/80">{profile.xp || 0} XP</span>
                  </div>
                </div>
              </div>

              {/* Join Date */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Зарегистрирован: {new Date(profile.created_at).toLocaleDateString("ru-RU")}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 text-center">
              <TrendingUp className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-400">{profile.total_wins || 0}</div>
              <div className="text-xs text-muted-foreground">Побед</div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 text-center">
              <TrendingDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
              <div className="text-2xl font-bold text-red-400">{profile.total_losses || 0}</div>
              <div className="text-xs text-muted-foreground">Поражений</div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 text-center">
              <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
              <div className="text-2xl font-bold text-primary">{winRate}%</div>
              <div className="text-xs text-muted-foreground">Винрейт</div>
            </div>
          </div>

          {/* Betting Stats */}
          {betsStats && betsStats.total > 0 && (
            <div className="p-4 rounded-2xl bg-card/50 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-primary" />
                <span className="font-bold">Статистика ставок</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold">{betsStats.total}</div>
                  <div className="text-xs text-muted-foreground">Всего</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400">{betsStats.won}</div>
                  <div className="text-xs text-muted-foreground">Выиграно</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">{betsStats.lost}</div>
                  <div className="text-xs text-muted-foreground">Проиграно</div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Games */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="font-bold">Последние игры</span>
            </div>
            
            {gameHistory && gameHistory.length > 0 ? (
              <div className="space-y-2">
                {gameHistory.map((game: any, index: number) => (
                  <div
                    key={game.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl",
                      "bg-card/50 border border-border/30",
                      "animate-fade-in"
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getGameIcon(game.game_name)}</span>
                      <div>
                        <div className="font-medium capitalize text-sm">
                          {game.game_name === 'streak_bonus' ? 'Бонус серии' : game.game_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(game.created_at).toLocaleDateString("ru-RU")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "font-bold",
                        game.win_amount > 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {game.win_amount > 0 ? '+' : ''}{game.win_amount?.toFixed(0)}₽
                      </div>
                      {game.bet_amount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Ставка: {game.bet_amount?.toFixed(0)}₽
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gamepad2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Игр пока нет</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
};

export default PublicProfile;