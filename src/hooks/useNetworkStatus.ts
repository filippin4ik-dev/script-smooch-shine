import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toastId, setToastId] = useState<string | number | null>(null);

  const showOfflineToast = useCallback(() => {
    if (toastId === null) {
      const id = toast.error("Нет интернет-соединения! Игра приостановлена.", { 
        duration: Infinity,
        id: "network-offline"
      });
      setToastId(id);
    }
  }, [toastId]);

  const dismissOfflineToast = useCallback(() => {
    if (toastId !== null) {
      toast.dismiss("network-offline");
      setToastId(null);
      toast.success("Соединение восстановлено");
    }
  }, [toastId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      dismissOfflineToast();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showOfflineToast();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Периодическая проверка каждые 3 секунды
    const checkConnection = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        await fetch("/favicon.ico", { 
          method: "HEAD",
          cache: "no-store",
          mode: "no-cors",
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!isOnline) {
          setIsOnline(true);
          dismissOfflineToast();
        }
      } catch (error) {
        if (navigator.onLine === false || (error as Error).name === 'AbortError') {
          if (isOnline) {
            setIsOnline(false);
            showOfflineToast();
          }
        }
      }
    }, 3000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(checkConnection);
    };
  }, [isOnline, showOfflineToast, dismissOfflineToast]);

  return isOnline;
};
