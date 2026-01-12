import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { cn } from "@/lib/utils";
import { 
  Home, 
  User, 
  Gift, 
  MessageCircle, 
  HeadphonesIcon,
  Settings,
  X,
  Crown,
  Wallet,
  ArrowDownToLine,
  Trophy
} from "lucide-react";

interface DesktopSidebarProps {
  userId?: string;
  profile: any;
  isAdmin: boolean;
  unreadCount?: number;
  unreadSupport?: number;
  unreadNotifications?: number;
  casinoLogo: string;
  onClose: () => void;
}

export const DesktopSidebar = ({
  userId,
  profile,
  isAdmin,
  unreadCount,
  unreadSupport,
  unreadNotifications,
  casinoLogo,
  onClose
}: DesktopSidebarProps) => {
  const navigate = useNavigate();

  const mainNavItems = [
    { icon: Home, label: "Главная", route: "/" },
    { icon: User, label: "Профиль", route: "/profile" },
    { icon: Trophy, label: "Розыгрыши", route: "/giveaways" },
    { icon: MessageCircle, label: "Чат", route: "/chat", badge: unreadCount },
    { icon: Gift, label: "Подарки", route: "/rewards", badge: unreadNotifications },
    { icon: HeadphonesIcon, label: "Поддержка", route: "/support", badge: unreadSupport },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 glass-strong border-r border-white/5 sticky top-0 h-screen">
      {/* Logo section */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/40 rounded-xl blur-xl animate-pulse" />
            <img 
              src={casinoLogo} 
              alt="Casino" 
              className="relative w-14 h-14 rounded-xl shadow-lg"
            />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full border-2 border-background animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black gradient-text-gold flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Golden Crown
            </h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              Premium Casino
            </p>
          </div>
        </div>
      </div>

      {/* Balance section */}
      <div className="p-4 border-b border-white/5">
        <BalanceDisplay 
          balance={profile?.balance || 0}
          freebetBalance={profile?.freebet_balance || 0}
          demoBalance={profile?.demo_balance || 0}
          variant="desktop"
        />
        
        <div className="flex gap-2 mt-3">
          <Button
            onClick={() => navigate("/deposit")}
            size="sm"
            className="flex-1 gap-1.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white border-0 shadow-[0_0_20px_hsl(142_76%_46%/0.3)]"
          >
            <Wallet className="w-4 h-4" />
            Пополнить
          </Button>
          <Button
            onClick={() => navigate("/withdraw")}
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 border-white/10 hover:border-primary/30 hover:bg-primary/5"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Вывести
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {userId && (
        <div className="p-4 border-b border-white/5 flex justify-center">
          <NotificationsPanel userId={userId} />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
        {mainNavItems.map((item) => (
          <Button
            key={item.route}
            onClick={() => navigate(item.route)}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-white/5 hover:border-white/10",
              "border border-transparent",
              "transition-all duration-300",
              "group"
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
              <item.icon className="w-4 h-4 group-hover:text-primary transition-colors" />
            </div>
            <span className="font-medium">{item.label}</span>
            {item.badge && item.badge > 0 && (
              <Badge className="ml-auto bg-destructive text-destructive-foreground border-0">
                {item.badge > 99 ? '99+' : item.badge}
              </Badge>
            )}
          </Button>
        ))}
        
        {isAdmin && (
          <Button
            onClick={() => navigate("/admin")}
            variant="ghost"
            className="w-full justify-start gap-3 text-secondary hover:text-secondary hover:bg-secondary/10 border border-transparent hover:border-secondary/20"
          >
            <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <span className="font-medium">Админка</span>
          </Button>
        )}
      </nav>

      {/* Close button */}
      <div className="p-4 border-t border-white/5">
        <Button
          onClick={onClose}
          variant="outline"
          className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
        >
          <X className="w-4 h-4" />
          Закрыть приложение
        </Button>
      </div>
    </aside>
  );
};
