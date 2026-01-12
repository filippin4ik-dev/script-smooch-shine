import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { cn } from "@/lib/utils";
import { 
  User, 
  Gift, 
  MessageCircle, 
  HeadphonesIcon,
  Settings,
  X,
  Crown,
  Trophy
} from "lucide-react";

interface MobileHeaderProps {
  userId?: string;
  profile: any;
  isAdmin: boolean;
  unreadCount?: number;
  unreadSupport?: number;
  unreadNotifications?: number;
  casinoLogo: string;
  onClose: () => void;
}

export const MobileHeader = ({
  userId,
  profile,
  isAdmin,
  unreadCount,
  unreadSupport,
  unreadNotifications,
  casinoLogo,
  onClose
}: MobileHeaderProps) => {
  const navigate = useNavigate();

  const navItems = [
    { 
      icon: User, 
      label: "Профиль", 
      route: "/profile",
      gradient: "from-primary to-amber-400"
    },
    { 
      icon: Trophy, 
      label: "Розыгрыши", 
      route: "/giveaways",
      gradient: "from-purple-500 to-pink-500"
    },
    { 
      icon: MessageCircle, 
      label: "Чат", 
      route: "/chat",
      badge: unreadCount,
      gradient: "from-blue-500 to-cyan-400"
    },
    { 
      icon: Gift, 
      label: "Подарки", 
      route: "/rewards",
      badge: unreadNotifications,
      gradient: "from-emerald-500 to-teal-400"
    },
    { 
      icon: HeadphonesIcon, 
      label: "Поддержка", 
      route: "/support",
      badge: unreadSupport,
      gradient: "from-amber-500 to-orange-500"
    },
  ];

  return (
    <header className="lg:hidden glass-strong border-b border-white/5 sticky top-0 z-50">
      <div className="px-4 py-3">
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-xl blur-lg animate-pulse" />
              <img 
                src={casinoLogo} 
                alt="Casino" 
                className="relative w-11 h-11 rounded-xl shadow-lg"
              />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full border-2 border-background animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black gradient-text-gold flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-primary" />
                Golden Crown
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                Premium Casino
              </p>
            </div>
          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-2">
            {userId && <NotificationsPanel userId={userId} />}
            <BalanceDisplay
              balance={profile?.balance || 0}
              freebetBalance={profile?.freebet_balance || 0}
              demoBalance={profile?.demo_balance || 0}
              variant="mobile"
              onClick={() => navigate("/deposit")}
            />
          </div>
        </div>

        {/* Navigation pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {navItems.map((item) => (
            <Button
              key={item.route}
              onClick={() => navigate(item.route)}
              size="sm"
              className={cn(
                "relative shrink-0 gap-1.5",
                "glass border border-white/10 hover:border-white/20",
                "bg-transparent hover:bg-white/5",
                "text-muted-foreground hover:text-foreground",
                "transition-all duration-300"
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px] bg-destructive border-0">
                  {item.badge > 99 ? '99+' : item.badge}
                </Badge>
              )}
            </Button>
          ))}
          
          {isAdmin && (
            <Button
              onClick={() => navigate("/admin")}
              size="sm"
              className="shrink-0 gap-1.5 glass border border-secondary/30 hover:border-secondary/50 bg-secondary/10 hover:bg-secondary/20 text-secondary"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Админ</span>
            </Button>
          )}
          
          <Button
            onClick={onClose}
            size="sm"
            className="shrink-0 gap-1.5 glass border border-destructive/30 hover:border-destructive/50 bg-destructive/10 hover:bg-destructive/20 text-destructive"
          >
            <X className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Выход</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
