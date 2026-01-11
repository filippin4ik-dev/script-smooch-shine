import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SESSION_KEY = "app_session_token";

export const useSessionManager = (userId: string | null) => {
  const [isSessionValid, setIsSessionValid] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentTokenRef = useRef<string | null>(null);

  // Create or validate session on mount
  const initSession = useCallback(async () => {
    if (!userId) {
      setIsInitialized(true);
      return;
    }

    const existingToken = localStorage.getItem(SESSION_KEY);
    
    if (existingToken) {
      // Validate existing session
      const { data: isValid } = await supabase.rpc('validate_user_session', {
        p_user_id: userId,
        p_session_token: existingToken
      });
      
      if (isValid) {
        currentTokenRef.current = existingToken;
        setIsSessionValid(true);
        setIsInitialized(true);
        return;
      }
    }
    
    // Create new session (this will kick out other devices)
    const deviceInfo = `${navigator.userAgent.slice(0, 100)} | ${new Date().toISOString()}`;
    
    const { data, error } = await supabase.rpc('create_user_session', {
      p_user_id: userId,
      p_device_info: deviceInfo
    });
    
    if (error) {
      console.error("Failed to create session:", error);
      setIsInitialized(true);
      return;
    }
    
    if (data && data.length > 0) {
      const { session_token } = data[0];
      localStorage.setItem(SESSION_KEY, session_token);
      currentTokenRef.current = session_token;
      setIsSessionValid(true);
    }
    
    setIsInitialized(true);
  }, [userId]);

  // Subscribe to session changes (detect if kicked out)
  useEffect(() => {
    if (!userId || !isInitialized) return;

    const sessionToken = localStorage.getItem(SESSION_KEY);
    if (!sessionToken) return;

    channelRef.current = supabase
      .channel(`session-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newSession = payload.new as { session_token: string; is_active: boolean };
          const currentToken = currentTokenRef.current || localStorage.getItem(SESSION_KEY);
          
          // Only show kicked message if session token actually changed (not just last_active_at update)
          // AND the new token is different from ours AND the session is still active (meaning another device took over)
          if (newSession.session_token !== currentToken && newSession.is_active) {
            setIsSessionValid(false);
            localStorage.removeItem(SESSION_KEY);
            currentTokenRef.current = null;
            toast.error("Сессия завершена", {
              description: "Вы вошли с другого устройства",
              duration: 10000
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, isInitialized]);

  // Initialize session
  useEffect(() => {
    initSession();
  }, [initSession]);

  // Periodic session validation (every 60 seconds instead of 30 to reduce load)
  useEffect(() => {
    if (!userId || !isInitialized) return;

    const interval = setInterval(async () => {
      const token = localStorage.getItem(SESSION_KEY);
      if (!token) {
        setIsSessionValid(false);
        return;
      }

      const { data: isValid } = await supabase.rpc('validate_user_session', {
        p_user_id: userId,
        p_session_token: token
      });

      if (!isValid) {
        setIsSessionValid(false);
        localStorage.removeItem(SESSION_KEY);
        currentTokenRef.current = null;
        toast.error("Сессия завершена", {
          description: "Вы вошли с другого устройства",
          duration: 10000
        });
      }
    }, 60000); // Changed to 60 seconds

    return () => clearInterval(interval);
  }, [userId, isInitialized]);

  return { isSessionValid, isInitialized };
};
