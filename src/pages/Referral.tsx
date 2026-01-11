import { AuthGuard, useAuth } from "@/components/AuthGuard";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Copy, Gift, Users, ArrowLeft, TrendingUp, Star, Coins } from "lucide-react";

const Referral = () => {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const navigate = useNavigate();

  const { data: referralStats } = useQuery({
    queryKey: ["referral-stats", user?.id],
    queryFn: async () => {
      // Получаем список приглашенных
      const { data: referred } = await supabase
        .from("profiles")
        .select("id, username, created_at, balance")
        .eq("referred_by", user!.id)
        .order("created_at", { ascending: false });

      // Получаем награды
      const { data: rewards } = await supabase
        .from("referral_rewards")
        .select("*")
        .eq("referrer_id", user!.id);

      const totalEarned = rewards?.reduce((sum, r) => sum + Number(r.reward_amount), 0) || 0;
      const totalReferred = referred?.length || 0;
      const totalXpEarned = totalReferred * 30;

      return {
        referredUsers: referred || [],
        totalReferred,
        totalEarned,
        totalXpEarned,
        rewards: rewards || []
      };
    },
    enabled: !!user?.id,
  });

  const copyReferralCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast.success("Реферальный код скопирован!");
    }
  };

  const copyReferralLink = () => {
    if (profile?.referral_code) {
      const link = `https://t.me/casinocasino123_bot/casic?startapp=${profile.referral_code}`;
      navigator.clipboard.writeText(link);
      toast.success("Реферальная ссылка скопирована!");
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <header className="sticky top-0 z-50 border-b border-border/50 bg-card/50 backdrop-blur">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                <Gift className="h-6 w-6" />
                Реферальная программа
              </h1>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Баланс</div>
              <div className="font-bold text-primary">{profile?.balance?.toFixed(2)}₽</div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Информационная карточка */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Gift className="h-12 w-12 mx-auto text-primary" />
                <h2 className="text-2xl font-bold">Приглашай друзей — получай награды!</h2>
                <div className="space-y-2 text-left max-w-md mx-auto">
                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                    <Coins className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                    <div>
                      <div className="font-bold">+10 монет новому игроку</div>
                      <div className="text-sm text-muted-foreground">Твой друг получит 10₽ при регистрации по твоему коду</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                    <Star className="h-6 w-6 text-purple-500 flex-shrink-0" />
                    <div>
                      <div className="font-bold">+30 XP за каждого реферала</div>
                      <div className="text-sm text-muted-foreground">Повышай уровень быстрее с каждым приглашенным другом</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-500 flex-shrink-0" />
                    <div>
                      <div className="font-bold">3% с каждого выигрыша друга</div>
                      <div className="text-sm text-muted-foreground">Получай комиссию с любых выигрышей приглашенных игроков</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ваш реферальный код */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Ваш реферальный код
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 bg-muted p-4 rounded-lg text-center">
                  <div className="text-3xl font-bold tracking-wider text-primary">
                    {profile?.referral_code || "Загрузка..."}
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={copyReferralCode}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Код
                </Button>
              </div>
              
              {/* Referral Link */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-center">Или поделись ссылкой:</div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted p-3 rounded-lg text-center overflow-hidden">
                    <div className="text-sm text-primary truncate">
                      t.me/casinocasino123_bot/casic?startapp={profile?.referral_code}
                    </div>
                  </div>
                  <Button
                    size="lg"
                    onClick={copyReferralLink}
                    className="gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                  >
                    <Copy className="h-4 w-4" />
                    Ссылка
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                Отправь ссылку другу — он получит 10₽ и его код реферала заполнится автоматически!
              </p>
            </CardContent>
          </Card>

          {/* Note about referral activation */}
          {!profile?.referred_by && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                💡 Реферальный код применяется автоматически при регистрации через ссылку друга
              </p>
            </div>
          )}

          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Users className="h-8 w-8 mx-auto text-primary" />
                  <div className="text-3xl font-bold text-primary">
                    {referralStats?.totalReferred || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Приглашено</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Coins className="h-8 w-8 mx-auto text-yellow-500" />
                  <div className="text-3xl font-bold text-yellow-500">
                    {referralStats?.totalEarned?.toFixed(0) || 0}₽
                  </div>
                  <div className="text-sm text-muted-foreground">Заработано</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Star className="h-8 w-8 mx-auto text-purple-500" />
                  <div className="text-3xl font-bold text-purple-500">
                    +{referralStats?.totalXpEarned || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">XP получено</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <TrendingUp className="h-8 w-8 mx-auto text-green-500" />
                  <div className="text-3xl font-bold text-green-500">
                    3%
                  </div>
                  <div className="text-sm text-muted-foreground">Комиссия</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Список приглашенных друзей */}
          {referralStats && referralStats.referredUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Приглашенные друзья</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {referralStats.referredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <div className="font-bold">{user.username}</div>
                        <div className="text-sm text-muted-foreground">
                          Присоединился: {new Date(user.created_at).toLocaleDateString("ru-RU")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-purple-500/20">+30 XP</Badge>
                        <Badge variant="outline" className="bg-green-500/20">3% с выигрышей</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {referralStats && referralStats.referredUsers.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <div className="text-xl font-bold text-muted-foreground mb-2">
                  Вы еще не пригласили друзей
                </div>
                <p className="text-muted-foreground">
                  Поделитесь своим кодом и начните зарабатывать!
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </AuthGuard>
  );
};

export default Referral;
