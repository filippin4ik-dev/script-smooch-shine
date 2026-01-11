import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { useProfile } from "@/hooks/useProfile";
import { useSnowContext } from "@/App";

// Components
import { Button } from "@/components/ui/button";
import { GradientColorPicker } from "@/components/GradientColorPicker";
import { ProfileBackgroundPicker, ProfileBackground } from "@/components/ProfileBackgroundPicker";
import { SkinMarket } from "@/components/SkinMarket";
import { SkinInventory } from "@/components/SkinInventory";
import { GradientColor } from "@/components/VipUsername";

// New profile components
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { StatsGrid } from "@/components/profile/StatsGrid";
import { GameHistoryList } from "@/components/profile/GameHistoryList";
import { GameSearchByNumber } from "@/components/profile/GameSearchByNumber";
import { LevelCard } from "@/components/profile/LevelCard";
import { ProfileNavButtons } from "@/components/profile/ProfileNavButtons";
import { EmailVerification } from "@/components/profile/EmailVerification";

// Icons
import { 
  ArrowLeft, 
  Wallet,
  Gift,
  Sparkles,
  ChevronRight,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveSection = "main" | "history" | "transactions" | "market" | "inventory" | "settings";

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, isAdmin } = useProfile(user?.id);
  const { isSnowEnabled, toggleSnow } = useSnowContext();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<ActiveSection>("main");

  // Queries
  const { data: gameHistory } = useQuery({
    queryKey: ["game-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_game_history_v2", {
        _user_id: user!.id,
        _limit: 50
      });
      if (error) {
        console.error("Game history error:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.id,
  });


  const { data: referralStats } = useQuery({
    queryKey: ["profile-referral-stats", user?.id],
    queryFn: async () => {
      const { data: referred } = await supabase
        .from("profiles")
        .select("id, username, created_at")
        .eq("referred_by", user!.id);
      
      const { data: rewards } = await supabase
        .from("referral_rewards")
        .select("reward_amount")
        .eq("referrer_id", user!.id);

      return {
        totalReferred: referred?.length || 0,
        totalEarned: rewards?.reduce((sum, r) => sum + Number(r.reward_amount), 0) || 0,
      };
    },
    enabled: !!user?.id,
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Mutations
  const updateUsername = useMutation({
    mutationFn: async (username: string) => {
      const { data, error } = await supabase.rpc("update_username", {
        _user_id: user!.id,
        _new_username: username,
      });
      if (error) throw error;
      return data?.[0];
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      } else {
        toast.error(data?.message || "Ошибка");
      }
    },
  });

  // Stats calculations
  const totalWins = profile?.total_wins || 0;
  const totalLosses = profile?.total_losses || 0;
  const totalGames = totalWins + totalLosses;
  const winRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0";

  const handleNavigate = (section: string) => {
    setActiveSection(section as ActiveSection);
  };

  // Render section content
  const renderSection = () => {
    switch (activeSection) {
      case "history":
        return (
          <div className="space-y-4 animate-fade-in">
            <GameHistoryList games={gameHistory || []} />
          </div>
        );
      
      case "transactions":
        return (
          <div className="space-y-2 animate-fade-in">
            {transactions?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Нет транзакций</p>
              </div>
            ) : (
              transactions?.map((tx, index) => (
                <div
                  key={tx.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl",
                    "bg-card/50 border border-border/30",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div>
                    <div className="font-medium text-sm">{tx.description || tx.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString("ru-RU")}
                    </div>
                  </div>
                  <div className={cn(
                    "font-bold",
                    tx.amount > 0 ? "text-primary" : "text-destructive"
                  )}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(0)}₽
                  </div>
                </div>
              ))
            )}
          </div>
        );
      
      case "market":
        return user ? (
          <div className="animate-fade-in">
            <SkinMarket 
              userId={user.id} 
              balance={profile?.balance || 0}
              demoBalance={profile?.demo_balance || 0}
              onBalanceUpdate={() => queryClient.invalidateQueries({ queryKey: ["profile"] })} 
            />
          </div>
        ) : null;
      
      case "inventory":
        return user ? (
          <div className="animate-fade-in">
            <SkinInventory 
              userId={user.id} 
              onBalanceUpdate={() => queryClient.invalidateQueries({ queryKey: ["profile"] })} 
            />
          </div>
        ) : null;
      
      case "settings":
        return (
          <div className="space-y-4 animate-fade-in">
            {/* Game Search by Number */}
            <GameSearchByNumber />

            {/* Email Verification */}
            {user && (
              <EmailVerification
                userId={user.id}
                currentEmail={(profile as any)?.email}
                emailVerifiedAt={(profile as any)?.email_verified_at}
                onVerified={() => queryClient.invalidateQueries({ queryKey: ["profile"] })}
              />
            )}

            {(isAdmin || profile?.is_vip) && (
              <GradientColorPicker
                currentColor={(profile?.gradient_color as GradientColor) || "gold"}
                onColorChange={async (color) => {
                  const { error } = await supabase
                    .from("profiles")
                    .update({ gradient_color: color })
                    .eq("id", user!.id);
                  
                  if (!error) {
                    toast.success("Цвет изменен!");
                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                  }
                }}
              />
            )}

            <ProfileBackgroundPicker
              currentBackground={((profile as any)?.profile_background as ProfileBackground) || "none"}
              onBackgroundChange={async (background) => {
                const { error } = await supabase
                  .from("profiles")
                  .update({ profile_background: background })
                  .eq("id", user!.id);
                
                if (!error) {
                  toast.success("Фон обновлён!");
                  queryClient.invalidateQueries({ queryKey: ["profile"] });
                }
              }}
              showSnowToggle={true}
              isSnowEnabled={isSnowEnabled}
              onSnowToggle={toggleSnow}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  // Main view or section view
  if (activeSection !== "main") {
    const sectionTitles: Record<ActiveSection, string> = {
      main: "",
      history: "История игр",
      transactions: "Транзакции",
      market: "Маркет скинов",
      inventory: "Инвентарь",
      settings: "Настройки",
    };

    return (
      <AuthGuard>
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setActiveSection("main")}
                className="hover:bg-primary/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-bold">{sectionTitles[activeSection]}</h1>
              <div className="w-10" />
            </div>
          </header>

          <main className="container mx-auto px-4 py-6 max-w-lg pb-24">
            {renderSection()}
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <ProfileHeader onSettingsClick={() => setActiveSection("settings")} />

        <main className="container mx-auto px-4 py-6 max-w-lg space-y-4 pb-24">
          {/* Profile Card */}
          <ProfileCard
            profile={profile}
            isAdmin={isAdmin}
            onUpdateUsername={(username) => updateUsername.mutate(username)}
            isUpdating={updateUsername.isPending}
            onAvatarUpdated={() => queryClient.invalidateQueries({ queryKey: ["profile"] })}
          />

          {/* Level Card */}
          {user?.id && (
            <LevelCard 
              userId={user.id} 
              xp={profile?.xp || 0} 
              level={profile?.level || 1} 
            />
          )}

          {/* Stats Grid */}
          <StatsGrid
            totalWins={totalWins}
            totalLosses={totalLosses}
            winRate={winRate}
            totalGames={totalGames}
          />

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 bg-card/50 border-border/50 hover:bg-primary/10 hover:border-primary/50"
              onClick={() => navigate("/deposit")}
            >
              <Wallet className="w-5 h-5 text-primary" />
              <span className="text-sm">Пополнить</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 bg-card/50 border-border/50 hover:bg-green-500/10 hover:border-green-500/50"
              onClick={() => navigate("/withdraw")}
            >
              <Gift className="w-5 h-5 text-green-400" />
              <span className="text-sm">Вывести</span>
            </Button>
          </div>

          {/* Referral Banner */}
          <div 
            className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 cursor-pointer hover:border-purple-500/50 transition-all"
            onClick={() => navigate("/referral")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <div className="font-bold text-sm">Реферальная программа</div>
                  <div className="text-xs text-muted-foreground">
                    {referralStats?.totalReferred || 0} друзей • {referralStats?.totalEarned?.toFixed(0) || 0}₽ заработано
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          {/* Navigation Buttons */}
          <ProfileNavButtons 
            onNavigate={handleNavigate} 
            activeTab="" 
          />
        </main>
      </div>
    </AuthGuard>
  );
};

export default Profile;
