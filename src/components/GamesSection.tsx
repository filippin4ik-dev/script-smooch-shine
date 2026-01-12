import { GameCard } from "@/components/GameCard";
import { cn } from "@/lib/utils";
import { Sparkles, Gamepad2, Zap } from "lucide-react";
import { toast } from "sonner";

interface GamesSectionProps {
  games: Array<{
    type: string;
    image: string;
    title: string;
    description: string;
    gameName: string;
  }>;
  specialCards: Array<{
    image: string;
    title: string;
    description: string;
    onClick: () => void;
    gameName: string;
  }>;
  gameRestrictions: string[];
  useFreebet: boolean;
  profile: any;
  getGameStatus: (gameName: string) => string;
  onGameSelect: (gameType: string) => void;
}

export const GamesSection = ({
  games,
  specialCards,
  gameRestrictions,
  useFreebet,
  profile,
  getGameStatus,
  onGameSelect
}: GamesSectionProps) => {
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
    <div className="space-y-6">
      {/* Section header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/20">
          <Gamepad2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Играй и выигрывай</span>
          <Zap className="w-4 h-4 text-primary" />
        </div>
        
        <h2 className="text-3xl sm:text-4xl font-black">
          <span className="gradient-text-premium">
            Популярные игры
          </span>
        </h2>
        
        <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
          Выбери любимую игру и испытай удачу прямо сейчас
        </p>
      </div>
      
      {/* Games grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Special cards first */}
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

        {/* Active games */}
        {activeGames.map((game) => (
          <GameCard
            key={game.type}
            image={game.image}
            title={game.title}
            description={game.description}
            onClick={() => onGameSelect(game.type)}
            status={getGameStatus(game.gameName || game.title) as any}
            showFreebetProgress={useFreebet && (profile?.wager_requirement || 0) > 0}
            wagerProgress={profile?.wager_progress || 0}
            wagerRequirement={profile?.wager_requirement || 0}
          />
        ))}

        {/* Maintenance separator */}
        {maintenanceGames.length > 0 && activeGames.length > 0 && (
          <div className="col-span-full flex items-center gap-4 py-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-destructive/30 to-transparent" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-destructive/20">
              <span className="text-sm text-destructive font-medium">🔧 На техперерыве</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-destructive/30 to-transparent" />
          </div>
        )}

        {/* Maintenance games */}
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
            />
          );
        })}
      </div>
    </div>
  );
};
