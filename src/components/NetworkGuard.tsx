import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff, Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface NetworkGuardProps {
  children: ReactNode;
  gameName?: string;
}

export const NetworkGuard = ({ children, gameName }: NetworkGuardProps) => {
  const isOnline = useNetworkStatus();

  if (!isOnline) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-[100] flex items-center justify-center">
        <div className="text-center space-y-6 p-8 max-w-md">
          <div className="relative">
            <WifiOff className="w-20 h-20 text-red-500 mx-auto animate-pulse" />
            <div className="absolute inset-0 w-20 h-20 mx-auto bg-red-500/20 rounded-full animate-ping" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Нет соединения</h2>
            <p className="text-gray-400">
              Интернет-соединение потеряно. Игра приостановлена до восстановления связи.
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-amber-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Ожидание подключения...</span>
          </div>
          
          {gameName && (
            <p className="text-xs text-gray-500">
              Прогресс в игре "{gameName}" сохранён
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
