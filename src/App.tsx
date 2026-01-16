import React, { useEffect, useState, createContext, useContext } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useSnowSettings } from "@/hooks/useSnowSettings";
import { Snowfall } from "@/components/Snowfall";
import { PerformanceProvider } from "@/hooks/usePerformance";

// Snow context
interface SnowContextType {
  isSnowEnabled: boolean;
  toggleSnow: () => void;
}

const SnowContext = createContext<SnowContextType>({ isSnowEnabled: true, toggleSnow: () => {} });
export const useSnowContext = () => useContext(SnowContext);
// Component to handle profile redirect and clear state after navigation
const ProfileRedirect = ({ publicId, onRedirect }: { publicId: string; onRedirect: () => void }) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate(`/player/${publicId}`, { replace: true, state: { fromDeepLink: true } });
    onRedirect();
  }, [publicId, navigate, onRedirect]);
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-dark">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
};

// Network status wrapper component
const NetworkChecker = ({ children }: { children: React.ReactNode }) => {
  const isOnline = useNetworkStatus();
  
  if (!isOnline) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-dark p-6">
        <div className="max-w-md text-center space-y-6">
          <div className="text-6xl">📡</div>
          <h1 className="text-2xl font-bold text-foreground">
            Нет интернет-соединения
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Проверьте подключение к интернету и попробуйте снова.
          </p>
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-red-500 animate-ping" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Giveaways from "./pages/Giveaways";
import Chat from "./pages/Chat";
import Bets from "./pages/Bets";
import MyBets from "./pages/MyBets";
import Deposit from "./pages/Deposit";
import Withdraw from "./pages/Withdraw";
import Support from "./pages/Support";
import Rewards from "./pages/Rewards";
import Referral from "./pages/Referral";
import BettingTournaments from "./pages/BettingTournaments";
import PokerDuel from "./pages/PokerDuel";
import { BanImage } from "@/components/BanImage";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent = () => {
  const { user, loading, isWebBrowser, startParam } = useTelegramAuth();
  const [isBanned, setIsBanned] = useState(false);
  const [profileRedirect, setProfileRedirect] = useState<string | null>(null);
  const [redirectHandled, setRedirectHandled] = useState(false);
  
  // Автопроверка обновлений каждые 30 сек
  useAppUpdate();

  // Check for profile redirect from startParam
  useEffect(() => {
    if (startParam && startParam.startsWith("profile_") && !redirectHandled) {
      const publicId = startParam.replace("profile_", "");
      if (publicId) {
        setProfileRedirect(publicId);
      }
    }
  }, [startParam, redirectHandled]);

  useEffect(() => {
    if (!user?.id) return;

    const checkBanStatus = async () => {
      const { data } = await supabase
        .from("user_moderation")
        .select("is_banned")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsBanned(data?.is_banned || false);
    };

    checkBanStatus();

    // Realtime subscription for ban status
    const channel = supabase
      .channel('ban-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_moderation',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          checkBanStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-dark">
        <div className="relative">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-t-primary border-r-secondary border-b-transparent border-l-transparent shadow-neon-blue"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping"></div>
        </div>
      </div>
    );
  }

  // Show error if opened in web browser or Telegram Web (not native Telegram client)
  if (isWebBrowser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-dark p-6">
        <div className="max-w-md text-center space-y-6">
          <div className="text-6xl">📱</div>
          <h1 className="text-2xl font-bold text-foreground">
            В браузере не получится!
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Откройте наше приложение внутри официального клиента Telegram для полноценного использования. 
            Веб-версия Telegram и браузеры не поддерживаются.
          </p>
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400">
              ⚠️ Telegram Web не поддерживается. Пожалуйста, используйте приложение Telegram на телефоне или компьютере.
            </p>
          </div>
          <div className="pt-4">
            <a 
              href="https://telegram.org/apps" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Скачать Telegram
            </a>
          </div>
        </div>
      </div>
    );
  }

  // If user is banned, show only ban screen
  if (isBanned) {
    return <BanImage userId={user?.id} />;
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            profileRedirect && !redirectHandled ? (
              <ProfileRedirect publicId={profileRedirect} onRedirect={() => { setRedirectHandled(true); setProfileRedirect(null); }} />
            ) : <Index />
          } />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/player/:publicId" element={<PublicProfile />} />
          <Route path="/giveaways" element={<Giveaways />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/bets" element={<Bets />} />
          <Route path="/my-bets" element={<MyBets />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/support" element={<Support />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/betting-tournaments" element={<BettingTournaments />} />
          <Route path="/poker-duel" element={<PokerDuel />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};
const App = () => {
  const { isSnowEnabled, toggleSnow } = useSnowSettings();
  
  return (
    <QueryClientProvider client={queryClient}>
      <PerformanceProvider>
        <SnowContext.Provider value={{ isSnowEnabled, toggleSnow }}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {isSnowEnabled && <Snowfall />}
            <NetworkChecker>
              <AppContent />
            </NetworkChecker>
          </TooltipProvider>
        </SnowContext.Provider>
      </PerformanceProvider>
    </QueryClientProvider>
  );
};

export default App;
