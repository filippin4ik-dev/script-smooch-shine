import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";
import { useFreebetMode } from "@/hooks/useFreebetMode";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
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
import casinoLogo from "/casino-logo.png";
import { FreeSpinsReward } from "@/components/FreeSpinsReward";
import { PromoBanner } from "@/components/PromoBanner";
import { LiveStats } from "@/components/LiveStats";
import { TopWinners } from "@/components/TopWinners";
import { LiveWinners } from "@/components/LiveWinners";
import { TelegramPromo } from "@/components/TelegramPromo";
import { NotificationsPanel } from "@/components/NotificationsPanel";
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
import { Button } from "@/components/ui/button";
import plinkoImg from "@/assets/plinko.webp";
import { useProfile } from "@/hooks/useProfile";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadSupport } from "@/hooks/useUnreadSupport";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Home, Trophy, MessageCircle, Settings, X, Wallet, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type GameType = "dice" | "mines" | "towers" | "hilo" | "roulette" | "blackjack" | "crash" | "slots" | "dogs-house-slots" | "cases" | "balloon" | "penalty" | "crypto" | "horse-racing" | "chicken-road" | "plinko" | "upgrader" | null;

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
  const [showBalanceActions, setShowBalanceActions] = useState(false);
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

  // Navigation indicator animation
  useEffect(() => {
    const updateIndicator = () => {
      const container = document.getElementById('nav-buttons');
      const indicator = document.getElementById('nav-indicator');
      if (!container || !indicator) return;

      const buttons = container.querySelectorAll('.nav-button');
      const scrollLeft = container.scrollLeft;
      
      // Find the button that's most visible in the viewport
      let activeButton = buttons[0] as HTMLElement;
      let maxVisibility = 0;
      
      buttons.forEach((btn) => {
        const button = btn as HTMLElement;
        const rect = button.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate how much of the button is visible
        const visibleWidth = Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left);
        const visibility = visibleWidth / rect.width;
        
        if (visibility > maxVisibility) {
          maxVisibility = visibility;
          activeButton = button;
        }
      });
      
      if (activeButton) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        const indicatorLeft = buttonRect.left - containerRect.left + scrollLeft;
        const indicatorWidth = buttonRect.width;
        
        indicator.style.width = `${indicatorWidth}px`;
        indicator.style.marginLeft = `${indicatorLeft}px`;
      }
    };

    const container = document.getElementById('nav-buttons');
    if (container) {
      updateIndicator();
      container.addEventListener('scroll', updateIndicator);
      window.addEventListener('resize', updateIndicator);
      
      return () => {
        container.removeEventListener('scroll', updateIndicator);
        window.removeEventListener('resize', updateIndicator);
      };
    }
  }, []);

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
    // Блокируем игру если включен тех.перерыв ИЛИ статус = maintenance
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-dark">
        <div className="relative">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-t-primary border-r-secondary border-b-transparent border-l-transparent shadow-neon-blue"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping"></div>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-dark flex">
        {/* Sidebar - Desktop only */}
        <aside className="hidden lg:flex flex-col w-64 bg-gradient-to-b from-card/80 via-card/60 to-card/40 backdrop-blur-xl border-r border-primary/30 sticky top-0 h-screen shadow-xl">
          <div className="p-6 border-b border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <img src={casinoLogo} alt="Golden Crown Casino" className="w-14 h-14 rounded-xl shadow-glow" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse border-2 border-background" />
              </div>
              <div>
                <h1 className="text-2xl font-black bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
                  Golden Crown
                </h1>
                <p className="text-xs text-primary/70 uppercase tracking-widest font-bold">Premium Casino</p>
              </div>
            </div>
          </div>

          {/* Balance Card */}
          <div className="p-4 border-b border-primary/20">
            <BalanceDisplay 
              balance={profile?.balance || 0}
              freebetBalance={profile?.freebet_balance || 0}
              demoBalance={(profile as any)?.demo_balance || 0}
              variant="desktop"
              onClick={() => setShowBalanceActions(!showBalanceActions)}
            />
            {showBalanceActions && (
              <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                <Button
                  onClick={() => navigate("/deposit")}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20"
                >
                  <Wallet className="w-5 h-5" />
                  <span>Пополнить</span>
                </Button>
                <Button
                  onClick={() => navigate("/withdraw")}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20"
                >
                  <Wallet className="w-5 h-5" />
                  <span>Вывести</span>
                </Button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {user?.id && (
              <div className="mb-4 flex justify-center">
                <NotificationsPanel userId={user.id} />
              </div>
            )}
            <Button
              onClick={() => navigate("/")}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/30"
            >
              <Home className="w-5 h-5" />
              <span>Главная</span>
            </Button>

            <Button
              onClick={() => navigate("/profile")}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/30"
            >
              <Wallet className="w-5 h-5" />
              <span>Профиль</span>
            </Button>
            

            <Button
              onClick={() => navigate("/giveaways")}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/30"
            >
              <Gift className="w-5 h-5" />
              <span>Розыгрыши</span>
            </Button>
            
            <Button
              onClick={() => navigate("/chat")}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/30 relative"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Чат</span>
              {unreadCount && unreadCount > 0 && (
                <Badge className="ml-auto bg-destructive text-destructive-foreground">
                  {unreadCount}
                </Badge>
              )}
            </Button>

            <Button
              onClick={() => navigate("/rewards")}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/30 relative"
            >
              <Gift className="w-5 h-5" />
              <span>Подарки</span>
              {unreadNotifications && unreadNotifications > 0 && (
                <Badge className="ml-auto bg-destructive text-destructive-foreground">
                  {unreadNotifications}
                </Badge>
              )}
            </Button>

            <Button
              onClick={() => navigate("/support")}
              variant="ghost"
              className="w-full justify-start gap-3 hover:bg-yellow-500/10 hover:text-yellow-500 border border-transparent hover:border-yellow-500/30 relative"
            >
              <Settings className="w-5 h-5" />
              <span>Поддержка</span>
              {unreadSupport && unreadSupport > 0 && (
                <Badge className="ml-auto bg-destructive text-destructive-foreground">
                  {unreadSupport}
                </Badge>
              )}
            </Button>
            
            {isAdmin && (
              <Button
                onClick={() => navigate("/admin")}
                variant="ghost"
                className="w-full justify-start gap-3 hover:bg-secondary/10 hover:text-secondary border border-transparent hover:border-secondary/30"
              >
                <Settings className="w-5 h-5" />
                <span>Админка</span>
              </Button>
            )}
          </nav>

          {/* Close button */}
          <div className="p-4 border-t border-primary/20">
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full border-destructive/30 hover:border-destructive hover:bg-destructive/10"
            >
              <X className="w-5 h-5 mr-2" />
              Закрыть
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Mobile Header */}
          <header className="lg:hidden border-b border-primary/30 bg-gradient-to-r from-card/90 via-card/80 to-card/90 backdrop-blur-xl sticky top-0 z-50 shadow-lg">
            <div className="px-3 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <img src={casinoLogo} alt="Golden Crown Casino" className="w-11 h-11 rounded-xl shadow-glow" />
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse border-2 border-background" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
                      Golden Crown
                    </h1>
                    <p className="text-[10px] text-primary/60 uppercase tracking-wider font-bold">Premium Casino</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {user?.id && <NotificationsPanel userId={user.id} />}
                  <BalanceDisplay
                    balance={profile?.balance || 0}
                    freebetBalance={profile?.freebet_balance || 0}
                    demoBalance={(profile as any)?.demo_balance || 0}
                    variant="mobile"
                    onClick={() => {
                      const menu = document.getElementById('mobile-balance-menu');
                      if (menu) menu.classList.toggle('hidden');
                    }}
                  />
                </div>
              </div>

              {/* Mobile Balance Menu */}
              <div id="mobile-balance-menu" className="hidden absolute top-full right-3 mt-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="bg-card border border-primary/30 rounded-lg shadow-2xl p-2 space-y-2 min-w-[140px]">
                  <Button
                    onClick={() => navigate("/deposit")}
                    size="sm"
                    className="w-full justify-start gap-2 bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20"
                  >
                    💰 Пополнить
                  </Button>
                  <Button
                    onClick={() => navigate("/withdraw")}
                    size="sm"
                    className="w-full justify-start gap-2 bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20"
                  >
                    💸 Вывести
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 scroll-smooth" id="nav-buttons">
                  <Button onClick={() => navigate("/profile")} size="sm" variant="outline" className="whitespace-nowrap border-primary/30 hover:bg-primary/10 nav-button" data-nav="profile">
                    👤 Профиль
                  </Button>
                  <Button onClick={() => navigate("/giveaways")} size="sm" variant="outline" className="whitespace-nowrap border-primary/30 hover:bg-primary/10 nav-button" data-nav="giveaways">
                    🎁 Розыгрыши
                  </Button>
                  <Button onClick={() => navigate("/chat")} size="sm" variant="outline" className="whitespace-nowrap border-primary/30 hover:bg-primary/10 relative nav-button" data-nav="chat">
                    💬 Чат
                    {unreadCount && unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] bg-destructive text-destructive-foreground">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </Button>
                  <Button onClick={() => navigate("/rewards")} size="sm" variant="outline" className="relative whitespace-nowrap border-primary/30 text-primary hover:bg-primary/10 nav-button" data-nav="rewards">
                    🎁 Подарки
                    {unreadNotifications && unreadNotifications > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] bg-destructive text-destructive-foreground">
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </Badge>
                    )}
                  </Button>
                  <Button onClick={() => navigate("/support")} size="sm" variant="outline" className="relative whitespace-nowrap border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 nav-button" data-nav="support">
                    🛠️ Поддержка
                    {unreadSupport && unreadSupport > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] bg-destructive text-destructive-foreground">
                        {unreadSupport > 99 ? '99+' : unreadSupport}
                      </Badge>
                    )}
                  </Button>
                  {isAdmin && (
                    <Button onClick={() => navigate("/admin")} size="sm" variant="outline" className="whitespace-nowrap border-secondary/30 hover:bg-secondary/10 nav-button" data-nav="admin">
                      ⚙️ Админ
                    </Button>
                  )}
                  <Button onClick={handleClose} size="sm" variant="outline" className="whitespace-nowrap border-destructive/30 hover:bg-destructive/10 nav-button" data-nav="close">
                    ❌ Выйти
                  </Button>
                </div>
                {/* Animated indicator line */}
                <div className="h-1 bg-gradient-to-r from-primary via-secondary to-primary rounded-full transition-all duration-300 shadow-neon-blue" style={{ width: '80px', marginLeft: '0px' }} id="nav-indicator"></div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="p-3 sm:p-6 max-w-7xl mx-auto">
            {!selectedGame ? (
              <div className="space-y-4 sm:space-y-6">
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
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl sm:text-4xl font-black">
                      <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
                        🎮 Популярные игры
                      </span>
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground/80">Выбери игру и начни выигрывать прямо сейчас!</p>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {specialCards.map((card, index) => (
                      <GameCard
                        key={`special-${index}`}
                        image={card.image}
                        title={card.title}
                        description={card.description}
                        onClick={card.onClick}
                        status={getGameStatus(card.gameName) as any}
                      />
                    ))}
                    {(() => {
                      const sortedGames = [...games].sort((a, b) => {
                        const aRestricted = gameRestrictions.includes(a.gameName || a.title);
                        const bRestricted = gameRestrictions.includes(b.gameName || b.title);
                        const aStatus = aRestricted ? "maintenance" : getGameStatus(a.gameName || a.title);
                        const bStatus = bRestricted ? "maintenance" : getGameStatus(b.gameName || b.title);
                        if (aStatus === "maintenance" && bStatus !== "maintenance") return 1;
                        if (aStatus !== "maintenance" && bStatus === "maintenance") return -1;
                        return 0;
                      });
                      
                      const activeGames = sortedGames.filter((g) => {
                        const isRestricted = gameRestrictions.includes(g.gameName || g.title);
                        const status = isRestricted ? "maintenance" : getGameStatus(g.gameName || g.title);
                        return status !== "maintenance";
                      });
                      
                      const maintenanceGames = sortedGames.filter((g) => {
                        const isRestricted = gameRestrictions.includes(g.gameName || g.title);
                        const status = isRestricted ? "maintenance" : getGameStatus(g.gameName || g.title);
                        return status === "maintenance";
                      });
                      
                      return (
                        <>
                          {activeGames.map((game) => (
                            <GameCard
                              key={game.type}
                              image={game.image}
                              title={game.title}
                              description={game.description}
                              onClick={() => setSelectedGame(game.type)}
                              status={getGameStatus(game.gameName || game.title) as any}
                              showFreebetProgress={useFreebet && (profile?.wager_requirement || 0) > 0}
                              wagerProgress={profile?.wager_progress || 0}
                              wagerRequirement={profile?.wager_requirement || 0}
                            />
                          ))}
                          
                          
                          {maintenanceGames.length > 0 && activeGames.length > 0 && (
                            <div className="col-span-full flex items-center gap-4 py-4">
                              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />
                              <span className="text-sm text-destructive font-medium px-4">🔧 На техперерыве</span>
                              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-destructive/50 to-transparent" />
                            </div>
                          )}
                          
                          {maintenanceGames.map((game) => {
                            const isRestricted = gameRestrictions.includes(game.gameName || game.title);
                            return (
                              <GameCard
                                key={game.type}
                                image={game.image}
                                title={game.title}
                                description={game.description}
                                onClick={() => {
                                  if (isRestricted) {
                                    toast.error("Доступ запрещен", {
                                      description: "Эта игра заблокирована для вашего аккаунта",
                                    });
                                    return;
                                  }
                                  toast.error("Игра на техперерыве");
                                }}
                                status="maintenance"
                                showFreebetProgress={false}
                                wagerProgress={0}
                                wagerRequirement={0}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">
                <Button
                  onClick={() => setSelectedGame(null)}
                  variant="outline"
                  className="mb-4 sm:mb-6 border-primary/30 hover:border-primary hover:bg-primary/10 hover:shadow-neon-blue transition-all"
                >
                  ← Назад к играм
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
                  <div className="text-center p-8 bg-card rounded-lg border border-destructive/30">
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
