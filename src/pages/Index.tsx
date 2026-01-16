import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";
import { useFreebetMode } from "@/hooks/useFreebetMode";
import { NetworkGuard } from "@/components/NetworkGuard";
import { GameErrorBoundary } from "@/components/GameErrorBoundary";
import WebApp from "@twa-dev/sdk";
import { GameCard } from "@/components/GameCard";
import blackjackImg from "@/assets/blackjack-new.webp";
import penaltyImg from "@/assets/penalty-new.webp";
import crashImg from "@/assets/crash-new.webp";
import minesImg from "@/assets/mines-new.webp";
import diceImg from "@/assets/dice-new.webp";
import balloonImg from "@/assets/balloon-new.webp";
import hiloImg from "@/assets/hilo-new.webp";
import slotsImg from "@/assets/sweet-bonanza.png";
import dogsHouseImg from "@/assets/dogs-house-new.webp";
import towersImg from "@/assets/towers-new.webp";
import rouletteImg from "@/assets/roulette-new.webp";
import casesImg from "@/assets/cases-new.webp";
import sportsBettingImg from "@/assets/sports-betting-new.webp";
import cryptoImg from "@/assets/crypto-trading.webp";
import horseRacingImg from "@/assets/horse-racing-new.webp";
import chickenRoadImg from "@/assets/chicken-road-new.webp";
import casinoLogo from "/plitebet-logo.png";
import { PromoBanner } from "@/components/PromoBanner";
import { LiveStats } from "@/components/LiveStats";
import { TopWinners } from "@/components/TopWinners";
import { LiveWinners } from "@/components/LiveWinners";
import { TelegramPromo } from "@/components/TelegramPromo";
import { DiceGame } from "@/components/games/DiceGame";
import { MinesGame } from "@/components/games/MinesGame";
import { TowersGame } from "@/components/games/TowersGame";
import { HiLoGame } from "@/components/games/HiLoGame";
import { RouletteGame } from "@/components/games/RouletteGame";
import { BlackjackGameNew } from "@/components/games/BlackjackGameNew";
import { CrashGame } from "@/components/games/CrashGame";
import { SlotsGame } from "@/components/games/SlotsGame";
import { DogsHouseSlots } from "@/components/games/DogsHouseSlots";
import { CasesGame } from "@/components/games/CasesGame";
import { BalloonGame } from "@/components/games/BalloonGame";
import { PenaltyGame } from "@/components/games/PenaltyGame";
import { CryptoTradingGame } from "@/components/games/CryptoTradingGame";
import { HorseRacingGame } from "@/components/games/HorseRacingGame";
import { ChickenRoadGame } from "@/components/games/ChickenRoadGame";
import { PlinkoGame } from "@/components/games/PlinkoGame";
import { UpgraderGame } from "@/components/games/UpgraderGame";
import { PokerDuelGame } from "@/components/games/PokerDuelGame";
import { Button } from "@/components/ui/button";
import plinkoImg from "@/assets/plinko.webp";
import { useProfile } from "@/hooks/useProfile";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadSupport } from "@/hooks/useUnreadSupport";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { MobileHeader } from "@/components/MobileHeader";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { GamesSection } from "@/components/GamesSection";
import { FloatingOrbs } from "@/components/FloatingOrbs";
import { ArrowLeft } from "lucide-react";

type GameType = "dice" | "mines" | "towers" | "hilo" | "roulette" | "blackjack" | "crash" | "slots" | "dogs-house-slots" | "cases" | "balloon" | "penalty" | "crypto" | "horse-racing" | "chicken-road" | "plinko" | "upgrader" | "poker-duel" | null;

const Index = () => {
  const { user, startParam } = useTelegramAuth();
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<GameType>(null);
  const { profile, isAdmin } = useProfile(user?.id);
  const { useFreebet } = useFreebetMode();
  const { data: unreadCount } = useUnreadMessages(user?.id);
  const { data: unreadSupport } = useUnreadSupport(user?.id);
  const { data: unreadNotifications } = useUnreadNotifications(user?.id);
  const [gameRestrictions, setGameRestrictions] = useState<string[]>([]);
  const [promoApplied, setPromoApplied] = useState(false);

  // Автоматическое применение промокода для существующих пользователей
  useEffect(() => {
    const applyPromocode = async () => {
      if (!user?.id || !startParam || promoApplied) return;
      if (!startParam.startsWith("PROMO_")) return;
      
      const promocode = startParam.replace("PROMO_", "");
      setPromoApplied(true);
      
      const { data, error } = await supabase.rpc("apply_promocode", {
        _user_id: user.id,
        _code: promocode,
      });

      if (!error && data?.[0]?.success) {
        toast.success(data[0].message);
      } else if (data?.[0]?.message) {
        toast.error(data[0].message);
      }
    };

    applyPromocode();
  }, [user?.id, startParam, promoApplied]);

  useEffect(() => {
    const fetchRestrictions = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('user_game_restrictions')
        .select('game_name')
        .eq('user_id', user.id);
      
      if (data) {
        setGameRestrictions(data.map(r => r.game_name));
      }
    };

    fetchRestrictions();
  }, [user?.id]);

  const { data: gameSettings } = useQuery({
    queryKey: ["game-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_settings")
        .select("*");
      return data || [];
    },
    refetchInterval: 5000,
  });

  const handleClose = () => {
    WebApp.close();
  };

  const refreshProfile = async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  const getGameStatus = (gameName: string) => {
    const setting = gameSettings?.find(g => g.game_name === gameName);
    if (!setting) return "active";
    return (setting.is_maintenance || setting.status === "maintenance") ? "maintenance" : "active";
  };

  const games = [
    { type: "crash" as GameType, image: crashImg, title: "Crash", description: "Лети к звёздам и забирай выигрыш", gameName: "crash" },
    { type: "crypto" as GameType, image: cryptoImg, title: "Crypto Trading", description: "Предугадай движение Bitcoin!", gameName: "crypto" },
    { type: "balloon" as GameType, image: balloonImg, title: "Balloon", description: "Надувай шар и рискуй!", gameName: "balloon" },
    { type: "mines" as GameType, image: minesImg, title: "Mines", description: "Найди сокровища, избегая мин", gameName: "mines" },
    { type: "dice" as GameType, image: diceImg, title: "Dice", description: "Угадай число на кубике", gameName: "dice" },
    { type: "blackjack" as GameType, image: blackjackImg, title: "Blackjack", description: "Набери 21 очко и победи", gameName: "blackjack" },
    { type: "penalty" as GameType, image: penaltyImg, title: "Penalty", description: "Забей гол вратарю!", gameName: "penalty" },
    { type: "hilo" as GameType, image: hiloImg, title: "Hi-Lo", description: "Выше или ниже?", gameName: "hilo" },
    { type: "slots" as GameType, image: slotsImg, title: "Sweet Bonanza", description: "Крути барабаны и выигрывай!", gameName: "slots" },
    { type: "dogs-house-slots" as GameType, image: dogsHouseImg, title: "Dogs House", description: "Слоты с собачками!", gameName: "Dogs House" },
    { type: "towers" as GameType, image: towersImg, title: "Towers", description: "Поднимись на вершину башни", gameName: "towers" },
    { type: "roulette" as GameType, image: rouletteImg, title: "Рулетка", description: "Испытай свою удачу!", gameName: "roulette" },
    { type: "cases" as GameType, image: casesImg, title: "Cases", description: "Открой кейсы с призами!", gameName: "cases" },
    { type: "horse-racing" as GameType, image: horseRacingImg, title: "Horse Racing", description: "Скачки! Выбери победителя!", gameName: "horse-racing" },
    { type: "chicken-road" as GameType, image: chickenRoadImg, title: "Chicken Road", description: "Проведи курицу через ловушки!", gameName: "chicken-road" },
    { type: "plinko" as GameType, image: plinkoImg, title: "Plinko", description: "Брось шарик и лови множители!", gameName: "plinko" },
    { type: "upgrader" as GameType, image: casesImg, title: "Upgrader", description: "Апгрейдь скины!", gameName: "upgrader" },
    { type: "poker-duel" as GameType, image: blackjackImg, title: "Poker Duel", description: "PvP покер 1 на 1!", gameName: "poker-duel" },
  ];

  const specialCards = [
    { 
      image: sportsBettingImg, 
      title: "Ставки на спорт", 
      description: "Делай ставки на спортивные события", 
      onClick: () => navigate("/bets"),
      gameName: "bets",
    },
  ];

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <FloatingOrbs />
        <div className="relative z-10">
          <div className="w-20 h-20 rounded-2xl glass-card flex items-center justify-center animate-pulse">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen flex relative">
        <FloatingOrbs />
        
        {/* Desktop Sidebar */}
        <DesktopSidebar
          userId={user?.id}
          profile={profile}
          isAdmin={isAdmin}
          unreadCount={unreadCount}
          unreadSupport={unreadSupport}
          unreadNotifications={unreadNotifications}
          casinoLogo={casinoLogo}
          onClose={handleClose}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-auto relative z-10">
          {/* Mobile Header */}
          <MobileHeader
            userId={user?.id}
            profile={profile}
            isAdmin={isAdmin}
            unreadCount={unreadCount}
            unreadSupport={unreadSupport}
            unreadNotifications={unreadNotifications}
            casinoLogo={casinoLogo}
            onClose={handleClose}
          />

          {/* Main Content Area */}
          <main className="p-4 sm:p-6 max-w-7xl mx-auto">
            {!selectedGame ? (
              <div className="space-y-6">
                {/* Promo Banner */}
                <div className="max-w-2xl mx-auto">
                  <PromoBanner />
                </div>

                {/* Live Stats */}
                <LiveStats />

                {/* Live Winners */}
                <LiveWinners />

                {/* Top Winners */}
                <TopWinners />

                {/* Telegram Promo */}
                <TelegramPromo />

                {/* Games Section */}
                <GamesSection
                  games={games}
                  specialCards={specialCards}
                  gameRestrictions={gameRestrictions}
                  useFreebet={useFreebet}
                  profile={profile}
                  getGameStatus={getGameStatus}
                  onGameSelect={(gameType) => setSelectedGame(gameType as GameType)}
                />
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <Button
                  onClick={() => setSelectedGame(null)}
                  variant="outline"
                  className="mb-6 gap-2 glass border-white/10 hover:border-primary/30 hover:bg-primary/5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Назад к играм
                </Button>
              
                <NetworkGuard gameName={selectedGame || undefined}>
                  {selectedGame === "dice" && (
                    <DiceGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "mines" && (
                    <MinesGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "towers" && (
                    <GameErrorBoundary title="Towers" onReset={() => setSelectedGame(null)}>
                      <TowersGame
                        userId={user!.id}
                        balance={profile?.balance || 0}
                        onBalanceUpdate={refreshProfile}
                      />
                    </GameErrorBoundary>
                  )}
                  
                  {selectedGame === "hilo" && (
                    <HiLoGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "roulette" && (
                    <RouletteGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "blackjack" && profile && (
                    <BlackjackGameNew
                      userId={profile.id}
                      balance={profile.balance}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "crash" && (
                    <GameErrorBoundary title="Crash" onReset={() => setSelectedGame(null)}>
                      <CrashGame />
                    </GameErrorBoundary>
                  )}
                  
                  {selectedGame === "slots" && (
                    <SlotsGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "dogs-house-slots" && (
                    getGameStatus("Dogs House") === "maintenance" ? (
                      <div className="text-center p-8 glass-card rounded-2xl border border-destructive/30">
                        <div className="text-4xl mb-4">🔧</div>
                        <h3 className="text-xl font-bold text-destructive mb-2">Технический перерыв</h3>
                        <p className="text-muted-foreground">Игра временно недоступна</p>
                      </div>
                    ) : (
                      <DogsHouseSlots
                        userId={user!.id}
                        balance={profile?.balance || 0}
                        onBalanceUpdate={refreshProfile}
                      />
                    )
                  )}
                  
                  {selectedGame === "cases" && (
                    <CasesGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "balloon" && (
                    <BalloonGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "penalty" && (
                    <PenaltyGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "crypto" && (
                    <CryptoTradingGame />
                  )}
                  
                  {selectedGame === "horse-racing" && (
                    <HorseRacingGame />
                  )}
                  
                  {selectedGame === "chicken-road" && (
                    <ChickenRoadGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "plinko" && (
                    <PlinkoGame
                      userId={user!.id}
                      balance={profile?.balance || 0}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "upgrader" && (
                    <UpgraderGame
                      userId={user!.id}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                  
                  {selectedGame === "poker-duel" && profile && (
                    <PokerDuelGame
                      visitorId={String(profile.telegram_id)}
                      balance={profile.balance}
                      onBalanceUpdate={refreshProfile}
                    />
                  )}
                </NetworkGuard>
              </div>
            )}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
};

export default Index;
