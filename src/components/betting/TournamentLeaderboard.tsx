import { cn } from "@/lib/utils";
import { Crown, Medal, Award, Users, Zap, TrendingUp, Flame } from "lucide-react";
import { GRADIENT_COLORS, GradientColor } from "@/components/VipUsername";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  is_vip?: boolean;
  level?: number;
  gradient_color?: GradientColor;
  total_wins: number;
  total_bets: number;
  biggest_win: number;
  rank: number;
}

interface TournamentLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  currentUserId?: string;
  isLoading?: boolean;
}

// Animated username with shimmer effect
const AnimatedUsername = ({ 
  username, 
  isVip, 
  gradientColor = "gold",
  isHighlighted = false,
  size = "default"
}: { 
  username: string; 
  isVip?: boolean; 
  gradientColor?: GradientColor;
  isHighlighted?: boolean;
  size?: "small" | "default" | "large";
}) => {
  const colorClass = GRADIENT_COLORS[gradientColor] || GRADIENT_COLORS.gold;
  const sizeClass = size === "large" ? "text-base font-bold" : size === "small" ? "text-xs" : "text-sm font-semibold";

  if (isVip || isHighlighted) {
    return (
      <span 
        className={cn(
          "bg-gradient-to-r bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]",
          colorClass,
          sizeClass
        )}
        style={{ animationDuration: "2s" }}
      >
        {username}
      </span>
    );
  }

  return <span className={cn("text-foreground", sizeClass)}>{username}</span>;
};

// Podium for top 3
const PodiumItem = ({ 
  player, 
  position, 
  isCurrentUser 
}: { 
  player: LeaderboardEntry | null; 
  position: 1 | 2 | 3;
  isCurrentUser: boolean;
}) => {
  if (!player) return null;

  const configs = {
    1: {
      order: "order-2",
      icon: Crown,
      iconColor: "text-yellow-400",
      bgGradient: "from-yellow-500/25 via-amber-500/15 to-yellow-600/10",
      borderColor: "border-yellow-500/50",
      labelColor: "text-yellow-400",
      iconBg: "bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600",
      shadow: "shadow-yellow-500/40",
      scale: "scale-105",
      size: "w-14 h-14",
      iconSize: "w-7 h-7",
      mt: "-mt-3",
    },
    2: {
      order: "order-1",
      icon: Medal,
      iconColor: "text-slate-300",
      bgGradient: "from-slate-400/20 via-slate-500/10 to-slate-400/5",
      borderColor: "border-slate-400/40",
      labelColor: "text-slate-300",
      iconBg: "bg-gradient-to-br from-slate-300 to-slate-500",
      shadow: "shadow-slate-400/30",
      scale: "",
      size: "w-11 h-11",
      iconSize: "w-5 h-5",
      mt: "mt-2",
    },
    3: {
      order: "order-3",
      icon: Award,
      iconColor: "text-amber-600",
      bgGradient: "from-amber-600/20 via-orange-500/10 to-amber-600/5",
      borderColor: "border-amber-600/40",
      labelColor: "text-amber-600",
      iconBg: "bg-gradient-to-br from-amber-600 to-orange-700",
      shadow: "shadow-amber-600/30",
      scale: "",
      size: "w-11 h-11",
      iconSize: "w-5 h-5",
      mt: "mt-4",
    },
  };

  const config = configs[position];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex flex-col items-center p-3 sm:p-4 rounded-2xl border-2 transition-all duration-300",
      `bg-gradient-to-b ${config.bgGradient}`,
      config.borderColor,
      config.order,
      config.scale,
      config.mt,
      isCurrentUser && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
    )}>
      {/* Icon */}
      <div className={cn(
        "rounded-full flex items-center justify-center mb-2 shadow-lg",
        config.size,
        config.iconBg,
        config.shadow
      )}>
        <Icon className={cn(config.iconSize, "text-white drop-shadow-md")} />
      </div>

      {/* Rank label */}
      <div className={cn("text-xs font-bold mb-1.5", config.labelColor)}>
        #{position}
      </div>

      {/* Username with animation */}
      <div className="text-center max-w-[85px] sm:max-w-[100px] truncate">
        <AnimatedUsername
          username={player.username}
          isVip={player.is_vip}
          gradientColor={player.gradient_color}
          isHighlighted={isCurrentUser}
          size={position === 1 ? "large" : "small"}
        />
      </div>

      {/* Wins amount */}
      <div className={cn(
        "font-bold mt-1.5",
        config.labelColor,
        position === 1 ? "text-lg" : "text-base"
      )}>
        {Number(player.total_wins || 0).toFixed(0)}₽
      </div>

      {/* Bets count */}
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {player.total_bets} ставок
      </div>
    </div>
  );
};

// Single leaderboard row
const LeaderboardRow = ({
  player,
  isCurrentUser,
}: {
  player: LeaderboardEntry;
  isCurrentUser: boolean;
}) => {
  const rank = Number(player.rank);

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all duration-200",
        isCurrentUser
          ? "bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-primary/50 shadow-lg shadow-primary/10"
          : "bg-card/50 border-border/40 hover:bg-card/70 hover:border-border/60"
      )}
    >
      {/* Rank badge */}
      <div className={cn(
        "w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0",
        isCurrentUser 
          ? "bg-primary/25 text-primary border border-primary/40" 
          : "bg-muted/60 text-muted-foreground"
      )}>
        #{rank}
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <AnimatedUsername
          username={player.username}
          isVip={player.is_vip}
          gradientColor={player.gradient_color}
          isHighlighted={isCurrentUser}
        />
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span>{player.total_bets} ставок</span>
          {player.biggest_win > 0 && (
            <>
              <span className="opacity-50">•</span>
              <span className="text-amber-500/80 flex items-center gap-0.5">
                <Flame className="w-2.5 h-2.5" />
                {Number(player.biggest_win).toFixed(0)}₽
              </span>
            </>
          )}
        </div>
      </div>

      {/* Wins */}
      <div className="text-right shrink-0">
        <div className={cn(
          "font-bold text-sm sm:text-base",
          isCurrentUser ? "text-primary" : "text-green-500"
        )}>
          {Number(player.total_wins).toFixed(0)}₽
        </div>
      </div>
    </div>
  );
};

export const TournamentLeaderboard = ({
  leaderboard,
  currentUserId,
  isLoading,
}: TournamentLeaderboardProps) => {
  const myRank = leaderboard?.find((l) => l.user_id === currentUserId);
  const myRankIndex = leaderboard?.findIndex((l) => l.user_id === currentUserId);
  const top3 = leaderboard?.slice(0, 3) || [];
  const rest = leaderboard?.slice(3, 10) || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Podium skeleton */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="h-36 rounded-2xl bg-muted/30 animate-pulse order-1" />
          <div className="h-40 rounded-2xl bg-muted/30 animate-pulse order-0 -mt-2" />
          <div className="h-32 rounded-2xl bg-muted/30 animate-pulse order-2 mt-2" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="text-center py-10 rounded-2xl bg-gradient-to-b from-muted/30 to-muted/10 border border-dashed border-border/50">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/40 mb-4">
          <Users className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="font-semibold text-muted-foreground text-lg">Пока нет участников</p>
        <p className="text-sm text-muted-foreground/70 mt-1.5">Сделай выигрышную ставку первым!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* My rank indicator */}
      {myRank && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary">Твоё место: #{myRank.rank}</span>
          <span className="text-sm text-primary/70">• {Number(myRank.total_wins).toFixed(0)}₽</span>
        </div>
      )}

      {/* Top 3 Podium */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
          <PodiumItem
            player={top3[1]}
            position={2}
            isCurrentUser={top3[1]?.user_id === currentUserId}
          />
          <PodiumItem
            player={top3[0]}
            position={1}
            isCurrentUser={top3[0]?.user_id === currentUserId}
          />
          <PodiumItem
            player={top3[2]}
            position={3}
            isCurrentUser={top3[2]?.user_id === currentUserId}
          />
        </div>
      )}

      {/* If less than 3 players, show them in list */}
      {top3.length > 0 && top3.length < 3 && (
        <div className="space-y-2">
          {top3.map((player) => (
            <LeaderboardRow
              key={player.user_id}
              player={player}
              isCurrentUser={player.user_id === currentUserId}
            />
          ))}
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((player) => (
            <LeaderboardRow
              key={player.user_id}
              player={player}
              isCurrentUser={player.user_id === currentUserId}
            />
          ))}
        </div>
      )}

      {/* Current user if not in top 10 */}
      {currentUserId && myRankIndex !== undefined && myRankIndex >= 10 && myRank && (
        <>
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="w-12 border-t border-dashed border-border/50" />
            <span className="text-xs text-muted-foreground">•••</span>
            <div className="w-12 border-t border-dashed border-border/50" />
          </div>
          <LeaderboardRow
            player={myRank}
            isCurrentUser={true}
          />
        </>
      )}
    </div>
  );
};
