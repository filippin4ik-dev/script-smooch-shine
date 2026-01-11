import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { supabase } from "@/integrations/supabase/client";

export interface TelegramUser {
  id: string | null;
  telegramId: number;
  username: string | null;
  firstName?: string;
  lastName?: string;
  hasProfile: boolean;
}

export interface TelegramAuthResult {
  user: TelegramUser | null;
  loading: boolean;
  isWebBrowser: boolean;
  startParam: string | null;
}

export const useTelegramAuth = (): TelegramAuthResult => {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWebBrowser, setIsWebBrowser] = useState(false);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    const initTelegramUser = async () => {
      try {
        // Expand the Telegram Web App
        WebApp.expand();
        
        // Get Telegram user data
        const tgUser = WebApp.initDataUnsafe?.user;
        
        // Get start_param (referral code from link)
        const tgStartParam = WebApp.initDataUnsafe?.start_param;
        if (tgStartParam) {
          setStartParam(tgStartParam);
        }
        
        // Check if opened in Telegram Web (not native client)
        const platform = WebApp.platform;
        // "tdesktop", "android", "ios", "macos" are native clients
        // "web", "weba", "webk" are web versions
        const isNativeClient = platform === "tdesktop" || platform === "android" || platform === "ios" || platform === "macos";
        
        if (!tgUser?.id || !isNativeClient) {
          // NOT in native Telegram client - show error
          setIsWebBrowser(true);
          setLoading(false);
          return;
        }

        // For real Telegram users - check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, username, telegram_id')
          .eq('telegram_id', tgUser.id)
          .single();

        if (existingProfile) {
          // Use existing profile
          // Сохраняем ID в localStorage для проверки фрибета
          localStorage.setItem("current_user_id", existingProfile.id);
          
          setUser({
            id: existingProfile.id,
            telegramId: existingProfile.telegram_id,
            username: existingProfile.username,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name,
            hasProfile: true,
          });
        } else {
          // DON'T create profile, just set telegram data
          setUser({
            id: null,
            telegramId: tgUser.id,
            username: null,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name,
            hasProfile: false,
          });
        }
      } catch (error) {
        console.error("Error initializing Telegram user:", error);
      } finally {
        setLoading(false);
      }
    };

    initTelegramUser();
  }, []);

  return { user, loading, isWebBrowser, startParam };
};
