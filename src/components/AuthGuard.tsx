import { ReactNode, useState, useEffect, useCallback } from "react";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";
import { UsernameDialog } from "./UsernameDialog";
import { useSessionManager } from "@/hooks/useSessionManager";
import { SessionKickedDialog } from "./SessionKickedDialog";

export const useAuth = () => {
  return useTelegramAuth();
};

export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { user, loading, startParam } = useTelegramAuth();
  const [needsUsername, setNeedsUsername] = useState(false);
  
  // Session management - only one device allowed
  const { isSessionValid, isInitialized } = useSessionManager(user?.id || null);

  useEffect(() => {
    if (!loading && user && !user.hasProfile) {
      setNeedsUsername(true);
    } else {
      setNeedsUsername(false);
    }
  }, [loading, user]);

  const handleProfileCreated = (profileId: string, username: string) => {
    if (user) {
      localStorage.setItem('demo_user_id', profileId);
      window.location.reload();
    }
  };

  const handleReconnect = useCallback(() => {
    // Force reload to create new session (kicks out other device)
    window.location.reload();
  }, []);

  if (loading || !isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-dark">
        <div className="relative">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-t-primary border-r-secondary border-b-transparent border-l-transparent shadow-neon-blue"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping"></div>
        </div>
      </div>
    );
  }

  // Show dialog if session was kicked out
  if (user && !isSessionValid) {
    return <SessionKickedDialog open={true} onReconnect={handleReconnect} />;
  }

  if (needsUsername && user) {
    return <UsernameDialog telegramId={user.telegramId} initialReferralCode={startParam || ""} onProfileCreated={handleProfileCreated} />;
  }

  return <>{children}</>;
};